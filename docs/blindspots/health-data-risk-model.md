# Modelo de Risco de Dados de Saúde — Velya Platform

> **Versão**: 1.0 | **Atualizado em**: 2026-04-08 | **Dono**: Privacidade, Compliance e Arquitetura  
> **Propósito**: Mapeamento completo de riscos regulatórios e de privacidade para dados clínicos na plataforma Velya, com foco em HIPAA e proteção de PHI em contexto de AI hospitalar.

---

## Definição de PHI na Plataforma Velya

A HIPAA define Protected Health Information (PHI) como qualquer informação de saúde individualmente identificável. Na plataforma Velya, isso inclui:

### Classificação de Dados PHI

| Classe | Descrição | Exemplos concretos na Velya | Risco de Exposição |
|---|---|---|---|
| **PHI Diretamente Identificador** | Identifica o paciente por si só | Nome completo, data de nascimento, CPF/MRN, endereço, telefone, email, IP do dispositivo do paciente, foto | Catastrófico |
| **PHI Clínico Identificador** | Identifica por combinação com outros dados | Diagnóstico + unidade hospitalar, resultado de exame + data, procedimento + médico, prescrição + paciente | Crítico |
| **PHI Operacional** | Dados operacionais que revelam situação de saúde | Status de alta, lista de tarefas de alta, agenda de procedimentos, leito ocupado por nome | Alto |
| **PHI de AI** | PHI gerado ou processado por AI | Prompts com nome de paciente, responses com diagnóstico, memória de agent com dados clínicos, contexto de decisão | Crítico |
| **PHI Derivado** | Dados inferidos por AI que podem identificar | "Paciente do leito 4 com histórico de X" sem nome, mas contexto suficiente para identificação | Alto |

---

## Mapa de Fluxos de PHI

### Fluxo 1 — patient-flow-service → AI Gateway → Anthropic

```
patient-flow-service
    |
    | Envia: { patient_id, diagnosis, current_status, blockers }
    ▼
ai-gateway (packages/ai-gateway/)
    |
    | Constrói contexto: inclui campos PHI para análise de alta
    ▼
Anthropic API (Claude claude-sonnet-4-6)
    |
    | Processa dados PHI em servidor externo (EUA)
    ▼
ai-gateway
    |
    | Recebe resposta: { recommendation, confidence, rationale }
    ▼
patient-flow-service
```

**Riscos identificados**:
- PHI enviado a terceiro (Anthropic) sem BAA confirmado → Violação HIPAA
- PHI inclui campos além do mínimo necessário → Violação de minimum necessary rule
- Logs do AI Gateway podem conter PHI em request/response → Exposição em logs
- Anthropic pode usar dados para treino (verificar ToS) → Violação de privacidade

**Controles necessários antes de usar dados reais**:
1. BAA firmado com Anthropic
2. Verificar ToS: proibir uso de dados para treino (usar opção de zero data retention)
3. Implementar PHI minimization antes de enviar ao Anthropic
4. Implementar PHI redaction nos logs do AI Gateway
5. Documentar quais campos PHI são enviados e por qual justificativa

---

### Fluxo 2 — FHIR Events → NATS JetStream

```
Medplum FHIR Server
    |
    | FHIR Subscription trigger: Patient updated, Encounter created
    ▼
FHIR Subscription Handler (service interno)
    |
    | Publica: evento com payload FHIR completo (inclui PHI)
    ▼
NATS JetStream Stream (ex: "clinical.patient.updated")
    |
    | Persiste por: X dias (definido em max_age do stream)
    | Todos os subscribers recebem: PHI em plaintext
    ▼
Consumers: patient-flow-service, discharge-orchestrator, task-inbox-service
```

**Riscos identificados**:
- PHI persistido em NATS streams sem criptografia em repouso
- Todos os services subscribers têm acesso ao PHI completo, não apenas ao que precisam
- Sem controle de acesso por subject — qualquer consumer pode ouvir qualquer stream
- Retenção de PHI em stream além do período necessário
- Sem audit log de quem leu quais mensagens

**Controles necessários antes de usar dados reais**:
1. Criptografia em repouso para NATS storage
2. Controle de acesso por subject com NATS authorization (credentials por consumer)
3. Enviar apenas campos necessários no payload NATS, não o objeto FHIR completo
4. Definir `max_age` nos streams baseado em necessidade operacional (não indefinido)
5. Audit log de acesso a subjects de PHI

---

### Fluxo 3 — Logs de Serviços NestJS → Loki

```
Serviço NestJS (ex: patient-flow-service)
    |
    | Logger interceptor captura request body com PHI
    | Formato atual: não-JSON, sem sanitização
    ▼
stdout/stderr do container
    |
    | Promtail coleta e envia para Loki
    ▼
Loki
    |
    | Armazena indefinidamente (sem retenção configurada)
    | Acessível via Grafana (qualquer usuário com acesso ao Grafana)
```

**Riscos identificados**:
- PHI em logs em texto plano — qualquer pessoa com acesso ao Loki vê dados de pacientes
- Sem controle de acesso por serviço — logs de patient-flow-service acessíveis por quem vê discharge logs
- Sem retenção — PHI acumula indefinidamente
- Logs em formato não-JSON dificultam sanitização automática

**Controles necessários antes de usar dados reais**:
1. Implementar log sanitization middleware em todos os serviços NestJS
2. Redact campos PHI antes de logar: nome, CPF, endereço, diagnóstico específico
3. Converter todos os logs para JSON estruturado
4. Configurar retenção no Loki: 30 dias para logs operacionais, 1 ano para logs de auditoria (sem PHI)
5. RBAC no Grafana por namespace/serviço

---

### Fluxo 4 — OpenTelemetry Traces → Tempo

```
Serviço NestJS
    |
    | OTel SDK cria span com atributos
    | Atributos podem incluir: request body, patient_id, diagnosis
    ▼
OTel Collector
    |
    | Sampling: 100% (problemático em volume alto)
    | Sem filtro de atributos PHI
    ▼
Tempo (backend de traces)
    |
    | Armazena indefinidamente
    | Acessível via Grafana
```

**Riscos identificados**:
- PHI em atributos de spans (ex: `http.request.body.patient_name`)
- Sem attribute filtering no OTel Collector para PHI
- Sampling a 100% → custo e volume excessivos com dados reais
- Traces acessíveis a qualquer pessoa com acesso ao Grafana

**Controles necessários antes de usar dados reais**:
1. Configurar attribute filtering no OTel Collector — allowlist de atributos permitidos
2. Nunca incluir request/response body como atributo de span
3. Usar apenas IDs (patient_id, encounter_id) não dados identificadores
4. Configurar tail-based sampling: 100% erros, 5% sucessos
5. Retenção de traces: 30 dias

---

### Fluxo 5 — Frontend Browser → velya-web

```
Browser do usuário (tablet do hospital, desktop de enfermagem)
    |
    | Next.js carrega e renderiza dados de pacientes
    | React state contém PHI em memória
    | Possível armazenamento: localStorage, sessionStorage, cookies
    ▼
velya-web (Next.js 15)
    |
    | Sem autenticação implementada
    | Sem HTTPS (http://velya.172.19.0.6.nip.io)
    | PHI trafega em plaintext HTTP
    ▼
API Gateway → Serviços internos
```

**Riscos identificados**:
- Sem autenticação — qualquer usuário na rede acessa PHI de todos os pacientes
- HTTP sem TLS — PHI em texto plano na rede hospitalar (pode ser sniffada)
- PHI possivelmente em localStorage (sem criptografia)
- Sessão não expira — leito desocupado com dados de paciente na tela
- Sem RBAC — enfermeiro da UTI pode ver pacientes da pediatria

**Controles necessários antes de usar dados reais**:
1. Autenticação obrigatória — NextAuth.js com OIDC antes de qualquer acesso
2. HTTPS obrigatório — configurar TLS no ingress
3. Auditoria de uso de localStorage/sessionStorage — remover qualquer PHI
4. Session timeout após 15 minutos de inatividade
5. RBAC por unidade/especialidade — acesso somente aos pacientes de sua área

---

## Requisitos HIPAA Ausentes

### Salvaguardas Técnicas (45 CFR § 164.312)

| Requisito HIPAA | Status na Velya | Evidência | Prioridade |
|---|---|---|---|
| Controle de acesso único por usuário | Ausente — sem autenticação | Frontend sem login | Crítica |
| Audit controls — registro de quem acessou PHI | Ausente | Nenhum audit log implementado | Catastrófica |
| Integridade — PHI não alterado sem autorização | Parcial (DB tem integridade básica) | Sem assinatura de registros | Alta |
| Autenticação de pessoa ou entidade | Ausente | Sem autenticação no frontend | Crítica |
| Controles de transmissão — criptografia | Ausente (HTTP sem TLS) | http:// sem S | Crítica |
| Criptografia em repouso | Não verificado | Sem documentação de estado | Alta |

### Salvaguardas Administrativas (45 CFR § 164.308)

| Requisito HIPAA | Status na Velya | Ação Necessária |
|---|---|---|
| Designação de Privacy Officer | Ausente | Nomear responsável |
| Programa de treinamento em privacidade | Ausente | Criar e executar treinamento |
| BAA com todos os fornecedores que processam PHI | Ausente (Anthropic, AWS) | Obter BAAs urgentemente |
| Análise de risco documentada (HIPAA Risk Assessment) | Ausente | Conduzir Risk Assessment formal |
| Políticas e procedimentos documentados | Parcial (existem regras técnicas, não políticas de privacidade) | Criar políticas completas |
| Contingency Plan (backup e recuperação) | Ausente | Criar e testar |
| Breach Notification Procedure | Ausente | Criar procedimento |

### Salvaguardas Físicas (45 CFR § 164.310)

| Requisito HIPAA | Status na Velya | Ação Necessária |
|---|---|---|
| Controle de acesso físico a servidores | Aplicável em produção (EKS) | Verificar controles de data center AWS |
| Workstation use controls | Não verificado | Definir política de uso de dispositivos |
| Media controls (descarte seguro) | Ausente | Definir política de descarte |

---

## Controles Mínimos por Fluxo — Antes de Usar Dados Reais

### Pré-requisitos Absolutos (sem esses controles, uso de dados reais é proibido)

1. **BAA com Anthropic firmado** — sem BAA, qualquer envio de PHI ao AI é violação HIPAA
2. **Autenticação implementada no frontend** — sem auth, qualquer PHI na interface é exposição
3. **HTTPS no ingress** — sem TLS, transmissão de PHI é violação
4. **Log sanitization implementado** — sem sanitização, logs são dump de PHI
5. **Audit trail implementado** — sem audit log, é impossível demonstrar conformidade HIPAA

### Controles de Segunda Camada (necessários em 90 dias)

6. PHI minimization no AI Gateway
7. NATS credentials por consumer com acesso baseado em necessidade
8. Criptografia em repouso verificada (PostgreSQL, NATS, volumes)
9. Política de retenção implementada (Loki, Tempo, NATS streams)
10. OTel attribute filtering para PHI
11. Session timeout no frontend
12. RBAC por unidade hospitalar

### Controles de Maturidade (necessários antes de escala)

13. HIPAA Risk Assessment formal documentado
14. Privacy Officer designado
15. Treinamento de equipe em privacidade
16. Breach Notification Procedure testado
17. Vulnerability Assessment periódico
18. Penetration testing anual

---

## Matriz de Dados PHI por Serviço

| Serviço | Dados PHI que Acessa | BAA Necessário | Criptografia em Trânsito | Criptografia em Repouso | Audit Log | Status |
|---|---|---|---|---|---|---|
| patient-flow-service | Nome, diagnóstico, status de alta | N/A (interno) | A implementar (mTLS) | A verificar | Ausente | Não pronto |
| task-inbox-service | Tarefas com referência a paciente | N/A (interno) | A implementar | A verificar | Ausente | Não pronto |
| discharge-orchestrator | Status completo de alta, bloqueadores | N/A (interno) | A implementar | A verificar | Ausente | Não pronto |
| api-gateway | Todos os dados que transitam | N/A (interno) | HTTPS no ingress | N/A | Ausente | Não pronto |
| velya-web (frontend) | Dados apresentados ao usuário | N/A | A implementar (HTTPS) | N/A (browser) | Ausente | Não pronto |
| ai-gateway | PHI enviado ao Anthropic | **Anthropic — BAA pendente** | HTTPS para Anthropic | N/A | Ausente | **Bloqueado** |
| decision-log-service | Decisões com contexto de paciente | N/A (interno) | A implementar | A verificar | Parcial | Não pronto |
| memory-service | Memória de agent (pode conter PHI) | N/A (interno) | A implementar | A verificar | Ausente | Não pronto |
| policy-engine | Políticas aplicadas por paciente | N/A (interno) | A implementar | A verificar | Ausente | Não pronto |
| Medplum (FHIR) | Source of truth de dados clínicos | Verificar ToS | HTTPS | A verificar | Parcial | Verificar |
| NATS JetStream | Eventos com PHI | N/A (interno) | A implementar | A verificar | Ausente | Não pronto |
| PostgreSQL | Dados operacionais | N/A (interno) | A implementar | A verificar | Ausente | Não pronto |
| Loki | Logs (possivelmente com PHI) | N/A (interno) | A implementar | A verificar | N/A | **Risco ativo** |
| Tempo | Traces (possivelmente com PHI) | N/A (interno) | A implementar | A verificar | N/A | **Risco ativo** |

---

## Plano de Remediação por Prioridade

### Fase 0 — Imediato (antes de qualquer dado real)

| Ação | Responsável | Prazo | Evidência de Conclusão |
|---|---|---|---|
| Obter BAA com Anthropic | Legal/Produto | 30 dias | BAA assinado arquivado |
| Implementar autenticação no frontend | Engenharia Frontend | 30 dias | Login funcional, sem bypass |
| Implementar HTTPS no ingress | DevOps | 7 dias | `https://` acessível, HTTP redirects para HTTPS |
| Implementar log sanitization em todos os serviços | Backend | 14 dias | Scan de logs sem PHI |
| Implementar audit log básico de acesso a PHI | Backend | 30 dias | Log de audit com user_id, resource, timestamp |

### Fase 1 — 90 dias

| Ação | Responsável | Prazo | Evidência de Conclusão |
|---|---|---|---|
| PHI minimization no AI Gateway | Backend/AI | 60 dias | Schema de contexto por tarefa validado |
| NATS credentials por consumer | DevOps | 45 dias | Teste de acesso negado entre consumers não autorizados |
| Verificar e documentar criptografia em repouso | DevOps | 30 dias | Documento de estado de criptografia por sistema |
| Política de retenção em Loki e Tempo | DevOps | 30 dias | `retention_period` configurado e verificado |
| OTel attribute filtering | DevOps | 45 dias | Scan de traces sem PHI |
| Session timeout no frontend | Frontend | 30 dias | Timeout de 15 min testado |

### Fase 2 — 180 dias

| Ação | Responsável | Prazo | Evidência de Conclusão |
|---|---|---|---|
| HIPAA Risk Assessment formal | Compliance | 120 dias | Relatório de Risk Assessment documentado |
| Nomear Privacy Officer | RH/Liderança | 60 dias | Nomeação formal |
| Treinamento de equipe em privacidade | HR/Compliance | 90 dias | Certificado de conclusão por membro da equipe |
| Breach Notification Procedure | Legal/Operações | 90 dias | Procedimento documentado e simulação executada |
| RBAC por unidade hospitalar | Frontend/Backend | 90 dias | Teste de acesso negado entre unidades |

---

> **Conclusão**: A plataforma Velya atualmente não tem condições de processar dados reais de pacientes. A implementação dos controles de Fase 0 é pré-requisito absoluto antes de qualquer uso com PHI real. A violação desta diretriz constitui risco legal e ético grave.
