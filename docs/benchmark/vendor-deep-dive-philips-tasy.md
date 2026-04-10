# Deep Dive — Philips Tasy EMR

## Identificação

- **Fornecedor:** Philips (Koninklijke Philips N.V.)
- **Produto:** Tasy EMR
- **Origem:** Brasil (Blumenau / Joinville), adquirido pela Philips em 2010
- **Escala:** ~1.500 instituições de saúde em 17 países
- **Reconhecimento:** KLAS Leader em EMR América Latina 2022 e 2023
- **Arquitetura:** Plataforma web HTML5, tradicionalmente rodando sobre Oracle DB
- **Modelo comercial:** Licenciamento perpétuo + manutenção; oferta cloud hospedada em crescimento

## Posicionamento

A Philips posiciona o Tasy como a **única plataforma integrada** que cobre simultaneamente os domínios clínico, assistencial, financeiro e administrativo em um único sistema. A mensagem de marketing enfatiza "integração de ponta a ponta" e "decisões mais assertivas com base em dados unificados". Para a Philips, Tasy é o pilar da estratégia de Enterprise Informatics, complementando a oferta de equipamentos médicos (monitores, ventiladores, imagem) com o software que gerencia a operação hospitalar.

Na LatAm, especialmente no Brasil, o Tasy é o benchmark que toda nova instituição considera por padrão quando vai substituir sistemas legados. Sua base instalada massiva gera um efeito de rede: profissionais já conhecem a ferramenta, consultorias especializadas são abundantes, e a Philips oferece suporte 24/7 estruturado.

## Escopo Funcional Documentado

### Clínico e Assistencial
- **PEP (Prontuário Eletrônico do Paciente)** estruturado, com evoluções livres e formulários parametrizáveis
- **CPOE** (Computerized Physician Order Entry) com suporte a protocolos clínicos
- **Prescrição eletrônica** integrada ao CDS (Clinical Decision Support)
- **Closed-loop medication** — ciclo fechado prescrição → dispensação → administração com código de barras
- **Avaliações estruturadas** (enfermagem, fisioterapia, nutrição, psicologia)
- **Patient Journey** e **clinical pathways** parametrizáveis por protocolo institucional
- **Sinais vitais** com captura manual e integração com monitores multi-paramétricos

### Operacional
- **Gestão de leitos** com mapa visual e status em tempo real
- **ADT** (admissão, transferência, alta) com integração a fila de regulação
- **Agendamento multi-recurso** (consulta, exame, cirurgia, procedimento)
- **Centro cirúrgico** — mapa de sala, tempos, contagem de materiais
- **Emergência / Pronto Atendimento** com Manchester e classificação de risco

### Financeiro
- **Revenue Cycle** completo — cadastro, conta, faturamento, recebimento
- **Integração com convênios** via TISS/TUSS
- **Gestão de glosa** e recursos administrativos

### Ancillary
- **LIS** (laboratório) integrado
- **RIS/PACS** com visualizador DICOM
- **Farmácia** hospitalar e central de abastecimento

## Diferenciais Evidentes

1. **Plataforma única** — clínico + operacional + financeiro sem integrações entre sistemas de terceiros
2. **HTML5 web-based** — não depende de client fat, acesso por navegador
3. **Base instalada enorme** — 1.500+ instituições, ecossistema de consultorias e profissionais
4. **Integração com equipamentos Philips** — monitores, ventiladores, ultrassom, imagem
5. **Suporte estruturado 24/7** e SLA formalizado
6. **Parametrização profunda** — cliente pode adaptar formulários, protocolos, regras

## Forças

- **Cobertura funcional** entre as mais completas do mercado LatAm
- **Confiança institucional** — clientes de grande porte permanecem por décadas
- **Integração vertical** com hardware Philips
- **Presença no Brasil** com suporte local, documentação em português, conhecimento regulatório (ANVISA, SBIS, ANS)

## Limitações Evidentes

1. **Stack legado** — Oracle DB, arquitetura monolítica, migração para cloud é hosting gerenciado, não cloud-native
2. **Implementação demorada** — projetos de 12-24 meses são a norma; consultoria pesada é praticamente obrigatória
3. **Customização via parametrização**, não extensibilidade via APIs públicas documentadas
4. **Mobile é retrofit** — apps existem, mas a experiência primária continua sendo web desktop
5. **Observabilidade** é caixa preta — não há telemetria OTel publicada
6. **Auditoria** é log tradicional — sem hash chain ou proveniência criptográfica
7. **IA / agentes** — pouca comunicação pública sobre governança, kill switch, evaluation harness
8. **Patient Journey** existe como nome, mas **não entrega uma timeline unificada** que una clínico, operacional, financeiro, dor, chamadas e handoffs em um único eixo temporal navegável

## O Que Inspira o Velya

### Copiar
- **Cobertura funcional ampla desde o dia um** — Velya não pode vender um módulo isolado; precisa entregar a visão integrada desde o MVP
- **Integração vertical com equipamentos** — modelo de parcerias com fabricantes de monitores e bombas
- **Suporte estruturado 24/7** — SLA formalizado desde o primeiro cliente
- **Parametrização profunda por instituição** — formulários, protocolos, regras configuráveis

### Adaptar
- **Clinical pathways** — Velya adapta o conceito para dentro do motor de Patient Journey, mas **com milestones observáveis e eventos de primeira classe**, não como mero fluxograma estático
- **Closed-loop medication** — Velya adota o padrão, mas adiciona observabilidade nativa de cada etapa do ciclo
- **HTML5 web-based** — Velya é web, mas também é **mobile nativo primeiro**, não retrofit

### Superar
- **Cloud-native real** — Velya nasce Kubernetes + microservices, não migra legado
- **Auditoria radical** — hash chain, proveniência, exportação forense
- **Observabilidade OTel nativa** — traces, métricas, logs estruturados em todos os serviços
- **Patient Journey unificada** — a timeline que o Tasy promete e não entrega, o Velya entrega
- **APIs públicas documentadas** — cliente pode estender sem parametrização proprietária
- **Mobile offline-first** — app profissional que trabalha sem rede e sincroniza
- **Agentes governados** — IA com kill switch, evaluation harness, contratos de dados

### Rejeitar
- **Dependência de Oracle DB** — Velya é agnóstico de banco; PostgreSQL padrão
- **Customização via parametrização proprietária** — Velya prefere APIs, plugins e extensões código
- **Projetos de 12-24 meses** — Velya visa time-to-value de semanas, não anos

## Conclusão

Philips Tasy é o **benchmark de cobertura funcional no Brasil**. Competir com Tasy significa entregar paridade em cobertura enquanto se diferencia fortemente em arquitetura cloud-native, observabilidade, auditoria, mobile-first e Patient Journey realmente unificada. O Velya não pode ser "um Tasy mais bonito"; precisa ser uma plataforma de natureza diferente que resolve problemas que o Tasy nem endereça.

O Tasy é o **concorrente mais próximo** no mercado primário do Velya (Brasil), e a proposta de valor do Velya deve ser legível para quem conhece Tasy: mesma cobertura, arquitetura superior, diferenciais únicos em jornada, auditoria e governança de IA.
