import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { resolveAiPolicy } from '@/lib/ai-permissions';
import { MOCK_TASKS } from '@/lib/fixtures/tasks';
import { getStaffOnDuty } from '@/lib/fixtures/staff';
import { CHARGES } from '@/lib/fixtures/charges';
import { CONSENT_FORMS } from '@/lib/fixtures/consent-forms';

/**
 * GET /api/me/activity
 *
 * Returns the current user's profile, AI policy, and an activity feed
 * partitioned into:
 *   - current: tasks the user is actively working on
 *   - pending: tasks assigned but not started
 *   - completed: recently finished tasks
 *
 * In production this reads from Temporal workflows + audit log + task
 * service. For now we infer from local fixtures using the user's name.
 */
export async function GET() {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const policy = resolveAiPolicy({
    email: session.email,
    professionalRole: session.professionalRole,
  });

  // Try to find the staff record matching the logged-in user
  const onDuty = getStaffOnDuty();
  const staffRecord = onDuty.find(
    (s) => s.name.toLowerCase() === session.userName.toLowerCase(),
  );

  // Tasks are filtered by assignee match — fall back to whatever role-tagged
  // tasks exist if we can't find an exact assignee match.
  const isMatch = (assignee: string) => {
    const a = assignee.toLowerCase();
    if (a.includes(session.userName.toLowerCase())) return true;
    if (session.professionalRole === 'medical_staff_attending' && a.includes('médic')) return true;
    if (session.professionalRole === 'nurse' && a.includes('enferm')) return true;
    if (session.professionalRole === 'pharmacist_clinical' && a.includes('farm')) return true;
    if (session.professionalRole === 'case_manager' && a.includes('planejador')) return true;
    return false;
  };

  const userTasks = MOCK_TASKS.filter((t) => isMatch(t.assignedTo));

  // Map our 3 statuses to a "current / pending / completed" frame.
  // 'in-progress' → current, 'open' → pending, 'deferred' → completed-ish
  const current = userTasks.filter((t) => t.status === 'in-progress');
  const pending = userTasks.filter((t) => t.status === 'open');
  const completed = userTasks.filter((t) => t.status === 'deferred');

  // Recent administrative work for billing roles
  const userCharges =
    session.professionalRole === 'billing_authorization' ||
    session.professionalRole === 'admin_system'
      ? CHARGES.slice(0, 5)
      : [];

  // Recent consents needing signature for clinical roles
  const userConsents =
    session.professionalRole === 'medical_staff_attending' ||
    session.professionalRole === 'medical_staff_on_call'
      ? CONSENT_FORMS.filter((c) => c.status === 'active').slice(0, 5)
      : [];

  return NextResponse.json({
    authenticated: true,
    profile: {
      userId: session.userId,
      userName: session.userName,
      email: session.email,
      role: session.role,
      professionalRole: session.professionalRole,
      setor: session.setor,
      conselhoProfissional: session.conselhoProfissional,
      loginTime: session.loginTime,
      lastActivity: session.lastActivity,
      isBreakGlass: session.isBreakGlass,
    },
    onDuty: staffRecord
      ? {
          ward: staffRecord.ward,
          shift: staffRecord.shift,
          shiftStart: staffRecord.shiftStart,
          shiftEnd: staffRecord.shiftEnd,
          presence: staffRecord.presence,
          assignedPatientMrns: staffRecord.assignedPatientMrns,
          contactExtension: staffRecord.contactExtension,
        }
      : null,
    aiPolicy: {
      label: policy.label,
      capabilityCount: policy.capabilities.length,
      maxRequestsPerHour: policy.maxRequestsPerHour,
    },
    activity: {
      current: current.map((t) => ({
        id: t.id,
        description: t.description,
        priority: t.priority,
        patient: t.patient,
        mrn: t.mrn,
        dueIn: t.dueIn,
        type: t.type,
      })),
      pending: pending.map((t) => ({
        id: t.id,
        description: t.description,
        priority: t.priority,
        patient: t.patient,
        mrn: t.mrn,
        dueIn: t.dueIn,
        type: t.type,
      })),
      completed: completed.map((t) => ({
        id: t.id,
        description: t.description,
        patient: t.patient,
        mrn: t.mrn,
        type: t.type,
      })),
    },
    charges: userCharges.map((c) => ({
      id: c.id,
      description: c.description,
      totalPrice: c.totalPrice,
      status: c.status,
    })),
    consents: userConsents.map((c) => ({
      id: c.id,
      patientMrn: c.patientMrn,
      type: c.type,
      signedAt: c.signedAt,
    })),
  });
}
