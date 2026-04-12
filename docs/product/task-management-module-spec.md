# Modulo de Gerenciamento de Tarefas Hospitalares — Especificacao Completa

**Versao:** 1.0
**Data:** 2026-04-12
**Autor:** Product Architecture
**Status:** Aprovado para implementacao

---

## 1. Visao Geral

Sistema de gerenciamento de tarefas hospitalares com controle ponta-a-ponta do ciclo de vida, desde a criacao ate a auditoria pos-conclusao. Substitui o modelo atual (React useState sem persistencia) por um sistema com persistencia, SLA, escalonamento, evidencia, auditoria e governanca.

**Diferencial:** Nao e um Kanban generico. E um sistema de ordens hospitalares operacionais com rastreabilidade completa, cadeia de custodia, escalonamento automatico e visibilidade por hierarquia.

---

## 2. Arquitetura Funcional

```
                                    ┌──────────────────┐
                                    │   TEMPORAL        │
                                    │   Workflows       │
                                    │   - SLA Timer     │
                                    │   - Escalation    │
                                    │   - Redistribution│
                                    └────────┬─────────┘
                                             │
┌──────────┐    ┌──────────────┐    ┌────────▼─────────┐    ┌──────────────┐
│  Frontend │───▶│  API Routes  │───▶│  Task Store      │───▶│  PostgreSQL  │
│  Next.js  │◀──│  /api/tasks  │◀──│  (Domain Logic)  │◀──│  + Audit Log │
└──────────┘    └──────────────┘    └────────┬─────────┘    └──────────────┘
                                             │
                                    ┌────────▼─────────┐
                                    │   NATS JetStream  │
                                    │   Events          │
                                    │   - task.created  │
                                    │   - task.assigned │
                                    │   - task.sla.breach│
                                    │   - task.completed│
                                    └──────────────────┘
```

**Camadas:**

| Camada | Responsabilidade |
|--------|-----------------|
| Frontend (Next.js) | UI operacional, Kanban, filtros, paineis, dashboards |
| API Routes | Validacao, autorizacao, orquestracao |
| Task Store | Logica de dominio, maquina de estados, SLA |
| Temporal Workflows | Timers de SLA, escalonamento automatico, redistribuicao |
| NATS JetStream | Eventos de dominio, notificacoes, integracao |
| PostgreSQL | Persistencia, auditoria, indices |
| Audit Logger | Hash chain, imutabilidade, compliance |

---

## 3. Mapa de Atores

### 3.1 Atores Primarios (criam e executam tarefas)

| Ator | Papel | Exemplos de tarefa |
|------|-------|-------------------|
| Medico plantonista | Prescreve, solicita, decide | Solicitar parecer, pedir exame, ajustar prescricao |
| Medico assistente | Planeja, acompanha, orienta | Plano de alta, reavaliacao, interconsulta |
| Enfermeiro(a) | Coordena cuidado, executa | Administrar medicacao, coletar exame, avaliar curative |
| Tecnico de enfermagem | Executa cuidados diretos | Verificar sinais vitais, trocar acesso, higienizar paciente |
| Farmaceutico | Valida, dispensa, orienta | Validar prescricao, separar medicacao, alertar interacao |
| Fisioterapeuta | Avalia, trata, orienta | Sessao respiratoria, mobilizacao, orientar exercicio |
| Nutricionista | Avalia, prescreve dieta | Avaliar disfagia, ajustar dieta, orientar jejum |
| Assistente social | Articula, orienta | Contatar familia, resolver pendencia previdenciaria |

### 3.2 Atores de Apoio Operacional

| Ator | Papel | Exemplos de tarefa |
|------|-------|-------------------|
| Maqueiro/Transportador | Transporta pacientes e materiais | Levar paciente ao exame, buscar hemocomponente |
| Higienizacao | Limpa e desinfecta | Limpeza terminal, limpeza concorrente, desinfeccao |
| Manutencao | Repara e mantem | Consertar cama, trocar lampada, reparar tomada O2 |
| Recepcao | Registra e orienta | Conferir documentacao, registrar acompanhante |

### 3.3 Atores de Gestao

| Ator | Papel | Escopo |
|------|-------|--------|
| Coordenador de ala | Supervisiona turno, distribui carga | Uma ala/setor |
| Chefe de enfermagem | Governa enfermagem, escala | Departamento |
| Chefia medica | Governa corpo clinico | Departamento |
| Gerente assistencial | Governa operacao clinica | Hospital |
| Diretor clinico | Decisao final, break-glass | Hospital |

### 3.4 Atores de Sistema

| Ator | Papel |
|------|-------|
| Motor de SLA (Temporal) | Dispara timers, escalonamento |
| Motor de escala | Identifica responsavel por turno |
| Motor de notificacao | Envia alertas inteligentes |
| Agente de auditoria | Valida integridade do log |

---

## 4. Perfis e Permissoes

### 4.1 Matriz de Permissoes

| Permissao | Medico | Enfermeiro | Tec.Enf | Farmacia | Fisio | Maqueiro | Limp | Manut | Coord | Chefe | Gerente | Diretor |
|-----------|--------|------------|---------|----------|-------|----------|------|-------|-------|-------|---------|---------|
| Criar tarefa | S | S | N | S | S | N | N | N | S | S | S | S |
| Delegar para subordinado | S | S | N | S | S | N | N | N | S | S | S | S |
| Delegar para par | S | S | N | S | S | N | N | N | S | S | S | S |
| Delegar para superior | S | S | S | S | S | S | S | S | S | S | S | S |
| Receber tarefa | S | S | S | S | S | S | S | S | S | S | S | S |
| Aceitar tarefa | S | S | S | S | S | S | S | S | S | S | S | S |
| Recusar com motivo | S | S | S | S | S | S | S | S | S | S | S | S |
| Registrar impedimento | S | S | S | S | S | S | S | S | S | S | S | S |
| Concluir tarefa | S | S | S | S | S | S | S | S | S | S | S | S |
| Anexar evidencia | S | S | S | S | S | S | S | S | S | S | S | S |
| Escalar manualmente | S | S | S | S | S | N | N | N | S | S | S | S |
| Reatribuir tarefa alheia | N | N | N | N | N | N | N | N | S | S | S | S |
| Cancelar tarefa alheia | N | N | N | N | N | N | N | N | S | S | S | S |
| Ver todas tarefas da ala | N | N | N | N | N | N | N | N | S | S | S | S |
| Ver todas tarefas do hospital | N | N | N | N | N | N | N | N | N | N | S | S |
| Ver auditoria | N | N | N | N | N | N | N | N | S | S | S | S |
| Configurar SLA | N | N | N | N | N | N | N | N | N | N | S | S |
| Break-glass (forcar conclusao) | N | N | N | N | N | N | N | N | N | N | N | S |

### 4.2 Regras de Delegacao por Hierarquia

```
Diretor clinico
  └── Gerente assistencial
        └── Chefe de enfermagem / Chefia medica
              └── Coordenador de ala
                    └── Enfermeiro(a)
                          └── Tecnico de enfermagem
                                └── (nao delega para baixo)
```

- Delegacao para **baixo**: direta, sem aprovacao
- Delegacao para **par**: direta, sem aprovacao
- Delegacao para **cima** (escalonamento): permitida, registrada como escalacao
- Delegacao **cross-funcional** (enfermagem→limpeza): permitida se o criador tem permissao sobre aquela categoria de tarefa
- Delegacao para **fora do turno**: proibida — sistema redireciona para responsavel do turno

---

## 5. Quadro de Status (Maquina de Estados)

### 5.1 Status Completo

| Status | Codigo | Descricao | Quem pode transicionar |
|--------|--------|-----------|----------------------|
| Rascunho | `draft` | Criada mas nao enviada | Criador |
| Aberta | `open` | Enviada, aguardando recebimento | Sistema (automatico) |
| Recebida | `received` | Destinatario confirmou recebimento | Destinatario |
| Aceita | `accepted` | Destinatario confirmou que vai executar | Destinatario |
| Em andamento | `in_progress` | Execucao iniciada | Executor |
| Impedida | `blocked` | Execucao travada por dependencia externa | Executor |
| Concluida | `completed` | Execucao finalizada, evidencia anexada | Executor |
| Verificada | `verified` | Conclusao validada pelo solicitante | Solicitante |
| Recusada | `declined` | Destinatario recusou com motivo | Destinatario |
| Reatribuida | `reassigned` | Redirecionada para outro responsavel | Coordenador, criador |
| Cancelada | `cancelled` | Cancelada pelo criador ou coordenador | Criador, coordenador |
| Expirada | `expired` | SLA estourou sem acao | Sistema |
| Escalada | `escalated` | Encaminhada para nivel superior | Sistema ou manual |

### 5.2 Diagrama de Transicoes

```
draft ──────────▶ open
                   │
                   ├──▶ received ──▶ accepted ──▶ in_progress ──▶ completed ──▶ verified
                   │       │            │              │              │
                   │       │            │              ├──▶ blocked ──┘
                   │       │            │              │       │
                   │       │            │              │       └──▶ in_progress (desbloqueio)
                   │       │            │              │
                   │       │            └──▶ declined (com motivo)
                   │       │
                   │       └──▶ declined (com motivo)
                   │
                   ├──▶ expired (SLA sem recebimento)
                   ├──▶ escalated (manual ou automatico)
                   ├──▶ reassigned (coordenador reatribui)
                   └──▶ cancelled (criador cancela)

Qualquer status ──▶ escalated (por SLA breach)
```

### 5.3 Regras de Transicao

| De | Para | Condicao | Obrigatorio |
|----|------|----------|------------|
| draft → open | Criador envia | Destinatario preenchido | SLA definido se tipo exige |
| open → received | Destinatario clica "Recebi" | - | Timestamp registrado |
| open → expired | SLA de recebimento estourou | Sem acao do destinatario | Escalamento automatico |
| received → accepted | Destinatario clica "Aceito" | - | Timestamp registrado |
| received → declined | Destinatario recusa | Motivo estruturado | Motivo obrigatorio |
| accepted → in_progress | Destinatario inicia execucao | - | Timer de execucao inicia |
| in_progress → blocked | Executor registra impedimento | Motivo + tipo de bloqueio | Timer pausa |
| blocked → in_progress | Executor desbloqueia | Resolucao informada | Timer retoma |
| in_progress → completed | Executor conclui | Evidencia se tipo exige | Timestamp + evidencia |
| completed → verified | Solicitante valida conclusao | - | Opcional por tipo |
| * → escalated | SLA breach ou acao manual | - | Proximo nivel notificado |
| * → reassigned | Coordenador reatribui | Novo destinatario | Historico mantido |
| * → cancelled | Criador cancela | Motivo | Somente antes de in_progress |

---

## 6. Regras de SLA

### 6.1 Tabela de SLA por Tipo e Prioridade

| Tipo de tarefa | Urgente | Alta | Normal | Baixa |
|----------------|---------|------|--------|-------|
| **Recebimento** (tempo max para confirmar recebimento) | 5 min | 15 min | 30 min | 2h |
| **Aceite** (tempo max para aceitar apos recebimento) | 5 min | 15 min | 1h | 4h |
| **Inicio execucao** (tempo max para iniciar apos aceite) | 10 min | 30 min | 2h | 8h |
| **Conclusao** (tempo max para concluir apos inicio) | Depende do tipo | Depende do tipo | Depende do tipo | Depende do tipo |

### 6.2 SLA de Conclusao por Categoria

| Categoria | Urgente | Alta | Normal | Baixa |
|-----------|---------|------|--------|-------|
| Medicacao (admin) | 30 min | 1h | 2h | turno |
| Coleta de exame | 30 min | 1h | 4h | 12h |
| Transporte paciente | 15 min | 30 min | 1h | 4h |
| Limpeza terminal | 30 min | 1h | 2h | turno |
| Limpeza concorrente | 15 min | 30 min | 1h | 4h |
| Manutencao corretiva | 1h | 4h | 24h | 72h |
| Parecer medico | 1h | 4h | 12h | 48h |
| Preparo de alta | 2h | 4h | 8h | 24h |
| Procedimento enfermagem | 30 min | 1h | 4h | turno |

### 6.3 Mecanica de Timer

1. Timer inicia quando tarefa transiciona para o status que o SLA cobre
2. Timer **pausa** quando status vai para `blocked`
3. Timer **retoma** quando status sai de `blocked`
4. Timer **zera** quando SLA de fase e atendido (ex: recebimento OK, inicia timer de aceite)
5. Timer **acumula** tempo total elapsed para metricas (excluindo pausa)

### 6.4 Alertas de SLA

| Threshold | Acao |
|-----------|------|
| 50% do SLA consumido | Notificacao sutil ao executor (badge no menu) |
| 75% do SLA consumido | Notificacao direta ao executor (push/alert) |
| 90% do SLA consumido | Notificacao ao coordenador da ala |
| 100% do SLA consumido | **SLA BREACH** — escalonamento automatico |

---

## 7. Regras de Escalonamento

### 7.1 Cadeia de Escalonamento

```
Nivel 0: Executor designado
  │ (SLA breach)
Nivel 1: Coordenador da ala do executor
  │ (15 min sem acao do coordenador)
Nivel 2: Chefe do departamento
  │ (30 min sem acao do chefe)
Nivel 3: Gerente assistencial
  │ (1h sem acao do gerente)
Nivel 4: Diretor clinico (break-glass)
```

### 7.2 Regras por Criticidade

| Prioridade | Escalonamento automatico | Pula niveis |
|-----------|------------------------|-------------|
| Urgente | A cada 5 min | Sim (0→2 se clinico) |
| Alta | A cada 15 min | Nao |
| Normal | A cada 30 min | Nao |
| Baixa | A cada 2h | Nao |

### 7.3 Acoes no Escalonamento

1. Tarefa marcada como `escalated` no historico
2. Notificacao enviada ao proximo nivel
3. Dashboard do coordenador/chefe mostra alerta
4. Se escalonamento atinge Nivel 3+, tarefa aparece no painel executivo
5. Se escalonamento atinge Nivel 4, gera evento de auditoria de alta severidade

### 7.4 Desescalonamento

- Quando o nivel superior age (aceita, reatribui, resolve), a tarefa volta para status operacional
- O historico mantem registro completo da cadeia de escalonamento
- Metricas contabilizam "escalonamentos por area" e "tempo em escalonamento"

---

## 8. Regras de Aceite e Reconhecimento

### 8.1 Reconhecimento (Recebimento)

- Toda tarefa delegada inicia em status `open`
- O destinatario **deve clicar "Recebi"** para confirmar
- Clicar "Recebi" nao e aceitar — e confirmar que viu
- O sistema registra: quem recebeu, quando, de qual dispositivo
- Se o destinatario nao receber dentro do SLA de recebimento, **escalonamento automatico**

### 8.2 Aceite

- Apos receber, o destinatario deve **aceitar ou recusar**
- Aceitar significa: "vou executar esta tarefa"
- O sistema registra: quem aceitou, quando
- Se nao aceitar dentro do SLA de aceite, **escalonamento automatico**

### 8.3 Aceite Implicito

Certos tipos de tarefa podem configurar aceite implicito:
- Tarefas de limpeza: aceite implicito ao iniciar execucao
- Tarefas de transporte: aceite implicito ao receber

Configuravel por tipo de tarefa no registro de tipos.

### 8.4 Aceite em Lote

- Coordenadores podem aceitar multiplas tarefas de uma vez para sua equipe
- O aceite em lote registra o coordenador como "aceito por" e o executor como "designado"

---

## 9. Regras de Evidencia

### 9.1 Categorias de Evidencia

| Tipo | Descricao | Exemplo |
|------|-----------|---------|
| `text` | Texto livre | "Medicacao administrada conforme prescricao" |
| `checklist` | Lista de itens verificados | Check de limpeza terminal (12 itens) |
| `photo` | Foto do resultado | Foto da area limpa, foto do curativo |
| `signature` | Assinatura digital | Confirmacao de entrega de medicacao |
| `timestamp` | Registro automatico de horario | Hora da administracao de medicacao |
| `measurement` | Valor medido | Sinais vitais pos-procedimento |
| `document` | Documento anexado | Laudo, resultado, formulario preenchido |

### 9.2 Obrigatoriedade por Tipo de Tarefa

| Categoria de tarefa | Evidencia obrigatoria | Tipo |
|--------------------|-----------------------|------|
| Administracao de medicacao | Sim | timestamp + text |
| Coleta de exame | Sim | timestamp + checklist |
| Limpeza terminal | Sim | checklist + photo |
| Limpeza concorrente | Sim | checklist |
| Transporte de paciente | Sim | timestamp (partida + chegada) |
| Manutencao corretiva | Sim | text + photo |
| Procedimento de enfermagem | Sim | text + checklist |
| Parecer medico | Sim | document (evolucao) |
| Tarefa administrativa | Nao | text (opcional) |
| Tarefa de coordenacao | Nao | text (opcional) |

### 9.3 Validacao de Evidencia

- Evidencia obrigatoria bloqueia transicao para `completed` se ausente
- Evidencia deve ser anexada pelo executor (nao por terceiro)
- Foto deve ter timestamp e geolocalizacao do dispositivo (se disponivel)
- Checklist deve ter todos os itens marcados para considerar completa

---

## 10. Regras de Auditoria

### 10.1 Eventos Auditados

Todo evento gera um registro na audit chain (hash chain imutavel):

| Evento | Dados registrados |
|--------|------------------|
| task.created | Criador, tipo, prioridade, destinatario, SLA, paciente |
| task.received | Receptor, timestamp, dispositivo |
| task.accepted | Executor, timestamp |
| task.declined | Executor, motivo estruturado, timestamp |
| task.started | Executor, timestamp |
| task.blocked | Executor, motivo, tipo de bloqueio, timestamp |
| task.unblocked | Executor, resolucao, timestamp |
| task.completed | Executor, evidencia, timestamp |
| task.verified | Verificador, timestamp, aceite/rejeicao |
| task.escalated | Nivel, motivo (auto/manual), de quem para quem |
| task.reassigned | Quem reatribuiu, de quem para quem, motivo |
| task.cancelled | Quem cancelou, motivo |
| task.sla_warning | Threshold atingido, tempo restante |
| task.sla_breach | SLA violado, tempo excedido, nivel de escalonamento |
| task.comment | Quem comentou, conteudo |

### 10.2 Retencao

- Registros de auditoria: 7 anos (requisito regulatorio hospitalar)
- Hash chain verificada diariamente pelo agente de auditoria
- Backup incremental diario para S3

### 10.3 Consulta de Auditoria

- Coordenador: ve auditoria da sua ala
- Chefe: ve auditoria do departamento
- Gerente: ve auditoria do hospital
- Diretor: ve tudo, incluindo break-glass
- Compliance auditor: ve tudo, pode exportar

---

## 11. Regras de Recusa e Bloqueio

### 11.1 Motivos Estruturados de Recusa

| Codigo | Motivo | Acao do sistema |
|--------|--------|----------------|
| `not_my_scope` | Fora do meu escopo profissional | Redireciona para criador |
| `not_my_shift` | Fora do meu turno | Redireciona para responsavel do turno |
| `patient_transferred` | Paciente transferido | Redireciona para ala destino |
| `already_done` | Ja realizado | Solicita evidencia |
| `duplicate` | Duplicata de outra tarefa | Solicita ID da tarefa original |
| `insufficient_info` | Informacoes insuficientes | Devolve ao criador com pedido de complemento |
| `resource_unavailable` | Recurso/material indisponivel | Bloqueia e notifica suprimentos |
| `clinical_contraindication` | Contraindicacao clinica | Escala para medico responsavel |
| `other` | Outro (texto livre obrigatorio) | Devolve ao criador |

### 11.2 Motivos Estruturados de Bloqueio

| Codigo | Motivo | Acao do sistema |
|--------|--------|----------------|
| `waiting_lab` | Aguardando resultado de exame | Timer pausa, monitora lab |
| `waiting_pharmacy` | Aguardando farmacia | Timer pausa, monitora farmacia |
| `waiting_transport` | Aguardando transporte | Timer pausa, monitora transporte |
| `waiting_cleaning` | Aguardando limpeza | Timer pausa, monitora limpeza |
| `waiting_equipment` | Aguardando equipamento | Timer pausa, notifica manutencao |
| `waiting_physician` | Aguardando avaliacao medica | Timer pausa, notifica medico |
| `waiting_family` | Aguardando contato com familia | Timer pausa |
| `waiting_insurance` | Aguardando autorizacao convenio | Timer pausa |
| `patient_unstable` | Paciente instavel, procedimento adiado | Timer pausa, registra clinico |
| `other` | Outro (texto livre obrigatorio) | Timer pausa |

### 11.3 Regras de Bloqueio

- Bloqueio **pausa** o timer de SLA
- Bloqueio **nao pausa** o timer de escalonamento — se o bloqueio dura mais que 2x o SLA original, escala
- Executor deve informar estimativa de desbloqueio
- Sistema monitora status do recurso bloqueante (se rastreavel)
- Coordenador pode forcar desbloqueio se necessario

---

## 12. Regras de Redistribuicao por Ausencia/Plantao

### 12.1 Deteccao de Ausencia

| Situacao | Deteccao | Acao |
|----------|----------|------|
| Fim de turno | Escala cadastrada | Redistribuir para turno seguinte |
| Saida nao programada | Coordenador registra | Redistribuir para par disponivel |
| Ferias/licenca | RH registra | Tarefas futuras para cobertura |
| Sem login > 30 min | Sistema detecta | Alerta ao coordenador |

### 12.2 Logica de Redistribuicao

1. Identificar tarefas `open` ou `received` do profissional ausente
2. Identificar profissionais do mesmo perfil no turno atual
3. Ordenar por carga de trabalho (menos tarefas primeiro)
4. Redistribuir automaticamente se configurado, ou alertar coordenador
5. Registrar no historico: "Redistribuida por fim de turno de [nome]"

### 12.3 Protecoes

- Nao redistribuir tarefas `in_progress` automaticamente (requer acao do coordenador)
- Nao redistribuir para profissional com carga > 150% da media
- Nao redistribuir cross-funcional automaticamente (enfermagem nao recebe manutencao)
- Manter tarefa com o mesmo executor se proximo turno e da mesma pessoa

---

## 13. Taxonomia dos Tipos de Tarefa

### 13.1 Categorias e Tipos

```
ASSISTENCIAL
├── Medicacao
│   ├── Administrar medicacao oral
│   ├── Administrar medicacao IV
│   ├── Administrar medicacao IM/SC
│   ├── Preparar infusao
│   └── Reconciliar medicacao
├── Exames
│   ├── Coletar amostra laboratorial
│   ├── Preparar paciente para exame
│   ├── Acompanhar paciente ao exame
│   └── Registrar resultado
├── Procedimentos
│   ├── Curativo simples
│   ├── Curativo complexo
│   ├── Sondagem
│   ├── Aspiracao
│   ├── Higiene paciente
│   └── Mudanca de decubito
├── Avaliacao
│   ├── Sinais vitais
│   ├── Escala de dor
│   ├── NEWS2
│   ├── Braden
│   ├── Glasgow
│   └── Balanco hidrico
├── Parecer
│   ├── Interconsulta
│   ├── Parecer especializado
│   └── Avaliacao multidisciplinar
└── Alta
    ├── Preparar documentacao de alta
    ├── Orientar paciente/familia
    ├── Reconciliar medicacao de alta
    └── Agendar retorno

APOIO OPERACIONAL
├── Limpeza
│   ├── Limpeza terminal
│   ├── Limpeza concorrente
│   ├── Desinfeccao especifica
│   └── Limpeza de area comum
├── Transporte
│   ├── Transporte de paciente intra-hospitalar
│   ├── Transporte de material biologico
│   ├── Transporte de medicacao
│   ├── Transporte de equipamento
│   └── Transporte de roupa/residuo
├── Manutencao
│   ├── Manutencao corretiva
│   ├── Manutencao preventiva
│   ├── Troca de equipamento
│   └── Calibracao
└── Nutricao
    ├── Preparo de dieta especial
    ├── Entrega de refeicao
    └── Recolhimento de bandeja

ADMINISTRATIVO
├── Documentacao
│   ├── Conferir documentacao de internacao
│   ├── Solicitar autorizacao de convenio
│   ├── Emitir guia
│   └── Registrar evolucao
├── Faturamento
│   ├── Revisar conta hospitalar
│   ├── Corrigir glosa
│   └── Emitir cobranca
└── Coordenacao
    ├── Reuniao multidisciplinar
    ├── Passagem de plantao
    ├── Escalar caso
    └── Comunicar familia
```

### 13.2 Configuracao por Tipo

Cada tipo registra:

```typescript
interface TaskTypeConfig {
  id: string;                    // e.g., 'med-admin-oral'
  category: string;              // 'assistencial' | 'apoio' | 'administrativo'
  subcategory: string;           // e.g., 'medicacao', 'limpeza'
  label: string;                 // e.g., 'Administrar medicacao oral'
  defaultPriority: Priority;
  requiresPatient: boolean;
  requiresLocation: boolean;
  requiresEvidence: boolean;
  evidenceTypes: EvidenceType[];
  implicitAccept: boolean;
  requiresVerification: boolean;
  slaOverrides?: Partial<SLAConfig>;
  allowedCreatorRoles: string[];
  allowedExecutorRoles: string[];
  checklistTemplate?: string[];  // pre-defined checklist items
  fhirTaskCode?: string;        // FHIR Task.code mapping
}
```

---

## 14. Taxonomia de Motivos de Atraso/Impedimento

### 14.1 Categorias de Atraso

| Categoria | Codigos | Atribuicao |
|-----------|---------|------------|
| Recurso humano | `staff_unavailable`, `staff_overloaded`, `shift_change` | Coordenacao |
| Material/equipamento | `material_stockout`, `equipment_broken`, `equipment_in_use` | Suprimentos/Manutencao |
| Dependencia clinica | `waiting_lab`, `waiting_imaging`, `patient_unstable`, `clinical_review` | Corpo clinico |
| Dependencia administrativa | `waiting_insurance`, `waiting_documentation`, `waiting_signature` | Administrativo |
| Dependencia externa | `waiting_family`, `waiting_external_provider`, `waiting_ambulance` | Externo |
| Infraestrutura | `room_unavailable`, `elevator_broken`, `system_down` | TI/Manutencao |

### 14.2 Obrigatoriedade

- Todo atraso > 50% do SLA exige selecao de motivo
- Motivo `other` exige texto livre com minimo de 20 caracteres
- Sistema sugere motivo com base no contexto (se bloqueio e por exame, sugere `waiting_lab`)

---

## 15. Modelo de Dados

### 15.1 Entidade Principal: Task

```typescript
interface HospitalTask {
  // Identidade
  id: string;                        // TASK-{YYYYMMDD}-{seq}
  shortCode: string;                 // T-{seq} (referencia curta)
  version: number;                   // Incrementa a cada update
  
  // Classificacao
  type: string;                      // ID do TaskTypeConfig
  category: TaskCategory;            // 'assistencial' | 'apoio' | 'administrativo'
  subcategory: string;
  priority: Priority;                // 'urgent' | 'high' | 'normal' | 'low'
  
  // Status
  status: TaskStatus;                // ver quadro de status
  previousStatus?: TaskStatus;
  statusChangedAt: string;           // ISO 8601
  
  // Descricao
  title: string;
  description?: string;
  instructions?: string;             // Instrucoes especificas para executor
  
  // Contexto clinico
  patientId?: string;
  patientMrn?: string;
  patientName?: string;
  ward: string;                      // Ala/setor
  bed?: string;                      // Leito
  location?: string;                 // Localizacao especifica
  
  // Pessoas
  createdBy: ActorRef;
  assignedTo: ActorRef;
  acceptedBy?: ActorRef;
  completedBy?: ActorRef;
  verifiedBy?: ActorRef;
  currentEscalationLevel: number;    // 0 = executor, 1 = coord, etc.
  
  // SLA
  sla: SLAState;
  
  // Evidencia
  evidence: Evidence[];
  checklistItems?: ChecklistItem[];
  
  // Dependencias
  parentTaskId?: string;             // Tarefa pai (subtarefa)
  blockedBy?: string[];              // IDs de tarefas bloqueantes
  relatedEntityType?: string;        // 'prescription' | 'lab_order' | 'bed' | etc.
  relatedEntityId?: string;
  
  // Bloqueio
  blockReason?: BlockReason;
  blockReasonText?: string;
  blockedAt?: string;
  estimatedUnblockAt?: string;
  
  // Recusa
  declineReason?: DeclineReason;
  declineReasonText?: string;
  
  // Historico
  history: TaskHistoryEntry[];
  comments: TaskComment[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  verifiedAt?: string;
  cancelledAt?: string;
  
  // Metadados
  source: 'manual' | 'system' | 'workflow' | 'escalation';
  tags?: string[];
  shift?: string;                    // Turno em que foi criada
}

interface ActorRef {
  id: string;
  name: string;
  role: string;
  ward?: string;
}

interface SLAState {
  receiveBy: string;                 // Deadline para recebimento
  acceptBy: string;                  // Deadline para aceite
  startBy: string;                   // Deadline para inicio
  completeBy: string;                // Deadline para conclusao
  currentPhase: 'receive' | 'accept' | 'start' | 'complete';
  elapsedMs: number;                 // Tempo total consumido
  pausedMs: number;                  // Tempo em pausa (bloqueio)
  breached: boolean;
  breachCount: number;               // Quantas fases ja estouraram
  breachedPhases: string[];
}

interface Evidence {
  id: string;
  type: 'text' | 'checklist' | 'photo' | 'signature' | 'timestamp' | 'measurement' | 'document';
  value: string;                     // Texto, URL da foto, valor medido
  attachedBy: ActorRef;
  attachedAt: string;
  metadata?: Record<string, unknown>;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  checkedBy?: ActorRef;
  checkedAt?: string;
}

interface TaskHistoryEntry {
  id: string;
  action: string;                    // 'created' | 'received' | 'accepted' | etc.
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
  actor: ActorRef;
  timestamp: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

interface TaskComment {
  id: string;
  author: ActorRef;
  text: string;
  createdAt: string;
}
```

### 15.2 Schema PostgreSQL (simplificado)

```sql
CREATE TABLE hospital_tasks (
  id            TEXT PRIMARY KEY,
  short_code    TEXT UNIQUE NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  type          TEXT NOT NULL,
  category      TEXT NOT NULL,
  subcategory   TEXT NOT NULL,
  priority      TEXT NOT NULL,
  status        TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  patient_id    TEXT,
  patient_mrn   TEXT,
  ward          TEXT NOT NULL,
  bed           TEXT,
  created_by    JSONB NOT NULL,
  assigned_to   JSONB NOT NULL,
  sla           JSONB NOT NULL,
  evidence      JSONB NOT NULL DEFAULT '[]',
  checklist     JSONB,
  history       JSONB NOT NULL DEFAULT '[]',
  comments      JSONB NOT NULL DEFAULT '[]',
  block_reason  TEXT,
  decline_reason TEXT,
  parent_task_id TEXT REFERENCES hospital_tasks(id),
  source        TEXT NOT NULL DEFAULT 'manual',
  tags          TEXT[],
  shift         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at   TIMESTAMPTZ,
  accepted_at   TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  verified_at   TIMESTAMPTZ
);

CREATE INDEX idx_tasks_status ON hospital_tasks(status);
CREATE INDEX idx_tasks_assigned ON hospital_tasks((assigned_to->>'id'));
CREATE INDEX idx_tasks_ward ON hospital_tasks(ward);
CREATE INDEX idx_tasks_patient ON hospital_tasks(patient_mrn);
CREATE INDEX idx_tasks_priority_status ON hospital_tasks(priority, status);
CREATE INDEX idx_tasks_sla_breach ON hospital_tasks(((sla->>'breached')::boolean)) WHERE (sla->>'breached')::boolean = true;
```

---

## 16. Telas e Componentes

### 16.1 Mapa de Telas

| Tela | Rota | Perfil | Proposito |
|------|------|--------|-----------|
| Kanban Operacional | /tasks | Executor | Board pessoal de tarefas |
| Kanban da Ala | /tasks/ward | Coordenador | Board de toda a ala |
| Criar Tarefa | /tasks/new | Criador | Formulario de criacao |
| Detalhe da Tarefa | /tasks/[id] | Todos | Timeline + acoes + evidencia |
| Dashboard Tatico | /tasks/dashboard | Coordenador/Chefe | Metricas da ala/departamento |
| Dashboard Executivo | /tasks/executive | Gerente/Diretor | Metricas do hospital |
| Configuracao de Tipos | /tasks/config | Gerente | Cadastro de tipos e SLA |

### 16.2 Componentes

| Componente | Descricao |
|------------|-----------|
| `TaskKanbanBoard` | Board com colunas por status, drag-and-drop |
| `TaskCard` | Card de tarefa no board (prioridade, SLA, executor, paciente) |
| `TaskCreateForm` | Formulario de criacao com selecao de tipo, destinatario, paciente |
| `TaskDetailPanel` | Painel lateral com timeline completa, acoes, evidencia |
| `TaskTimeline` | Timeline vertical dos eventos da tarefa |
| `TaskSLAIndicator` | Indicador visual do SLA (barra de progresso neutral) |
| `TaskEvidenceAttacher` | Upload de evidencia (foto, documento, checklist) |
| `TaskChecklistEditor` | Checklist editavel para evidencia |
| `TaskDeclineModal` | Modal de recusa com motivo estruturado |
| `TaskBlockModal` | Modal de impedimento com motivo estruturado |
| `TaskReassignModal` | Modal de reatribuicao com busca de profissional |
| `TaskEscalationBanner` | Banner de escalonamento no topo da tela |
| `TaskMetricsPanel` | Painel de metricas (SLA compliance, throughput, etc.) |
| `TaskFilterBar` | Barra de filtros (prioridade, tipo, ala, executor, status) |

---

## 17. Dashboards

### 17.1 Dashboard Operacional (Executor)

```
┌──────────────────────────────────────────────────────┐
│ Minhas Tarefas                    [Filtros] [Kanban] │
├──────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │ Abertas  │ │ Aceitas │ │ Em Exec │ │ Impedida│    │
│ │    3     │ │    2    │ │    1    │ │    1    │    │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│                                                      │
│ ┌────────────────────────────────────────────────┐   │
│ │ T-042 Administrar Dipirona IV - Leito 302A    │   │
│ │ SLA: ████████░░ 80% | Vence em 12 min         │   │
│ │ [Recebi] [Recusar]                             │   │
│ └────────────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────────────┐   │
│ │ T-039 Coleta HMG - Leito 205B                 │   │
│ │ SLA: █████░░░░░ 50% | Vence em 1h             │   │
│ │ [Iniciar] [Bloquear]                           │   │
│ └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### 17.2 Dashboard Tatico (Coordenador de Ala)

```
┌──────────────────────────────────────────────────────┐
│ Ala 3B — Painel de Controle              [Periodo]   │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│ Tarefas  │ SLA OK   │ SLA Risk │ SLA Fail │ Escalad │
│   47     │   38     │    5     │    3     │    1    │
├──────────┴──────────┴──────────┴──────────┴─────────┤
│                                                      │
│ Distribuicao por Profissional                        │
│ ┌──────────────────────────────────────┐             │
│ │ Ana Silva (Enf) ████████ 8 tarefas   │             │
│ │ Carlos M. (Tec) ██████ 6 tarefas     │             │
│ │ Maria J. (Enf)  ████ 4 tarefas       │             │
│ └──────────────────────────────────────┘             │
│                                                      │
│ Tarefas em Risco de SLA                              │
│ ┌────────────────────────────────────────────────┐   │
│ │ T-042 Dipirona IV 302A | Ana Silva | 12 min   │   │
│ │ T-051 Limpeza 305 | Eq.Limp | 8 min           │   │
│ │ [Reatribuir] [Escalar]                         │   │
│ └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### 17.3 Dashboard Executivo (Gerente/Diretor)

```
┌──────────────────────────────────────────────────────┐
│ Hospital — Visao Executiva            [7d] [30d]     │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│ Total    │ Comply%  │ TMA      │ Escalac. │ Recusas │
│  1.247   │  91,3%   │  47 min  │   23     │   8     │
├──────────┴──────────┴──────────┴──────────┴─────────┤
│                                                      │
│ Compliance SLA por Area                              │
│ Ala 3A ██████████████████░░ 92%                      │
│ Ala 3B ████████████████░░░░ 85%                      │
│ UTI    ██████████████████░░ 94%                      │
│ CC     ███████████████░░░░░ 78%                      │
│ Limp   ████████████████████ 97%                      │
│                                                      │
│ Top Motivos de Atraso (30d)                          │
│ 1. Aguardando farmacia (31)                          │
│ 2. Profissional sobrecarregado (22)                  │
│ 3. Equipamento indisponivel (14)                     │
└──────────────────────────────────────────────────────┘
```

---

## 18. Automacoes

### 18.1 Temporal Workflows

| Workflow | Trigger | Acao |
|----------|---------|------|
| `TaskSLATimerWorkflow` | Tarefa criada | Inicia timers de SLA por fase, dispara alertas nos thresholds |
| `TaskEscalationWorkflow` | SLA breach | Sobe niveis de escalonamento a cada intervalo |
| `ShiftHandoverWorkflow` | Fim de turno (escala) | Redistribui tarefas abertas para turno seguinte |
| `TaskReminderWorkflow` | Tarefa em status parado > X min | Envia lembrete ao executor |
| `BlockDependencyWatcher` | Tarefa bloqueada | Monitora status do recurso bloqueante, desbloqueia quando disponivel |

### 18.2 NATS Events

| Subject | Publisher | Subscriber |
|---------|-----------|------------|
| `tasks.created` | API | SLA Timer, Notificacao |
| `tasks.status-changed` | API | SLA Timer, Dashboard, Auditoria |
| `tasks.sla.warning` | SLA Timer | Notificacao |
| `tasks.sla.breach` | SLA Timer | Escalonamento, Auditoria, Dashboard |
| `tasks.escalated` | Escalonamento | Notificacao, Dashboard |
| `tasks.completed` | API | Metricas, Auditoria |
| `tasks.evidence.attached` | API | Auditoria |

### 18.3 Notificacao Inteligente

**Anti-spam:**
- Agrupar notificacoes do mesmo tipo em batch (max 1 a cada 5 min)
- Nao notificar sobre tarefas de prioridade baixa fora do turno
- Nao notificar sobre tarefas ja em andamento por outro profissional
- Consolidar alertas de SLA em um unico digest a cada 15 min

**Canais:**
- Badge no menu (sempre, contagem)
- Push no navegador (urgente e alta)
- Som sutil (urgente, se configurado pelo usuario)
- Banner na tela (SLA breach)

---

## 19. Casos de Uso Detalhados

### 19.1 Caso: Enfermeira administra medicacao

1. Medico prescreve Dipirona 1g IV 6/6h para paciente do leito 302A
2. Sistema cria tarefa automatica `med-admin-iv` com SLA urgente (30 min)
3. Tarefa atribuida a enfermeira do turno da ala 3B (Ana Silva)
4. Ana recebe notificacao (badge + push)
5. Ana clica "Recebi" — status `received`, timer de aceite inicia
6. Ana clica "Iniciar" — status `in_progress`, timer de execucao inicia
7. Ana administra a medicacao, marca checklist (verificou paciente, verificou medicacao, verificou via, administrou)
8. Ana clica "Concluir" com evidencia: timestamp + texto "Administrada sem intercorrencias"
9. Tarefa vai para `completed`
10. Auditoria registra todo o fluxo

### 19.2 Caso: Maqueiro transporta paciente — impedimento

1. Enfermeira cria tarefa `transport-patient` para levar paciente do 302A ao raio-X
2. Maqueiro Carlos recebe (aceite implicito neste tipo)
3. Carlos inicia transporte — status `in_progress`
4. Elevador quebrado — Carlos clica "Bloquear" com motivo `elevator_broken`
5. Timer pausa, manutencao e notificada automaticamente
6. Manutencao resolve elevador em 20 min
7. Carlos clica "Desbloquear" — timer retoma
8. Carlos completa transporte — evidencia: timestamp partida + timestamp chegada
9. Tarefa `completed`

### 19.3 Caso: Limpeza terminal com SLA estourado

1. Alta do paciente do leito 305 gera tarefa automatica `cleaning-terminal`
2. Equipe de limpeza recebe tarefa (SLA: 1h)
3. 30 min: alerta 50% ao executor
4. 45 min: alerta 75% ao executor
5. 54 min: alerta 90% ao coordenador de limpeza
6. 60 min: **SLA BREACH** — escalonamento nivel 1 (coordenador)
7. Coordenador reatribui para outro profissional disponivel
8. Novo executor completa em 20 min com checklist + foto
9. Dashboard registra: limpeza com SLA breach, motivo = sobrecarga

### 19.4 Caso: Recusa de tarefa cross-funcional

1. Coordenador de ala cria tarefa `maintenance-corrective` para consertar cama
2. Tarefa atribuida a tecnico de manutencao Joao
3. Joao recusa com motivo `resource_unavailable` — "peca de reposicao em falta, pedido de compra #OC-789"
4. Tarefa volta para coordenador com status `declined`
5. Coordenador pode: reatribuir para outro tecnico, cancelar, ou escalar para gerencia
6. Auditoria registra: recusa, motivo, responsavel original, coordenador notificado

### 19.5 Caso: Redistribuicao por fim de turno

1. Turno diurno termina as 19h, turno noturno inicia
2. Ana (turno diurno) tem 2 tarefas `received` e 1 `in_progress`
3. Workflow `ShiftHandoverWorkflow` dispara
4. Tarefas `received` redistribuidas para Beatriz (turno noturno, mesma ala)
5. Tarefa `in_progress` permanece com Ana (coordenador decide se transfere)
6. Coordenador recebe alerta: "Ana saiu do turno com 1 tarefa em andamento"
7. Coordenador decide transferir para Beatriz — reatribuicao manual com nota

---

## 20. Cenarios de Excecao

| Cenario | Tratamento |
|---------|-----------|
| Destinatario nao existe no sistema | Tarefa rejeitada na criacao, mensagem de erro |
| Destinatario esta de ferias | Sistema sugere cobertura automaticamente |
| Paciente foi transferido de ala | Tarefa reatribuida para profissional da nova ala |
| Paciente foi a obito | Tarefas clinicas canceladas automaticamente, tarefas admin mantidas |
| Sistema indisponivel durante execucao | Executor registra offline, sincroniza quando voltar |
| Dois profissionais tentam aceitar a mesma tarefa | Primeiro ganha (optimistic lock), segundo ve mensagem |
| SLA de 5 min em horario de pico | Sistema nao reduz SLA, mas agrupa alertas |
| Tarefa criada por engano | Criador pode cancelar se status <= received |
| Evidencia de foto invalida (fora de foco) | Verificador rejeita conclusao, tarefa volta para executor |
| Profissional se recusa a todas as tarefas | Dashboard mostra taxa de recusa, coordenador investiga |
| Break-glass: diretor forca conclusao sem evidencia | Permitido, registrado como break-glass na auditoria |

---

## 21. Requisitos Funcionais e Nao Funcionais

### 21.1 Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| RF-01 | Criar tarefa com tipo, prioridade, destinatario, paciente, SLA |
| RF-02 | Receber tarefa com confirmacao explicita |
| RF-03 | Aceitar ou recusar tarefa com motivo estruturado |
| RF-04 | Iniciar execucao com registro de timestamp |
| RF-05 | Registrar impedimento com motivo e estimativa |
| RF-06 | Concluir tarefa com evidencia obrigatoria por tipo |
| RF-07 | Verificar conclusao pelo solicitante |
| RF-08 | Escalonamento automatico por SLA breach |
| RF-09 | Escalonamento manual por executor ou coordenador |
| RF-10 | Reatribuicao por coordenador com historico |
| RF-11 | Redistribuicao automatica por fim de turno |
| RF-12 | Cancelamento com motivo |
| RF-13 | Historico completo e auditavel |
| RF-14 | Filtros por prioridade, tipo, ala, executor, status, periodo |
| RF-15 | Visao Kanban com drag-and-drop |
| RF-16 | Dashboard operacional, tatico e executivo |
| RF-17 | Notificacao inteligente com anti-spam |
| RF-18 | Comentarios e comunicacao na tarefa |
| RF-19 | Subtarefas e dependencias |
| RF-20 | Busca global de tarefas |

### 21.2 Requisitos Nao Funcionais

| ID | Requisito | Meta |
|----|-----------|------|
| RNF-01 | Tempo de resposta da API | < 200ms p95 |
| RNF-02 | Disponibilidade | 99.9% |
| RNF-03 | Consistencia de dados | Forte (PostgreSQL) |
| RNF-04 | Latencia de notificacao | < 5s para urgente |
| RNF-05 | Retencao de auditoria | 7 anos |
| RNF-06 | Capacidade | 10.000 tarefas/dia |
| RNF-07 | Concorrencia | 200 usuarios simultaneos |
| RNF-08 | Acessibilidade | WCAG AA |
| RNF-09 | Compatibilidade | Chrome, Firefox, Safari, Edge |
| RNF-10 | Responsividade | Funcional em tablet (1024px+) |

---

## 22. Proposta de Rollout por Fases

### Fase 1: Fundacao (Semanas 1-3)
**Escopo:** Modelo de dados, API, maquina de estados, persistencia

- Implementar `HospitalTask` model e store
- API Routes: CRUD + transicoes de status
- Maquina de estados com validacao
- Auditoria integrada (hash chain)
- Fixtures com dados realistas
- Testes unitarios para transicoes

**Criterio de aceite:** Criar tarefa via API, transicionar por todos os status, auditoria funcionando.

### Fase 2: Frontend Operacional (Semanas 4-6)
**Escopo:** Telas de uso diario do executor

- Tela Kanban pessoal (/tasks) — redesign completo
- Tela de criacao de tarefa (/tasks/new)
- Painel de detalhe da tarefa (/tasks/[id])
- Acoes: receber, aceitar, recusar, iniciar, bloquear, concluir
- Evidencia: texto, checklist, timestamp
- Filtros e busca
- Componentes monocromaticos

**Criterio de aceite:** Enfermeira consegue receber, aceitar, executar e concluir tarefa com evidencia.

### Fase 3: SLA e Escalonamento (Semanas 7-9)
**Escopo:** Automacao de SLA e cadeia de escalonamento

- Temporal Workflows: SLA Timer, Escalation
- Indicadores visuais de SLA nas cards
- Banner de SLA breach
- Notificacao por badge e push
- Logica de escalonamento por nivel
- Dashboard tatico (coordenador)

**Criterio de aceite:** Tarefa com SLA de 30 min escala automaticamente para coordenador se nao atendida.

### Fase 4: Governanca e Gestao (Semanas 10-12)
**Escopo:** Dashboards, redistribuicao, configuracao

- Dashboard executivo (gerente/diretor)
- Redistribuicao por fim de turno
- Configuracao de tipos de tarefa e SLA
- Metricas: compliance SLA, throughput, tempo medio, top motivos
- Relatorios exportaveis
- Kanban da ala (/tasks/ward)

**Criterio de aceite:** Gerente ve compliance SLA por ala e top motivos de atraso.

### Fase 5: Integracao e Automacao (Semanas 13-16)
**Escopo:** Integracao com outros modulos, tarefas automaticas

- Tarefas automaticas por prescricao (medicacao gera tarefa)
- Tarefas automaticas por alta (limpeza terminal gera tarefa)
- Tarefas automaticas por admissao (checklist de entrada)
- Integracao com FHIR Task resource (Medplum)
- NATS events para integracao com outros servicos
- Evidencia: foto, assinatura, documento

**Criterio de aceite:** Alta de paciente gera tarefa de limpeza automaticamente com SLA correto.
