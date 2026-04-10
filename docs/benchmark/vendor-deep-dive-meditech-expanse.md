# Deep Dive — MEDITECH Expanse

## Identificação

- **Fornecedor:** Medical Information Technology, Inc. (MEDITECH) — Westwood, Massachusetts, fundada em 1969
- **Produto:** MEDITECH Expanse — nova geração de EHR, cloud-first
- **Escala:** Liderança em hospitais comunitários e regionais nos EUA, forte presença no Canadá, Reino Unido, Austrália, África do Sul
- **Arquitetura:** Cloud-first em **Google Cloud**; experiência web unificada e mobile
- **Reconhecimento:** KLAS rankings sólidos, especialmente em hospitais de porte médio
- **Diferencial comercial:** **30-48% de aumento em collections** documentado após implementação em clientes

## Posicionamento

A MEDITECH se posiciona como a **alternativa cloud-first ao Epic e Cerner** para hospitais que não querem o custo e a complexidade das plataformas premium. Expanse é a nova geração da MEDITECH, reconstruída para ser **web-first**, **mobile-first** e **AI-first**, com hospedagem nativa no **Google Cloud**.

A mensagem é clara: **"Cloud. Mobile. AI. Together."** — os três pilares de modernização. Expanse é o fornecedor que mais comunica genuinamente essa combinação, entregando apps móveis nativos maduros (Expanse Now), IA integrada no fluxo clínico e financeiro (Discharge AI, claim denial AI), e uma arquitetura cloud-first com Google Cloud.

## Escopo Funcional Documentado

### Cloud-First EHR
- **Hospedagem Google Cloud** — multi-região, escalabilidade automática
- **Web-first** — navegador como interface primária
- **Mobile-first** — apps nativos complementando a web
- **Arquitetura pensada para APIs** e interoperabilidade

### Expanse Now (Physician Mobile App)
- **Documentação móvel** — apps iOS/Android para médicos
- **Prescrição** via app
- **Resultados** e evoluções
- **Integração com microfone** para voice-to-text

### Discharge AI
- **Agente IA** que ajuda no processo de alta hospitalar
- **Economia documentada** de ~7 minutos por discharge
- **Sumarização** de prontuário, geração de orientações de alta
- **Validação** por profissional antes da liberação

### MyHealth Assistant
- **Chatbot integrado** ao portal do paciente
- **Autoatendimento** — agendamento, dúvidas, resultados, medicações
- **Integração com MyHealth** portal do paciente

### Claim Denial AI
- **Agentes IA** para gestão de glosa e recusas de seguradora
- **Identificação** automática de padrões de negação
- **Geração** de recursos e respostas

### Revenue Cycle (Front-to-Back Integrated)
- **Patient access** — agendamento, registration, eligibility
- **Charge capture**
- **Claims management**
- **Denial management** com IA
- **Patient billing**
- **Collections**
- **Resultado documentado:** 30-48% de aumento em collections pós-implementação

### Clinical
- **EHR completo** — documentação, CPOE, resultados, alertas
- **Order management**
- **Medication** — closed-loop
- **Surgical Services**
- **Emergency Department**
- **Ambulatory**

### Analytics
- **BCA (Business & Clinical Analytics)** embarcado
- **Dashboards** em tempo real
- **Relatórios regulatórios**

## Diferenciais Evidentes

1. **Cloud-first genuíno** — Google Cloud é plataforma primária, não hosting adicional
2. **Mobile nativo maduro** — Expanse Now é um dos apps médicos mais reconhecidos
3. **Discharge AI** — entrega documentada com métrica pública (~7 min/discharge)
4. **MyHealth Assistant** — chatbot integrado ao portal do paciente
5. **Claim Denial AI** — aplicação concreta de IA no RCM
6. **30-48% aumento em collections** — número comercial forte e defensável
7. **Posicionamento de custo-benefício** — mais barato que Epic, com cloud-first real

## Forças

- **Cloud-first honesto** — o único dos nove que pode genuinamente reivindicar isso
- **Mobile forte** — Expanse Now é referência de mercado
- **IA entregue e medida** — Discharge AI e Claim Denial AI com métricas públicas
- **Força em hospitais comunitários** — nicho saudável e grande
- **Presença internacional** em mercados de língua inglesa

## Limitações Evidentes

1. **Profundidade em especialidades complexas** menor que Epic (oncologia, transplante)
2. **Presença LatAm quase nula** — Brasil não é mercado
3. **Base instalada menor** que Epic e Cerner
4. **Customização** menos flexível que Epic
5. **Dependência do Google Cloud** — lock-in de infra
6. **UI/UX** está melhorando, mas ainda tem heranças legadas em alguns módulos
7. **Auditoria radical** com hash chain não é diferencial publicado
8. **Observabilidade OTel nativa** não é diferencial publicado
9. **Patient Journey** — existe, mas não como timeline unificada conforme visão Velya

## O Que Inspira o Velya

### Copiar
- **Cloud-first genuíno** — Velya é cloud-native desde o dia um
- **Apps móveis nativos maduros** — Velya tem Expanse Now como referência para o app médico
- **Discharge AI com métrica** — Velya entrega IA com resultado medido (tempo, erro, qualidade)
- **MyHealth Assistant (chatbot paciente)** — Velya tem chatbot no portal
- **Claim Denial AI** — Velya tem agente para gestão de glosa/recursos
- **30-48% collections** como mensagem comercial — Velya persegue métrica comparável
- **Mensagem "Cloud. Mobile. AI."** — Velya adota e expande com "Cloud. Mobile. AI. Observability. Audit."

### Adaptar
- **Front-to-back RCM integrado** — Velya adota, mas com **clinically driven** do Oracle e **TISS brasileiro**
- **BCA analytics embarcado** — Velya expõe via observabilidade OTel + warehouse
- **Hospedagem Google Cloud** — Velya é multi-cloud (GCP, AWS, Azure, on-prem Kubernetes)

### Superar
- **Multi-cloud real** em vez de lock-in Google
- **Profundidade clínica** — Velya deve cobrir oncologia, UTI, centro cirúrgico com mesma profundidade que Epic
- **Auditoria radical** com hash chain
- **Observabilidade OTel nativa**
- **Agentes governados** com kill switch, evaluation harness, contratos de dados publicados (Expanse tem IA, mas não publica governança)
- **Patient Journey unificada** como conceito de primeira classe
- **UX action-first**
- **RBAC granular profissão+função+tarefa+contexto**

### Rejeitar
- **Lock-in Google Cloud** — Velya é cloud-agnóstico
- **Profundidade menor em especialidades** — Velya precisa cobrir

## Conclusão

MEDITECH Expanse é o **concorrente global mais próximo conceitualmente da visão Velya**: cloud-first, mobile-first, AI-first, com foco em RCM integrado e métricas comerciais defensáveis. Para o Velya, Expanse é **a inspiração positiva mais direta** em termos de mensagem comercial e arquitetura.

As diferenças críticas que Velya oferece frente ao Expanse são:

1. **Multi-cloud real** — Velya não amarra cliente em Google
2. **Auditoria radical** — hash chain, proveniência
3. **Observabilidade OTel nativa**
4. **Agentes governados publicados** — kill switch, evaluation harness
5. **Patient Journey unificada**
6. **Mercado brasileiro** — Velya é brasileiro, Expanse não é

O Expanse mostra ao mercado que é **possível** entregar EHR moderno, cloud, mobile e com IA. Velya se posiciona como **a evolução natural** do que Expanse começou — adicionando governança, observabilidade, auditoria e jornada que Expanse ainda não entrega.

Estrategicamente, Velya pode **citar** MEDITECH Expanse como prova de que o mercado global já aceita cloud-first e mobile-first como padrão. O que Velya adiciona é o que nenhum concorrente global entrega junto: governança, auditoria radical e timeline unificada.
