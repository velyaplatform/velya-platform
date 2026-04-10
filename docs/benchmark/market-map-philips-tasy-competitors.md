# Mapa do Mercado — Philips Tasy e seus Concorrentes

## Objetivo

Este documento mapeia, de forma estruturada e comparativa, os nove fornecedores de sistemas hospitalares de maior relevância para o posicionamento competitivo do Velya. O objetivo é entender **onde cada um atua**, **como se posiciona**, **quais são seus pontos fortes evidentes** e **onde o mercado deixa brechas** que o Velya pode explorar.

Este mapa é a base para os mergulhos profundos (`vendor-deep-dive-*.md`) e para a matriz de capacidades (`capability-matrix-*.md`).

---

## Os Nove Fornecedores Analisados

| # | Fornecedor | Produto | Origem | Categoria KLAS |
|---|---|---|---|---|
| 1 | Philips | Tasy EMR | Brasil / Países Baixos | Líder LatAm 2022/2023 |
| 2 | MV | SOUL MV | Brasil (Recife) | Líder PEP LatAm (6 anos) |
| 3 | Pixeon | HIS/CIS/LIS/RIS/PACS | Brasil | Líder PACS LatAm (4x) |
| 4 | TOTVS | Saúde Hospitais e Clínicas (linha RM) | Brasil | Top 3 Brasil ERP saúde |
| 5 | Oracle Health | Cerner Millennium | EUA (Kansas City) | Top 3 global EHR |
| 6 | InterSystems | TrakCare | EUA / Global | Top 10 global EHR |
| 7 | Epic | Epic Systems (Hyperspace / Hyperdrive) | EUA (Verona, WI) | #1 global EHR |
| 8 | MEDITECH | Expanse | EUA (Westwood, MA) | Top 5 global EHR |
| 9 | Dedalus | ORBIS U | Itália / Alemanha | #1 Europa EPR |

---

## Posicionamento Geográfico

### Dominância por Região

**América Latina (Brasil, México, Argentina, Chile, Colômbia):**
- **Philips Tasy** — liderança consolidada, ~1.500 instituições, forte presença em hospitais privados de grande porte
- **MV SOUL MV** — maior base instalada no Brasil, PEP reconhecido pela KLAS como melhor da região por 6 anos consecutivos
- **Pixeon** — nicho em imagem e diagnóstico, expansão para HIS completo após aquisição da MedicWare
- **TOTVS Saúde** — forte em hospitais de médio porte e redes, aproveita base instalada do ERP TOTVS

**América do Norte (EUA, Canadá):**
- **Epic** — domínio absoluto em grandes sistemas acadêmicos, ~30% do mercado hospitalar americano
- **Oracle Health (Cerner)** — segunda maior participação, forte em governo (VA, DoD) e sistemas regionais
- **MEDITECH Expanse** — liderança em hospitais comunitários e rurais, forte no Canadá

**Europa:**
- **Dedalus ORBIS U** — líder em Alemanha, França, Itália, com presença em mais de 1.000 hospitais
- **InterSystems TrakCare** — forte no Reino Unido, Irlanda, Escandinávia, Ásia-Pacífico
- **Epic** — crescendo em Dinamarca, Holanda, Finlândia, Reino Unido

**Ásia-Pacífico e Oriente Médio:**
- **InterSystems TrakCare** — liderança na Austrália, Emirados Árabes Unidos, Arábia Saudita, Hong Kong
- **Epic** — expansão em Singapura, Austrália
- **Dedalus** — presença em Oriente Médio

---

## Tipos de Cliente Alvo

### Segmentação por Porte

| Fornecedor | Pequeno (<100 leitos) | Médio (100-400) | Grande (>400) | Rede / Hub | Governo |
|---|---|---|---|---|---|
| Philips Tasy | Pouco | Forte | Muito forte | Forte | Pouco |
| MV SOUL MV | Forte | Muito forte | Forte | Forte | Forte |
| Pixeon | Forte | Forte | Médio | Médio | Pouco |
| TOTVS Saúde | Forte | Muito forte | Médio | Médio | Pouco |
| Oracle Health | Pouco | Médio | Muito forte | Muito forte | Muito forte |
| TrakCare | Pouco | Forte | Muito forte | Muito forte | Forte |
| Epic | Pouco | Médio | Muito forte | Muito forte | Forte |
| MEDITECH Expanse | Muito forte | Forte | Médio | Médio | Médio |
| Dedalus ORBIS U | Médio | Muito forte | Muito forte | Muito forte | Forte |

### Segmentação por Tipo de Serviço

- **Hospital geral agudo** — todos os nove cobrem
- **Hospital especializado (oncologia, cardio, ortopedia)** — Tasy, MV, Epic, TrakCare têm destaque
- **Ambulatório / clínica** — TOTVS, Pixeon, MEDITECH
- **Diagnóstico por imagem** — Pixeon (forte), Philips (forte), Oracle
- **Mental health** — Dedalus, Epic, MEDITECH
- **Reabilitação** — Dedalus, MV
- **Home care** — MV, TOTVS, Philips

---

## Modelo de Entrega (Cloud vs On-Prem)

| Fornecedor | On-Prem Legacy | Hosted / Private Cloud | SaaS Multi-Tenant | Cloud-Native Real |
|---|---|---|---|---|
| Philips Tasy | Sim (maioria) | Crescendo | Parcial | Não |
| MV SOUL MV | Sim (maioria) | Sim | Parcial | Não |
| Pixeon | Sim | Sim | Parcial | Não |
| TOTVS Saúde | Sim | Sim | Parcial | Não |
| Oracle Health | Sim | Sim (OCI) | Em transição | Roadmap 2025 |
| TrakCare | Sim | Sim | Parcial | Não |
| Epic | Sim | Sim (Epic-hosted) | Não | Não |
| MEDITECH Expanse | Sim | Sim | Sim (Google Cloud) | Parcial |
| Dedalus ORBIS U | Sim | Sim (AWS) | Parcial | Parcial |

**Observação crítica:** Nenhum dos nove nasceu cloud-native. Todos são sistemas legados sendo portados para cloud via lift-and-shift ou hosting gerenciado. Este é o primeiro vácuo estratégico que Velya pode explorar.

---

## Forças Evidentes (Material Público)

### Philips Tasy
- Plataforma única integrando clínico, assistencial, financeiro e administrativo
- Base instalada enorme no Brasil
- HTML5 web-based (não depende de client fat)
- Suporte 24/7 estruturado, parceria com grandes redes

### MV SOUL MV
- 50+ módulos cobrindo todos os domínios hospitalares
- PEP reconhecido como melhor da América Latina pela KLAS
- Alertas de interação medicamentosa maduros
- Forte presença em hospitais públicos e SUS

### Pixeon
- Único EHR de larga escala certificado SBIS nível máximo
- Domínio absoluto em imagem (RIS/PACS)
- Modularidade real (HIS, CIS, LIS separáveis)
- Aquisição da MedicWare ampliou portfólio clínico

### TOTVS Saúde
- Jornada 100% digital (recepção à alta)
- Integração nativa com WhatsApp
- Teleconsulta nativa
- Aproveita base instalada do ERP TOTVS

### Oracle Health
- Escala global e robustez operacional
- Ambient AI de próxima geração (2025)
- Foco em "clinically driven revenue cycle workflows"
- Integração profunda com Oracle DB e OCI

### InterSystems TrakCare
- Plataforma de dados IRIS unificada
- AI Patient Flow Optimisation (ML para no-shows, LOS)
- TrakCare Assistant lançado no HIMSS25
- Módulos especializados (ICU, Oncology) maduros

### Epic
- Maior base instalada global
- 1.500+ módulos cobrindo todo o ciclo
- Real-time payer integration
- Grand Central (ADT + bed planning + housekeeping) referência de mercado

### MEDITECH Expanse
- Cloud-first genuíno (Google Cloud)
- Discharge AI economiza 7 min por alta
- MyHealth Assistant chatbot para pacientes
- Relato de 30-48% aumento em collections após implementação

### Dedalus ORBIS U
- Líder europeu com 1.000+ hospitais
- 68+ módulos clínicos integrados
- Arquitetura microservices + AWS
- Padrões FHIR, HL7, DICOM, SNOMED nativos

---

## Fraquezas Evidentes (Material Público)

### Temas comuns a todos
1. **Mobile-first é retrofit** — Nenhum nasceu mobile; todos têm apps complementares limitados
2. **Cloud-native é promessa** — Migração de legado, não arquitetura greenfield
3. **Observabilidade é black box** — Nenhum publica contratos de telemetria abertos
4. **Auditoria é log simples** — Nenhum tem hash chain ou proveniência criptográfica
5. **AI sem governança** — Nenhum publica kill switch, evaluation harness ou drift monitoring
6. **Eventos são DB triggers** — Nenhum tem event streaming como primeira classe
7. **RBAC é papel, não contexto** — Permissões não consideram profissão + função + tarefa + contexto
8. **Memória depende de checklist humano** — Nenhum oferece offload automático cognitivo
9. **UX é click-heavy** — Telas densas, tudo de uma vez, sem priorização por ação
10. **Patient Journey é promessa** — Todos dizem ter, ninguém entrega timeline unificada clínica + operacional + financeira

### Específicos por fornecedor

| Fornecedor | Principal Fraqueza Evidente |
|---|---|
| Philips Tasy | Cliente precisa de consultoria pesada para implementar |
| MV SOUL MV | UI/UX datada, curva de aprendizado alta |
| Pixeon | Força concentrada em imagem; outros módulos menos maduros |
| TOTVS Saúde | Dependência do ecossistema TOTVS; menos flexível para integrações fora dele |
| Oracle Health | Preço alto, implementação demorada, reputação de complexidade |
| TrakCare | Menor penetração em LatAm; dependência do IRIS |
| Epic | Preço proibitivo para médios, cultura "do the Epic way" |
| MEDITECH | Menor profundidade em especialidades complexas vs Epic |
| Dedalus ORBIS U | Pouca presença nas Américas; integração entre módulos herdados de múltiplas aquisições |

---

## Quadrante de Posicionamento (Resumo)

```
                     Profundidade Clínica
                              ^
                              |
      Epic *          * Oracle Health
                              |
  Dedalus *    Philips Tasy * | * InterSystems TrakCare
                              |
                 MV SOUL MV * | * MEDITECH Expanse
                              |
        TOTVS Saúde *         |
                              |
                 Pixeon *     |
                              |
------------------------------+-----------------------------> Cobertura Funcional
                              |         Total (Clin+Adm+Fin)
```

---

## Conclusão: Onde Velya Joga

O mercado é dominado por nove jogadores maduros, todos com décadas de código legado. A oportunidade do Velya **não** é ser mais um EHR. É ser a **primeira plataforma hospitalar cloud-native real, mobile-first séria, com agentes governados, auditoria radical e observabilidade nativa**. Esses cinco vetores não aparecem bem feitos em nenhum dos nove.

O documento `what-velya-must-do-better-than-the-market.md` aprofunda cada vetor. O documento `velya-target-state-from-market-benchmark.md` mostra o que copiar/adaptar/superar.
