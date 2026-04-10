# Deep Dive — Dedalus ORBIS U

## Identificação

- **Fornecedor:** Dedalus Group (Itália / Alemanha / França; sede em Florença, Itália)
- **Produto:** ORBIS U — Electronic Patient Record (EPR) empresarial
- **Escala:** 1.000+ hospitais; **#1 EPR na Europa**, liderança em Alemanha, França, Itália; presença em Reino Unido, Espanha, Oriente Médio, África
- **Arquitetura:** Microservices, AWS cloud-ready, FHIR/HL7/DICOM/SNOMED nativos
- **Origem:** Dedalus cresceu por aquisições consolidando o mercado europeu de HIS/EPR; ORBIS vem da aquisição da Agfa HealthCare Enterprise
- **Reconhecimento:** Líder europeu, HIMSS EMRAM stages elevados em múltiplos clientes

## Posicionamento

Dedalus se posiciona como o **fornecedor europeu líder de EPR**, resultado da consolidação de várias marcas históricas (Agfa HealthCare Enterprise, iSOFT, DH Healthcare) sob uma única estratégia de produto: ORBIS U. A mensagem é de **"European leader, now reimagined"** — combinando décadas de presença clínica europeia com uma reconstrução arquitetural moderna (microservices, AWS, FHIR nativo).

ORBIS U é apresentado como a **próxima geração** do ORBIS, com **68+ módulos clínicos integrados**, cobrindo o continuum hospitalar completo: inpatient, outpatient, acute care, rehabilitation, mental health. A aposta estratégica da Dedalus é que o futuro do EPR está em **arquitetura aberta, microservices, cloud, AI e padrões internacionais**.

## Escopo Funcional Documentado

### Clinical Core (68+ módulos)
- **PEP** estruturado e multi-profissional
- **Ordem e resultados** (labs, imagem, medicação)
- **Documentação clínica** por especialidade
- **CDS** — Clinical Decision Support
- **Prescrição eletrônica** com alertas

### Cobertura de Continuum
- **Inpatient** — hospitalização aguda
- **Outpatient** — ambulatório
- **Acute care** — UTI, emergência
- **Rehabilitation** — reabilitação física, ocupacional, fonoaudiologia
- **Mental health** — psiquiatria, psicologia clínica
- **Home care**
- **Long-term care** — idoso, cuidados prolongados

### Módulos Especializados
- **Oncology**
- **Cardiology**
- **Maternity / Obstetrics**
- **Emergency Department**
- **Operating Theatre**
- **ICU**
- **Anesthesia**
- **Pharmacy** (hospitalar e clínica)

### Administrative / Operational
- **ADT**
- **Bed management**
- **Scheduling**
- **Billing** conforme mercado local (complexo na Europa por variações regulatórias por país)

### AI-Driven Assistants
- **Clinical assistants** — sumarização, busca, sugestão
- **Administrative assistants** — documentação assistida
- **Comunicação pública crescente** sobre IA, especialmente pós-2023

### Interoperability
- **FHIR R4** nativo
- **HL7 v2**
- **DICOM**
- **SNOMED CT** — reconhecido como forte em codificação estruturada
- **IHE profiles**
- **openEHR** em alguns módulos

### Arquitetura
- **Microservices**
- **AWS cloud-ready**
- **Containerização** (Docker, Kubernetes em partes)
- **APIs FHIR** expostas

## Diferenciais Evidentes

1. **Cobertura de continuum** — único com cobertura séria de mental health, rehab, long-term care além do agudo
2. **68+ módulos integrados** — profundidade comparável ao Epic em categorias europeias
3. **Arquitetura moderna** — microservices + AWS + FHIR nativo (um dos poucos do grupo que podem reivindicar isso honestamente)
4. **SNOMED CT forte** — referência em codificação estruturada
5. **Liderança europeia** — 1.000+ hospitais em mercados regulatoriamente complexos
6. **openEHR** em alguns módulos — aposta na interoperabilidade semântica

## Forças

- **Domínio europeu** — especialmente Alemanha, França, Itália
- **Arquitetura moderna** como diferencial publicado
- **Cobertura de continuum** — não apenas agudo
- **Interoperabilidade forte** por obrigação regulatória europeia (GDPR, HL7, FHIR)
- **SNOMED CT** maduro

## Limitações Evidentes

1. **Integração entre módulos herdados** de múltiplas aquisições ainda em maturação
2. **Presença nas Américas quase nula** — Brasil não é mercado
3. **Complexidade** — múltiplas marcas e produtos sendo unificados
4. **Cloud-native real** — microservices + AWS é **parcial**; muito do ORBIS ainda é herança
5. **UI/UX** varia entre módulos (herança de aquisições)
6. **KLAS recognition** menor que Epic/Oracle em rankings globais
7. **Mobile** está evoluindo, mas não é primário
8. **Auditoria radical** com hash chain não é diferencial publicado
9. **Observabilidade OTel nativa** não é diferencial publicado
10. **Patient Journey** — não é mensagem central

## O Que Inspira o Velya

### Copiar
- **Cobertura de continuum** — Velya deve cobrir agudo + ambulatório + rehab + mental health + home care no roadmap
- **SNOMED CT nativo** — Velya adota SNOMED como codificação estruturada primária
- **FHIR R4 nativo** — Velya tem FHIR como contrato primário
- **openEHR** em áreas de interoperabilidade semântica profunda
- **Arquitetura microservices + cloud** — Velya entrega isso de forma **mais pura** (sem legacy)

### Adaptar
- **68+ módulos** — Velya adapta para **microservices independentes** com contratos explícitos, não módulos monolíticos
- **AI-driven assistants** — Velya adota com **governança publicada** (kill switch, evaluation harness)
- **AWS cloud-ready** — Velya é multi-cloud (AWS, GCP, Azure, on-prem Kubernetes)

### Superar
- **Cloud-native real** — Velya é Kubernetes multi-cloud sem heranças
- **Unificação entre módulos** — Velya nasce unificado, não consolida aquisições
- **Auditoria radical** com hash chain
- **Observabilidade OTel nativa**
- **Governança de IA publicada**
- **Patient Journey unificada**
- **UX moderna consistente** (Dedalus tem heranças de UI de várias marcas)
- **Mobile-first sério**
- **Mercado brasileiro** — Velya é BR, Dedalus é europeu

### Rejeitar
- **Consolidação via aquisições** — Velya constrói de forma unificada desde o início
- **UI inconsistente** entre módulos

## Conclusão

Dedalus ORBIS U é o **benchmark europeu de arquitetura moderna e cobertura de continuum**. É o concorrente global cuja **arquitetura** mais se aproxima da visão Velya: microservices, AWS cloud-ready, FHIR nativo, APIs abertas, SNOMED CT. Porém, Dedalus carrega a complexidade de consolidar múltiplas aquisições, enquanto Velya parte do zero.

Para o Velya, o Dedalus é:

1. **Prova de que o mercado aceita arquitetura moderna** — clientes europeus top escolheram microservices + cloud + FHIR
2. **Inspiração em cobertura de continuum** — Velya deve pensar além do agudo
3. **Referência em SNOMED CT e openEHR** — interoperabilidade semântica profunda
4. **Anti-modelo de consolidação** — Velya rejeita o caminho "comprar vários e integrar depois"

No mercado brasileiro, Dedalus não compete. Conceitualmente, é o fornecedor global com quem Velya tem **mais afinidade arquitetural**, mas também o que demonstra os **limites dessa abordagem** quando aplicada a um legado gigante. Velya tem a vantagem de começar limpo.

A mensagem estratégica: "Dedalus é a evolução que o mercado europeu aceitou. Velya é a mesma evolução, feita do zero, com governança, observabilidade e jornada que Dedalus ainda não entrega — e no mercado brasileiro que Dedalus nem tenta atender".
