# Governanca de Acesso Emergencial e Sensivel

> Fluxos de break-glass, acesso a dados sensiveis, limites temporais, revisao pos-evento e deteccao de abuso.

## 1. Visao Geral

O acesso emergencial (break-glass) e o mecanismo que permite a um profissional de saude acessar dados de um paciente com quem NAO possui vinculo ativo (CareTeam), em situacoes onde a seguranca do paciente exige acesso imediato. O acesso sensivel abrange situacoes de monitoramento especial: pacientes VIP, acesso ao proprio prontuario, prontuario de familiares, e acesso administrativo privilegiado.

### 1.1 Principios

1. **Seguranca do paciente primeiro**: O acesso nunca deve ser a barreira entre o profissional e a vida do paciente.
2. **Todo acesso extraordinario e rastreado**: Break-glass nao e acesso livre — e acesso monitorado intensivamente.
3. **Revisao obrigatoria**: Todo break-glass e revisado por humano em 24 horas.
4. **Proporcionalidade**: O escopo e a duracao do acesso sao proporcionais a justificativa.
5. **Deteccao ativa de abuso**: O sistema detecta padroes de uso indevido automaticamente.

---

## 2. Classificacao de Acesso Emergencial

### 2.1 Classes de Break-Glass

| Classe       | Descricao                                                     | Limite de Tempo | Escopo                                    | Elegibilidade                                        |
| ------------ | ------------------------------------------------------------- | --------------- | ----------------------------------------- | ---------------------------------------------------- |
| **Classe A** | Emergencia clinica vital (PCR, choque, deterioracao aguda)    | 4 horas         | Leitura completa + prescricao emergencial | Medicos, enfermeiros                                 |
| **Classe B** | Transferencia/admissao em andamento (CareTeam nao atualizado) | 2 horas         | Leitura completa                          | Medicos, enfermeiros, tecnicos                       |
| **Classe C** | Cobertura nao registrada (plantao, substituicao)              | 4 horas         | Leitura completa + acoes do papel         | Todos os profissionais assistenciais                 |
| **Classe D** | Interconsulta verbal nao formalizada                          | 2 horas         | Leitura conforme papel                    | Medicos especialistas                                |
| **Classe E** | Risco de seguranca iminente (alergia, interacao, erro)        | 1 hora          | Leitura dos dados relevantes ao risco     | Todos os profissionais assistenciais + farmaceuticos |

### 2.2 Papeis Elegiveis

| Papel                 | Classes Permitidas | Restricoes                                         |
| --------------------- | ------------------ | -------------------------------------------------- |
| Medico plantonista    | A, B, C, D, E      | Nenhuma restricao adicional                        |
| Medico diarista       | B, C, D, E         | Classe A apenas se plantonista tambem              |
| Medico residente      | B, C, D, E         | Requer notificacao ao preceptor                    |
| Enfermeiro            | A, B, C, E         | Classe A apenas para acoes de enfermagem           |
| Tecnico de enfermagem | B, C, E            | Escopo limitado a sinais vitais e medicamentos     |
| Farmaceutico          | E                  | Apenas para verificacao de seguranca medicamentosa |
| Fisioterapeuta        | B, C               | Escopo limitado a mobilidade e respiratorio        |
| Nutricionista         | C                  | Escopo limitado a dieta                            |
| Assistente social     | C                  | Escopo limitado a dados sociais                    |
| Administrador TI      | Nenhuma            | Usa mecanismo JIT separado (secao 9)               |

---

## 3. Fluxo de Ativacao

### 3.1 Diagrama de Fluxo

```
┌──────────────────────────────────────────────────────────────┐
│ PROFISSIONAL TENTA ACESSAR DADOS DE PACIENTE SEM VINCULO    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ SISTEMA VERIFICA VINCULO (CareTeam, Encounter, Cobertura)   │
│ RESULTADO: SEM VINCULO                                       │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ TELA DE ACESSO NEGADO COM OPCAO BREAK-GLASS                 │
│                                                              │
│ ⚠ Voce nao tem vinculo ativo com este paciente.             │
│                                                              │
│ Se voce precisa acessar em situacao de emergencia,           │
│ ative o acesso emergencial (break-glass).                    │
│                                                              │
│ ⚠ ATENCAO: Este acesso sera auditado e revisado em 24h.    │
│                                                              │
│ [CANCELAR]  [ATIVAR BREAK-GLASS →]                          │
└──────────────────────────┬───────────────────────────────────┘
                           │ (ativar)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ FORMULARIO DE JUSTIFICATIVA                                  │
│                                                              │
│ Classe de acesso: [dropdown]                                 │
│   ( ) Classe A - Emergencia clinica vital                    │
│   ( ) Classe B - Transferencia em andamento                  │
│   ( ) Classe C - Cobertura nao registrada                    │
│   ( ) Classe D - Interconsulta verbal                        │
│   ( ) Classe E - Risco de seguranca                          │
│                                                              │
│ Motivo clinico: [dropdown]                                   │
│   PCR / Deterioracao aguda / Admissao emergencial /          │
│   Transferencia / Cobertura de plantao / Interconsulta /     │
│   Verificacao de seguranca / Outro                           │
│                                                              │
│ Justificativa detalhada: [texto livre, minimo 20 chars]      │
│ ___________________________________________________________  │
│                                                              │
│ [ ] Declaro que este acesso e necessario para a seguranca    │
│     do paciente e estou ciente de que sera auditado.         │
│                                                              │
│ [CANCELAR]  [CONFIRMAR E ACESSAR]                            │
└──────────────────────────┬───────────────────────────────────┘
                           │ (confirmar)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ SISTEMA:                                                     │
│ 1. Registra AuditEvent tipo break-glass                      │
│ 2. Concede acesso temporario (conforme classe)               │
│ 3. Inicia timer de expiracao                                 │
│ 4. Envia notificacoes imediatas:                             │
│    - DPO (email + dashboard)                                 │
│    - Coordenador da unidade do paciente                      │
│    - Medico responsavel pelo paciente                        │
│    - Coordenador do profissional solicitante                 │
│ 5. Agenda revisao obrigatoria (24h)                          │
│ 6. Ativa monitoramento intensivo da sessao                   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ ACESSO CONCEDIDO                                             │
│                                                              │
│ ⚠ ACESSO EMERGENCIAL ATIVO                                  │
│ Classe: [X]                                                  │
│ Expira em: [HH:MM]                                           │
│ Escopo: [descricao]                                          │
│                                                              │
│ [ENCERRAR ACESSO ANTECIPADAMENTE]                            │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Banner Persistente

Durante todo o break-glass, um banner vermelho e exibido no topo da tela:

```
╔══════════════════════════════════════════════════════════════╗
║ ⚠ ACESSO EMERGENCIAL ATIVO — Paciente: Maria Santos        ║
║   Classe C | Expira em: 01:42:15 | [Encerrar]              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 4. Limites de Tempo e Escopo

### 4.1 Limites por Classe

| Classe | Duracao Maxima | Renovacao                                     | Escopo de Leitura         | Escopo de Escrita                               |
| ------ | -------------- | --------------------------------------------- | ------------------------- | ----------------------------------------------- |
| **A**  | 4 horas        | Ate 1x com nova justificativa                 | Prontuario completo       | Prescricao emergencial, sinais vitais, evolucao |
| **B**  | 2 horas        | Nao renovavel (deve registrar vinculo)        | Prontuario completo       | Nenhuma (somente leitura)                       |
| **C**  | 4 horas        | Ate 1x com aprovacao do coordenador           | Conforme papel            | Conforme papel                                  |
| **D**  | 2 horas        | Nao renovavel (deve formalizar interconsulta) | Conforme especialidade    | Nota de interconsulta                           |
| **E**  | 1 hora         | Nao renovavel                                 | Dados relevantes ao risco | Nenhuma                                         |

### 4.2 Restricoes durante Break-Glass

| Restricao                       | Descricao                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| **Sem exportacao**              | Dados nao podem ser exportados durante break-glass                                   |
| **Sem impressao**               | Impressao desabilitada (exceto Classe A para protocolo)                              |
| **Sem compartilhamento**        | Dados nao podem ser compartilhados com terceiros                                     |
| **Monitoramento intensivo**     | Cada tela visualizada, cada campo expandido e registrado                             |
| **Dados psiquiatricos ocultos** | Mesmo em break-glass, notas psiquiatricas nao sao exibidas (exceto para psiquiatras) |
| **Timeout de inatividade**      | Sessao encerrada apos 10 minutos de inatividade (vs 30 min padrao)                   |

---

## 5. Notificacoes Automaticas

### 5.1 Notificacoes na Ativacao

| Destinatario                           | Canal             | Tempo              | Conteudo                                              |
| -------------------------------------- | ----------------- | ------------------ | ----------------------------------------------------- |
| **DPO**                                | Email + Dashboard | Imediato           | Nome do profissional, paciente, classe, justificativa |
| **Coordenador da unidade do paciente** | Push + SMS        | Imediato           | Nome do profissional, paciente, classe                |
| **Medico responsavel pelo paciente**   | Push              | Imediato           | Nome do profissional, classe                          |
| **Coordenador do solicitante**         | Push              | Imediato           | Nome do profissional, paciente, classe                |
| **Comite de Etica**                    | Email             | Consolidado diario | Resumo de todos os break-glass do dia                 |

### 5.2 Notificacoes durante o Break-Glass

| Evento                           | Destinatario                                  | Canal           |
| -------------------------------- | --------------------------------------------- | --------------- |
| 50% do tempo expirado            | Profissional                                  | Banner + push   |
| 80% do tempo expirado            | Profissional + coordenador                    | Banner + push   |
| Tempo expirado                   | Profissional (sessao encerrada) + coordenador | Todos           |
| Tentativa de renovacao           | DPO + coordenador                             | Email           |
| Tentativa de acao fora do escopo | DPO + TI                                      | Alerta imediato |

### 5.3 Notificacoes pos-Break-Glass

| Evento                 | Destinatario          | Canal                   |
| ---------------------- | --------------------- | ----------------------- |
| Break-glass encerrado  | DPO + coordenador     | Email (resumo de acoes) |
| Revisao pendente (24h) | Coordenador designado | Push + email            |
| Revisao atrasada (48h) | DPO + diretoria       | Email urgente           |
| Revisao concluida      | DPO + profissional    | Email                   |

---

## 6. Revisao Pos-Evento

### 6.1 Prazo

| Classe | Prazo de Revisao | Revisor                           |
| ------ | ---------------- | --------------------------------- |
| **A**  | 24 horas         | Coordenador medico da unidade     |
| **B**  | 24 horas         | Coordenador da unidade receptora  |
| **C**  | 48 horas         | Coordenador do profissional       |
| **D**  | 24 horas         | Coordenador medico                |
| **E**  | 24 horas         | Coordenador de farmacia/qualidade |

### 6.2 Formulario de Revisao

```
┌──────────────────────────────────────────────────────────────┐
│ REVISAO DE BREAK-GLASS #BG-2026-0409-001                     │
│                                                              │
│ Profissional: Enf. Carlos Lima - COREN 654321/SP             │
│ Paciente: Maria Santos - Prontuario 12345                    │
│ Classe: C (Cobertura nao registrada)                         │
│ Justificativa: "Substituindo Enf. Joana que passou mal.      │
│ Escala ainda nao atualizada no sistema."                     │
│ Duracao: 3h42min                                             │
│ Dados acessados: [lista detalhada]                           │
│ Acoes realizadas: [lista detalhada]                          │
│                                                              │
│ AVALIACAO DO REVISOR:                                        │
│                                                              │
│ Justificativa valida?                                        │
│   ( ) Sim - Justificativa adequada e proporcional            │
│   ( ) Parcialmente - Justificativa valida mas escopo         │
│       excedeu o necessario                                   │
│   ( ) Nao - Justificativa invalida ou insuficiente           │
│                                                              │
│ Escopo adequado?                                             │
│   ( ) Sim - Acessou apenas o necessario                      │
│   ( ) Nao - Acessou dados alem do necessario                 │
│                                                              │
│ Acoes necessarias:                                           │
│   [ ] Nenhuma - Uso adequado                                 │
│   [ ] Orientacao ao profissional                             │
│   [ ] Atualizacao da escala/CareTeam (prevencao)             │
│   [ ] Encaminhamento para comissao de etica                  │
│   [ ] Notificacao disciplinar                                │
│   [ ] Notificacao a ANPD (violacao de dados)                 │
│                                                              │
│ Observacoes do revisor:                                      │
│ ___________________________________________________________  │
│                                                              │
│ [CONCLUIR REVISAO]                                           │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Desfechos da Revisao

| Desfecho                      | Acao                                                                 |
| ----------------------------- | -------------------------------------------------------------------- |
| **Uso adequado**              | Registro arquivado. Nenhuma acao adicional.                          |
| **Uso adequado com melhoria** | Registro + acao preventiva (ex: melhorar processo de cobertura).     |
| **Escopo excedido**           | Orientacao ao profissional. Registro na ficha funcional.             |
| **Uso indevido leve**         | Orientacao formal + monitoramento intensivo por 30 dias.             |
| **Uso indevido grave**        | Encaminhamento para comissao de etica + possivel notificacao a ANPD. |
| **Fraude/abuso**              | Bloqueio de break-glass + processo disciplinar + notificacao a ANPD. |

---

## 7. Deteccao de Abuso

### 7.1 Indicadores de Abuso

| Indicador                             | Threshold                                             | Acao                           |
| ------------------------------------- | ----------------------------------------------------- | ------------------------------ |
| **Frequencia de break-glass**         | > 3 por mes para mesmo profissional                   | Alerta para coordenador        |
| **Break-glass para mesmo paciente**   | > 1 por semana sem vinculo formalizado                | Alerta para DPO                |
| **Break-glass fora do horario**       | Ativacao fora do turno/escala do profissional         | Alerta imediato                |
| **Break-glass + navegacao excessiva** | > 50 registros expandidos em uma sessao               | Alerta para DPO                |
| **Break-glass sem acao clinica**      | Nenhuma acao registrada apos acesso (somente leitura) | Flag para revisao              |
| **Break-glass para paciente VIP**     | Qualquer break-glass para paciente com flag VIP       | Alerta imediato para diretoria |
| **Horario anomalo**                   | Break-glass entre 01:00-05:00 para classe C/D         | Flag para revisao              |

### 7.2 Algoritmo de Deteccao

```typescript
interface AbuseDetectionRule {
  ruleId: string;
  description: string;
  evaluate: (events: BreakGlassEvent[]) => AbuseAlert | null;
}

const abuseRules: AbuseDetectionRule[] = [
  {
    ruleId: 'ABUSE-001',
    description: 'Frequencia excessiva de break-glass',
    evaluate: (events) => {
      const byPractitioner = groupBy(events, 'practitionerId');
      for (const [practId, practEvents] of Object.entries(byPractitioner)) {
        const last30Days = practEvents.filter((e) => daysSince(e.activatedAt) <= 30);
        if (last30Days.length > 3) {
          return {
            ruleId: 'ABUSE-001',
            practitionerId: practId,
            severity: last30Days.length > 6 ? 'high' : 'medium',
            detail: `${last30Days.length} break-glass nos ultimos 30 dias`,
          };
        }
      }
      return null;
    },
  },
  {
    ruleId: 'ABUSE-002',
    description: 'Break-glass para mesmo paciente repetidamente',
    evaluate: (events) => {
      const byPractPatient = groupBy(events, (e) => `${e.practitionerId}:${e.patientId}`);
      for (const [key, pairEvents] of Object.entries(byPractPatient)) {
        const last7Days = pairEvents.filter((e) => daysSince(e.activatedAt) <= 7);
        if (last7Days.length > 1) {
          const [practId, patientId] = key.split(':');
          return {
            ruleId: 'ABUSE-002',
            practitionerId: practId,
            patientId: patientId,
            severity: 'high',
            detail: `${last7Days.length} break-glass para mesmo paciente em 7 dias`,
          };
        }
      }
      return null;
    },
  },
  {
    ruleId: 'ABUSE-003',
    description: 'Break-glass sem acao clinica subsequente',
    evaluate: (events) => {
      for (const event of events) {
        if (event.status === 'completed') {
          const clinicalActions = getClinicalActionsInPeriod(
            event.practitionerId,
            event.patientId,
            event.activatedAt,
            event.deactivatedAt,
          );
          if (clinicalActions.length === 0 && event.durationMinutes > 5) {
            return {
              ruleId: 'ABUSE-003',
              practitionerId: event.practitionerId,
              severity: 'medium',
              detail: `Break-glass de ${event.durationMinutes}min sem acao clinica registrada`,
            };
          }
        }
      }
      return null;
    },
  },
];
```

### 7.3 Metricas de Deteccao (PromQL)

```promql
# Total de break-glass por periodo
sum(increase(velya_break_glass_activated_total[24h]))

# Break-glass por classe
sum by (class) (increase(velya_break_glass_activated_total[24h]))

# Break-glass por profissional (top 10)
topk(10, sum by (practitioner) (increase(velya_break_glass_activated_total[30d])))

# Alertas de abuso gerados
sum(increase(velya_break_glass_abuse_alert_total[30d]))

# Taxa de revisao no prazo
sum(rate(velya_break_glass_review_on_time_total[30d]))
/ sum(rate(velya_break_glass_review_total[30d]))
```

---

## 8. Monitoramento de Acesso Sensivel

### 8.1 Categorias de Acesso Sensivel

Alem do break-glass, tres categorias de acesso recebem monitoramento especial:

#### 8.1.1 Pacientes VIP

| Criterio de VIP                              | Exemplos                              |
| -------------------------------------------- | ------------------------------------- |
| Funcionarios do hospital                     | Medicos, enfermeiros, diretores       |
| Familiares de funcionarios                   | Conjuges, filhos                      |
| Figuras publicas                             | Politicos, celebridades, executivos   |
| Pacientes designados pelo DPO                | Casos sensiveis, testemunhas, vitimas |
| Pacientes que solicitaram protecao adicional | Solicitacao formal ao DPO             |

**Controles para VIP**:

- Flag `VIP` no recurso Patient (visivel apenas para administradores).
- Todo acesso gera alerta para DPO (nao apenas break-glass).
- Lista de profissionais autorizados e pre-aprovada.
- Acesso fora da lista gera bloqueio + alerta imediato.
- Revisao semanal da lista de autorizados.

#### 8.1.2 Acesso ao Proprio Prontuario

| Regra                   | Descricao                                                                |
| ----------------------- | ------------------------------------------------------------------------ |
| **Deteccao automatica** | Sistema compara ID do profissional com ID do paciente                    |
| **Bloqueio por padrao** | Profissional NAO pode acessar seu proprio prontuario via sistema clinico |
| **Canal proprio**       | Acesso via portal do paciente (mesmo canal de qualquer paciente)         |
| **Alerta**              | Tentativa de acesso via sistema clinico gera alerta para DPO             |
| **Excecao**             | Medico pode acessar seus proprios exames via portal                      |

#### 8.1.3 Acesso a Prontuario de Familiares

| Regra                | Descricao                                                         |
| -------------------- | ----------------------------------------------------------------- |
| **Deteccao**         | Sistema mantem cadastro de vinculos familiares de funcionarios    |
| **Bloqueio parcial** | Profissional pode ter vinculo assistencial, mas com monitoramento |
| **Alerta**           | Todo acesso a prontuario de familiar gera alerta para coordenador |
| **Revisao**          | Revisao mensal de acessos a prontuarios de familiares             |
| **Recomendacao**     | Idealmente, familiar e atendido por outra equipe                  |

---

## 9. JIT (Just-In-Time) para TI/DBA

### 9.1 Conceito

Profissionais de TI e DBAs NAO usam break-glass clinico. Eles utilizam o modelo JIT (Just-In-Time Access), onde acesso privilegiado e concedido sob demanda, por tempo limitado, com aprovacao.

### 9.2 Fluxo JIT

```
┌──────────────────────────────────────────────────────────────┐
│ SOLICITACAO JIT                                              │
│                                                              │
│ Solicitante: DBA Pedro                                       │
│ Tipo de acesso: Leitura em tabela de producao                │
│ Justificativa: Investigacao de performance (ticket #4567)    │
│ Duracao solicitada: 2 horas                                  │
│ Escopo: SELECT em tabela encounter_events (sem PII)          │
│                                                              │
│ Aprovadores: Gerente de TI + DPO                             │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ APROVACAO                                                    │
│                                                              │
│ Gerente TI: [Aprovado] - "Ticket valido, performance critica"│
│ DPO: [Aprovado com restricao] - "Mascarar patient_name e CPF"│
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ ACESSO CONCEDIDO                                             │
│                                                              │
│ Role temporaria: velya_jit_readonly_masked                   │
│ Tabelas: encounter_events (columns mascarados: patient_name, │
│          patient_cpf, patient_phone)                         │
│ Duracao: 2 horas (expira automaticamente)                    │
│ Sessao monitorada: todas as queries registradas              │
│ IP restrito: rede corporativa                                │
└──────────────────────────────────────────────────────────────┘
```

### 9.3 Regras JIT

| Regra                        | Descricao                                                   |
| ---------------------------- | ----------------------------------------------------------- |
| **Sem acesso permanente**    | DBAs nao tem acesso permanente a tabelas com dados de saude |
| **Dual approval**            | Requer aprovacao de gerente TI + DPO                        |
| **Duracao maxima**           | 4 horas (renovavel com nova aprovacao)                      |
| **Mascaramento obrigatorio** | PII sempre mascarado, exceto com aprovacao explicita do DPO |
| **Query logging**            | Todas as queries executadas sao registradas                 |
| **Alerta de volume**         | Mais de 1000 registros em uma query gera alerta             |
| **Sem COPY/pg_dump**         | Operacoes de exportacao em massa bloqueadas                 |

---

## 10. Relatorios e Compliance

### 10.1 Relatorio Mensal de Acesso Emergencial

Gerado automaticamente para DPO e diretoria:

| Secao                  | Conteudo                                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| **Resumo executivo**   | Total de break-glass, por classe, tendencia vs mes anterior            |
| **Detalhamento**       | Lista de todos os break-glass com justificativa e resultado da revisao |
| **Analise de padrao**  | Profissionais com mais break-glass, horarios de pico, unidades         |
| **Revisoes pendentes** | Break-glass sem revisao alem do prazo                                  |
| **Alertas de abuso**   | Alertas gerados e desfecho                                             |
| **Acessos sensiveis**  | VIP, proprio prontuario, familiares                                    |
| **JIT**                | Acessos JIT concedidos e queries executadas                            |
| **Recomendacoes**      | Sugestoes de melhoria de processos para reduzir break-glass            |

### 10.2 Indicadores de Compliance

| Indicador                            | Meta                 | Frequencia |
| ------------------------------------ | -------------------- | ---------- |
| Break-glass revisados em 24h         | > 95%                | Semanal    |
| Break-glass com justificativa valida | > 90%                | Mensal     |
| Alertas de abuso investigados        | 100%                 | Mensal     |
| JIT com dual approval                | 100%                 | Mensal     |
| Acessos VIP autorizados              | 100%                 | Semanal    |
| Break-glass por 1000 internacoes     | Baseline + tendencia | Mensal     |

### 10.3 Retencao

| Tipo de Registro            | Retencao           |
| --------------------------- | ------------------ |
| AuditEvent de break-glass   | 20 anos (imutavel) |
| Formulario de justificativa | 20 anos            |
| Revisao pos-evento          | 20 anos            |
| Alertas de abuso            | 10 anos            |
| Logs de sessao JIT          | 5 anos             |
| Queries de DBA              | 5 anos             |

---

## 11. Integracao com Outros Modulos

| Modulo                | Integracao                                                     |
| --------------------- | -------------------------------------------------------------- |
| **Security & Access** | Break-glass e uma excecao controlada ao modelo RBAC+ABAC       |
| **Digital Twin**      | Break-glass concede acesso ao twin com escopo limitado         |
| **Audit Dashboards**  | Dashboard dedicado para monitoramento de break-glass           |
| **Gap Detection**     | Break-glass sem acao clinica gera gap detectado                |
| **Handoff**           | Break-glass Classe B deve resultar em handoff formal em ate 2h |
| **Shift Ownership**   | Break-glass Classe C deve resultar em atualizacao de escala    |
| **LGPD/DPO**          | Toda ativacao notifica DPO automaticamente                     |
