# Command Centers e Dashboards

> **Escopo:** os painéis de comando que dão visibilidade operacional em tempo real para cada área do hospital e para a direção geral.

---

## 1. Filosofia dos Command Centers

Um hospital de grande porte é um **sistema distribuído 24/7** operando com centenas de variáveis críticas. Ninguém consegue coordenar tudo sem visibilidade unificada. Os command centers do Velya existem em dois níveis:

1. **Geral / Estratégico:** visão do hospital inteiro, para direção e CMO.
2. **Tático / por área:** visão profunda de uma área específica, para seus gestores e equipes.

Todos os dashboards compartilham a mesma fonte de verdade (eventos + estados), a mesma semântica e o mesmo timeline.

---

## 2. Command Center Geral (Bed & Flow)

### 2.1 Propósito
Visão única do hospital: onde estão os gargalos, onde há risco, onde há oportunidade.

### 2.2 Widgets
- **Mapa de ocupação por unidade** (ED, UTI, enfermarias, CC, maternidade).
- **Pacientes em boarding** (contagem + tempo médio).
- **LOS médio x esperado** por unidade.
- **Saídas previstas do dia** (alta prevista vs confirmada).
- **Entradas previstas do dia** (eletivos + urgências estimadas).
- **Taxa de ocupação global** (%).
- **Ambulâncias a caminho** (contagem + ETAs).
- **Red flags clínicas**: código azul ativos, trauma ativo, AVC ativo, IAM ativo.
- **Eventos não atendidos** (alarmes, alertas, handoffs pendentes).
- **Equipe em turno** (médicos, enfermeiros, carga).

### 2.3 Ações
- Drill-down em qualquer widget.
- Escalação automática.
- Alertas push.

---

## 3. Dashboard da ED

### 3.1 Widgets
- **Fila de triagem** (quem chegou, quanto tempo, cor).
- **Pacientes por bay** (ocupação visual).
- **Tempos críticos**: door-to-doctor, door-to-disposition.
- **Pacientes em espera** por nível MTS.
- **Protocolos ativos**: AVC, IAM, sepse, trauma (com cronômetro).
- **Boarding** (admitidos na ED sem leito).
- **Fast-track performance.**
- **LWBS count.**
- **Red room status.**
- **Eventos ocorridos nas últimas 24h.**

### 3.2 Ações
- Escalação automática quando SLOs estouram.
- Reassignment de bay em 1 clique.
- Notificação ao diretor médico.

---

## 4. Dashboard de Ambulâncias / EMS

### 4.1 Widgets
- **Viaturas a caminho** (cards): ID, ETA, queixa principal, protocolo ativo.
- **Viaturas aguardando handoff** (TBR não completo).
- **Mapa GPS** em tempo real.
- **Tempo médio de pré-notificação.**
- **Cobertura de ePCR.**
- **Tempo médio de handoff.**
- **Turnaround da viatura** (chegada → liberação).

### 4.2 Alertas
- ePCR vazio > 2 min após despacho.
- ETA > 30 min para paciente crítico (AVC, IAM, trauma).
- Handoff sem ack em 5 min.

---

## 5. Dashboard de Leitos / Central de Regulação

### 5.1 Widgets
- **Mapa de leitos** colorido por estado.
- **Reservas pendentes** (quem, quando, de onde).
- **Tempo de turnaround de higienização** (leito a leito).
- **Leitos bloqueados** (motivo).
- **Leitos em manutenção.**
- **Alta prevista do dia** por unidade.
- **Cross-matching entrada x saída.**

### 5.2 Ações
- Reservar leito.
- Forçar liberação justificada.
- Acionar higienização prioritária.

---

## 6. Dashboard da UTI (SmartICU)

### 6.1 Widgets
- **Painel por leito:** sinais vitais, ventilador, bombas, drogas em curso, scores (RASS, CAM-ICU, SOFA).
- **Bundle compliance** (VAP, CLABSI, CAUTI, DVT).
- **Preditores de deterioração.**
- **Goals of care status** (BRIDGE).
- **Tempo de VM.**
- **LOS UTI.**
- **Candidatos a desmame** (daily screen).
- **Candidatos a alta da UTI.**

### 6.2 Alarmes inteligentes
- Deterioração hemodinâmica.
- Sepse precoce.
- AKI iminente.
- Extubação falhada iminente.

---

## 7. Dashboard do Centro Cirúrgico

### 7.1 Widgets
- **Mapa de salas** (estado em tempo real).
- **Cirurgias do dia** (timeline por sala).
- **First case on-time start** do dia.
- **Turnaround entre cirurgias.**
- **Cancelamentos.**
- **Checklist OMS compliance.**
- **Tempo de pausa (time-out).**
- **Cirurgias atrasadas.**
- **Status da CME/SPD** (sets prontos, em processamento, atrasados).

### 7.2 Integração ReadySet-like
- Preference cards sincronizados.
- Vendor reps online.

---

## 8. Dashboard de Oncologia

### 8.1 Widgets
- **Agenda do dia** (cadeiras, poltronas, pacientes).
- **Preparações da farmácia** (prontas, em preparo, atrasadas).
- **Ciclos iniciados vs planejados.**
- **Eventos adversos registrados.**
- **PBM status** (pacientes elegíveis, intervenções).
- **Transfusões do dia.**
- **Taxa de extravasamento.**
- **Agendamentos cancelados** (com motivo).

---

## 9. Dashboard de Farmácia

### 9.1 Widgets
- **Prescrições pendentes de validação.**
- **Intervenções farmacêuticas do dia.**
- **Stock-out (atual + iminente).**
- **Medicamentos próximos ao vencimento.**
- **Controlados em aberto.**
- **Preparações farmacotécnicas em curso.**
- **Tempo médio prescrição → administração.**

---

## 10. Dashboard de Lab / Imagem

### 10.1 Lab
- **Amostras em processamento.**
- **Resultados críticos pendentes de ack.**
- **Backlog por setor.**
- **Turnaround por tipo de exame.**
- **POCT calibração.**

### 10.2 Imagem
- **Filas por modalidade.**
- **Laudos pendentes.**
- **Tempo solicitação → exame.**
- **Tempo exame → laudo.**

---

## 11. Dashboard de Chamadas / Dor

### 11.1 Widgets
- **Chamadas de enfermagem** (botão do leito).
- **Tempo de resposta por unidade.**
- **Pacientes com dor > 4** (EVA).
- **Reavaliações de dor pendentes.**
- **Reações adversas registradas.**

---

## 12. Dashboard de Transporte Interno

### 12.1 Widgets
- **Solicitações ativas.**
- **Maqueiros ocupados/livres.**
- **Tempo médio de resposta.**
- **Atrasos em exames por transporte.**
- **Rotas mais demandadas.**

---

## 13. Dashboard de Higienização

### 13.1 Widgets
- **Leitos sujos** (por unidade).
- **Turnaround médio.**
- **SLA estourado.**
- **Equipes em campo.**
- **Inspeções pendentes.**

---

## 14. Dashboard de Manutenção / Engenharia Clínica

### 14.1 Widgets
- **Chamados abertos** (por criticidade).
- **MTTR por tipo.**
- **Equipamentos críticos parados.**
- **Preventivas vencidas.**
- **Backlog de peças.**
- **Calibrações vencendo.**

---

## 15. Dashboard de Supply Chain

### 15.1 Widgets
- **Stock-out / iminente.**
- **Curva ABC em consumo.**
- **Lead time por fornecedor.**
- **Pedidos atrasados.**
- **Recebimentos do dia.**
- **Validade vencendo.**

---

## 16. Dashboard de Faturamento

### 16.1 Widgets
- **Contas abertas** (por tempo).
- **Contas prontas para envio.**
- **DSO atual.**
- **Glosa primária / líquida.**
- **Recursos em andamento.**
- **Top motivos de glosa.**
- **Margem por service line.**

---

## 17. Dashboard de Qualidade e Segurança

### 17.1 Widgets
- **Never events.**
- **Eventos adversos** (por tipo e severidade).
- **Quedas com lesão.**
- **Úlceras por pressão novas.**
- **IRAS** (infecções relacionadas à assistência).
- **Mortalidade ajustada.**
- **Readmissão < 30 dias.**
- **Compliance de protocolos.**
- **Bundle compliance agregado.**

---

## 18. Dashboard de Observabilidade (Meta-Dashboard)

### 18.1 Widgets
- **Saúde do sistema** (latência, erros, uptime).
- **Traces incompletos.**
- **SLOs estourados** (clínicos e técnicos).
- **Fluxos quebrados detectados.**
- **No-data detection.**
- **Integrações falhando.**
- **Pipelines de dados.**

Ver `observability-and-autonomous-improvement.md`.

---

## 19. Princípios de Design dos Dashboards

1. **Uma tela, uma decisão.** Cada dashboard deve permitir uma decisão em < 10 segundos.
2. **Fonte única de verdade.** Todos consomem os mesmos eventos/estados.
3. **Real-time + histórico.** Nunca só um dos dois.
4. **Drill-down universal.** Clicar em qualquer número leva ao detalhe.
5. **Contexto clínico.** Números puros não resolvem — sempre com o "por quê".
6. **Alertas acionáveis.** Cada alerta tem uma ação clara e responsável.
7. **Fadiga de alarme controlada.** Agrupamento, priorização, silenciamento inteligente.
8. **Acessível a perfis certos.** Respeitando o modelo de acesso contextual.

---

## 20. Implementação Técnica

- **Backend:** streams de eventos (Kafka/NATS).
- **Agregação:** Flink/Materialize/ksql para métricas em tempo real.
- **Storage:** Postgres + TimescaleDB + ClickHouse (séries temporais).
- **Visualização:** Grafana para operacional, dashboards nativos Velya para clínicos.
- **Distribuição:** web, mobile, TVs grandes nas salas de command center.
- **Alertas:** PagerDuty-like, push, SMS, ligação automática para casos críticos.
