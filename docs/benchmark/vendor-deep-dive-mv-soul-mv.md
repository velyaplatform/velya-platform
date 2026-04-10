# Deep Dive — MV SOUL MV

## Identificação

- **Fornecedor:** MV Sistemas (fundada em 1987, Recife-PE, Brasil)
- **Produto:** SOUL MV — suíte de gestão hospitalar integrada
- **Escala:** Centenas de hospitais no Brasil e América Latina; maior base instalada em hospitais públicos e privados no Brasil
- **Reconhecimento:** **KLAS — melhor PEP (Prontuário Eletrônico) da América Latina por 6 anos consecutivos**
- **Arquitetura:** Suíte modular baseada em .NET e banco Oracle/SQL Server; plataforma web + client
- **Modelo comercial:** Licenciamento + manutenção; oferta de hospedagem em crescimento

## Posicionamento

A MV se posiciona como a **empresa brasileira com maior cobertura funcional** para o setor de saúde. Com mais de **50 módulos integrados**, o SOUL MV cobre desde os níveis clínico e assistencial até o administrativo, financeiro e estratégico. É o sistema mais usado no Brasil pela combinação de escala, cobertura funcional e presença comercial forte.

Ao contrário da Philips (que trouxe o Tasy via aquisição e integra com sua linha de hardware), a MV é uma empresa **nativa de software hospitalar**, o que historicamente gera profundidade funcional em áreas específicas do fluxo hospitalar brasileiro (SUS, TISS, ANS, ANVISA).

## Escopo Funcional Documentado

### Clínico
- **PEP** — estruturado, com evolução multiprofissional (médico, enfermagem, fisioterapia, nutrição, psicologia, fonoaudiologia, serviço social)
- **CPOE** com prescrição eletrônica
- **Alertas de interação medicamentosa** — referência de maturidade no mercado brasileiro
- **Protocolos clínicos** parametrizáveis
- **Anamnese, exame físico, diagnóstico** (CID-10, CIAP, TUSS)
- **Prescrição por protocolo** (sepse, dor torácica, AVC, etc.)

### Assistencial
- **Avaliações estruturadas de enfermagem** (SAE — Sistematização da Assistência de Enfermagem)
- **Classificação de risco** (Manchester, ESI)
- **Painéis de alertas clínicos**
- **Prescrição de cuidados**

### Operacional
- **Gestão de leitos** com mapa dinâmico
- **Agendamento multi-recurso** (consulta, exame, cirurgia)
- **Centro cirúrgico** com mapeamento de sala, check-list e tempos
- **Pronto atendimento** com Manchester
- **Higienização** e controle de infecção hospitalar (CCIH)

### Administrativo / Financeiro
- **Faturamento** (convênio, particular, SUS)
- **Autorização eletrônica TISS/TUSS**
- **Gestão de glosa** e recursos
- **Contas a pagar / receber**
- **Custos hospitalares**

### Estratégico
- **BI / dashboards** para gestão
- **Indicadores assistenciais e operacionais**
- **Gestão por protocolos clínicos**

## Diferenciais Evidentes

1. **Cobertura funcional mais ampla do Brasil** — 50+ módulos integrados em um único produto
2. **KLAS PEP melhor da América Latina por 6 anos consecutivos** — reconhecimento independente de qualidade clínica
3. **Alertas de interação medicamentosa maduros** — base de conhecimento nacional consolidada
4. **Forte presença no setor público** — SUS, hospitais estaduais, prefeituras
5. **Conhecimento profundo das regulamentações brasileiras** — ANVISA, ANS, SBIS, TISS/TUSS
6. **Rede de treinamento e certificação** própria para profissionais do mercado

## Forças

- **Base instalada gigantesca no Brasil** — efeito de rede forte
- **Maturidade do PEP** reconhecida pela KLAS
- **Cobertura de ponta a ponta** — cliente não precisa integrar múltiplos fornecedores
- **Conhecimento regulatório profundo** — desde SUS até convênios privados
- **Suporte local** — equipes em todo o Brasil, documentação em português, treinamento presencial

## Limitações Evidentes

1. **UI/UX datada** — a interface tem décadas de acumulação; curva de aprendizado é íngreme
2. **Stack legado** — .NET + SQL Server/Oracle; não é cloud-native
3. **Customização via parametrização** — extensibilidade limitada por APIs públicas documentadas
4. **Mobile é complementar**, não primário — apps existem, mas a experiência central é desktop
5. **Observabilidade** não é diferencial — logs internos, sem telemetria aberta
6. **Auditoria** é tradicional — sem hash chain ou proveniência criptográfica
7. **IA / agentes** — comunicação pública modesta; não há plataforma clara de governança
8. **Patient Journey** — conceito presente, mas **não há timeline unificada** clínica+operacional+financeira+dor+chamadas
9. **Implementação pesada** — projetos demorados, dependência de consultoria

## O Que Inspira o Velya

### Copiar
- **Alertas de interação medicamentosa maduros** — Velya deve adotar base de conhecimento nacional (a mesma usada pelo MV ou equivalente brasileira), integrada ao motor de prescrição
- **Cobertura de múltiplas categorias profissionais** no PEP (médico, enfermagem, fisio, nutrição, psico, fono, serviço social) — Velya precisa desde o MVP
- **Conhecimento regulatório embutido** — SUS, TISS, TUSS, SBIS, ANVISA como primeira classe
- **Classificação de risco** (Manchester, ESI) nativa
- **SAE** (Sistematização da Assistência de Enfermagem) estruturada

### Adaptar
- **Módulos integrados** — Velya adota o conceito de cobertura ampla, mas via **microservices com contratos explícitos**, não módulos monolíticos acoplados ao mesmo DB
- **Protocolos clínicos parametrizáveis** — Velya adapta como **pathways versionados** com observabilidade de execução
- **Autorização TISS eletrônica** — Velya adota o padrão e expõe como API pública

### Superar
- **UI/UX moderna e orientada a ação** — Velya é action-first UX, não "tudo ao mesmo tempo"
- **Arquitetura cloud-native real** — Kubernetes + microservices, não .NET monolítico
- **Mobile-first sério** — app nativo offline-first, não retrofit
- **Patient Journey unificada** — a promessa do MV, entregue pelo Velya
- **Auditoria radical** — hash chain, proveniência, trilha forense exportável
- **Observabilidade OTel nativa** em todos os serviços
- **IA governada** com kill switch e evaluation harness

### Rejeitar
- **Curva de aprendizado alta** — Velya visa onboarding rápido via UX guiada
- **Customização via parametrização proprietária** — Velya usa APIs públicas
- **Projetos de implementação de anos** — Velya visa semanas

## Conclusão

MV SOUL MV é o **benchmark de PEP no Brasil** segundo a KLAS. É o concorrente mais forte em profundidade clínica nacional e conhecimento regulatório. A estratégia do Velya frente ao MV precisa ser:

1. **Paridade clínica** — Velya entrega o que o MV entrega em PEP, prescrição, alertas e avaliações multiprofissionais
2. **Paridade regulatória** — Velya é tão brasileiro quanto o MV em termos de SUS, TISS, TUSS, SBIS
3. **Superioridade arquitetural** — cloud-native, mobile-first, observabilidade, auditoria radical
4. **Superioridade de UX** — action-first, não click-heavy
5. **Superioridade em jornada** — timeline unificada que o MV não entrega

Para um cliente avaliando MV e Velya, a mensagem é: "mesma profundidade clínica, mesma aderência regulatória, mas com arquitetura, UX, jornada e governança de IA que o MV não tem e nem pode ter sem reescrever tudo".
