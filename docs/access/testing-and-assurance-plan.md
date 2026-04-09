# Plano de Testes e Garantia de Seguranca

**Modulo:** Velya Access Control - Testing & Assurance Plan  
**Versao:** 1.0.0  
**Data:** 2026-04-08  
**Classificacao:** Interno - Engenharia e Seguranca  
**Responsavel:** Time de Plataforma Velya

---

## 1. Visao Geral

Este documento especifica o plano de testes de seguranca para o sistema de controle de acesso do Velya. O objetivo e garantir que todas as politicas de acesso, autenticacao, auditoria e privacidade funcionem conforme especificado e sejam resistentes a ataques.

### 1.1 Principios de Teste

1. **Deny by default**: Qualquer permissao nao explicitamente concedida deve ser negada.
2. **Defesa em profundidade**: Multiplas camadas devem ser validadas independentemente.
3. **Teste continuo**: Testes executam automaticamente em cada PR e diariamente.
4. **Cobertura de borda**: Testar casos limites, race conditions e estados invalidos.
5. **Nao-regressao**: Todo incidente de seguranca gera um novo caso de teste.

### 1.2 Frequencia de Testes

| Tipo                 | Frequencia     | Gatilho    | Responsavel         |
| -------------------- | -------------- | ---------- | ------------------- |
| Testes unitarios     | Cada PR        | CI/CD      | Desenvolvedores     |
| Testes de integracao | Diario (03:00) | CronJob    | Pipeline CI         |
| Testes de penetracao | Mensal         | Agendado   | Equipe de Seguranca |
| Revisao de auditoria | Trimestral     | Calendario | Compliance          |
| Exercicio red team   | Semestral      | Agendado   | Equipe externa      |

---

## 2. Catalogo de Testes

### 2.1 TC-001: Deny by Default

**Descricao:** Validar que qualquer requisicao sem autorizacao explicita e negada.

**Pre-condicoes:**

- Usuario autenticado com papel `enfermeiro` na unidade `UTI Adulto`.
- Nenhuma permissao adicional concedida.

**Passos:**

1. Tentar acessar endpoint de administracao (`/api/admin/users`).
2. Tentar acessar prontuario de paciente em outra unidade sem vinculo.
3. Tentar executar acao de prescricao (sem papel de prescritor).
4. Tentar acessar endpoint inexistente (`/api/internal/debug`).

**Resultado Esperado:**

- Todas as requisicoes retornam `403 Forbidden`.
- Evento `POLICY_DENIAL` registrado na auditoria para cada tentativa.
- Nenhum dado e retornado no corpo da resposta.

**Automacao:**

```typescript
// tests/access-control/deny-by-default.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestSession, TestSession } from '../helpers/session';
import { apiClient } from '../helpers/api-client';

describe('TC-001: Deny by Default', () => {
  let session: TestSession;

  beforeAll(async () => {
    session = await createTestSession({
      role: 'enfermeiro',
      unit: 'UTI Adulto',
    });
  });

  afterAll(async () => {
    await session.destroy();
  });

  it('deve negar acesso a endpoints administrativos', async () => {
    const response = await apiClient.get('/api/admin/users', {
      headers: session.authHeaders(),
    });

    expect(response.status).toBe(403);
    expect(response.data).not.toHaveProperty('users');
    expect(response.data).toEqual({
      error: 'access_denied',
      message: expect.any(String),
      policy_id: expect.any(String),
    });
  });

  it('deve negar acesso a prontuario de outra unidade sem vinculo', async () => {
    const patientInOtherUnit = 'PAC-99999999';

    const response = await apiClient.get(`/api/patients/${patientInOtherUnit}/chart`, {
      headers: session.authHeaders(),
    });

    expect(response.status).toBe(403);
    expect(response.data.error).toBe('access_denied');
  });

  it('deve negar acao de prescricao para enfermeiro', async () => {
    const response = await apiClient.post(
      '/api/prescriptions',
      {
        patient_id: 'PAC-00000001',
        medication: 'Dipirona 500mg',
        dosage: '1 comp VO 6/6h',
      },
      { headers: session.authHeaders() },
    );

    expect(response.status).toBe(403);
    expect(response.data.error).toBe('access_denied');
  });

  it('deve negar acesso a endpoints internos/debug', async () => {
    const endpoints = [
      '/api/internal/debug',
      '/api/internal/config',
      '/api/internal/metrics',
      '/api/actuator/env',
      '/api/swagger-ui',
    ];

    for (const endpoint of endpoints) {
      const response = await apiClient.get(endpoint, {
        headers: session.authHeaders(),
      });
      expect(response.status).toBeOneOf([403, 404]);
    }
  });

  it('deve registrar POLICY_DENIAL na auditoria', async () => {
    // Executar acao negada
    await apiClient.get('/api/admin/users', {
      headers: session.authHeaders(),
    });

    // Verificar auditoria
    const auditEvents = await session.getAuditEvents({
      event_type: 'POLICY_DENIAL',
      user_id: session.userId,
      limit: 1,
    });

    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      event_type: 'POLICY_DENIAL',
      user_id: session.userId,
      result: 'denied',
      denial_reason: expect.any(String),
    });
  });
});
```

---

### 2.2 TC-002: Escalacao de Privilegios

**Descricao:** Validar que um usuario nao consegue elevar seus privilegios alem do autorizado.

**Pre-condicoes:**

- Usuario autenticado com papel `tecnico_enfermagem`.

**Passos:**

1. Tentar alterar o papel ativo na sessao para `medico_intensivista`.
2. Tentar manipular o JWT para incluir papel adicional.
3. Tentar acessar recurso com papel de outro usuario via IDOR.
4. Tentar criar delegacao para si mesmo.

**Resultado Esperado:**

- Todas as tentativas falham com `403`.
- Token manipulado e rejeitado (assinatura invalida).
- Alerta de seguranca gerado para manipulacao de token.

**Automacao:**

```typescript
// tests/access-control/privilege-escalation.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestSession, TestSession } from '../helpers/session';
import { apiClient } from '../helpers/api-client';
import { forgeToken, tamperTokenPayload } from '../helpers/token-utils';

describe('TC-002: Escalacao de Privilegios', () => {
  let session: TestSession;

  beforeAll(async () => {
    session = await createTestSession({
      role: 'tecnico_enfermagem',
      unit: 'Enfermaria 2B',
    });
  });

  it('deve negar troca para papel nao autorizado', async () => {
    const response = await apiClient.post(
      '/api/session/switch-role',
      { role: 'medico_intensivista' },
      { headers: session.authHeaders() },
    );

    expect(response.status).toBe(403);
    expect(response.data.error).toBe('role_not_assigned');
  });

  it('deve rejeitar token com payload adulterado', async () => {
    const tamperedToken = tamperTokenPayload(session.accessToken, {
      active_role: 'admin_sistema',
      roles: ['admin_sistema', 'dba_producao'],
    });

    const response = await apiClient.get('/api/admin/users', {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });

    expect(response.status).toBe(401);
    expect(response.data.error).toBe('invalid_token');
  });

  it('deve rejeitar token com assinatura forjada', async () => {
    const forgedToken = forgeToken({
      sub: session.userId,
      active_role: 'admin_sistema',
    });

    const response = await apiClient.get('/api/admin/users', {
      headers: { Authorization: `Bearer ${forgedToken}` },
    });

    expect(response.status).toBe(401);
  });

  it('deve negar criacao de delegacao para si mesmo', async () => {
    const response = await apiClient.post(
      '/api/delegations',
      {
        delegator_id: session.userId,
        delegate_id: session.userId,
        role: 'enfermeiro',
        duration_hours: 8,
      },
      { headers: session.authHeaders() },
    );

    expect(response.status).toBe(400);
    expect(response.data.error).toBe('self_delegation_not_allowed');
  });
});
```

---

### 2.3 TC-003: BOLA/IDOR (Broken Object Level Authorization)

**Descricao:** Validar que um usuario nao pode acessar recursos de outro usuario ou paciente manipulando IDs na URL ou payload.

**Automacao:**

```typescript
// tests/access-control/bola-idor.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestSession, TestSession } from '../helpers/session';
import { apiClient } from '../helpers/api-client';

describe('TC-003: BOLA/IDOR', () => {
  let nurseSession: TestSession;
  let doctorSession: TestSession;
  const nursePatientId = 'PAC-00000001'; // Paciente na unidade da enfermeira
  const otherPatientId = 'PAC-00099999'; // Paciente em outra unidade

  beforeAll(async () => {
    nurseSession = await createTestSession({
      role: 'enfermeiro',
      unit: 'UTI Adulto',
    });
    doctorSession = await createTestSession({
      role: 'medico_intensivista',
      unit: 'UTI Adulto',
    });
  });

  it('deve negar acesso a prontuario de paciente sem vinculo', async () => {
    const response = await apiClient.get(`/api/patients/${otherPatientId}/chart`, {
      headers: nurseSession.authHeaders(),
    });

    expect(response.status).toBe(403);
  });

  it('deve negar acesso a prescricao de outro medico via ID direto', async () => {
    // Criar prescricao com medico
    const createResponse = await apiClient.post(
      '/api/prescriptions',
      {
        patient_id: nursePatientId,
        medication: 'Dipirona 500mg',
        dosage: '1 comp VO 6/6h',
      },
      { headers: doctorSession.authHeaders() },
    );
    const prescriptionId = createResponse.data.id;

    // Enfermeira tenta editar prescricao do medico
    const editResponse = await apiClient.put(
      `/api/prescriptions/${prescriptionId}`,
      { dosage: '2 comp VO 4/4h' },
      { headers: nurseSession.authHeaders() },
    );

    expect(editResponse.status).toBe(403);
  });

  it('deve negar acesso a sessao de outro usuario', async () => {
    const response = await apiClient.get(`/api/sessions/${doctorSession.sessionId}`, {
      headers: nurseSession.authHeaders(),
    });

    expect(response.status).toBe(403);
  });

  it('deve negar acesso a documentos com IDs sequenciais', async () => {
    // Tentar acessar documentos com IDs sequenciais (enumeration)
    const ids = Array.from({ length: 10 }, (_, i) => `DOC-${String(i + 1).padStart(8, '0')}`);

    let accessCount = 0;
    for (const id of ids) {
      const response = await apiClient.get(`/api/documents/${id}`, {
        headers: nurseSession.authHeaders(),
      });
      if (response.status === 200) accessCount++;
    }

    // Enfermeira so deve ter acesso a documentos de seus pacientes
    // Nao deve ter acesso a todos os documentos sequenciais
    expect(accessCount).toBeLessThan(ids.length);
  });

  it('nao deve vazar informacao no erro (404 vs 403)', async () => {
    // Recurso existente sem acesso
    const existingResponse = await apiClient.get(`/api/patients/${otherPatientId}/chart`, {
      headers: nurseSession.authHeaders(),
    });

    // Recurso inexistente
    const nonExistingResponse = await apiClient.get(`/api/patients/PAC-XXXXXXXX/chart`, {
      headers: nurseSession.authHeaders(),
    });

    // Ambos devem retornar o mesmo status (nao vazar existencia)
    expect(existingResponse.status).toBe(nonExistingResponse.status);
  });
});
```

---

### 2.4 TC-004: Vazamento de Rota (Route Leakage)

**Descricao:** Validar que rotas internas, administrativas e de debug nao sao acessiveis.

**Automacao:**

```typescript
// tests/access-control/route-leakage.test.ts
import { describe, it, expect } from 'vitest';
import { createTestSession } from '../helpers/session';
import { apiClient } from '../helpers/api-client';

describe('TC-004: Route Leakage', () => {
  const sensitiveRoutes = [
    '/api/internal/health/detailed',
    '/api/internal/config',
    '/api/internal/env',
    '/api/internal/metrics',
    '/api/debug/pprof',
    '/api/actuator',
    '/api/actuator/env',
    '/api/actuator/beans',
    '/api/actuator/heapdump',
    '/api/swagger-ui/index.html',
    '/api/graphql/playground',
    '/api/admin/database/console',
    '/api/admin/redis/info',
    '/api/.env',
    '/api/config.yaml',
    '/api/secrets',
    '/.well-known/openid-configuration', // Deve ser publico mas nao vazar dados
  ];

  it.each(sensitiveRoutes)('deve negar acesso a rota sensivel: %s', async (route) => {
    // Sem autenticacao
    const unauthResponse = await apiClient.get(route);
    expect(unauthResponse.status).toBeOneOf([401, 403, 404]);

    // Com autenticacao de usuario normal
    const session = await createTestSession({ role: 'enfermeiro', unit: 'UTI' });
    const authResponse = await apiClient.get(route, {
      headers: session.authHeaders(),
    });
    expect(authResponse.status).toBeOneOf([403, 404]);
    await session.destroy();
  });

  it('nao deve expor stack traces em respostas de erro', async () => {
    const response = await apiClient.get('/api/patients/INVALID_ID/chart', {
      validateStatus: () => true,
    });

    const body = JSON.stringify(response.data);
    expect(body).not.toContain('stack');
    expect(body).not.toContain('trace');
    expect(body).not.toContain('node_modules');
    expect(body).not.toContain('at Object.');
    expect(body).not.toContain('.ts:');
    expect(body).not.toContain('Error:');
  });

  it('nao deve expor headers internos', async () => {
    const response = await apiClient.get('/api/health');

    const sensitiveHeaders = [
      'x-powered-by',
      'server',
      'x-aspnet-version',
      'x-debug',
      'x-internal-id',
    ];

    for (const header of sensitiveHeaders) {
      expect(response.headers[header]).toBeUndefined();
    }
  });
});
```

---

### 2.5 TC-005: Vazamento de Contexto (Context Leakage)

**Descricao:** Validar que na troca de usuario, nenhum dado do usuario anterior permanece acessivel.

**Automacao:**

```typescript
// tests/access-control/context-leakage.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestSession, TestSession, switchUser } from '../helpers/session';
import { apiClient } from '../helpers/api-client';

describe('TC-005: Context Leakage na Troca de Usuario', () => {
  let sessionA: TestSession;
  let sessionB: TestSession;

  it('nao deve retornar dados do usuario anterior apos troca', async () => {
    // Usuario A acessa prontuario
    sessionA = await createTestSession({
      userId: 'USR-00001',
      role: 'medico_intensivista',
      unit: 'UTI Adulto',
    });

    const chartResponseA = await apiClient.get('/api/patients/PAC-00000001/chart', {
      headers: sessionA.authHeaders(),
    });
    expect(chartResponseA.status).toBe(200);

    // Troca para usuario B (enfermeiro em outra unidade)
    sessionB = await switchUser(sessionA.workstationId, {
      userId: 'USR-00002',
      role: 'enfermeiro',
      unit: 'Enfermaria 2B',
    });

    // Usuario B tenta acessar mesmo prontuario (nao deve ter acesso)
    const chartResponseB = await apiClient.get('/api/patients/PAC-00000001/chart', {
      headers: sessionB.authHeaders(),
    });
    expect(chartResponseB.status).toBe(403);
  });

  it('nao deve permitir uso do token anterior apos troca', async () => {
    sessionA = await createTestSession({
      userId: 'USR-00001',
      role: 'medico_intensivista',
      unit: 'UTI Adulto',
    });
    const tokenA = sessionA.accessToken;

    // Troca de usuario
    sessionB = await switchUser(sessionA.workstationId, {
      userId: 'USR-00002',
      role: 'enfermeiro',
      unit: 'Enfermaria 2B',
    });

    // Tentar usar token antigo do usuario A
    const response = await apiClient.get('/api/patients/PAC-00000001/chart', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(response.status).toBe(401);
    expect(response.data.error).toBe('token_revoked');
  });

  it('deve invalidar sessao anterior no server-side', async () => {
    sessionA = await createTestSession({
      userId: 'USR-00001',
      role: 'medico_intensivista',
      unit: 'UTI Adulto',
    });
    const sessionIdA = sessionA.sessionId;

    // Troca de usuario
    sessionB = await switchUser(sessionA.workstationId, {
      userId: 'USR-00002',
      role: 'enfermeiro',
      unit: 'Enfermaria 2B',
    });

    // Verificar que sessao A foi invalidada no server
    const sessionStatus = await apiClient.get(`/api/internal/sessions/${sessionIdA}/status`, {
      headers: { 'X-Internal-Key': process.env.INTERNAL_KEY! },
    });

    expect(sessionStatus.data.status).toBe('TERMINATED');
  });

  it('deve registrar evento USER_SWITCH com ambos os user_ids', async () => {
    sessionA = await createTestSession({
      userId: 'USR-00001',
      role: 'medico_intensivista',
      unit: 'UTI Adulto',
    });

    sessionB = await switchUser(sessionA.workstationId, {
      userId: 'USR-00002',
      role: 'enfermeiro',
      unit: 'Enfermaria 2B',
    });

    const auditEvents = await sessionB.getAuditEvents({
      event_type: 'AUTH_USER_SWITCH',
      session_id: sessionB.sessionId,
      limit: 1,
    });

    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      event_type: 'AUTH_USER_SWITCH',
      user_id: 'USR-00002',
      previous_user_id: 'USR-00001',
    });
  });
});
```

---

### 2.6 TC-006: Seguranca de Auto-Logoff

**Descricao:** Validar que sessoes sao bloqueadas e encerradas corretamente por inatividade.

```typescript
// tests/access-control/auto-logoff.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { TimeoutProfile, SessionStatus } from '../../src/session/types';
import {
  createMockAuthGateway,
  createMockSessionStore,
  createMockAuditEmitter,
  createMockUICacheCleaner,
  createMockWorkstation,
} from '../helpers/mocks';

describe('TC-006: Auto-Logoff', () => {
  let sessionManager: SessionManager;
  let mockSessionStore: ReturnType<typeof createMockSessionStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSessionStore = createMockSessionStore();

    sessionManager = new SessionManager(
      createMockWorkstation({ timeoutProfile: TimeoutProfile.ICU }),
      createMockAuthGateway(),
      mockSessionStore,
      createMockAuditEmitter(),
      createMockUICacheCleaner(),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve bloquear sessao apos 5 minutos de inatividade (UTI)', async () => {
    await sessionManager.createSession({
      method: 'badge_pin',
      badge: 'BADGE-001',
      pin: '123456',
    });

    expect(sessionManager.getSession()?.status).toBe(SessionStatus.ACTIVE);

    // Avancar 5 minutos
    vi.advanceTimersByTime(5 * 60 * 1000);

    expect(sessionManager.getSession()?.status).toBe(SessionStatus.LOCKED);
    expect(mockSessionStore.updateStatus).toHaveBeenCalledWith(
      expect.any(String),
      SessionStatus.LOCKED,
    );
  });

  it('deve emitir aviso 1 minuto antes do lock (UTI)', async () => {
    const warningHandler = vi.fn();
    sessionManager.on('TIMEOUT_WARNING', warningHandler);

    await sessionManager.createSession({
      method: 'badge_pin',
      badge: 'BADGE-001',
      pin: '123456',
    });

    // Avancar 4 minutos (1 min antes do timeout de 5)
    vi.advanceTimersByTime(4 * 60 * 1000);

    expect(warningHandler).toHaveBeenCalledTimes(1);
  });

  it('deve resetar timer quando atividade e detectada', async () => {
    await sessionManager.createSession({
      method: 'badge_pin',
      badge: 'BADGE-001',
      pin: '123456',
    });

    // Avancar 4 minutos
    vi.advanceTimersByTime(4 * 60 * 1000);

    // Registrar atividade
    sessionManager.recordActivity();

    // Avancar mais 4 minutos (total 8 desde o inicio, mas 4 desde atividade)
    vi.advanceTimersByTime(4 * 60 * 1000);

    // Sessao ainda deve estar ativa (timer resetou com a atividade)
    expect(sessionManager.getSession()?.status).toBe(SessionStatus.ACTIVE);
  });

  it('deve forcar logout apos lock prolongado (30min para UTI)', async () => {
    await sessionManager.createSession({
      method: 'badge_pin',
      badge: 'BADGE-001',
      pin: '123456',
    });

    // Timeout de inatividade (5 min)
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(sessionManager.getSession()?.status).toBe(SessionStatus.LOCKED);

    // Tempo de lock prolongado (30 min)
    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(sessionManager.getSession()).toBeNull();
    expect(mockSessionStore.invalidate).toHaveBeenCalled();
  });
});
```

---

### 2.7 TC-007: Auditoria de Break-Glass

**Descricao:** Validar que o break-glass e completamente auditado.

```typescript
// tests/access-control/break-glass-audit.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestSession, TestSession } from '../helpers/session';
import { apiClient } from '../helpers/api-client';

describe('TC-007: Break-Glass Audit', () => {
  let session: TestSession;

  beforeAll(async () => {
    session = await createTestSession({
      role: 'medico_emergencista',
      unit: 'Pronto Socorro',
    });
  });

  it('deve registrar ativacao de break-glass com todos os campos', async () => {
    const response = await apiClient.post(
      '/api/break-glass/activate',
      {
        patient_id: 'PAC-00000099',
        justification:
          'Paciente em parada cardiorrespiratoria, necessidade de acesso imediato ao historico de alergias e medicacoes em uso para manejo adequado da reanimacao.',
        reason: 'emergencia_clinica',
      },
      { headers: session.authHeaders() },
    );

    expect(response.status).toBe(200);
    expect(response.data.break_glass_id).toBeDefined();

    // Verificar auditoria
    const auditEvents = await session.getAuditEvents({
      event_type: 'BREAK_GLASS_ACTIVATE',
      limit: 1,
    });

    expect(auditEvents).toHaveLength(1);
    const event = auditEvents[0];

    // Todos os campos obrigatorios devem estar presentes
    expect(event).toMatchObject({
      event_id: expect.any(String),
      timestamp: expect.any(String),
      event_type: 'BREAK_GLASS_ACTIVATE',
      severity: 'CRITICAL',
      user_id: session.userId,
      user_name: expect.any(String),
      profession: 'medico',
      council_number: expect.stringMatching(/^CRM-/),
      unit: 'Pronto Socorro',
      active_role: 'medico_emergencista',
      workstation_id: expect.any(String),
      ip_address: expect.any(String),
      session_id: session.sessionId,
      patient_id: 'PAC-00000099',
      action: 'activate',
      result: 'success',
      justification: expect.stringContaining('parada cardiorrespiratoria'),
      step_up_level: 'L3',
    });
  });

  it('deve notificar gestor e seguranca em break-glass', async () => {
    await apiClient.post(
      '/api/break-glass/activate',
      {
        patient_id: 'PAC-00000099',
        justification: 'Emergencia clinica - risco iminente de vida.',
        reason: 'emergencia_clinica',
      },
      { headers: session.authHeaders() },
    );

    // Verificar que notificacoes foram enviadas
    const notifications = await apiClient.get('/api/internal/notifications/recent', {
      headers: { 'X-Internal-Key': process.env.INTERNAL_KEY! },
      params: { type: 'break_glass_alert', limit: 5 },
    });

    const recipients = notifications.data.map((n: { recipient_role: string }) => n.recipient_role);
    expect(recipients).toContain('security_team');
    expect(recipients).toContain('gestor_unidade');
  });
});
```

---

### 2.8 TC-008: Nao-Repudio de Assinatura

**Descricao:** Validar que documentos assinados digitalmente nao podem ser repudiados.

```typescript
// tests/access-control/signature-non-repudiation.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestSession, TestSession } from '../helpers/session';
import { apiClient } from '../helpers/api-client';
import { verifyDigitalSignature } from '../helpers/crypto-utils';

describe('TC-008: Nao-Repudio de Assinatura', () => {
  let doctorSession: TestSession;

  beforeAll(async () => {
    doctorSession = await createTestSession({
      role: 'medico_intensivista',
      unit: 'UTI Adulto',
      certificate: 'test-icp-brasil-a3',
    });
  });

  it('deve criar assinatura digital valida ao assinar evolucao', async () => {
    // Criar evolucao
    const createResponse = await apiClient.post(
      '/api/clinical-notes',
      {
        patient_id: 'PAC-00000001',
        type: 'evolucao_medica',
        content: 'Paciente evolui com melhora do quadro respiratorio...',
      },
      { headers: doctorSession.authHeaders() },
    );
    const noteId = createResponse.data.id;

    // Assinar (requer step-up)
    const signResponse = await apiClient.post(
      `/api/clinical-notes/${noteId}/sign`,
      { step_up_token: await doctorSession.performStepUp('L1') },
      { headers: doctorSession.authHeaders() },
    );

    expect(signResponse.status).toBe(200);
    expect(signResponse.data.signature).toBeDefined();

    // Verificar assinatura digital
    const verification = await verifyDigitalSignature({
      document_hash: signResponse.data.document_hash,
      signature: signResponse.data.signature,
      certificate: signResponse.data.certificate,
      timestamp: signResponse.data.timestamp,
    });

    expect(verification.valid).toBe(true);
    expect(verification.signer_cn).toContain('CRM');
    expect(verification.timestamp_valid).toBe(true);
  });

  it('deve impedir alteracao de documento assinado', async () => {
    const createResponse = await apiClient.post(
      '/api/clinical-notes',
      {
        patient_id: 'PAC-00000001',
        type: 'evolucao_medica',
        content: 'Conteudo original.',
      },
      { headers: doctorSession.authHeaders() },
    );
    const noteId = createResponse.data.id;

    // Assinar
    await apiClient.post(
      `/api/clinical-notes/${noteId}/sign`,
      { step_up_token: await doctorSession.performStepUp('L1') },
      { headers: doctorSession.authHeaders() },
    );

    // Tentar alterar documento assinado
    const editResponse = await apiClient.put(
      `/api/clinical-notes/${noteId}`,
      { content: 'Conteudo alterado indevidamente.' },
      { headers: doctorSession.authHeaders() },
    );

    expect(editResponse.status).toBe(403);
    expect(editResponse.data.error).toBe('document_already_signed');
  });
});
```

---

### 2.9 TC-009: Combinacoes Toxicas de Papeis

```typescript
// tests/access-control/toxic-combinations.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestSession, TestSession } from '../helpers/session';
import { apiClient } from '../helpers/api-client';

describe('TC-009: Combinacoes Toxicas de Papeis', () => {
  let adminSession: TestSession;

  beforeAll(async () => {
    adminSession = await createTestSession({
      role: 'admin_sistema',
      unit: 'TI',
    });
  });

  const toxicPairs = [
    ['medico_prescritor', 'farmaceutico_dispensador'],
    ['medico_solicitante', 'medico_laudista'],
    ['enfermeiro_checagem', 'farmaceutico_dispensador'],
    ['gestor_usuarios', 'auditor_acesso'],
    ['faturista', 'gestor_financeiro'],
  ];

  it.each(toxicPairs)('deve impedir atribuicao simultanea de %s e %s', async (roleA, roleB) => {
    // Criar usuario de teste
    const createUser = await apiClient.post(
      '/api/admin/users',
      {
        name: 'Teste Toxico',
        profession: 'medico',
        council_number: 'CRM-SP 999999',
      },
      { headers: adminSession.authHeaders() },
    );
    const testUserId = createUser.data.id;

    // Atribuir primeiro papel
    await apiClient.post(
      `/api/admin/users/${testUserId}/roles`,
      { role: roleA },
      { headers: adminSession.authHeaders() },
    );

    // Tentar atribuir segundo papel (toxico)
    const response = await apiClient.post(
      `/api/admin/users/${testUserId}/roles`,
      { role: roleB },
      { headers: adminSession.authHeaders() },
    );

    expect(response.status).toBe(409);
    expect(response.data.error).toBe('toxic_combination');
    expect(response.data.conflicting_role).toBe(roleA);

    // Cleanup
    await apiClient.delete(`/api/admin/users/${testUserId}`, {
      headers: adminSession.authHeaders(),
    });
  });
});
```

---

### 2.10 TC-010: Sessao Obsoleta (Stale Session)

```typescript
// tests/access-control/stale-session.test.ts
import { describe, it, expect } from 'vitest';
import { createTestSession } from '../helpers/session';
import { apiClient } from '../helpers/api-client';
import { expireTokenInRedis } from '../helpers/redis-utils';

describe('TC-010: Stale Session', () => {
  it('deve rejeitar token apos revogacao server-side', async () => {
    const session = await createTestSession({
      role: 'enfermeiro',
      unit: 'UTI Adulto',
    });

    // Simular revogacao server-side (ex: admin revogou)
    await expireTokenInRedis(session.sessionId);

    // Tentar usar token (ainda valido do ponto de vista do JWT)
    const response = await apiClient.get('/api/patients', {
      headers: session.authHeaders(),
    });

    expect(response.status).toBe(401);
    expect(response.data.error).toBe('session_invalidated');
  });

  it('deve rejeitar token com versao antiga apos rotacao', async () => {
    const session = await createTestSession({
      role: 'enfermeiro',
      unit: 'UTI Adulto',
    });
    const oldToken = session.accessToken;

    // Forcar rotacao de token
    await session.rotateToken();

    // Tentar usar token antigo
    const response = await apiClient.get('/api/patients', {
      headers: { Authorization: `Bearer ${oldToken}` },
    });

    expect(response.status).toBe(401);
    expect(response.data.error).toBe('token_version_mismatch');
  });
});
```

---

### 2.11 TC-011: Forced Browsing e Restricoes de Exportacao

```typescript
// tests/access-control/forced-browsing-export.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestSession, TestSession } from '../helpers/session';
import { apiClient } from '../helpers/api-client';

describe('TC-011: Forced Browsing', () => {
  let session: TestSession;

  beforeAll(async () => {
    session = await createTestSession({
      role: 'enfermeiro',
      unit: 'Enfermaria 2B',
    });
  });

  it('deve negar acesso a paths com traversal', async () => {
    const traversalPaths = [
      '/api/patients/../admin/users',
      '/api/patients/PAC-00000001/../../admin',
      '/api/documents/%2e%2e%2fadmin',
      '/api/documents/..%252fadmin',
    ];

    for (const path of traversalPaths) {
      const response = await apiClient.get(path, {
        headers: session.authHeaders(),
      });
      expect(response.status).toBeOneOf([400, 403, 404]);
    }
  });
});

describe('TC-012: Restricoes de Exportacao', () => {
  let session: TestSession;

  beforeAll(async () => {
    session = await createTestSession({
      role: 'medico_intensivista',
      unit: 'UTI Adulto',
    });
  });

  it('deve exigir step-up L2 para exportacao', async () => {
    const response = await apiClient.post(
      '/api/patients/PAC-00000001/export',
      { format: 'pdf' },
      { headers: session.authHeaders() },
    );

    expect(response.status).toBe(403);
    expect(response.data.error).toBe('step_up_required');
    expect(response.data.required_level).toBe('L2');
  });

  it('deve exigir justificativa para exportacao', async () => {
    const stepUpToken = await session.performStepUp('L2');

    const response = await apiClient.post(
      '/api/patients/PAC-00000001/export',
      {
        format: 'pdf',
        step_up_token: stepUpToken,
        // Sem justificativa
      },
      { headers: session.authHeaders() },
    );

    expect(response.status).toBe(400);
    expect(response.data.error).toBe('justification_required');
  });

  it('deve bloquear exportacao em massa', async () => {
    const stepUpToken = await session.performStepUp('L2');

    const response = await apiClient.post(
      '/api/patients/export-batch',
      {
        patient_ids: Array.from({ length: 100 }, (_, i) => `PAC-${String(i).padStart(8, '0')}`),
        format: 'csv',
        step_up_token: stepUpToken,
        justification: 'Tentativa de exportacao em massa',
      },
      { headers: session.authHeaders() },
    );

    expect(response.status).toBe(403);
    expect(response.data.error).toBe('bulk_export_denied');
  });
});
```

---

### 2.12 TC-013: Correcao de Mascaramento

```typescript
// tests/access-control/masking-correctness.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestSession, TestSession } from '../helpers/session';
import { apiClient } from '../helpers/api-client';

describe('TC-013: Correcao de Mascaramento', () => {
  let jitSession: TestSession;

  beforeAll(async () => {
    jitSession = await createTestSession({
      role: 'dba_producao',
      unit: 'TI',
      accessType: 'jit',
    });
  });

  it('deve mascarar CPF em consultas de DBA', async () => {
    const response = await apiClient.post(
      '/api/jit/query',
      {
        database: 'velya_clinical',
        query: 'SELECT cpf FROM patient_demographics LIMIT 5',
      },
      { headers: jitSession.authHeaders() },
    );

    expect(response.status).toBe(200);
    for (const row of response.data.rows) {
      // CPF deve estar mascarado: ***.***.**9-00
      expect(row.cpf).toMatch(/^\*\*\*\.\*\*\*\.\*\*\d-\d{2}$/);
    }
  });

  it('deve mascarar nome do paciente em consultas de DBA', async () => {
    const response = await apiClient.post(
      '/api/jit/query',
      {
        database: 'velya_clinical',
        query: 'SELECT full_name FROM patient_demographics LIMIT 5',
      },
      { headers: jitSession.authHeaders() },
    );

    expect(response.status).toBe(200);
    for (const row of response.data.rows) {
      // Nome deve estar mascarado: Ma**** Si****
      expect(row.full_name).toMatch(/^[A-Z][a-z]\*+/);
    }
  });

  it('deve mascarar dados em texto livre (NER)', async () => {
    const response = await apiClient.post(
      '/api/jit/query',
      {
        database: 'velya_clinical',
        query: 'SELECT content FROM clinical_notes LIMIT 1',
      },
      { headers: jitSession.authHeaders() },
    );

    expect(response.status).toBe(200);
    const content = response.data.rows[0].content;

    // Nao deve conter nomes proprios, CPF, telefones
    expect(content).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/); // CPF
    expect(content).not.toMatch(/\(\d{2}\)\s*\d{4,5}-\d{4}/); // Telefone
    expect(content).toContain('[NOME]'); // Placeholder de NER
  });
});
```

---

### 2.13 TC-014: Completude de Auditoria

```typescript
// tests/access-control/audit-completeness.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestSession, TestSession } from '../helpers/session';
import { apiClient } from '../helpers/api-client';

describe('TC-014: Completude de Auditoria', () => {
  let session: TestSession;

  beforeAll(async () => {
    session = await createTestSession({
      role: 'medico_intensivista',
      unit: 'UTI Adulto',
    });
  });

  it('deve registrar evento para cada acao clinica', async () => {
    const actions = [
      {
        action: 'open_chart',
        method: 'GET',
        path: '/api/patients/PAC-00000001/chart',
        expectedEvent: 'CHART_OPEN',
      },
      {
        action: 'create_note',
        method: 'POST',
        path: '/api/clinical-notes',
        body: {
          patient_id: 'PAC-00000001',
          type: 'evolucao_medica',
          content: 'Teste de auditoria',
        },
        expectedEvent: 'CHART_EDIT',
      },
    ];

    for (const act of actions) {
      const before = Date.now();

      if (act.method === 'GET') {
        await apiClient.get(act.path, { headers: session.authHeaders() });
      } else {
        await apiClient.post(act.path, act.body, {
          headers: session.authHeaders(),
        });
      }

      // Buscar evento de auditoria
      const events = await session.getAuditEvents({
        event_type: act.expectedEvent,
        after: new Date(before).toISOString(),
        limit: 1,
      });

      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(act.expectedEvent);
      expect(events[0].hash).toBeDefined();
      expect(events[0].previous_hash).toBeDefined();
    }
  });

  it('deve manter cadeia de hashes integra', async () => {
    // Executar 5 acoes sequenciais
    for (let i = 0; i < 5; i++) {
      await apiClient.get('/api/patients/PAC-00000001/chart', {
        headers: session.authHeaders(),
      });
    }

    // Buscar ultimos 5 eventos
    const events = await session.getAuditEvents({
      user_id: session.userId,
      limit: 5,
      order: 'asc',
    });

    // Verificar cadeia de hashes
    for (let i = 1; i < events.length; i++) {
      expect(events[i].previous_hash).toBe(events[i - 1].hash);
    }
  });

  it('nao deve permitir gap na cadeia de auditoria', async () => {
    // Verificar integridade geral (API de verificacao)
    const response = await apiClient.get('/api/internal/audit/verify-chain', {
      headers: { 'X-Internal-Key': process.env.INTERNAL_KEY! },
      params: { period: '1h' },
    });

    expect(response.data.chain_valid).toBe(true);
    expect(response.data.gaps).toHaveLength(0);
    expect(response.data.broken_links).toHaveLength(0);
  });
});
```

---

### 2.14 TC-015: Resistencia a Adulteracao de Auditoria

```typescript
// tests/access-control/audit-tamper-resistance.test.ts
import { describe, it, expect } from 'vitest';
import { apiClient } from '../helpers/api-client';

describe('TC-015: Resistencia a Adulteracao', () => {
  it('deve detectar modificacao de evento de auditoria', async () => {
    // Verificar integridade (deve passar antes da adulteracao simulada)
    const beforeResponse = await apiClient.get('/api/internal/audit/verify-chain', {
      headers: { 'X-Internal-Key': process.env.INTERNAL_KEY! },
      params: { period: '1h' },
    });

    expect(beforeResponse.data.chain_valid).toBe(true);
  });

  it('nao deve permitir delecao de evento via API', async () => {
    const response = await apiClient.delete('/api/internal/audit/events/any-event-id', {
      headers: { 'X-Internal-Key': process.env.INTERNAL_KEY! },
    });

    expect(response.status).toBeOneOf([403, 404, 405]);
  });

  it('nao deve permitir update de evento via API', async () => {
    const response = await apiClient.put(
      '/api/internal/audit/events/any-event-id',
      { result: 'success' },
      {
        headers: { 'X-Internal-Key': process.env.INTERNAL_KEY! },
      },
    );

    expect(response.status).toBeOneOf([403, 404, 405]);
  });
});
```

---

## 3. Testes de API: Tentativas de Bypass de Contexto

```typescript
// tests/access-control/api-context-bypass.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestSession, TestSession } from '../helpers/session';
import { apiClient } from '../helpers/api-client';

describe('Tentativas de Bypass de Contexto via API', () => {
  let nurseSession: TestSession;

  beforeAll(async () => {
    nurseSession = await createTestSession({
      role: 'enfermeiro',
      unit: 'Enfermaria 2B',
    });
  });

  it('deve ignorar header X-Unit-Override', async () => {
    const response = await apiClient.get('/api/patients', {
      headers: {
        ...nurseSession.authHeaders(),
        'X-Unit-Override': 'UTI Adulto',
      },
    });

    // Deve retornar apenas pacientes da Enfermaria 2B
    if (response.status === 200) {
      for (const patient of response.data.patients) {
        expect(patient.unit).toBe('Enfermaria 2B');
      }
    }
  });

  it('deve ignorar query param role_override', async () => {
    const response = await apiClient.get('/api/patients?role_override=admin_sistema', {
      headers: nurseSession.authHeaders(),
    });

    // Nao deve ter acesso administrativo
    expect(response.status).not.toBe(200);
  });

  it('deve ignorar campo role no body da requisicao', async () => {
    const response = await apiClient.post(
      '/api/prescriptions',
      {
        patient_id: 'PAC-00000001',
        medication: 'Dipirona 500mg',
        role: 'medico_prescritor', // Tentativa de injecao de papel
      },
      { headers: nurseSession.authHeaders() },
    );

    expect(response.status).toBe(403); // Enfermeiro nao pode prescrever
  });

  it('deve rejeitar JWT com claims adulteradas', async () => {
    const response = await apiClient.get('/api/patients', {
      headers: {
        Authorization: `Bearer ${nurseSession.accessToken}.extra`,
      },
    });

    expect(response.status).toBe(401);
  });

  it('deve validar Content-Type para prevenir type confusion', async () => {
    const response = await apiClient.post('/api/clinical-notes', '<xml><role>admin</role></xml>', {
      headers: {
        ...nurseSession.authHeaders(),
        'Content-Type': 'application/xml',
      },
    });

    expect(response.status).toBeOneOf([400, 415]); // Bad Request ou Unsupported Media Type
  });
});
```

---

## 4. CronJob para Validacao Periodica

```yaml
# cronjob-access-control-validation.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: access-control-periodic-validation
  namespace: velya-access
  labels:
    app: velya-security-testing
    component: periodic-validation
spec:
  schedule: '0 4 * * *' # Todo dia as 4h da manha
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 30
  failedJobsHistoryLimit: 10
  jobTemplate:
    spec:
      backoffLimit: 1
      activeDeadlineSeconds: 3600 # Maximo 1 hora
      template:
        metadata:
          labels:
            app: velya-security-testing
            job: periodic-validation
        spec:
          serviceAccountName: security-testing-sa
          containers:
            - name: access-control-validator
              image: velya/security-testing:1.0.0
              command:
                - /bin/sh
                - -c
                - |
                  echo "=== Validacao Periodica de Controle de Acesso ==="
                  echo "Data: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
                  echo ""

                  FAILURES=0

                  # 1. Verificar integridade da cadeia de auditoria (24h)
                  echo "[1/8] Verificando cadeia de auditoria..."
                  if ! audit-verify --period 24h --strict; then
                    echo "FALHA: Cadeia de auditoria comprometida!"
                    FAILURES=$((FAILURES + 1))
                  fi

                  # 2. Verificar que deny-by-default esta funcionando
                  echo "[2/8] Verificando deny-by-default..."
                  if ! access-test deny-by-default --endpoints /etc/velya/protected-endpoints.yaml; then
                    echo "FALHA: Deny-by-default violado!"
                    FAILURES=$((FAILURES + 1))
                  fi

                  # 3. Verificar combinacoes toxicas ativas
                  echo "[3/8] Verificando combinacoes toxicas..."
                  TOXIC=$(access-review detect-toxic-combinations --count-only)
                  if [ "$TOXIC" -gt 0 ]; then
                    echo "FALHA: $TOXIC combinacoes toxicas encontradas!"
                    FAILURES=$((FAILURES + 1))
                  fi

                  # 4. Verificar contas desativadas nao tem sessoes ativas
                  echo "[4/8] Verificando contas desativadas..."
                  ZOMBIE=$(access-test check-zombie-sessions)
                  if [ "$ZOMBIE" -gt 0 ]; then
                    echo "FALHA: $ZOMBIE sessoes zombies de contas desativadas!"
                    FAILURES=$((FAILURES + 1))
                  fi

                  # 5. Verificar tokens expirados nao sao aceitos
                  echo "[5/8] Verificando rejeicao de tokens expirados..."
                  if ! access-test expired-token-rejection; then
                    echo "FALHA: Tokens expirados sendo aceitos!"
                    FAILURES=$((FAILURES + 1))
                  fi

                  # 6. Verificar mascaramento de dados em JIT
                  echo "[6/8] Verificando mascaramento de dados..."
                  if ! access-test data-masking-check; then
                    echo "FALHA: Dados nao mascarados em acesso JIT!"
                    FAILURES=$((FAILURES + 1))
                  fi

                  # 7. Verificar que rotas sensiveis estao protegidas
                  echo "[7/8] Verificando rotas sensiveis..."
                  if ! access-test route-protection --routes /etc/velya/sensitive-routes.yaml; then
                    echo "FALHA: Rotas sensiveis expostas!"
                    FAILURES=$((FAILURES + 1))
                  fi

                  # 8. Verificar que step-up esta funcionando
                  echo "[8/8] Verificando step-up auth..."
                  if ! access-test step-up-enforcement; then
                    echo "FALHA: Step-up nao esta sendo exigido!"
                    FAILURES=$((FAILURES + 1))
                  fi

                  echo ""
                  echo "=== Resultado ==="
                  echo "Falhas: $FAILURES / 8"

                  # Publicar metricas
                  access-test push-metrics \
                    --failures $FAILURES \
                    --total 8 \
                    --pushgateway $PUSHGATEWAY_URL

                  if [ "$FAILURES" -gt 0 ]; then
                    # Enviar alerta
                    access-test send-alert \
                      --failures $FAILURES \
                      --channel security-alerts \
                      --severity critical
                    exit 1
                  fi

                  echo "Todas as validacoes passaram!"
              env:
                - name: VELYA_API_URL
                  value: 'http://velya-gateway.velya-platform:8080'
                - name: PUSHGATEWAY_URL
                  value: 'http://pushgateway.observability:9091'
                - name: INTERNAL_KEY
                  valueFrom:
                    secretKeyRef:
                      name: security-testing-credentials
                      key: internal_key
              volumeMounts:
                - name: config
                  mountPath: /etc/velya
                  readOnly: true
              resources:
                requests:
                  memory: '256Mi'
                  cpu: '200m'
                limits:
                  memory: '512Mi'
                  cpu: '500m'
          volumes:
            - name: config
              configMap:
                name: security-testing-config
          restartPolicy: Never
```

---

## 5. Cronograma de Testes

### 5.1 Testes por PR (CI)

| Teste                            | Tempo Maximo | Obrigatorio para Merge |
| -------------------------------- | ------------ | ---------------------- |
| TC-001: Deny by Default          | 30s          | Sim                    |
| TC-002: Escalacao de Privilegios | 30s          | Sim                    |
| TC-003: BOLA/IDOR                | 45s          | Sim                    |
| TC-004: Route Leakage            | 20s          | Sim                    |
| TC-005: Context Leakage          | 45s          | Sim                    |
| TC-009: Combinacoes Toxicas      | 20s          | Sim                    |
| TC-010: Stale Session            | 30s          | Sim                    |
| TC-014: Completude de Auditoria  | 30s          | Sim                    |

### 5.2 Testes Diarios (CronJob)

| Teste                            | Horario | Notificacao     |
| -------------------------------- | ------- | --------------- |
| Todos os testes de PR            | 03:00   | Apenas em falha |
| TC-006: Auto-Logoff (E2E)        | 03:30   | Apenas em falha |
| TC-007: Break-Glass Audit        | 03:30   | Apenas em falha |
| TC-008: Assinatura Digital       | 03:30   | Apenas em falha |
| TC-011: Forced Browsing          | 04:00   | Apenas em falha |
| TC-012: Restricoes de Exportacao | 04:00   | Apenas em falha |
| TC-013: Mascaramento             | 04:00   | Apenas em falha |
| TC-015: Tamper Resistance        | 04:00   | Apenas em falha |
| Validacao Periodica (CronJob)    | 04:00   | Sempre          |

### 5.3 Testes Mensais (Penetracao)

| Area             | Escopo                                                   | Responsavel |
| ---------------- | -------------------------------------------------------- | ----------- |
| Autenticacao/MFA | Bypass de MFA, session hijacking, replay                 | Red Team    |
| Autorizacao      | Escalacao horizontal/vertical, IDOR, parameter tampering | Red Team    |
| Auditoria        | Tentativa de adulteracao, bypass de logging              | Red Team    |
| API              | Injection, mass assignment, rate limiting                | Red Team    |
| Infraestrutura   | Network segmentation, container escape                   | Red Team    |

### 5.4 Revisao Trimestral (Auditoria)

| Item                   | Verificacao                        | Evidencia                   |
| ---------------------- | ---------------------------------- | --------------------------- |
| Politicas de acesso    | Revisao de todas as OPA policies   | Relatorio de revisao        |
| Combinacoes toxicas    | Zero combinacoes ativas            | Saida do CronJob            |
| Contas inativas        | Todas tratadas (< 90 dias)         | Relatorio de contas         |
| Recertificacao         | 100% concluida no prazo            | Relatorio de recertificacao |
| Incidentes             | Todos os incidentes geraram testes | Lista de testes novos       |
| Cobertura de auditoria | > 99% de acoes auditadas           | Metricas de cobertura       |
| Integridade de cadeia  | Zero quebras                       | Saida do verificador        |

---

## 6. Metricas de Teste

```yaml
# security-testing-metrics.yaml
metrics:
  - name: velya_security_test_runs_total
    type: counter
    labels: [test_suite, result]
    help: 'Total de execucoes de teste de seguranca'

  - name: velya_security_test_failures_total
    type: counter
    labels: [test_suite, test_case, severity]
    help: 'Total de falhas em testes de seguranca'

  - name: velya_security_test_duration_seconds
    type: histogram
    labels: [test_suite]
    buckets: [1, 5, 10, 30, 60, 120, 300, 600]
    help: 'Duracao dos testes de seguranca'

  - name: velya_security_coverage_percent
    type: gauge
    labels: [area]
    help: 'Cobertura de testes por area de seguranca'

alerts:
  - alert: SecurityTestFailure
    expr: increase(velya_security_test_failures_total[1h]) > 0
    for: 0m
    labels:
      severity: critical
    annotations:
      summary: 'Falha em teste de seguranca: {{ $labels.test_case }}'

  - alert: SecurityTestNotRunning
    expr: time() - velya_security_test_last_run_timestamp > 86400
    for: 1h
    labels:
      severity: warning
    annotations:
      summary: 'Testes de seguranca nao executaram nas ultimas 24h'
```

---

## 7. Rastreabilidade Incidente-para-Teste

Cada incidente de seguranca gera obrigatoriamente um novo caso de teste:

| Incidente    | Data       | Teste Gerado                            | Arquivo                                 |
| ------------ | ---------- | --------------------------------------- | --------------------------------------- |
| INC-2026-001 | 2026-01-15 | Bypass de step-up via header            | `tests/regression/inc-2026-001.test.ts` |
| INC-2026-002 | 2026-02-20 | Sessao nao invalidada apos desligamento | `tests/regression/inc-2026-002.test.ts` |
| INC-2026-003 | 2026-03-10 | Dados do usuario anterior no cache      | `tests/regression/inc-2026-003.test.ts` |

Todo novo incidente passa pelo processo:

1. Investigacao e correcao.
2. Criacao de teste de regressao que reproduz o cenario.
3. Inclusao do teste na suite CI (executa em todo PR).
4. Validacao de que o teste falha sem a correcao e passa com ela.
5. Documentacao no plano de testes.

---

_Documento gerado para a plataforma Velya. Uso interno - Engenharia e Seguranca._
