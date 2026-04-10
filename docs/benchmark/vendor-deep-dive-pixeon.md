# Deep Dive — Pixeon

## Identificação

- **Fornecedor:** Pixeon Medical Systems (fundada em 2000, Brasil)
- **Produtos:** HIS, CIS, LIS, RIS, PACS — suíte modular integrada
- **Escala:** Centenas de instituições no Brasil e América Latina
- **Reconhecimento:** **4x melhor PACS da América Latina pela KLAS**; **único EHR de larga escala certificado SBIS em nível máximo** no Brasil
- **Aquisição relevante:** MedicWare (2021) — ampliou portfólio clínico e ambulatorial
- **Arquitetura:** Suíte modular web + client; integração DICOM nativa
- **Modelo comercial:** Licenciamento + manutenção; oferta cloud em crescimento

## Posicionamento

A Pixeon se posiciona como a plataforma **modular de ponta a ponta** para hospitais, clínicas e centros de diagnóstico, com **força histórica em imagem** (RIS/PACS) expandindo progressivamente para o HIS/CIS completo. A aquisição da MedicWare consolidou a presença em ambulatórios e clínicas, ampliando o portfólio clínico para além do nicho de imagem.

O diferencial mais citado é a **certificação SBIS nível máximo**, que garante conformidade técnica e legal para o uso do prontuário eletrônico sem necessidade de impressão, economizando papel e recursos. Poucos EHRs de grande escala atingiram esse nível de certificação no Brasil.

## Escopo Funcional Documentado

### HIS (Hospital Information System)
- **PEP** interoperável com módulos de imagem e laboratório
- **Gestão administrativa** — cadastro, admissão, alta
- **Faturamento** hospitalar (convênio, particular, SUS)
- **Autorização TISS/TUSS**

### CIS (Clinical Information System)
- **Prescrição eletrônica**
- **Evolução médica e de enfermagem**
- **Protocolos clínicos**

### LIS (Laboratory Information System)
- **Gestão de laboratório** — coleta, processamento, liberação
- **Integração com analisadores** laboratoriais
- **Emissão de laudos** digitais e assinatura

### RIS (Radiology Information System)
- **Agendamento de exames de imagem**
- **Worklist DICOM**
- **Laudo estruturado**
- **Assinatura digital**

### PACS (Picture Archiving and Communication System)
- **Armazenamento DICOM** em longo prazo
- **Visualizador diagnóstico** multi-planar
- **Distribuição de imagens** para referência e telemedicina
- **Backup e redundância**

### Ambulatorial (pós-MedicWare)
- **Gestão de clínicas** e consultórios
- **Agenda médica**
- **Prescrição ambulatorial**
- **Faturamento clínico**

## Diferenciais Evidentes

1. **Domínio de imagem** — PACS Pixeon é referência de mercado LatAm, 4x KLAS
2. **Certificação SBIS nível máximo** — único EHR de grande escala no Brasil com essa certificação
3. **Modularidade real** — cliente pode adotar HIS, CIS, LIS, RIS ou PACS separadamente
4. **Portfólio ampliado pós-MedicWare** — força ambulatorial + hospitalar + imagem
5. **Interoperabilidade** forte por natureza (imagem exige DICOM, laboratório exige HL7)
6. **Presença nacional** — hospitais, clínicas, centros de diagnóstico

## Forças

- **Força em imagem** sem concorrentes diretos no Brasil
- **Certificação SBIS máxima** — argumento legal e regulatório forte
- **Arquitetura modular** real, não "módulos" acoplados a um monólito
- **Integração nativa de imagem** dentro do EHR — poucos conseguem isso sem integração de terceiros
- **Presença em múltiplos segmentos** — hospital, clínica, diagnóstico

## Limitações Evidentes

1. **Profundidade clínica** em áreas fora de imagem é menor que Tasy e MV
2. **Integração entre módulos herdados** (HIS Pixeon + MedicWare) ainda em maturação
3. **Stack legado** — não é cloud-native; modularidade é por produto, não por microservice
4. **UI/UX** é mais datada que a média do mercado
5. **Mobile** é secundário; experiência primária é desktop
6. **Observabilidade** não é diferencial publicado
7. **Auditoria** é tradicional
8. **IA / agentes** — comunicação pública modesta
9. **Patient Journey** — pouco destaque como conceito; foco continua sendo imagem + clínico

## O Que Inspira o Velya

### Copiar
- **Modularidade real** — Velya adota a ideia de que o cliente pode começar por qualquer módulo e expandir
- **Certificação SBIS nível máximo** — Velya deve buscar essa certificação desde o início
- **Integração nativa de imagem** — Velya não trata imagem como "sistema externo"; tem visualizador e metadados no core

### Adaptar
- **HIS + CIS + LIS + RIS + PACS modular** — Velya adapta para **microservices independentes** com contratos FHIR/DICOM/HL7 explícitos, não produtos separados
- **Worklist DICOM** — Velya suporta nativamente
- **Laudo estruturado assinado digitalmente** — Velya implementa com proveniência criptográfica (hash chain)

### Superar
- **Profundidade clínica além de imagem** — Velya tem que entregar PEP, prescrição, alertas, avaliações multiprofissionais com a mesma maturidade do Tasy e MV
- **Cloud-native real** — Velya é Kubernetes + microservices
- **UI/UX moderna action-first** — Velya não carrega dívida de UI legada
- **Mobile-first sério** — app nativo offline-first
- **Patient Journey unificada** — Velya eleva jornada a conceito de primeira classe
- **Observabilidade + auditoria radical** — não existem no Pixeon

### Rejeitar
- **Dependência de imagem como identidade** — Velya não é "plataforma de imagem"; é plataforma hospitalar completa
- **UI datada** — Velya parte do zero com design moderno

## Conclusão

Pixeon é o **benchmark de imagem médica no Brasil**. Em hospitais onde a cadeia de imagem é crítica (oncologia, ortopedia, cardiologia intervencionista), Pixeon tem vantagem natural. Fora desse nicho, a profundidade clínica de Tasy e MV supera a Pixeon.

Para o Velya, a lição da Pixeon é dupla:

1. **Integração nativa de imagem desde o dia um** — imagem não pode ser "plugin"; precisa ser cidadã de primeira classe no core
2. **Certificação SBIS máxima como diferencial legal** — Velya deve perseguir essa certificação com prioridade alta, pois ela desbloqueia clientes que hoje não podem abandonar papel

O Velya compete com a Pixeon principalmente em contextos de **hospital geral**, onde a força em imagem da Pixeon não compensa a menor profundidade nas demais áreas. Em contextos de **centro de diagnóstico puro**, a Pixeon ainda tem vantagem — e Velya pode optar por integrar com ela em vez de competir diretamente.
