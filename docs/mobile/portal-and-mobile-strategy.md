# Estratégia Mobile-First, Portais e Bedside Workflows

> Estratégia de mobilidade do Velya Hospital OS: apps nativos para médicos, enfermagem,
> farmácia, command center, portal do paciente e portal do médico externo — todos
> consumindo as mesmas projeções CQRS e eventos do core.

---

## 1. Premissas

- **Mobile não é feature, é canal primário.** Enfermagem, médicos em plantão, equipes de
  farmácia e manutenção passam a maior parte do tempo longe da workstation.
- **Beira-leito é o lugar do cuidado.** Toda ação deve ser executável no ponto de cuidado,
  com confiança e rastreabilidade.
- **Offline-first** onde faz sentido, com sincronização por eventos quando a rede volta.
- **Paridade funcional mínima 80%** com desktop para cada persona.
- **Tipagem fim-a-fim** via tRPC + FHIR types compartilhados.

---

## 2. Stack

- **React Native + Expo EAS** para apps nativos iOS e Android.
- **Tipagem** compartilhada via monorepo (`packages/contracts`).
- **tRPC** como camada de transporte para CRUD + comando.
- **WebSocket / SSE** para atualizações ao vivo.
- **FHIR REST** quando necessário para interoperabilidade.
- **Offline store**: WatermelonDB ou SQLite com fila de sync baseada em eventos.
- **Autenticação**: OIDC + biometria (Face ID, Touch ID, impressão digital).
- **Push**: APNs / FCM via serviço próprio de notificações.
- **Observabilidade**: OpenTelemetry JS para mobile + crash reporting.

---

## 3. Apps por persona

### 3.1. Physician Mobility

Público: médicos assistentes, plantonistas, intensivistas.

Funcionalidades:

- Lista de pacientes do dia (assistidos, internados, UTI).
- Prontuário completo na visão médica com projeção `journey_physician_view`.
- Prescrição eletrônica com assinatura digital.
- Assinatura remota de documentos pendentes.
- Visualização de exames laboratoriais e laudos.
- Visualização de imagens (DICOMweb embebido).
- Evolução clínica por texto, ditado ou template.
- Notificação push de resultados críticos.
- Comunicação intra-equipe (chat seguro ligado ao paciente).

### 3.2. Nursing Mobility

Público: enfermagem assistencial.

Funcionalidades:

- Passagem de plantão com SBAR estruturado.
- Aprazamento de medicações do plantão.
- Administração beira-leito com scan de código de barras.
- Registro de sinais vitais com smart capture.
- SAE (NANDA/NIC/NOC) como formulário estruturado.
- Formulários: NEWS2, Glasgow, Braden, Morse, dor.
- Eventos adversos com foto.
- Solicitação de transporte, higienização, manutenção.
- Lista de tarefas do paciente com priorização.

### 3.3. Bedside Workflows

Público: todos os profissionais que atuam beira-leito.

Princípios:

- Operação one-handed.
- Confirmação com scan (paciente + insumo + profissional).
- Workflows guiados com mínimo de toques.
- Resistência a distrações (alarmes, telefones).
- Fallback offline com sincronização determinística.

### 3.4. Pharmacy Mobility

Público: farmácia clínica e satélite.

Funcionalidades:

- Fila de revisão priorizada.
- Intervenções farmacêuticas com templates.
- Reconciliação medicamentosa.
- Dispensação e devolução via scan.
- Controle de estoque em movimento.
- Validação de preparos com dupla checagem por biometria.

### 3.5. Command Center Mobile

Público: gestão hospitalar, NIR (Núcleo Interno de Regulação).

Funcionalidades:

- Mapa do hospital com status de leitos.
- Ocupação em tempo real.
- Boarding em emergência.
- Cirurgias em andamento.
- Altas previstas próximas horas.
- Alertas críticos.
- Ações rápidas (bloquear/liberar leito, escalar recurso).

### 3.6. Housekeeping Mobility

Público: equipe de limpeza.

Funcionalidades:

- Fila de tickets por prioridade.
- Scan do leito para iniciar.
- Checklist por tipo.
- Foto final.
- Métricas de produtividade do turno.

### 3.7. Portal do Paciente

Público: paciente e familiares.

Funcionalidades:

- Linha do tempo do cuidado (visão simplificada).
- Medicamentos com orientação em linguagem leiga.
- Agendamentos.
- Laudos e exames.
- Receita de alta com lembretes.
- Mensageria com a equipe (limitada e moderada).
- Consentimentos e assinaturas.
- Questionários PRO (Patient-Reported Outcomes).
- Exportação LGPD dos próprios dados.

Disponível como app nativo + PWA.

### 3.8. Portal do Médico Externo

Público: médicos cooperados, externos, não vinculados ao hospital.

Funcionalidades:

- Acesso controlado aos pacientes sob sua responsabilidade.
- Prescrição eletrônica remota.
- Assinatura ICP-Brasil.
- Consulta de laudos e imagens.
- Solicitação de internação.
- Agendamento cirúrgico.

---

## 4. Offline-first

Estratégia:

- **Leitura offline** para pacientes do profissional (cache com TTL).
- **Escrita offline** para eventos comuns (administração de medicação, sinais vitais,
  formulários) armazenados em fila local.
- **Sincronização** por eventos quando a rede volta, com reconciliação determinística.
- **Conflitos** tratados por regras claras: eventos são append-only, não há "last write wins".
- **Indicador visual claro** quando em offline.
- **Políticas** que exigem online para operações críticas (ex.: prescrição de controlado
  exige conexão para assinatura).

---

## 5. Push notifications

- Segmentadas por persona e paciente.
- Criticidade: `info`, `warning`, `critical`.
- Críticas requerem acknowledgment e escalam se não reconhecidas em X minutos.
- Integração com sistema de alarmes centralizado para evitar "alarm fatigue".
- Política de quiet hours por perfil e turno.

---

## 6. Segurança mobile

- Autenticação biométrica obrigatória para abrir o app.
- Token seguro em Keychain / Keystore do SO.
- Detecção de jailbreak/root com bloqueio.
- Mobile Device Management (MDM) opcional para dispositivos corporativos.
- Screenshot bloqueado em telas com PHI.
- Copy/paste bloqueado em campos sensíveis.
- Logout automático por inatividade.
- Wipe remoto em caso de perda.

---

## 7. Performance

- **Time to interactive** < 2s em 4G.
- **Smooth list** > 60 fps para listas grandes (FlashList).
- **Lazy loading** de recursos pesados (imagens, documentos).
- **Background sync** otimizado para economia de bateria.
- **Redução de payload** via FHIR `_elements` e `_summary`.

---

## 8. Acessibilidade

- WCAG 2.1 AA.
- Suporte a leitores de tela (TalkBack, VoiceOver).
- Tamanho de fonte dinâmico.
- Contraste alto.
- Operação por voz em bedside (quando apropriado).

---

## 9. Internacionalização

- Padrão pt-BR.
- Suporte a en-US e es-ES para hospitais internacionais.
- Formatos de data/hora conforme locale.

---

## 10. Atualizações

- **OTA updates** via Expo EAS para correções rápidas.
- **Store updates** quando mudanças nativas são necessárias.
- **Rollback** rápido em caso de problema.
- **Feature flags** por tenant para rollout gradual.

---

## 11. Observabilidade mobile

- OpenTelemetry JS para traces.
- Crash reporting via Sentry ou equivalente.
- Métricas de uso por feature.
- Métricas de sincronização offline.
- Métricas de performance e battery drain.
- Correlação trace mobile <-> backend.

---

## 12. Relação com web

- Web e mobile consomem as mesmas projeções CQRS.
- Contratos compartilhados via tRPC.
- Componentes de UI com design system comum onde aplicável.
- Princípio de "one source of truth" por funcionalidade.

---

## 13. Roadmap

- V1: Physician + Nursing + Housekeeping.
- V2: Pharmacy + Command Center.
- V3: Portal do paciente completo + Portal médico externo.
- V4: Ditado clínico com LLM + sumarização automática em modo supervisionado.

---

## 14. Referências

- `docs/patient-journey/patient-journey-architecture.md`
- `docs/forms/structured-assessments-engine.md`
- `docs/medication/closed-loop-medication-architecture.md`
- `docs/security/access-audit-signature-model.md`
- Expo EAS Docs.
- React Native Docs.
