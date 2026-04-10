# Deep Dive — InterSystems TrakCare

## Identificação

- **Fornecedor:** InterSystems Corporation (Cambridge, Massachusetts, fundada em 1978)
- **Produto:** TrakCare — Unified Healthcare Information System
- **Plataforma de dados:** InterSystems IRIS (DBMS multi-modelo próprio, unificando SQL, objetos, JSON, chave-valor e analytics)
- **Escala:** Presença forte no Reino Unido, Irlanda, Escandinávia, Austrália, Oriente Médio, Hong Kong, Sudeste Asiático
- **Reconhecimento:** Top 10 global EHR; HIMSS Analytics Stage 6/7 em múltiplos clientes
- **Lançamento recente:** **TrakCare Assistant (AI clinician workflow)** e **AI Patient Flow Optimisation** apresentados no HIMSS25

## Posicionamento

A InterSystems se posiciona como o fornecedor de EHR construído sobre sua **própria plataforma de dados unificada (IRIS)**, o que dá ao TrakCare uma vantagem arquitetural em analytics em tempo real, interoperabilidade e IA. Enquanto Epic e Cerner/Oracle usam bancos de dados tradicionais com camadas de analytics separadas, a InterSystems argumenta que o IRIS permite que a mesma plataforma serve como EHR transacional e como data platform para BI, ML e IA — sem ETL.

No HIMSS25, a InterSystems anunciou duas capacidades de IA integradas ao TrakCare:

1. **TrakCare Assistant** — um assistente clínico que ajuda o médico em workflow, documentação, sumarização e busca de informações no prontuário
2. **AI Patient Flow Optimisation** — ML preditivo para no-shows, previsão de Length of Stay (LOS), otimização de alta, gestão de leitos

## Escopo Funcional Documentado

### EPR (Electronic Patient Record) — continuum clínico e administrativo
- **PEP** estruturado e orientado a processo
- **Ordem e resultados** (labs, imagem, medicação)
- **Documentação** clínica multi-profissional
- **CDS** (Clinical Decision Support)
- **Alertas** e protocolos

### Módulos Clínicos Especializados
- **ICU / Critical Care** — flow sheets, ventilação, infusão, score de gravidade
- **Oncology** — pathways de quimioterapia, protocolos, dosagem por peso/superfície
- **Maternity** — obstetrícia, partograma
- **Discharge Summary** — sumário de alta estruturado
- **Emergency Department**
- **Theatre / Perioperative**

### Operacional
- **ADT**
- **Bed management**
- **Scheduling**
- **Outpatient clinic**

### Administrativo
- **Patient administration**
- **Billing / claims** (conforme mercado local)
- **Resource management**

### AI (HIMSS25)
- **TrakCare Assistant** — voz/texto, sumarização, busca, documentação assistida
- **AI Patient Flow Optimisation** — ML para no-show, LOS, alta
- **Anomaly detection** em sinais vitais e labs

### Interoperability
- **FHIR** e **HL7** nativos (IRIS for Health é plataforma FHIR)
- **SNOMED CT**
- **IHE profiles**

### Analytics
- **IRIS Analytics** embarcado
- **Dashboards** em tempo real
- **Data warehouse** nativo (não precisa ETL)

## Diferenciais Evidentes

1. **Plataforma IRIS unificada** — transacional + analítica + IA sem ETL
2. **TrakCare Assistant (AI)** — anunciado HIMSS25, posiciona InterSystems entre líderes de AI
3. **AI Patient Flow Optimisation** — único com comunicação pública madura de ML para fluxo operacional
4. **Módulos ICU e Oncology** reconhecidos por profundidade
5. **FHIR nativo** — IRIS for Health é referência em interoperabilidade
6. **HIMSS Analytics** — múltiplos clientes em Stage 6/7 validando maturidade

## Forças

- **Arquitetura de dados unificada** — vantagem real para IA e analytics em tempo real
- **Liderança em interoperabilidade** — IRIS for Health domina segmentos de HIE (Health Information Exchange)
- **Investimento em IA clínica** comunicado e entregue
- **Presença global** — forte no UK, Austrália, Oriente Médio, Hong Kong
- **Governo** — cliente de grandes sistemas nacionais

## Limitações Evidentes

1. **Dependência do IRIS** — cliente compra plataforma proprietária da InterSystems
2. **Presença LatAm modesta** — Brasil não é mercado prioritário
3. **UI/UX** é mais funcional que bonita
4. **Implementação demorada** em grandes clientes
5. **Mobile** existe, mas não é primário
6. **Auditoria radical** com hash chain não é diferencial publicado
7. **Observabilidade OTel nativa** não é diferencial publicado
8. **Patient Journey** — não é comunicação central

## O Que Inspira o Velya

### Copiar
- **Plataforma de dados unificada** — Velya inspira-se no IRIS, mas usa stack aberto (PostgreSQL + Kafka + OLAP column-store) para não depender de vendor proprietário
- **AI Patient Flow Optimisation** — Velya adota ML para no-shows, LOS, alta, com evaluation harness nativo
- **TrakCare Assistant** — Velya tem assistente clínico embutido, mas **com kill switch e governança**
- **Módulos ICU e Oncology** como referência de profundidade

### Adaptar
- **FHIR nativo** — Velya adota FHIR R4 como contrato primário de interoperabilidade
- **Discharge Summary estruturado** — Velya tem sumário de alta como evento observável no Patient Journey
- **Analytics embarcado** — Velya expõe observabilidade OTel + warehouse

### Superar
- **Stack aberto vs IRIS proprietário** — Velya não amarra cliente em plataforma proprietária
- **Auditoria radical** com hash chain
- **Observabilidade OTel nativa** — traces, métricas, logs estruturados
- **Agentes governados publicados** — kill switch, evaluation harness, contratos de dados abertos
- **Patient Journey unificada** como conceito de primeira classe
- **Mobile-first sério**
- **UX action-first**
- **Cloud-native real multi-cloud**

### Rejeitar
- **Dependência de DBMS proprietário** — Velya é agnóstico de banco
- **UI funcional-mas-feia** — Velya investe em design desde o dia um

## Conclusão

InterSystems TrakCare é o **benchmark de IA clínica e interoperabilidade moderna**. Sua aposta em IRIS como plataforma de dados unificada é arquiteturalmente inteligente, mas cria lock-in. O lançamento do TrakCare Assistant e AI Patient Flow Optimisation no HIMSS25 coloca a InterSystems entre os líderes em IA hospitalar.

Para o Velya, o TrakCare é o concorrente global que **mais se parece conceitualmente** com o que Velya quer ser: uma plataforma unificada, com IA integrada e analytics em tempo real. A diferença crítica é que Velya quer fazer isso **sem lock-in proprietário**, com **stack aberto**, **governança publicada**, **observabilidade nativa** e **Patient Journey unificada**.

No mercado primário do Velya (Brasil), a TrakCare não é concorrente direto frequente. Mas **conceitualmente** é o fornecedor que Velya deve monitorar mais de perto, porque suas apostas arquiteturais e de IA são as mais próximas da visão Velya. Cada release do TrakCare deve ser analisado para entender o que o mercado global aceita como "estado da arte" em IA clínica.
