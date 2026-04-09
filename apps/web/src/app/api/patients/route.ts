import { NextRequest, NextResponse } from 'next/server';
import { appendEvent, getEvents } from '@/lib/event-store';
import { audit } from '@/lib/audit-logger';
import { getSessionFromRequest } from '@/lib/auth-session';

// ---------------------------------------------------------------------------
// FHIR-inspired Patient resource structure
// ---------------------------------------------------------------------------

interface PatientResource {
  resourceType: 'Patient';
  mrn: string;
  active: boolean;
  name: {
    given: string;
    family: string;
    full: string;
  };
  cpf: string;
  rg?: string;
  birthDate: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  maritalStatus?: string;
  motherName: string;
  nationality?: string;
  birthPlace?: string;
  address?: {
    postalCode?: string;
    line?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
  };
  telecom: {
    phone: string;
    phoneSecondary?: string;
    email?: string;
  };
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  insurance: {
    type: 'SUS' | 'Convenio' | 'Particular';
    provider?: string;
    cardNumber?: string;
    expiryDate?: string;
  };
  clinicalData: {
    allergies: string[];
    continuousMedications: string[];
    comorbidities: string[];
    bloodType?: string;
    weight?: number;
    height?: number;
  };
  admission: {
    origin: string;
    reason: string;
    cidPrimary?: string;
    responsiblePhysician: string;
    ward: string;
    bed: string;
    priority: 'Normal' | 'Urgente' | 'Emergencia';
    admissionDateTime: string;
  };
  createdAt: string;
  createdBy: string;
}

// ---------------------------------------------------------------------------
// MRN Generator
// ---------------------------------------------------------------------------

function generateMrn(): string {
  const num = Date.now() % 100000;
  return `MRN-${String(num).padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// POST — Create Patient
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest();
    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    const body = await request.json();

    // Required field validation
    const required = [
      'nomeCompleto', 'cpf', 'dataNascimento', 'sexo', 'nomeMae',
      'telefonePrincipal', 'contatoEmergenciaNome', 'contatoEmergenciaParentesco',
      'contatoEmergenciaTelefone', 'motivoInternacao', 'medicoResponsavel',
      'unidadeInternacao', 'leito',
    ];

    const missing = required.filter((f) => !body[f]?.toString().trim());
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Campos obrigatorios faltando: ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    const mrn = generateMrn();
    const nameParts = body.nomeCompleto.trim().split(' ');
    const given = nameParts[0] || '';
    const family = nameParts.slice(1).join(' ') || '';

    const patient: PatientResource = {
      resourceType: 'Patient',
      mrn,
      active: true,
      name: { given, family, full: body.nomeCompleto.trim() },
      cpf: body.cpf,
      rg: body.rg || undefined,
      birthDate: body.dataNascimento,
      gender: body.sexo,
      maritalStatus: body.estadoCivil || undefined,
      motherName: body.nomeMae,
      nationality: body.nacionalidade || undefined,
      birthPlace: body.naturalidade || undefined,
      address: {
        postalCode: body.cep || undefined,
        line: body.rua || undefined,
        number: body.numero || undefined,
        complement: body.complemento || undefined,
        district: body.bairro || undefined,
        city: body.cidade || undefined,
        state: body.estado || undefined,
      },
      telecom: {
        phone: body.telefonePrincipal,
        phoneSecondary: body.telefoneSecundario || undefined,
        email: body.email || undefined,
      },
      emergencyContact: {
        name: body.contatoEmergenciaNome,
        relationship: body.contatoEmergenciaParentesco,
        phone: body.contatoEmergenciaTelefone,
      },
      insurance: {
        type: body.tipoPlano || 'SUS',
        provider: body.operadora || undefined,
        cardNumber: body.numeroCarteirinha || undefined,
        expiryDate: body.validadeCarteirinha || undefined,
      },
      clinicalData: {
        allergies: body.alergias || [],
        continuousMedications: body.medicacoesContinuas || [],
        comorbidities: body.comorbidades || [],
        bloodType: body.tipoSanguineo || undefined,
        weight: body.peso ? parseFloat(body.peso) : undefined,
        height: body.altura ? parseFloat(body.altura) : undefined,
      },
      admission: {
        origin: body.origem || 'Pronto Atendimento',
        reason: body.motivoInternacao,
        cidPrimary: body.cidPrincipal || undefined,
        responsiblePhysician: body.medicoResponsavel,
        ward: body.unidadeInternacao,
        bed: body.leito,
        priority: body.prioridade || 'Normal',
        admissionDateTime: body.dataHoraAdmissao || new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      createdBy: `${session.userName} (${session.role})`,
    };

    // Save to event store
    const stored = appendEvent('patient', {
      timestamp: new Date().toISOString(),
      source: 'web-patient-admission',
      type: 'patient',
      severity: 'info',
      data: patient as unknown as Record<string, unknown>,
    });

    // Create admission event in timeline
    appendEvent('patient-event', {
      timestamp: new Date().toISOString(),
      source: 'web-patient-admission',
      type: 'patient-event',
      severity: 'info',
      data: {
        patientId: mrn,
        category: 'admissao',
        title: `Admissao hospitalar — ${patient.admission.origin}`,
        description: `Paciente ${patient.name.full} admitido(a). Motivo: ${patient.admission.reason}. Leito ${patient.admission.bed}, ${patient.admission.ward}. Medico: ${patient.admission.responsiblePhysician}. Prioridade: ${patient.admission.priority}.`,
        timestamp: patient.admission.admissionDateTime,
        location: patient.admission.ward,
        priority: patient.admission.priority === 'Emergencia' ? 'critico' : patient.admission.priority === 'Urgente' ? 'urgente' : 'normal',
        author: session.userName,
        role: session.role,
      },
    });

    // Audit trail
    audit({
      category: 'frontend',
      action: 'patient_created',
      description: `Paciente ${patient.name.full} (${mrn}) admitido por ${session.userName}`,
      actor: `${session.userName} (${session.role})`,
      resource: `patient:${mrn}`,
      result: 'success',
      details: {
        mrn,
        patientName: patient.name.full,
        ward: patient.admission.ward,
        bed: patient.admission.bed,
        priority: patient.admission.priority,
        eventId: stored.id,
      },
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: 'velya-web',
      requestPath: '/api/patients',
      requestMethod: 'POST',
    });

    return NextResponse.json({
      success: true,
      mrn,
      patient,
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar paciente:', error);
    audit({
      category: 'frontend',
      action: 'patient_created',
      description: 'Falha ao criar paciente',
      actor: 'unknown',
      resource: 'patient:unknown',
      result: 'error',
    });
    return NextResponse.json({ error: 'Erro interno ao criar paciente' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET — List Patients
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest();
    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    const { events } = getEvents('patient', { limit: 10000 });

    const patients = events.map((e) => {
      const data = e.data as unknown as PatientResource;
      return {
        mrn: data.mrn,
        name: data.name?.full || 'Desconhecido',
        age: data.birthDate
          ? Math.floor((Date.now() - new Date(data.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : 0,
        ward: data.admission?.ward || '--',
        bed: data.admission?.bed || '--',
        diagnosis: data.admission?.reason || '--',
        admissionDate: data.admission?.admissionDateTime?.split('T')[0] || '--',
        consultant: data.admission?.responsiblePhysician || '--',
        priority: data.admission?.priority || 'Normal',
        createdAt: data.createdAt,
      };
    });

    audit({
      category: 'frontend',
      action: 'patients_listed',
      description: `Lista de pacientes consultada por ${session.userName}`,
      actor: `${session.userName} (${session.role})`,
      resource: 'patients:all',
      result: 'info',
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: 'velya-web',
      requestPath: '/api/patients',
      requestMethod: 'GET',
    });

    return NextResponse.json({ patients, total: patients.length });
  } catch (error) {
    console.error('Erro ao listar pacientes:', error);
    return NextResponse.json({ error: 'Erro interno ao listar pacientes' }, { status: 500 });
  }
}
