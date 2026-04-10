# Ciclo de Vida de Medicamentos, Materiais, Instrumentais e Ativos

> **Escopo:** todo o ciclo logístico-clínico dos insumos do hospital, desde compra até descarte ou reprocessamento, com rastreabilidade fim a fim.

---

## 1. Por que tratar tudo junto

Medicamentos, materiais, instrumentais e ativos **compartilham** o mesmo padrão: entram no hospital, são consumidos (ou reutilizados), geram custo, precisam ser rastreados, podem causar dano se mal utilizados.

Mas **divergem** em:
- **Medicamentos:** consumíveis, com validade, sensíveis à temperatura, alguns controlados.
- **Materiais:** consumíveis em sua maioria, alguns reprocessáveis.
- **Instrumentais:** reutilizáveis após reprocessamento (limpeza → esterilização).
- **Ativos:** permanentes, com depreciação, manutenção preventiva.

---

## 2. Medicamentos — Ciclo Completo

### 2.1 Etapa 1: Seleção (formulário terapêutico)
- CFT (Comissão de Farmácia e Terapêutica) padroniza o rol.
- Avaliação custo-efetividade.
- Alternativas terapêuticas.

### 2.2 Etapa 2: Compra
- Pedido baseado em consumo histórico + ponto de pedido + lead time.
- Cotação com fornecedores homologados.
- Ordem de compra.
- Recebimento com conferência (lote, validade, laudo, nota fiscal).

### 2.3 Etapa 3: Armazenagem
- Farmácia central: temperatura controlada (15–25°C), umidade, luz.
- Câmara fria (2–8°C) para imunobiológicos, insulina, vacinas.
- Freezer (-20°C) para alguns biológicos.
- Segurança para controlados (Portaria 344/98) com dupla chave.
- FEFO (First Expire, First Out).

### 2.4 Etapa 4: Distribuição interna
- **Dose unitária:** preparo individualizado por paciente (ideal).
- **Dose individualizada:** empacotamento por dose por horário.
- **Estoque satélite:** unidades com estoque limitado e seguro.
- **Armários inteligentes (Pyxis-like):** dispensação automatizada com biometria.

### 2.5 Etapa 5: Prescrição (CPOE)
- Prescrição eletrônica com CDS (Clinical Decision Support).
- Checagem de alergia, interação, duplicidade, dose máxima, renal/hepática.
- Assinatura digital do prescritor.

### 2.6 Etapa 6: Validação farmacêutica
- Farmacêutico clínico revisa antes da dispensação.
- Sugere trocas, ajustes, suspensões.
- Registra intervenções.

### 2.7 Etapa 7: Dispensação
- Scan do medicamento + scan do paciente.
- Registro de lote e validade dispensados.

### 2.8 Etapa 8: Administração
- **5 certos (na verdade 9+):** paciente certo, medicamento certo, dose certa, via certa, horário certo, orientação certa, documentação certa, razão certa, resposta certa.
- **Barcode scan** do medicamento + pulseira do paciente.
- Registro em prontuário.
- Observação de reações.

### 2.9 Etapa 9: Monitoramento
- Farmacovigilância (reações adversas).
- Monitoramento terapêutico (níveis séricos).
- Desfecho clínico.

### 2.10 Etapa 10: Devolução
- Dose não administrada → devolução à farmácia com justificativa.
- Recalculo do consumo.

### 2.11 Etapa 11: Baixa / Faturamento
- Conta do paciente é debitada.
- Custo direto por item.

### 2.12 Etapa 12: Descarte
- Medicamento vencido: incineração (RSS grupo B).
- Citostáticos: protocolo específico.
- Registro de descarte para controlados.

### 2.13 Categorias especiais de medicamentos
- **Controlados (Portaria 344/98):** A1, A2, A3 (entorpecentes, psicotrópicos), B1, B2, C1, C2, C3.
- **Alta vigilância (high-alert):** heparina, insulina, opioides, eletrólitos concentrados, quimioterápicos.
- **Antibióticos restritos (stewardship):** aprovação CCIH.
- **Quimioterápicos:** preparo em CAC + farmácia oncológica.
- **NPT (nutrição parenteral total):** preparo em capela de fluxo.

---

## 3. Materiais — Ciclo

### 3.1 Tipos
- **Consumíveis:** gaze, luva, seringa, agulha, sonda, cateter descartável.
- **Médico-hospitalares:** kits de curativo, kits de procedimento.
- **OPME (Órteses, Próteses e Materiais Especiais):** implantes ortopédicos, stents, válvulas, marca-passos.

### 3.2 Ciclo
1. **Previsão de demanda** (consumo histórico + cirurgias programadas).
2. **Pedido** ao setor de compras.
3. **Cotação e compra.**
4. **Recebimento:** conferência NF + lote + validade + integridade da embalagem.
5. **Armazenagem.**
6. **Distribuição:** por unidade, por bandeja cirúrgica, por armário satélite.
7. **Consumo:** registrado no momento do uso (barcode).
8. **Rastreabilidade:** lote + validade vinculados ao paciente específico.
9. **OPME:** etiqueta grudada no prontuário físico e eletrônico (rastreamento obrigatório por vigilância sanitária).
10. **Baixa / faturamento.**

### 3.3 OPME — regra especial
- **Pré-autorização do convênio** antes da cirurgia.
- **Representante do fornecedor** pode entrar no centro cirúrgico, mas seu acesso é rastreado e limitado.
- **Etiqueta com código de barras** é destacada e colada no prontuário.
- Consumido ou não consumido → devolução formal se não usado.

---

## 4. Instrumentais — Ciclo de Reprocessamento

### 4.1 Central de Material Esterilizado (CME / SPD)

O Velya integra com plataformas tipo **ReadySet**, que sincronizam em tempo real SPD ↔ Centro Cirúrgico ↔ representantes de OPME, unificando preference cards e sets de instrumental.

### 4.2 Fluxo de reprocessamento

```
[uso em cirurgia]
   ↓
[área suja: recepção, conferência de recebimento do set]
   ↓
[limpeza: manual + lavadora ultrassônica + termodesinfectora]
   ↓
[inspeção: funcionalidade + integridade + lupa]
   ↓
[montagem do set segundo preference card]
   ↓
[embalagem: papel grau cirúrgico / contêiner / SMS]
   ↓
[esterilização: autoclave a vapor, baixa temperatura (plasma/óxido de etileno)]
   ↓
[quarentena + validação biológica / química]
   ↓
[armazenagem: área limpa]
   ↓
[distribuição: próxima cirurgia]
```

### 4.3 Controles obrigatórios
- **Indicadores biológicos** (Bowie-Dick, spore test) com frequência.
- **Indicadores químicos** em cada pacote.
- **Lote de esterilização** rastreado.
- **Rastreabilidade set → cirurgia → paciente** para qualquer ocorrência de infecção pós-op.

### 4.4 Turnaround crítico
Cirurgias consecutivas com o mesmo instrumental exigem turnaround < 4h. O Velya monitora e alerta.

### 4.5 Integração ReadySet-like
- Preference card sincronizado em tempo real.
- Mudança feita no PACU pelo cirurgião atualiza o próximo set.
- Vendor reps veem o mesmo painel (com acesso restrito).
- SPD recebe o set list da cirurgia do dia seguinte automaticamente.

---

## 5. Ativos / Equipamentos Médicos

### 5.1 Categorias
- **Críticos de suporte à vida:** ventiladores, monitores, desfibriladores, bombas de infusão, marca-passos externos.
- **Diagnósticos:** ecografia, ECG, tomógrafo, ressonância, raio-X, PET-CT.
- **Cirúrgicos:** bisturis elétricos, mesas cirúrgicas, focos, arcos em C, robôs cirúrgicos, torres de laparoscopia.
- **De transporte:** macas, cadeiras de rodas, ambulâncias.
- **De ambiente:** ar-condicionado, iluminação, camas motorizadas.

### 5.2 Ciclo
1. **Aquisição** (capex, análise de retorno, acreditação regulatória).
2. **Cadastro em engenharia clínica** (tombamento, QR code).
3. **Aceite + calibração inicial.**
4. **Treinamento da equipe.**
5. **Uso clínico.**
6. **Manutenção preventiva** por cronograma (quadrimestral, semestral, anual).
7. **Manutenção corretiva** sob demanda.
8. **Calibração periódica.**
9. **Baixa técnica** ao fim da vida útil.
10. **Descarte adequado.**

### 5.3 Estado do ativo
- `AVAILABLE`
- `IN_USE`
- `DIRTY`
- `CLEANING`
- `MAINTENANCE_PREVENTIVE`
- `MAINTENANCE_CORRECTIVE`
- `AWAITING_PARTS`
- `CALIBRATION_DUE`
- `BLOCKED`
- `RETIRED`

### 5.4 Rastreabilidade de uso
- Ventilador X foi usado no paciente Y do dia D1 ao D2.
- Usado em conjunto com circuito Z, filtro W (consumíveis).
- Retornado para higienização.
- Validado para reuso.

---

## 6. Gases Medicinais

Tratados como ativos contínuos:
- **O₂** (oxigênio): rede canalizada + cilindros de emergência.
- **Ar comprimido medicinal.**
- **Vácuo** (aspiração).
- **Óxido nitroso.**
- **CO₂.**

Monitoramento:
- Nível dos tanques criogênicos em tempo real.
- Pressão na rede em cada andar.
- Alarmes de baixa pressão.
- Central de gases.

---

## 7. Enxoval e Roupa Hospitalar

Ciclo: suja → separação → lavagem → desinfecção → secagem → passadoria → embalagem → distribuição → uso → suja.

Regras de barreira biológica entre áreas suja e limpa da lavanderia.

---

## 8. Resíduos (RSS)

Segregação no ponto de geração:
- **Grupo A:** biológico infectante (saco branco leitoso).
- **Grupo B:** químico (medicamentos vencidos, citostáticos).
- **Grupo C:** radioativo.
- **Grupo D:** comum (reciclável, orgânico).
- **Grupo E:** perfurocortante (caixa amarela).

Ciclo: geração → segregação → acondicionamento → coleta interna → abrigo → coleta externa → destino final (incineração, autoclavagem, aterro).

---

## 9. Rastreabilidade Total

Para cada insumo consumido pelo paciente, o Velya mantém:
- `item_id` + `lote` + `validade`
- `patient_id`
- `encounter_id`
- `prescribed_by` / `administered_by`
- `timestamp`
- `location`
- `cost_center`

Isso permite:
- Recall de lote → identificação imediata dos pacientes expostos.
- Análise de custo por paciente/procedimento.
- Farmacovigilância retrospectiva.
- Auditoria regulatória (ANVISA).

---

## 10. Integração com Dashboards

Ver `command-centers-and-dashboards.md`:
- **Dashboard de farmácia:** stock-out, próximos a vencer, controlados em aberto.
- **Dashboard de SPD:** tempo de turnaround, sets com pendência.
- **Dashboard de engenharia clínica:** ativos em manutenção, calibração vencida.
- **Dashboard de supply chain:** ponto de pedido, lead time, curva ABC/XYZ.
