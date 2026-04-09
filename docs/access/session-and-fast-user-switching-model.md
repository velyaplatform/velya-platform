# Modelo de Sessao e Troca Rapida de Usuario

**Modulo:** Velya Access Control - Session Management  
**Versao:** 1.0.0  
**Data:** 2026-04-08  
**Classificacao:** Interno - Engenharia  
**Responsavel:** Time de Plataforma Velya  

---

## 1. Visao Geral

Em ambientes hospitalares, estacoes de trabalho sao compartilhadas por multiplos profissionais ao longo do turno. Um unico terminal no posto de enfermagem pode ser utilizado por 15 a 20 profissionais diferentes em um periodo de 12 horas. O modelo de sessao do Velya foi projetado para:

1. Permitir troca rapida de usuario sem reinicializar a aplicacao.
2. Garantir isolamento completo de contexto entre sessoes.
3. Manter rastreabilidade total de acoes por usuario e dispositivo.
4. Aplicar timeouts diferenciados por localizacao e criticidade.
5. Exigir autenticacao elevada (step-up) para acoes criticas.

---

## 2. Arquitetura de Sessao

### 2.1 Componentes Envolvidos

| Componente | Responsabilidade |
|---|---|
| `SessionManager` | Gerencia ciclo de vida da sessao no cliente |
| `AuthGateway` | Valida credenciais e emite tokens |
| `SessionStore` (Redis) | Armazena sessoes ativas server-side |
| `AuditEmitter` | Registra eventos de sessao no log de auditoria |
| `WorkstationAgent` | Identifica e registra o dispositivo fisico |
| `UIContextGuard` | Limpa cache e estado visual na troca de usuario |
| `StepUpAuthProvider` | Gerencia autenticacao elevada para acoes criticas |

### 2.2 Identificacao de Estacao de Trabalho

Cada estacao de trabalho hospitalar recebe um identificador unico (`workstation_id`) que e vinculado a:

- Endereco MAC da interface de rede primaria
- Certificado de dispositivo X.509 emitido pelo CA interno
- Localizacao fisica cadastrada (ala, andar, sala)
- Perfil de timeout correspondente a localizacao

```yaml
# workstation-registry.yaml
workstations:
  - id: "WS-UTI-3A-001"
    mac: "AA:BB:CC:DD:EE:01"
    certificate_cn: "ws-uti-3a-001.velya.hospital.internal"
    location:
      building: "Principal"
      floor: 3
      wing: "A"
      unit: "UTI Adulto"
      room: "Posto de Enfermagem 1"
    timeout_profile: "icu"
    allowed_roles:
      - medico_intensivista
      - enfermeiro_uti
      - tecnico_enfermagem_uti
      - fisioterapeuta_uti

  - id: "WS-ENF-2B-003"
    mac: "AA:BB:CC:DD:EE:03"
    certificate_cn: "ws-enf-2b-003.velya.hospital.internal"
    location:
      building: "Principal"
      floor: 2
      wing: "B"
      unit: "Enfermaria Clinica"
      room: "Posto de Enfermagem 3"
    timeout_profile: "ward"
    allowed_roles:
      - medico_clinico
      - enfermeiro
      - tecnico_enfermagem
      - nutricionista

  - id: "WS-ADM-1A-002"
    mac: "AA:BB:CC:DD:EE:05"
    certificate_cn: "ws-adm-1a-002.velya.hospital.internal"
    location:
      building: "Administrativo"
      floor: 1
      wing: "A"
      unit: "Diretoria Clinica"
      room: "Sala 102"
    timeout_profile: "admin"
    allowed_roles:
      - diretor_clinico
      - gestor_qualidade
      - analista_faturamento
```

---

## 3. Politica de Timeout por Localizacao

O timeout de sessao varia conforme a criticidade e o fluxo de pessoas na localizacao:

| Perfil | Localizacao Tipica | Timeout Inatividade | Aviso Pre-Lock | Lock Automatico | Logout Forçado |
|---|---|---|---|---|---|
| `icu` | UTI, Centro Cirurgico, Sala de Emergencia | 5 minutos | 1 min antes | Apos timeout | 30 min apos lock |
| `ward` | Enfermarias, Ambulatorio, Posto de Enfermagem | 10 minutos | 2 min antes | Apos timeout | 60 min apos lock |
| `office` | Consultorios, Salas de Laudo, Farmacia | 15 minutos | 3 min antes | Apos timeout | 120 min apos lock |
| `admin` | Escritorios Administrativos, TI, Diretoria | 30 minutos | 5 min antes | Apos timeout | 240 min apos lock |

### 3.1 Configuracao de Timeout

```yaml
# session-timeout-policy.yaml
timeout_profiles:
  icu:
    inactivity_timeout_seconds: 300
    pre_lock_warning_seconds: 60
    lock_to_logout_seconds: 1800
    activity_signals:
      - mouse_move
      - keyboard_input
      - touch_input
      - barcode_scan
      - badge_tap
    exempt_during:
      - active_prescription_entry
      - active_procedure_documentation

  ward:
    inactivity_timeout_seconds: 600
    pre_lock_warning_seconds: 120
    lock_to_logout_seconds: 3600
    activity_signals:
      - mouse_move
      - keyboard_input
      - touch_input
      - barcode_scan
      - badge_tap

  office:
    inactivity_timeout_seconds: 900
    pre_lock_warning_seconds: 180
    lock_to_logout_seconds: 7200
    activity_signals:
      - mouse_move
      - keyboard_input

  admin:
    inactivity_timeout_seconds: 1800
    pre_lock_warning_seconds: 300
    lock_to_logout_seconds: 14400
    activity_signals:
      - mouse_move
      - keyboard_input
```

---

## 4. Fluxo de Troca Rapida de Usuario

### 4.1 Diagrama de Sequencia (ASCII)

```
Usr_A        UI_Client       SessionMgr      AuthGateway     SessionStore    AuditEmitter
  |              |               |               |               |               |
  |--[Clica      |               |               |               |               |
  |  "Trocar     |               |               |               |               |
  |  Usuario"]-->|               |               |               |               |
  |              |--[lockSession |               |               |               |
  |              |   (user_a)]-->|               |               |               |
  |              |               |--[setState    |               |               |
  |              |               |  LOCKED]----->|               |               |
  |              |               |               |               |--[set status  |
  |              |               |               |               |  locked]      |
  |              |               |--[emitEvent   |               |               |
  |              |               |  SESSION_     |               |               |
  |              |               |  LOCKED]------|---------------|-------------->|
  |              |<-[showLogin   |               |               |               |
  |              |   Screen]----|               |               |               |
  |              |               |               |               |               |
Usr_B            |               |               |               |               |
  |--[Apresenta  |               |               |               |               |
  |  cracha +    |               |               |               |               |
  |  PIN]------->|               |               |               |               |
  |              |--[authenticate|               |               |               |
  |              |  (badge,pin)]>|               |               |               |
  |              |               |--[validate    |               |               |
  |              |               |  credentials]>|               |               |
  |              |               |               |--[verify      |               |
  |              |               |               |  badge+PIN]   |               |
  |              |               |               |--[issue       |               |
  |              |               |               |  session_     |               |
  |              |               |               |  token]       |               |
  |              |               |<-[token +     |               |               |
  |              |               |  user_context]|               |               |
  |              |               |               |               |               |
  |              |               |--[invalidate  |               |               |
  |              |               |  (session_a)]>|-------------->|               |
  |              |               |               |               |--[delete      |
  |              |               |               |               |  session_a]   |
  |              |               |--[create      |               |               |
  |              |               |  (session_b)]>|-------------->|               |
  |              |               |               |               |--[store       |
  |              |               |               |               |  session_b]   |
  |              |               |               |               |               |
  |              |--[clearUI     |               |               |               |
  |              |   Cache]----->|               |               |               |
  |              |--[clearLocal  |               |               |               |
  |              |   Storage]--->|               |               |               |
  |              |--[resetState  |               |               |               |
  |              |   Store]----->|               |               |               |
  |              |               |               |               |               |
  |              |               |--[emitEvent   |               |               |
  |              |               |  USER_SWITCH  |               |               |
  |              |               |  prev=A       |               |               |
  |              |               |  new=B]-------|---------------|-------------->|
  |              |               |               |               |               |
  |              |<-[renderHome  |               |               |               |
  |              |   (user_b)]---|               |               |               |
  |<-[Dashboard  |               |               |               |               |
  |  user_b]-----|               |               |               |               |
```

### 4.2 Etapas Detalhadas

| Etapa | Acao | Tempo Maximo | Fallback |
|---|---|---|---|
| 1 | Usuario clica "Trocar Usuario" | - | Atalho Ctrl+Shift+L |
| 2 | Sessao atual e bloqueada (LOCKED) | 100ms | Se falhar, força logout |
| 3 | Cache UI e limpo (React state, stores) | 200ms | Hard refresh se falhar |
| 4 | Tela de login rapido e exibida | 100ms | - |
| 5 | Novo usuario apresenta credenciais | 30s | Timeout retorna ao lock |
| 6 | Credenciais validadas no AuthGateway | 500ms | Retry 1x, depois offline |
| 7 | Sessao anterior invalidada server-side | 100ms | Async, nao bloqueia |
| 8 | Nova sessao criada no SessionStore | 100ms | Retry com backoff |
| 9 | LocalStorage/IndexedDB limpos | 200ms | Force clear |
| 10 | Evento USER_SWITCH emitido para auditoria | Async | Fila persistente |
| 11 | Dashboard do novo usuario renderizado | 500ms | Skeleton loading |

**Tempo total alvo: < 2 segundos** do clique em "Trocar Usuario" ate o dashboard do novo usuario.

---

## 5. Gerenciamento de Sessao - Codigo TypeScript

### 5.1 Tipos e Interfaces

```typescript
// src/session/types.ts

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  LOCKED = 'LOCKED',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
}

export enum TimeoutProfile {
  ICU = 'icu',
  WARD = 'ward',
  OFFICE = 'office',
  ADMIN = 'admin',
}

export interface WorkstationInfo {
  workstationId: string;
  mac: string;
  certificateCn: string;
  location: {
    building: string;
    floor: number;
    wing: string;
    unit: string;
    room: string;
  };
  timeoutProfile: TimeoutProfile;
  ipAddress: string;
}

export interface SessionContext {
  sessionId: string;
  userId: string;
  userName: string;
  profession: string;
  councilNumber: string;         // CRM, COREN, CRF, etc.
  activeRole: string;
  activeUnit: string;
  workstation: WorkstationInfo;
  status: SessionStatus;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  tokenVersion: number;
  stepUpLevel: StepUpLevel;
  stepUpExpiresAt: Date | null;
}

export enum StepUpLevel {
  NONE = 'none',
  STANDARD = 'standard',        // Badge + PIN
  HIGH = 'high',                 // Biometria
  CRITICAL = 'critical',        // Biometria + PIN + Justificativa
}

export interface SessionEvent {
  eventId: string;
  eventType: SessionEventType;
  timestamp: Date;
  sessionId: string;
  userId: string;
  workstationId: string;
  previousUserId?: string;
  metadata: Record<string, unknown>;
}

export type SessionEventType =
  | 'SESSION_CREATED'
  | 'SESSION_LOCKED'
  | 'SESSION_UNLOCKED'
  | 'SESSION_EXPIRED'
  | 'SESSION_TERMINATED'
  | 'USER_SWITCH'
  | 'STEP_UP_GRANTED'
  | 'STEP_UP_EXPIRED'
  | 'TOKEN_ROTATED'
  | 'TIMEOUT_WARNING';
```

### 5.2 SessionManager

```typescript
// src/session/session-manager.ts

import { v4 as uuidv4 } from 'uuid';
import {
  SessionContext,
  SessionStatus,
  SessionEvent,
  SessionEventType,
  StepUpLevel,
  TimeoutProfile,
  WorkstationInfo,
} from './types';

interface TimeoutConfig {
  inactivityMs: number;
  preWarningMs: number;
  lockToLogoutMs: number;
}

const TIMEOUT_CONFIGS: Record<TimeoutProfile, TimeoutConfig> = {
  [TimeoutProfile.ICU]: {
    inactivityMs: 5 * 60 * 1000,
    preWarningMs: 1 * 60 * 1000,
    lockToLogoutMs: 30 * 60 * 1000,
  },
  [TimeoutProfile.WARD]: {
    inactivityMs: 10 * 60 * 1000,
    preWarningMs: 2 * 60 * 1000,
    lockToLogoutMs: 60 * 60 * 1000,
  },
  [TimeoutProfile.OFFICE]: {
    inactivityMs: 15 * 60 * 1000,
    preWarningMs: 3 * 60 * 1000,
    lockToLogoutMs: 120 * 60 * 1000,
  },
  [TimeoutProfile.ADMIN]: {
    inactivityMs: 30 * 60 * 1000,
    preWarningMs: 5 * 60 * 1000,
    lockToLogoutMs: 240 * 60 * 1000,
  },
};

const TOKEN_ROTATION_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

export class SessionManager {
  private currentSession: SessionContext | null = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private lockTimer: ReturnType<typeof setTimeout> | null = null;
  private tokenRotationTimer: ReturnType<typeof setTimeout> | null = null;
  private eventListeners: Map<SessionEventType, Array<(e: SessionEvent) => void>> = new Map();

  constructor(
    private readonly workstation: WorkstationInfo,
    private readonly authGateway: AuthGatewayClient,
    private readonly sessionStore: SessionStoreClient,
    private readonly auditEmitter: AuditEmitterClient,
    private readonly uiCacheCleaner: UICacheCleaner,
  ) {}

  /**
   * Obtem a sessao ativa atual.
   */
  getSession(): SessionContext | null {
    return this.currentSession;
  }

  /**
   * Cria uma nova sessao apos autenticacao bem-sucedida.
   */
  async createSession(credentials: AuthCredentials): Promise<SessionContext> {
    // 1. Validar credenciais no AuthGateway
    const authResult = await this.authGateway.authenticate(credentials);
    if (!authResult.success) {
      throw new AuthenticationError(authResult.reason);
    }

    // 2. Criar contexto de sessao
    const now = new Date();
    const timeoutConfig = TIMEOUT_CONFIGS[this.workstation.timeoutProfile];

    const session: SessionContext = {
      sessionId: uuidv4(),
      userId: authResult.user.id,
      userName: authResult.user.name,
      profession: authResult.user.profession,
      councilNumber: authResult.user.councilNumber,
      activeRole: authResult.user.defaultRole,
      activeUnit: this.workstation.location.unit,
      workstation: this.workstation,
      status: SessionStatus.ACTIVE,
      createdAt: now,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + timeoutConfig.inactivityMs),
      tokenVersion: 1,
      stepUpLevel: StepUpLevel.NONE,
      stepUpExpiresAt: null,
    };

    // 3. Persistir sessao no store server-side
    await this.sessionStore.create(session, authResult.token);

    // 4. Configurar timers
    this.currentSession = session;
    this.startInactivityTimer();
    this.startTokenRotation();

    // 5. Emitir evento de auditoria
    await this.emitEvent('SESSION_CREATED', {
      loginMethod: credentials.method,
      workstationId: this.workstation.workstationId,
    });

    return session;
  }

  /**
   * Troca rapida de usuario.
   * Bloqueia sessao atual, autentica novo usuario, limpa cache.
   */
  async switchUser(newCredentials: AuthCredentials): Promise<SessionContext> {
    const previousSession = this.currentSession;
    const previousUserId = previousSession?.userId;

    try {
      // Etapa 1: Bloquear sessao atual
      if (previousSession) {
        await this.lockSession();
      }

      // Etapa 2: Limpar cache da UI
      await this.uiCacheCleaner.clearAll();

      // Etapa 3: Autenticar novo usuario
      const authResult = await this.authGateway.authenticate(newCredentials);
      if (!authResult.success) {
        // Falha na autenticacao - manter tela de lock
        throw new AuthenticationError(authResult.reason);
      }

      // Etapa 4: Invalidar sessao anterior server-side
      if (previousSession) {
        await this.sessionStore.invalidate(previousSession.sessionId);
        this.clearAllTimers();
      }

      // Etapa 5: Criar nova sessao
      const now = new Date();
      const timeoutConfig = TIMEOUT_CONFIGS[this.workstation.timeoutProfile];

      const newSession: SessionContext = {
        sessionId: uuidv4(),
        userId: authResult.user.id,
        userName: authResult.user.name,
        profession: authResult.user.profession,
        councilNumber: authResult.user.councilNumber,
        activeRole: authResult.user.defaultRole,
        activeUnit: this.workstation.location.unit,
        workstation: this.workstation,
        status: SessionStatus.ACTIVE,
        createdAt: now,
        lastActivity: now,
        expiresAt: new Date(now.getTime() + timeoutConfig.inactivityMs),
        tokenVersion: 1,
        stepUpLevel: StepUpLevel.NONE,
        stepUpExpiresAt: null,
      };

      await this.sessionStore.create(newSession, authResult.token);

      // Etapa 6: Atualizar estado local
      this.currentSession = newSession;
      this.startInactivityTimer();
      this.startTokenRotation();

      // Etapa 7: Emitir evento de troca
      await this.emitEvent('USER_SWITCH', {
        previousUserId,
        previousSessionId: previousSession?.sessionId,
        newUserId: newSession.userId,
        switchDurationMs: Date.now() - now.getTime(),
      });

      return newSession;
    } catch (error) {
      // Em caso de erro, garantir que a UI esta em estado seguro
      if (error instanceof AuthenticationError) {
        // Manter tela de lock para nova tentativa
        throw error;
      }
      // Erro inesperado - forcar logout completo
      await this.forceLogout();
      throw error;
    }
  }

  /**
   * Bloqueia a sessao atual (tela de lock).
   */
  async lockSession(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.status = SessionStatus.LOCKED;
    await this.sessionStore.updateStatus(
      this.currentSession.sessionId,
      SessionStatus.LOCKED,
    );

    this.clearInactivityTimer();
    this.startLockTimer();

    await this.emitEvent('SESSION_LOCKED', {});
    this.notifyListeners('SESSION_LOCKED');
  }

  /**
   * Registra atividade do usuario para resetar o timer de inatividade.
   */
  recordActivity(): void {
    if (!this.currentSession || this.currentSession.status !== SessionStatus.ACTIVE) {
      return;
    }

    this.currentSession.lastActivity = new Date();
    this.resetInactivityTimer();
  }

  /**
   * Solicita autenticacao elevada (step-up) para acoes criticas.
   */
  async requestStepUp(
    requiredLevel: StepUpLevel,
    credentials: StepUpCredentials,
    justification?: string,
  ): Promise<boolean> {
    if (!this.currentSession) {
      throw new Error('Nenhuma sessao ativa');
    }

    // Verificar se ja possui nivel suficiente
    if (this.isStepUpValid(requiredLevel)) {
      return true;
    }

    // Validar credenciais de step-up
    const result = await this.authGateway.validateStepUp(
      this.currentSession.sessionId,
      requiredLevel,
      credentials,
      justification,
    );

    if (result.success) {
      this.currentSession.stepUpLevel = requiredLevel;
      this.currentSession.stepUpExpiresAt = new Date(
        Date.now() + result.elevationDurationMs,
      );

      await this.emitEvent('STEP_UP_GRANTED', {
        level: requiredLevel,
        justification,
        expiresAt: this.currentSession.stepUpExpiresAt,
      });

      // Agendar expiracao do step-up
      setTimeout(() => {
        this.expireStepUp();
      }, result.elevationDurationMs);

      return true;
    }

    return false;
  }

  // --- Metodos privados ---

  private isStepUpValid(requiredLevel: StepUpLevel): boolean {
    if (!this.currentSession?.stepUpExpiresAt) return false;
    if (new Date() > this.currentSession.stepUpExpiresAt) return false;

    const levels = [StepUpLevel.NONE, StepUpLevel.STANDARD, StepUpLevel.HIGH, StepUpLevel.CRITICAL];
    const currentIdx = levels.indexOf(this.currentSession.stepUpLevel);
    const requiredIdx = levels.indexOf(requiredLevel);
    return currentIdx >= requiredIdx;
  }

  private async expireStepUp(): Promise<void> {
    if (!this.currentSession) return;
    this.currentSession.stepUpLevel = StepUpLevel.NONE;
    this.currentSession.stepUpExpiresAt = null;
    await this.emitEvent('STEP_UP_EXPIRED', {});
  }

  private startInactivityTimer(): void {
    const config = TIMEOUT_CONFIGS[this.workstation.timeoutProfile];

    // Timer de aviso
    this.warningTimer = setTimeout(() => {
      this.notifyListeners('TIMEOUT_WARNING');
    }, config.inactivityMs - config.preWarningMs);

    // Timer de lock
    this.inactivityTimer = setTimeout(() => {
      this.lockSession();
    }, config.inactivityMs);
  }

  private resetInactivityTimer(): void {
    this.clearInactivityTimer();
    this.startInactivityTimer();
  }

  private clearInactivityTimer(): void {
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
  }

  private startLockTimer(): void {
    const config = TIMEOUT_CONFIGS[this.workstation.timeoutProfile];
    this.lockTimer = setTimeout(() => {
      this.forceLogout();
    }, config.lockToLogoutMs);
  }

  private startTokenRotation(): void {
    this.tokenRotationTimer = setInterval(async () => {
      if (!this.currentSession) return;
      try {
        const newToken = await this.authGateway.rotateToken(
          this.currentSession.sessionId,
        );
        this.currentSession.tokenVersion += 1;
        await this.sessionStore.updateToken(
          this.currentSession.sessionId,
          newToken,
          this.currentSession.tokenVersion,
        );
        await this.emitEvent('TOKEN_ROTATED', {
          version: this.currentSession.tokenVersion,
        });
      } catch {
        // Falha na rotacao - agendar retry
        console.error('Falha na rotacao de token');
      }
    }, TOKEN_ROTATION_INTERVAL_MS);
  }

  private clearAllTimers(): void {
    this.clearInactivityTimer();
    if (this.lockTimer) clearTimeout(this.lockTimer);
    if (this.tokenRotationTimer) clearInterval(this.tokenRotationTimer);
  }

  private async forceLogout(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.status = SessionStatus.TERMINATED;
      await this.sessionStore.invalidate(this.currentSession.sessionId);
      await this.emitEvent('SESSION_TERMINATED', { reason: 'force_logout' });
    }
    this.clearAllTimers();
    this.currentSession = null;
    await this.uiCacheCleaner.clearAll();
  }

  private async emitEvent(
    type: SessionEventType,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const event: SessionEvent = {
      eventId: uuidv4(),
      eventType: type,
      timestamp: new Date(),
      sessionId: this.currentSession?.sessionId ?? 'unknown',
      userId: this.currentSession?.userId ?? 'unknown',
      workstationId: this.workstation.workstationId,
      metadata,
    };
    await this.auditEmitter.emit(event);
  }

  private notifyListeners(type: SessionEventType): void {
    const listeners = this.eventListeners.get(type) ?? [];
    const event: SessionEvent = {
      eventId: uuidv4(),
      eventType: type,
      timestamp: new Date(),
      sessionId: this.currentSession?.sessionId ?? '',
      userId: this.currentSession?.userId ?? '',
      workstationId: this.workstation.workstationId,
      metadata: {},
    };
    listeners.forEach((fn) => fn(event));
  }

  on(type: SessionEventType, listener: (e: SessionEvent) => void): void {
    const current = this.eventListeners.get(type) ?? [];
    current.push(listener);
    this.eventListeners.set(type, current);
  }
}
```

### 5.3 UICacheCleaner

```typescript
// src/session/ui-cache-cleaner.ts

export class UICacheCleaner {
  /**
   * Limpa todos os caches e estados da UI na troca de usuario.
   * Garante que nenhuma informacao do usuario anterior persista.
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      this.clearReactQueryCache(),
      this.clearLocalStorage(),
      this.clearSessionStorage(),
      this.clearIndexedDB(),
      this.clearInMemoryStores(),
      this.clearServiceWorkerCache(),
    ]);
  }

  private async clearReactQueryCache(): Promise<void> {
    // Invalida todas as queries do React Query / TanStack Query
    const { queryClient } = await import('../providers/query-client');
    queryClient.clear();
    queryClient.removeQueries();
  }

  private async clearLocalStorage(): Promise<void> {
    // Remove apenas chaves da aplicacao, preserva configuracoes de dispositivo
    const keysToPreserve = ['workstation_id', 'device_cert', 'ui_theme'];
    const allKeys = Object.keys(localStorage);
    allKeys
      .filter((key) => !keysToPreserve.includes(key))
      .forEach((key) => localStorage.removeItem(key));
  }

  private async clearSessionStorage(): Promise<void> {
    sessionStorage.clear();
  }

  private async clearIndexedDB(): Promise<void> {
    const databases = await indexedDB.databases();
    const appDatabases = databases.filter(
      (db) => db.name?.startsWith('velya_') && db.name !== 'velya_device',
    );
    for (const db of appDatabases) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  }

  private async clearInMemoryStores(): Promise<void> {
    // Reseta stores Zustand/Jotai
    const { resetAllStores } = await import('../stores/reset');
    resetAllStores();
  }

  private async clearServiceWorkerCache(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      const userCaches = cacheNames.filter((name) => name.startsWith('velya-user-'));
      await Promise.all(userCaches.map((name) => caches.delete(name)));
    }
  }
}
```

---

## 6. Invalidacao Server-Side

### 6.1 Estrutura no Redis

```
# Chave principal da sessao
session:{session_id} -> Hash {
  user_id: "USR-001"
  status: "ACTIVE"
  workstation_id: "WS-UTI-3A-001"
  token_version: 3
  created_at: "2026-04-08T10:30:00Z"
  last_activity: "2026-04-08T10:45:00Z"
  expires_at: "2026-04-08T10:50:00Z"
  step_up_level: "none"
}
TTL: definido conforme perfil de timeout

# Indice por usuario (para invalidar todas as sessoes)
user_sessions:{user_id} -> Set { session_id_1, session_id_2 }

# Indice por estacao (para detectar sessoes concorrentes)
workstation_sessions:{workstation_id} -> Set { session_id }

# Blacklist de tokens revogados
token_blacklist:{token_jti} -> "revoked"
TTL: tempo restante do token
```

### 6.2 Invalidacao no Logout e Troca

Na troca de usuario ou logout, o servidor executa:

1. Marca a sessao como `TERMINATED` no Redis.
2. Adiciona o JTI do token atual a blacklist.
3. Remove o `session_id` dos indices de usuario e estacao.
4. Publica mensagem no canal Redis `session:invalidated` para notificar outros servicos.
5. Emite evento de auditoria com `previous_user_id` e `new_user_id`.

---

## 7. Politica de Rotacao de Token

| Parametro | Valor |
|---|---|
| Algoritmo de assinatura | EdDSA (Ed25519) |
| Tempo de vida do access token | 15 minutos |
| Rotacao automatica | A cada 15 minutos enquanto sessao ativa |
| Refresh token | Vinculado a sessao, rotacionado junto |
| Versao do token | Incrementada a cada rotacao |
| Tokens anteriores | Invalidados imediatamente apos rotacao |
| Verificacao server-side | Token version deve coincidir com SessionStore |

---

## 8. Autenticacao Elevada (Step-Up) para Acoes Criticas

### 8.1 Acoes que Exigem Step-Up

| Acao | Nivel Minimo | Duracao da Elevacao | Justificativa Obrigatoria |
|---|---|---|---|
| Prescrever medicamento | `standard` | 30 min | Nao |
| Assinar documento clinico | `standard` | 15 min | Nao |
| Exportar dados de paciente | `high` | 10 min | Sim |
| Acesso break-glass | `critical` | 15 min | Sim |
| Alterar dados demograficos | `standard` | 15 min | Nao |
| Imprimir prontuario completo | `high` | 5 min | Sim |
| Acessar dados Classe D/E | `high` | 10 min | Sim |
| Acoes administrativas (RBAC) | `critical` | 5 min | Sim |

### 8.2 Fluxo de Step-Up

```
Usuario          UI               StepUpProvider      AuthGateway       AuditLog
  |               |                    |                   |               |
  |--[Prescr.]--->|                    |                   |               |
  |               |--[checkStepUp     |                   |               |
  |               |  (STANDARD)]----->|                   |               |
  |               |                   |--[nivel atual     |               |
  |               |                   |  insuficiente]    |               |
  |               |<-[solicitarFator]-|                   |               |
  |               |                   |                   |               |
  |<-[Modal:      |                   |                   |               |
  |  "Confirme    |                   |                   |               |
  |  identidade   |                   |                   |               |
  |  Badge+PIN"]--|                   |                   |               |
  |               |                   |                   |               |
  |--[Badge+PIN]->|                   |                   |               |
  |               |--[validateFactor]>|                   |               |
  |               |                   |--[verify]-------->|               |
  |               |                   |                   |--[OK]         |
  |               |                   |<-[elevacao 30min]-|               |
  |               |                   |--[emitStepUp]-----|-------------->|
  |               |<-[autorizado]-----|                   |               |
  |               |                   |                   |               |
  |               |--[executar        |                   |               |
  |               |  prescricao]      |                   |               |
  |<-[Sucesso]----|                   |                   |               |
```

---

## 9. Indicadores Visuais

### 9.1 Badge do Usuario Atual

O badge do usuario e exibido permanentemente no canto superior direito da aplicacao:

```
+------------------------------------------+
| VELYA                    [Dr. Maria S.]   |
|                          Medica - CRM 123 |
|                          UTI Adulto       |
|                          [====----] 3:42  |
|                          [Trocar Usuario] |
+------------------------------------------+
```

### 9.2 Timer de Sessao

| Estado | Indicador Visual | Cor |
|---|---|---|
| Ativo (> 50% tempo) | Barra de progresso verde | `#22C55E` |
| Ativo (25-50% tempo) | Barra de progresso amarela | `#EAB308` |
| Aviso pre-lock | Barra pulsante vermelha + modal de aviso | `#EF4444` |
| Bloqueado (locked) | Tela de lock com campo de autenticacao | `#6B7280` |
| Step-up ativo | Icone de escudo ao lado do badge | `#3B82F6` |

### 9.3 Aviso de Auto-Lock

Quando o timer de pre-aviso e acionado, um modal nao-bloqueante aparece:

```
+---------------------------------------------------+
|  ⚠ Sessao sera bloqueada em 58 segundos            |
|                                                     |
|  Mova o mouse ou pressione qualquer tecla para      |
|  continuar.                                         |
|                                                     |
|  [ Continuar Trabalhando ]    [ Trocar Usuario ]    |
+---------------------------------------------------+
```

---

## 10. Seguranca e Consideracoes

### 10.1 Garantias de Isolamento

| Vetor de Risco | Mitigacao |
|---|---|
| Dados do usuario anterior em cache | UICacheCleaner limpa todos os caches |
| Requisicoes em andamento do usuario anterior | AbortController cancela requisicoes pendentes |
| WebSocket com contexto anterior | Reconexao com novo token na troca |
| Service Worker com cache do usuario anterior | Caches prefixados por usuario sao deletados |
| Estado em variaveis globais JavaScript | Reset de todos os stores (Zustand/Jotai) |
| Token do usuario anterior ainda valido | Blacklist imediata + invalidacao server-side |
| Browser back button mostra dados anteriores | `no-store` cache headers + replace history |

### 10.2 Restricoes de Sessao Concorrente

- Um usuario pode ter no maximo **1 sessao ativa** simultaneamente.
- Ao fazer login em nova estacao, a sessao anterior e terminada automaticamente.
- Um aviso e exibido: "Sua sessao na estacao WS-ENF-2B-003 foi encerrada."
- Excecao: usuarios com papel `admin_sistema` podem ter ate 2 sessoes.

### 10.3 Metricas de Monitoramento

```yaml
# prometheus-rules.yaml
groups:
  - name: session_metrics
    rules:
      - record: velya_active_sessions_total
        expr: count(velya_session_status == 1) by (unit, workstation_id)

      - record: velya_user_switches_rate
        expr: rate(velya_user_switch_total[5m])

      - alert: HighSwitchRate
        expr: rate(velya_user_switch_total{workstation_id=~".+"}[1h]) > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Taxa alta de troca de usuario na estacao {{ $labels.workstation_id }}"

      - alert: SessionTokenRotationFailure
        expr: increase(velya_token_rotation_failures_total[15m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Falha na rotacao de token para sessao ativa"
```

---

## 11. Referencia de Configuracao Completa

```yaml
# session-management-config.yaml
session:
  max_concurrent_per_user: 1
  max_concurrent_admin: 2
  token:
    algorithm: "EdDSA"
    access_ttl_seconds: 900
    rotation_interval_seconds: 900
    issuer: "velya-auth-gateway"
    audience: "velya-platform"
  switch:
    max_auth_wait_seconds: 30
    cache_clear_timeout_ms: 500
    target_total_switch_ms: 2000
  step_up:
    standard_duration_seconds: 1800
    high_duration_seconds: 600
    critical_duration_seconds: 300
    max_attempts: 3
    lockout_duration_seconds: 300
  redis:
    prefix: "velya:session:"
    cluster: true
    sentinel_master: "velya-session"
    read_from_replica: false
  audit:
    emit_async: true
    queue: "velya.session.events"
    retry_count: 3
    retry_delay_ms: 1000
```

---

*Documento gerado para a plataforma Velya. Uso interno - Engenharia e Seguranca.*
