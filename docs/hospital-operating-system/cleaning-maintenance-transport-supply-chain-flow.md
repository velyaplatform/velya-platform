# Áreas Operacionais — Higienização, Manutenção, Transporte Interno e Supply Chain

> **Escopo:** as operações logísticas que sustentam 24/7 o funcionamento do hospital. Sem elas, não há cuidado clínico.

---

## 1. Por que modelar operações como cidadão de primeira classe

Em quase todo EHR tradicional, higienização, manutenção, transporte e supply chain são "sistemas satélite". O resultado: leitos sujos invisíveis, manutenção reativa, maqueiros perdidos, faltas de materiais no momento crítico.

O Velya eleva cada uma dessas áreas ao mesmo nível do fluxo clínico, com estados, eventos, SLAs, dashboards e observabilidade.

---

## 2. Higienização Hospitalar

### 2.1 Tipos de limpeza

| Tipo | Quando | SLA |
|---|---|---|
| Concorrente | Diária (com paciente no leito) | Manhã + tarde |
| Terminal | Alta, óbito, transferência | ≤ 60 min |
| Pós-procedimento | Sala cirúrgica, sala de exame | ≤ 20 min |
| De isolamento (terminal) | Isolamento de contato/respiratório | ≤ 90 min |
| Áreas comuns | Corredores, banheiros | Várias vezes/dia |

### 2.2 Fluxo terminal
```
[alta/óbito/transferência] → [leito marcado DIRTY] →
[solicitação de higienização gerada] → [alocação da equipe] →
[limpeza com EPI + produtos específicos] →
[desinfecção (superfícies de alto toque)] →
[vistoria por supervisão] →
[leito marcado AVAILABLE_CLEAN]
```

### 2.3 Estados do leito (higienização)
- `OCCUPIED`
- `DISCHARGE_IN_PROGRESS`
- `DIRTY`
- `CLEANING_IN_PROGRESS`
- `CLEANING_DONE`
- `INSPECTING`
- `AVAILABLE_CLEAN`
- `BLOCKED`

### 2.4 SLA e métricas
- Terminal ≤ 60 min.
- Tempo médio de turnaround (alta → pronto).
- Leitos bloqueados > 4h → alerta.
- Cobertura de inspeção (100%).

### 2.5 Produtos e processos
- Quaternário de amônio para superfícies.
- Hipoclorito para esporicida.
- Álcool 70% para alta rotatividade.
- Kits específicos para C. difficile (hipoclorito 0,5%).
- Vapor seco, UV-C em casos selecionados.

### 2.6 Integração
- Evento `patient.discharged` dispara automaticamente solicitação de higienização terminal.
- Central de regulação de leitos consome `bed.cleaning.done` para liberar o leito para o próximo paciente.

---

## 3. Manutenção Predial e Engenharia Clínica

### 3.1 Escopo
- **Manutenção predial:** elétrica, hidráulica, refrigeração, civil, marcenaria, climatização, iluminação, gerador, elevadores, sistema contra incêndio.
- **Engenharia clínica:** equipamentos médico-hospitalares — ventiladores, monitores, bombas, desfibriladores, tomógrafo, ressonância, etc.

### 3.2 Tipos
| Tipo | Descrição |
|---|---|
| Preventiva | Cronograma definido (trimestral, semestral, anual) |
| Corretiva | Sob demanda, falha em curso |
| Preditiva | Baseada em telemetria/sensores |
| Calibração | Ajuste periódico |
| Reforma | Projeto programado |

### 3.3 Fluxo corretiva
1. Abertura de chamado (app ou central).
2. Triagem por criticidade.
3. Alocação de técnico.
4. Deslocamento + diagnóstico.
5. Reparo ou pedido de peça.
6. Teste funcional.
7. Entrega à unidade.
8. Registro + baixa.

### 3.4 Criticidade
- **Emergência:** equipamento de suporte à vida em falha durante uso → resposta imediata.
- **Alta:** equipamento crítico parado sem reserva → ≤ 1h.
- **Média:** afeta fluxo mas tem alternativa → ≤ 4h.
- **Baixa:** conforto/estética → ≤ 24h.

### 3.5 Preventiva
- Cronograma por ativo.
- Notificação automática 7 dias antes.
- Bloqueio do ativo se vencer sem PM.
- Calibração vencida = bloqueio.

### 3.6 Métricas
- MTTR (Mean Time To Repair).
- MTBF (Mean Time Between Failures).
- Disponibilidade de equipamento crítico (≥ 99%).
- Compliance de PM (≥ 95%).
- Backlog de chamados.

### 3.7 Engenharia clínica específico
- Entrada de equipamento: tombamento + calibração inicial + treinamento.
- Saída de equipamento: baixa técnica + descontaminação + descarte.
- Rastreabilidade: qual equipamento foi usado em qual paciente.

---

## 4. Transporte Interno (Maqueiros)

### 4.1 Tipos de solicitação
- Paciente deitado (maca).
- Paciente sentado (cadeira de rodas).
- Paciente deambulando + acompanhante.
- Maca + monitorização + O₂.
- Maca + equipe médica (paciente crítico).

### 4.2 Fluxo
1. Solicitação (app, ligação, integração com exames).
2. Avaliação: criticidade, rota, equipamentos necessários.
3. Alocação de maqueiro (ou dupla).
4. Deslocamento até origem.
5. Conferência de identidade + destino.
6. Transporte.
7. Handoff no destino (assinatura).
8. Retorno à base.

### 4.3 Critérios especiais
- **Paciente em precauções** (isolamento): EPIs adicionais, rota alternativa.
- **Paciente crítico**: enfermeiro ou médico acompanha.
- **Equipamento durante transporte**: verificação de bateria, O₂.

### 4.4 Métricas
- Tempo de resposta (solicitação → chegada do maqueiro).
- Tempo de transporte.
- Taxa de atraso (exames perdidos por transporte).
- Cobertura de EPI.

### 4.5 Integração
- Central de transporte interno com painel em tempo real.
- Pré-notificação a exames/procedimentos.
- Alerta se paciente "em trânsito" > X minutos sem registro.

---

## 5. Supply Chain

### 5.1 Cadeia completa
```
[planejamento de demanda] → [compra] → [recebimento] →
[armazenagem central] → [distribuição] →
[estoque satélite] → [consumo] → [reposição]
```

### 5.2 Planejamento
- Análise histórica + cirurgias programadas + sazonalidade.
- Classificação ABC (valor) e XYZ (previsibilidade).
- Ponto de pedido e estoque de segurança por SKU.

### 5.3 Compra
- Cotação com fornecedores homologados.
- Ordem de compra.
- Homologação de novos fornecedores (CCIH, qualidade, fiscal).

### 5.4 Recebimento
- Conferência: nota fiscal, quantidade, lote, validade, laudo de análise.
- Quarentena até liberação.
- Aceite ou rejeição.

### 5.5 Armazenagem
- Condições (temperatura, umidade, luz).
- FEFO (First Expire, First Out).
- Segregação por tipo (comum, controlado, termolábil, citostáticos).
- Curva ABC para otimização de espaço.

### 5.6 Distribuição
- Reposição automática por consumo (kanban).
- Carrinho de abastecimento por unidade.
- Armários inteligentes por unidade.
- Rastreabilidade lote → paciente.

### 5.7 Estoque satélite
- Postos de enfermagem.
- Centro cirúrgico.
- Farmácias satélite.
- Controle de reposição.

### 5.8 Consumo e baixa
- Scan no ponto de uso.
- Baixa automática.
- Atualização de estoque em tempo real.
- Vínculo com conta do paciente.

### 5.9 Métricas
- Nível de serviço (≥ 98%).
- Ruptura (stock-out) crítica < 0,5%.
- Giro de estoque.
- Custo médio de estoque.
- Validade perdida (< 1%).
- Lead time por fornecedor.

### 5.10 Alertas
- Stock-out iminente.
- Lote próximo a vencer (30 dias).
- Consumo anormal (spike ou queda).
- Fornecedor atrasado.

---

## 6. Resíduos Hospitalares (RSS)

### 6.1 Segregação no ponto de geração
- **Grupo A:** infectante (branco leitoso).
- **Grupo B:** químico (medicamentos vencidos, citostáticos, reagentes).
- **Grupo C:** radioativo.
- **Grupo D:** comum (reciclável/orgânico).
- **Grupo E:** perfurocortante (caixa amarela rígida).

### 6.2 Fluxo
```
[geração] → [segregação] → [acondicionamento] →
[coleta interna] → [abrigo externo] →
[coleta por empresa homologada] → [tratamento + destino final]
```

### 6.3 Destino final
- Grupo A: autoclavagem ou incineração.
- Grupo B: incineração ou coprocessamento.
- Grupo C: decaimento até níveis seguros.
- Grupo D: aterro ou reciclagem.
- Grupo E: incineração.

### 6.4 Rastreabilidade
- Manifesto por coleta.
- Peso e volume.
- Empresa responsável.
- Destino final comprovado.

---

## 7. Lavanderia Hospitalar

- Roupa suja separada na origem (contaminada vs comum).
- Transporte em sacos identificados.
- Lavagem com desinfecção térmica/química.
- Barreira física entre área suja e limpa.
- Secagem, passadoria.
- Embalagem.
- Distribuição às unidades.
- Rouparia mantém estoque por unidade.

---

## 8. Utilities

- Gases medicinais (monitorização da central + rede + alarmes).
- Energia (gerador em standby, no-break, failover).
- Água (potável + hemodiálise ultrapura + esgoto).
- Climatização (pressão positiva/negativa, filtros HEPA em salas críticas).
- Sistema contra incêndio.
- CFTV + controle de acesso.

Cada utility é monitorado em tempo real com alertas em caso de desvio crítico.

---

## 9. Integração Operacional ↔ Clínica

- Alta do paciente dispara higienização.
- Higienização concluída libera leito para central de regulação.
- Cirurgia programada reserva sala + set + instrumental (via SPD) + hemoderivados.
- Falha de equipamento crítico dispara alerta clínico + engenharia.
- Stock-out de medicamento crítico dispara alerta + substituição terapêutica.
- Transporte interno é disparado por eventos de exames, cirurgia, transferências.

Tudo isso é **visível em dashboards integrados** (ver `command-centers-and-dashboards.md`).

---

## 10. Observabilidade Operacional

- Cada área operacional emite RED+USE metrics.
- Fluxos quebrados são detectados automaticamente (leito sujo > 2h, chamado sem técnico > SLA, stock-out não tratado, maqueiro ocioso ou sobrecarregado).
- Ciclos de melhoria contínua tocam diretamente nos processos operacionais.
