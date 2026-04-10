# Deep Dive — Epic Systems

## Identificação

- **Fornecedor:** Epic Systems Corporation (Verona, Wisconsin, fundada em 1979)
- **Produto:** Epic (suíte completa com 1.500+ módulos identificados)
- **Front-end:** Hyperspace (client tradicional) e Hyperdrive (nova geração web-first)
- **Escala:** ~36% do mercado hospitalar americano; referência mundial em grandes sistemas acadêmicos; 250+ milhões de pacientes atendidos globalmente
- **Origem:** Verona, WI; empresa privada (nunca abriu capital)
- **Arquitetura:** Client-server tradicional (Cache/IRIS), migrando para web (Hyperdrive); Epic Hosting em cloud
- **Modelo comercial:** Licenciamento empresarial premium; hosting gerenciado pela Epic

## Posicionamento

Epic é o **líder global absoluto** em EHR, especialmente em grandes sistemas acadêmicos (Mayo Clinic, Cleveland Clinic, Johns Hopkins, Kaiser Permanente, Providence, NHS England partes, e muitos outros). Sua mensagem é menos de marketing e mais de **reputação operacional**: "quando você escolhe Epic, você escolhe a plataforma que os melhores hospitais do mundo escolhem".

A filosofia Epic é: **fazer do jeito Epic**. A customização é possível, mas a cultura da empresa é que o cliente se adapta às melhores práticas Epic, não o contrário. Isso gera consistência, qualidade, e um ecossistema enorme de consultores, certificações, treinamentos e comunidade.

## Escopo Funcional Documentado

### Front-End e Arquitetura de UI
- **Hyperspace** — cliente tradicional com menus role-based (médico, enfermagem, farmácia, admin, etc.)
- **Hyperdrive** — nova geração web-first, substituindo Hyperspace progressivamente
- **Haiku / Canto / Rover** — apps mobile para iOS/Android (médico, paciente, enfermagem)

### Patient Access (entrada)
- **Cadence** — agendamento empresarial multi-recurso
- **Prelude** — registration e cadastro do paciente
- **Grand Central** — ADT + bed planning + housekeeping integrados — **referência de mercado em operações**
- **Welcome** — check-in, kiosks, autoatendimento

### Clinical
- **ClinDoc** — documentação clínica médica e de enfermagem
- **Stork** — obstetrícia
- **Beacon** — oncologia
- **ASAP** — emergência
- **OpTime** — perioperatório / centro cirúrgico
- **Anesthesia** — anestesia
- **Willow** — farmácia
- **Bugsy** — controle de infecção
- **Radiant** — radiologia
- **Beaker** — laboratório
- **Cupid** — cardiologia
- **Wisdom** — odontologia

### Population Health
- **Healthy Planet** — gestão de saúde populacional, chronic care, quality measures
- **Compass Rose** — engagement de paciente

### Revenue Cycle
- **Resolute** — faturamento profissional e hospitalar
- **Tapestry** — claims / payer
- **Real-time payer integration** — verificação de elegibilidade, autorização prévia em tempo real

### Patient Portal
- **MyChart** — portal do paciente mais usado do mundo em grandes sistemas

### Analytics
- **Cogito** — data warehouse e analytics
- **Slicer Dicer** — self-service analytics para clínicos

### Interoperability
- **Care Everywhere** — rede de interoperabilidade Epic-to-Epic
- **FHIR** via App Orchard
- **Integração com USCDI** e padrões americanos

## Diferenciais Evidentes

1. **Cobertura funcional incomparável** — 1.500+ módulos
2. **Grand Central** — referência mundial em ADT, bed planning e operações integradas
3. **MyChart** — portal do paciente mais adotado do planeta
4. **Real-time payer integration** — único com essa profundidade de integração com seguradoras
5. **Care Everywhere** — rede de interoperabilidade Epic-to-Epic com bilhões de documentos trocados
6. **Reputação** — clientes incluem os melhores hospitais do mundo
7. **Cultura de implementação disciplinada** — taxa de sucesso de projeto alta

## Forças

- **Base instalada premium** — os hospitais mais reconhecidos do mundo
- **Profundidade funcional** — qualquer nicho tem módulo dedicado
- **Cultura de qualidade** — Epic é famoso por ser rigoroso com qualidade
- **Ecossistema** — consultores, certificações, treinamentos, comunidade
- **Estabilidade** — empresa privada com liderança consistente

## Limitações Evidentes

1. **Preço proibitivo** — projetos Epic começam em dezenas de milhões de dólares
2. **Cultura "Epic way"** — cliente se adapta ao Epic, não o contrário
3. **Implementação demorada** — 18-36 meses para grandes projetos
4. **Presença LatAm quase nula** — Brasil não é mercado
5. **Stack legado** — Cache/IRIS; Hyperdrive moderniza o front, mas backend é herança
6. **Não é cloud-native** — Epic Hosting é gerenciado, não SaaS multi-tenant
7. **Mobile** melhorou, mas historicamente foi retrofit
8. **Auditoria radical** com hash chain não é diferencial publicado
9. **Observabilidade OTel nativa** não é diferencial publicado
10. **Patient Journey** — módulos existem, mas não como timeline unificada conforme visão Velya

## O Que Inspira o Velya

### Copiar
- **Grand Central** — Velya deve ter ADT + bed planning + housekeeping unificados como primeira classe
- **MyChart** — portal do paciente com agendamento, resultados, mensagens, pagamentos, histórico
- **Real-time payer integration** — verificação TISS em tempo real
- **Care Everywhere** — conceito de rede de interoperabilidade entre instalações Velya
- **Cobertura funcional ampla** — Velya pretende ter cobertura comparável em módulos core (emergência, UTI, centro cirúrgico, oncologia, maternidade)
- **Cultura de qualidade** — Velya deve ter disciplina Epic-like em testes, releases e implementação

### Adaptar
- **Menus role-based** (Hyperspace) — Velya adota, mas com **RBAC granular profissão+função+tarefa+contexto**
- **Cogito data warehouse** — Velya adota observabilidade OTel + warehouse
- **App Orchard (FHIR)** — Velya adota APIs públicas e marketplace de extensões

### Superar
- **Preço** — Velya é 10x mais barato que Epic
- **Time-to-value** — semanas, não anos
- **Cloud-native real** — Kubernetes multi-cloud, não Epic Hosting
- **Mobile-first sério** — app nativo desde o dia um
- **Patient Journey unificada** — conceito de primeira classe
- **Auditoria radical** com hash chain
- **Observabilidade OTel nativa**
- **Agentes governados** com kill switch
- **UX action-first** — não "tudo ao mesmo tempo"
- **Menos dogma "the Velya way"** — cliente pode estender via APIs e plugins abertos

### Rejeitar
- **Cultura "do the Epic way"** — Velya é aberto e configurável
- **Preço premium** — Velya quer democratizar
- **Stack Cache/IRIS** — Velya é PostgreSQL + Kafka + Kubernetes
- **Cliente fat** — Velya é web-first e mobile-first desde o início

## Conclusão

Epic é o **benchmark global absoluto** em EHR. Nenhum outro fornecedor tem sua combinação de cobertura, reputação e clientes premium. Para o Velya, Epic é:

1. **Inspiração funcional** — o que copiar em cobertura (Grand Central, MyChart, módulos clínicos)
2. **Anti-modelo comercial** — Velya rejeita o preço proibitivo e o time-to-value longo
3. **Inspiração cultural** — qualidade, disciplina, consistência
4. **Oportunidade arquitetural** — Velya é cloud-native onde Epic não é

No mercado brasileiro, Epic não compete diretamente com Velya porque praticamente não está presente. No mercado global de longo prazo, Velya pode competir com Epic oferecendo **a mesma cobertura, 10x mais barato, cloud-native real, mobile-first, com Patient Journey unificada e IA governada** — valores que Epic não tem e cuja implementação exigiria reescrever grande parte do stack.

A mensagem estratégica: Velya não é "o Epic brasileiro"; é a plataforma de próxima geração que resolve os problemas que Epic criou ao ser tão bem-sucedido (preço, lentidão, cultura fechada).
