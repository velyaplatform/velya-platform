# Politica de Autenticacao Multi-Fator e Step-Up

**Modulo:** Velya Access Control - MFA & Step-Up Authentication  
**Versao:** 1.0.0  
**Data:** 2026-04-08  
**Classificacao:** Interno - Seguranca  
**Responsavel:** Time de Plataforma Velya

---

## 1. Visao Geral

A autenticacao multi-fator (MFA) no Velya segue uma abordagem adaptativa ao contexto hospitalar. O nivel de autenticacao exigido varia conforme:

- O tipo de acao sendo executada (leitura vs. escrita vs. acao critica)
- O local fisico do acesso (beira de leito, escritorio, remoto)
- A classificacao dos dados acessados (Classe A a E)
- O horario e o padrao de comportamento do usuario

O objetivo e equilibrar seguranca com usabilidade clinica, evitando que a autenticacao se torne um obstaculo ao atendimento do paciente.

---

## 2. Niveis de Autenticacao

### 2.1 Autenticacao Base (Login)

Todo acesso ao Velya requer autenticacao base composta por:

| Componente        | Descricao                                              | Obrigatoriedade         |
| ----------------- | ------------------------------------------------------ | ----------------------- |
| SSO Institucional | Federacao via SAML 2.0 / OIDC com IdP do hospital      | Obrigatorio             |
| Cracha/Cartao     | Leitura de cartao RFID/NFC institucional               | Obrigatorio em estacoes |
| PIN               | Codigo numerico de 6 digitos, pessoal e intransferivel | Obrigatorio             |

### 2.2 Niveis de Step-Up

Apos o login base, acoes criticas exigem autenticacao adicional (step-up):

| Nivel | Nome     | Fatores Adicionais              | Duracao           | Uso Tipico                               |
| ----- | -------- | ------------------------------- | ----------------- | ---------------------------------------- |
| L0    | Base     | SSO + Cracha + PIN              | Duração da sessao | Navegacao, leitura de dados Classe A/B   |
| L1    | Standard | Cracha + PIN (re-confirmacao)   | 30 min            | Prescricao, assinatura de evolucao       |
| L2    | High     | Biometria (impressao digital)   | 10 min            | Exportacao, impressao, dados Classe D    |
| L3    | Critical | Biometria + PIN + Justificativa | 5 min             | Break-glass, dados Classe E, acoes admin |

---

## 3. Gatilhos de Step-Up

### 3.1 Tabela Completa de Gatilhos

| Acao                                      | Nivel Minimo | Justificativa Obrigatoria | Notificacao ao Gestor | Registro Especial        |
| ----------------------------------------- | ------------ | ------------------------- | --------------------- | ------------------------ |
| Prescrever medicamento                    | L1           | Nao                       | Nao                   | Sim - assinatura digital |
| Prescrever controlado (Portaria 344)      | L2           | Nao                       | Nao                   | Sim - registro SNGPC     |
| Assinar evolucao clinica                  | L1           | Nao                       | Nao                   | Sim - assinatura digital |
| Assinar laudo/atestado                    | L2           | Nao                       | Nao                   | Sim - ICP-Brasil         |
| Exportar dados de paciente                | L2           | Sim                       | Sim                   | Sim - DLP log            |
| Imprimir prontuario                       | L2           | Sim                       | Nao                   | Sim - controle de copias |
| Acesso break-glass                        | L3           | Sim                       | Sim (imediato)        | Sim - alerta seguranca   |
| Acessar dados Classe D (psiq/HIV/genetic) | L2           | Sim                       | Nao                   | Sim - audit especial     |
| Acessar dados Classe E (VIP/judiciario)   | L3           | Sim                       | Sim (imediato)        | Sim - alerta seguranca   |
| Alterar papel/permissao de usuario        | L3           | Sim                       | Sim                   | Sim - change log         |
| Criar/desativar usuario                   | L3           | Sim                       | Sim                   | Sim - change log         |
| Modificar politica de acesso              | L3           | Sim                       | Sim (dual approval)   | Sim - change log         |
| Visualizar log de auditoria               | L2           | Nao                       | Nao                   | Sim                      |
| Acessar painel administrativo             | L2           | Nao                       | Nao                   | Sim                      |
| Cancelar/anular prescricao                | L1           | Sim                       | Nao                   | Sim - motivo obrigatorio |
| Alterar dados demograficos                | L1           | Nao                       | Nao                   | Sim                      |
| Acessar prontuario proprio ou familiar    | L3           | Sim                       | Sim (imediato)        | Sim - alerta compliance  |

### 3.2 Escalacao Automatica

Em determinadas condicoes, o nivel de step-up e automaticamente escalado:

| Condicao                                     | Escalacao                   |
| -------------------------------------------- | --------------------------- |
| Acesso fora do horario de trabalho           | +1 nivel                    |
| Acesso de unidade diferente da atribuida     | +1 nivel                    |
| Mais de 3 falhas de autenticacao na sessao   | Bloqueio temporario 5min    |
| Acesso via rede nao-hospitalar               | Sempre L2 minimo            |
| Primeira vez acessando prontuario especifico | +1 nivel se dados Classe C+ |

---

## 4. Fatores de Autenticacao Suportados

### 4.1 Catalogo de Fatores

| Fator                          | Tipo         | Hardware              | Disponibilidade      | Tempo Medio |
| ------------------------------ | ------------ | --------------------- | -------------------- | ----------- |
| Cracha RFID/NFC                | Posse        | Leitor de cartao      | Todas as estacoes    | < 1s        |
| PIN (6 digitos)                | Conhecimento | Teclado/numpad        | Universal            | 2-3s        |
| Impressao digital              | Biometria    | Leitor biometrico     | Estacoes clinicas    | 1-2s        |
| TOTP (app autenticador)        | Posse        | Celular pessoal       | Acesso remoto        | 5-10s       |
| Push notification              | Posse        | Celular institucional | Acesso remoto        | 3-15s       |
| Certificado digital ICP-Brasil | Posse        | Token USB / smartcard | Medicos (assinatura) | 3-5s        |

### 4.2 Selecao de Fator por Contexto

```yaml
# mfa-context-policy.yaml
factor_selection:
  contexts:
    bedside:
      description: 'Beira de leito - tablets e terminais moveis'
      primary_factor: 'badge_rfid'
      secondary_factor: 'biometric_fingerprint'
      fallback_factor: 'pin'
      rationale: >
        Beira de leito prioriza rapidez. Badge + biometria permite
        autenticacao em menos de 3 segundos sem memorizar codigo.
      hardware_required:
        - rfid_reader
        - fingerprint_scanner

    nursing_station:
      description: 'Posto de enfermagem - estacoes compartilhadas'
      primary_factor: 'badge_rfid'
      secondary_factor: 'pin'
      fallback_factor: 'biometric_fingerprint'
      rationale: >
        Postos de enfermagem tem troca frequente de usuario.
        Badge + PIN e rapido e familiar para a equipe.
      hardware_required:
        - rfid_reader

    office:
      description: 'Consultorio e sala de laudo'
      primary_factor: 'badge_rfid'
      secondary_factor: 'pin'
      fallback_factor: 'totp'
      rationale: >
        Ambiente de uso individual. Badge + PIN e suficiente.
        TOTP como fallback caso esqueca o cracha.
      hardware_required:
        - rfid_reader

    remote:
      description: 'Acesso remoto via VPN'
      primary_factor: 'sso_oidc'
      secondary_factor: 'totp'
      tertiary_factor: 'push_notification'
      fallback_factor: null
      rationale: >
        Acesso remoto exige autenticacao mais forte.
        SSO + TOTP/Push obrigatorios.
      hardware_required: []
      additional_checks:
        - vpn_active
        - device_registered
        - geolocation_within_country

    emergency_room:
      description: 'Pronto-socorro e sala de emergencia'
      primary_factor: 'badge_rfid'
      secondary_factor: 'pin'
      fallback_factor: 'verbal_auth_with_witness'
      rationale: >
        Em emergencias, o acesso nao pode ser impedido por falha
        de hardware. Autenticacao verbal com testemunha e aceita
        como ultimo recurso, com registro obrigatorio.
      hardware_required:
        - rfid_reader
      emergency_override: true
```

---

## 5. Fluxo de Elevacao de Sessao (Step-Up)

### 5.1 Diagrama de Fluxo

```
+------------------+
| Usuario executa  |
| acao na UI       |
+--------+---------+
         |
         v
+--------+---------+
| ActionGuard      |
| verifica nivel   |
| de step-up       |
+--------+---------+
         |
    +----+----+
    | Nivel   |
    | atual   |
    | >= req? |
    +----+----+
    Sim  |  Nao
    |    |
    v    v
+---+--+ +---+--------+
|Permite| |Exibir modal|
|acao   | |de step-up  |
+------+ +---+--------+
              |
              v
     +--------+--------+
     | Selecionar fator |
     | conforme contexto|
     +--------+--------+
              |
              v
     +--------+--------+
     | Usuario apresenta|
     | fator adicional  |
     +--------+--------+
              |
         +----+----+
         | Fator   |
         | valido? |
         +----+----+
         Sim  |  Nao
         |    |
         v    v
    +----+--+ +---+--------+
    |Elevar | |Incrementar |
    |sessao | |contador de |
    |       | |falhas      |
    +---+---+ +---+--------+
        |         |
        v         v
   +----+----+ +--+----------+
   |Timer de | |>3 falhas?   |
   |expiracao| |Bloquear 5min|
   |step-up  | +--------------+
   +---------+
```

### 5.2 Timeout de Elevacao

A elevacao de sessao expira apos o periodo definido para o nivel:

| Nivel         | Duracao da Elevacao | Renovavel | Maximo de Renovacoes |
| ------------- | ------------------- | --------- | -------------------- |
| L1 (Standard) | 30 minutos          | Sim       | 3 vezes (total 2h)   |
| L2 (High)     | 10 minutos          | Sim       | 1 vez (total 20min)  |
| L3 (Critical) | 5 minutos           | Nao       | -                    |

Apos expirar, a sessao retorna ao nivel base (L0). O usuario deve re-autenticar para executar novas acoes criticas.

---

## 6. Prevencao de Fadiga de MFA

### 6.1 Estrategias Anti-Fadiga

A fadiga de MFA ocorre quando usuarios sao solicitados a autenticar com tanta frequencia que começam a tratar a autenticacao como mero obstaculo, reduzindo a eficacia da seguranca.

| Estrategia                     | Implementacao                                           | Parametro       |
| ------------------------------ | ------------------------------------------------------- | --------------- |
| Agrupamento de acoes           | Acoes do mesmo nivel dentro do timeout nao re-solicitam | Automatico      |
| Limite de desafios por hora    | Maximo de desafios step-up por usuario/hora             | 10/hora         |
| Throttling progressivo         | Atraso crescente entre desafios se aceitos rapidamente  | 0s, 2s, 5s, 10s |
| Nivel de risco adaptativo      | Ajusta nivel baseado no score de risco da sessao        | Score 0-100     |
| Caching de biometria           | Template biometrico em memoria segura por 60s           | Configuravel    |
| Bypass para emergencia clinica | Codigo de emergencia do supervisor                      | Auditado        |

### 6.2 Rate Limiting de Desafios

```yaml
# mfa-rate-limiting.yaml
rate_limits:
  step_up_challenges:
    per_user_per_hour: 10
    per_user_per_day: 50
    per_workstation_per_hour: 30
    cooldown_after_max: 300 # 5 minutos

  failed_attempts:
    max_consecutive: 3
    lockout_duration_seconds: 300
    lockout_escalation:
      - attempts: 3
        duration: 300 # 5 minutos
      - attempts: 6
        duration: 900 # 15 minutos
      - attempts: 9
        duration: 3600 # 1 hora - notifica seguranca
      - attempts: 12
        duration: 86400 # 24 horas - requer desbloqueio manual

  push_notifications:
    max_per_minute: 1
    max_per_hour: 10
    require_interaction: true # Nao auto-aprovar
    show_context: true # Mostrar IP, estacao, acao

  totp:
    max_attempts_per_code: 3
    time_window: 30 # segundos
    accept_previous: true # aceita codigo anterior (30s)
    accept_next: false # nao aceita codigo futuro
```

### 6.3 Score de Risco Adaptativo

O score de risco influencia quando step-up e solicitado:

```yaml
# risk-scoring.yaml
risk_factors:
  - factor: 'access_outside_shift'
    weight: 30
    description: 'Acesso fora do horario de trabalho atribuido'

  - factor: 'access_outside_unit'
    weight: 20
    description: 'Acesso de unidade diferente da atribuida'

  - factor: 'new_workstation'
    weight: 10
    description: 'Primeira vez usando esta estacao de trabalho'

  - factor: 'high_volume_access'
    weight: 25
    description: 'Volume de acessos acima do percentil 95 do perfil'

  - factor: 'vip_patient'
    weight: 15
    description: 'Paciente marcado como VIP'

  - factor: 'recent_role_change'
    weight: 10
    description: 'Papel alterado nos ultimos 7 dias'

  - factor: 'network_anomaly'
    weight: 20
    description: 'IP ou rede diferente do padrao'

  - factor: 'rapid_switching'
    weight: 15
    description: 'Troca rapida de usuario (>3 em 30min)'

thresholds:
  - score_range: [0, 30]
    action: 'normal'
    step_up_modifier: 0

  - score_range: [31, 60]
    action: 'elevated'
    step_up_modifier: 1 # +1 nivel de step-up

  - score_range: [61, 80]
    action: 'high_risk'
    step_up_modifier: 2
    notify: 'security_team'

  - score_range: [81, 100]
    action: 'block_and_review'
    step_up_modifier: null # bloqueia ate revisao
    notify: ['security_team', 'compliance']
```

---

## 7. Procedimentos de Fallback

### 7.1 Falha no Leitor de Cracha

| Cenario                    | Procedimento                                        | Nivel de Acesso |
| -------------------------- | --------------------------------------------------- | --------------- |
| Leitor com defeito         | Autenticar com usuario/senha + TOTP                 | Normal          |
| Cracha perdido/esquecido   | Solicitar cracha temporario na recepcao + biometria | Restrito (24h)  |
| Cracha desmagnetizado      | Autenticar com usuario/senha + biometria            | Normal          |
| Sistema de crachas offline | PIN especial + biometria + registro manual          | Restrito        |

### 7.2 Falha no Leitor Biometrico

| Cenario                        | Procedimento                                | Nivel de Acesso     |
| ------------------------------ | ------------------------------------------- | ------------------- |
| Leitor com defeito             | Substituir por Cracha + PIN + TOTP          | Normal              |
| Biometria nao reconhecida (3x) | Fallback para PIN + Cracha                  | Normal (com alerta) |
| Lesao no dedo cadastrado       | Usar dedo alternativo (2 dedos cadastrados) | Normal              |
| Todos os dedos indisponiveis   | Cracha + PIN + supervisor presencial        | Restrito            |

### 7.3 Falha no App TOTP (Acesso Remoto)

| Cenario                     | Procedimento                                              | Nivel de Acesso     |
| --------------------------- | --------------------------------------------------------- | ------------------- |
| Celular sem bateria         | Push notification nao disponivel - usar codigos de backup | Normal              |
| App desinstalado            | Usar codigos de backup (10 codigos pre-gerados)           | Normal              |
| Celular perdido             | Contatar TI para desativar MFA + reemitir                 | Bloqueado ate reset |
| Codigos de backup esgotados | Contatar TI para regenerar + verificacao presencial       | Bloqueado ate reset |

### 7.4 Codigos de Backup

```yaml
# backup-codes-policy.yaml
backup_codes:
  quantity: 10
  format: 'XXXX-XXXX' # 8 caracteres alfanumericos
  single_use: true
  regeneration:
    requires: 'L3_auth'
    invalidates_previous: true
    notification: true
  storage:
    hashed: true
    algorithm: 'argon2id'
  display:
    show_once: true
    allow_download: true
    format: 'pdf_encrypted'
    pdf_password: 'ultimos 4 digitos do CPF + ano de nascimento'
```

---

## 8. Configuracao YAML Completa da Politica MFA

```yaml
# mfa-policy.yaml
apiVersion: velya.io/v1
kind: MFAPolicy
metadata:
  name: hospital-mfa-policy
  namespace: velya-access
  labels:
    compliance: lgpd
    environment: production
spec:
  # Autenticacao base obrigatoria para todos os acessos
  base_authentication:
    required_factors:
      - type: 'sso'
        provider: 'hospital-idp'
        protocol: 'oidc'
        claims_required:
          - 'sub'
          - 'email'
          - 'groups'
          - 'employee_id'
      - type: 'badge'
        technology: 'rfid_nfc'
        reader_protocol: 'pc_sc'
        certificate_validation: true
      - type: 'pin'
        length: 6
        numeric_only: true
        max_age_days: 90
        history_count: 12
        complexity: 'no_sequential_no_repeated'

  # Regras de step-up por acao
  step_up_rules:
    - name: 'prescribe_medication'
      actions:
        - 'prescricao.criar'
        - 'prescricao.alterar'
      required_level: 'L1'
      factors: ['badge_reconfirm', 'pin']
      elevation_duration_seconds: 1800
      justification_required: false
      audit_category: 'clinical_action'

    - name: 'prescribe_controlled'
      actions:
        - 'prescricao.criar.controlado'
      required_level: 'L2'
      factors: ['biometric_fingerprint']
      elevation_duration_seconds: 600
      justification_required: false
      audit_category: 'controlled_substance'
      additional_checks:
        - 'user_has_crm'
        - 'crm_specialty_matches'

    - name: 'sign_clinical_document'
      actions:
        - 'evolucao.assinar'
        - 'sumario.assinar'
        - 'parecer.assinar'
      required_level: 'L1'
      factors: ['badge_reconfirm', 'pin']
      elevation_duration_seconds: 900
      justification_required: false
      audit_category: 'clinical_signature'
      digital_signature:
        required: true
        standard: 'xades_bes'
        certificate: 'icp_brasil_a3'

    - name: 'sign_legal_document'
      actions:
        - 'laudo.assinar'
        - 'atestado.assinar'
        - 'declaracao.assinar'
      required_level: 'L2'
      factors: ['certificate_icp_brasil']
      elevation_duration_seconds: 600
      justification_required: false
      audit_category: 'legal_signature'
      digital_signature:
        required: true
        standard: 'cades_bes'
        certificate: 'icp_brasil_a3'
        timestamp_authority: 'ac_certisign'

    - name: 'export_patient_data'
      actions:
        - 'prontuario.exportar'
        - 'dados.exportar.csv'
        - 'dados.exportar.pdf'
      required_level: 'L2'
      factors: ['biometric_fingerprint']
      elevation_duration_seconds: 600
      justification_required: true
      justification_options:
        - 'solicitacao_paciente'
        - 'ordem_judicial'
        - 'transferencia_hospitalar'
        - 'pesquisa_aprovada_cep'
        - 'auditoria_regulatoria'
      audit_category: 'data_export'
      dlp_check: true
      notify:
        - role: 'encarregado_dados'
        - role: 'gestor_unidade'

    - name: 'break_glass_access'
      actions:
        - 'breakglass.ativar'
      required_level: 'L3'
      factors: ['biometric_fingerprint', 'pin', 'justification']
      elevation_duration_seconds: 900
      justification_required: true
      justification_min_length: 50
      justification_options:
        - 'emergencia_clinica'
        - 'risco_iminente_vida'
      audit_category: 'break_glass'
      notify:
        - role: 'security_team'
          method: 'immediate'
        - role: 'gestor_unidade'
          method: 'immediate'
        - role: 'compliance'
          method: 'batch_daily'

    - name: 'access_class_d_data'
      actions:
        - 'prontuario.ler.psiquiatria'
        - 'prontuario.ler.hiv'
        - 'prontuario.ler.genetica'
        - 'prontuario.ler.reproducao'
      required_level: 'L2'
      factors: ['biometric_fingerprint']
      elevation_duration_seconds: 600
      justification_required: true
      justification_options:
        - 'vinculo_assistencial'
        - 'parecer_solicitado'
        - 'supervisao_clinica'
      audit_category: 'sensitive_data'

    - name: 'access_class_e_data'
      actions:
        - 'prontuario.ler.vip'
        - 'prontuario.ler.judicial'
        - 'prontuario.ler.funcionario'
      required_level: 'L3'
      factors: ['biometric_fingerprint', 'pin', 'justification']
      elevation_duration_seconds: 300
      justification_required: true
      justification_min_length: 100
      audit_category: 'restricted_data'
      notify:
        - role: 'security_team'
          method: 'immediate'
        - role: 'compliance'
          method: 'immediate'

    - name: 'admin_role_management'
      actions:
        - 'rbac.role.atribuir'
        - 'rbac.role.revogar'
        - 'rbac.politica.alterar'
      required_level: 'L3'
      factors: ['biometric_fingerprint', 'pin', 'justification']
      elevation_duration_seconds: 300
      justification_required: true
      audit_category: 'admin_action'
      dual_approval: true
      notify:
        - role: 'security_team'
        - role: 'compliance'

    - name: 'user_management'
      actions:
        - 'usuario.criar'
        - 'usuario.desativar'
        - 'usuario.reativar'
      required_level: 'L3'
      factors: ['biometric_fingerprint', 'pin']
      elevation_duration_seconds: 300
      justification_required: true
      audit_category: 'admin_action'

  # Configuracao de fatores
  factor_config:
    badge_rfid:
      timeout_seconds: 10
      retry_on_fail: true
      max_retries: 3

    pin:
      length: 6
      input_timeout_seconds: 30
      mask_input: true

    biometric_fingerprint:
      timeout_seconds: 15
      min_match_score: 40
      max_retries: 3
      enrolled_fingers: 2
      liveness_detection: true
      template_format: 'iso_19794_2'

    totp:
      digits: 6
      period_seconds: 30
      algorithm: 'sha256'
      issuer: 'Velya Hospital'
      window: 1

    push_notification:
      timeout_seconds: 60
      show_location: true
      show_action: true
      require_biometric_on_device: true
      provider: 'firebase_fcm'

    certificate_icp_brasil:
      allowed_types: ['A3']
      min_key_size: 2048
      revocation_check: 'ocsp_with_crl_fallback'
      timestamp_required: true

  # Anti-fadiga
  fatigue_prevention:
    group_similar_actions: true
    group_window_seconds: 300
    max_challenges_per_hour: 10
    max_challenges_per_day: 50
    progressive_delay:
      enabled: true
      delays_seconds: [0, 2, 5, 10, 20]
    risk_based_bypass:
      enabled: true
      low_risk_threshold: 20
      bypass_for_low_risk_l1: true
```

---

## 9. Integracao com Assinatura Digital

### 9.1 Fluxo de Assinatura com Step-Up

Para documentos que exigem assinatura digital com validade juridica (laudos, atestados), o step-up e integrado ao processo de assinatura:

| Etapa | Acao                         | Detalhe                                          |
| ----- | ---------------------------- | ------------------------------------------------ |
| 1     | Usuario solicita assinatura  | Clica "Assinar" no documento                     |
| 2     | Verificacao de step-up L2    | Sistema verifica se ja tem elevacao              |
| 3     | Insercao de token ICP-Brasil | Usuario insere token USB ou smartcard            |
| 4     | Leitura do certificado       | Sistema le certificado A3 do token               |
| 5     | Validacao do certificado     | Verifica cadeia, revogacao (OCSP), validade      |
| 6     | PIN do token                 | Usuario digita PIN do token ICP-Brasil           |
| 7     | Hash do documento            | Calculo do hash SHA-256 do documento             |
| 8     | Assinatura no token          | Operacao criptografica no hardware do token      |
| 9     | Carimbo de tempo             | TSA da AC Certisign aplica timestamp             |
| 10    | Armazenamento                | Documento assinado armazenado com envelope CAdES |

### 9.2 Certificados Aceitos

| Autoridade Certificadora | Tipo     | Uso                               |
| ------------------------ | -------- | --------------------------------- |
| AC Certisign             | A3       | Medicos (CRM)                     |
| AC Serasa                | A3       | Medicos (CRM)                     |
| AC Valid                 | A3       | Equipe multiprofissional          |
| AC do CRM                | A3 (CFM) | Medicos - certificado do conselho |
| AC Safeweb               | A3       | Farmaceuticos (CRF)               |

---

## 10. Monitoramento e Metricas MFA

### 10.1 Metricas Coletadas

```yaml
# mfa-metrics.yaml
metrics:
  counters:
    - name: velya_mfa_challenges_total
      labels: [level, factor, context, result]
      help: 'Total de desafios MFA emitidos'

    - name: velya_mfa_failures_total
      labels: [level, factor, context, reason]
      help: 'Total de falhas de MFA'

    - name: velya_mfa_lockouts_total
      labels: [reason]
      help: 'Total de bloqueios por falha de MFA'

    - name: velya_mfa_fallback_total
      labels: [primary_factor, fallback_factor]
      help: 'Total de vezes que fallback foi utilizado'

  histograms:
    - name: velya_mfa_challenge_duration_seconds
      labels: [level, factor]
      buckets: [0.5, 1, 2, 3, 5, 10, 15, 30, 60]
      help: 'Tempo para completar desafio MFA'

  gauges:
    - name: velya_mfa_elevated_sessions
      labels: [level, unit]
      help: 'Sessoes atualmente com step-up ativo'
```

### 10.2 Alertas

```yaml
# mfa-alerts.yaml
groups:
  - name: mfa_security
    rules:
      - alert: HighMFAFailureRate
        expr: |
          rate(velya_mfa_failures_total[15m]) /
          rate(velya_mfa_challenges_total[15m]) > 0.3
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'Taxa de falha MFA acima de 30% nos ultimos 15 minutos'

      - alert: MFABruteForceAttempt
        expr: |
          increase(velya_mfa_failures_total{reason="invalid_credential"}[5m]) > 10
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'Possivel tentativa de forca bruta em MFA'

      - alert: UnusualFallbackUsage
        expr: |
          increase(velya_mfa_fallback_total[1h]) > 20
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: 'Uso elevado de fallback MFA - verificar hardware'

      - alert: BiometricReaderOffline
        expr: |
          velya_hardware_status{device="fingerprint_reader"} == 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Leitor biometrico offline na estacao {{ $labels.workstation_id }}'
```

---

## 11. Conformidade e Auditoria

### 11.1 Requisitos Regulatorios

| Regulamento     | Requisito MFA                            | Implementacao Velya              |
| --------------- | ---------------------------------------- | -------------------------------- |
| LGPD Art. 46    | Medidas tecnicas de protecao             | MFA adaptativo por classificacao |
| CFM 2.299/2021  | Autenticacao para PEP                    | Assinatura digital ICP-Brasil    |
| SBIS NGS2       | Autenticacao forte para registro clinico | Step-up L1+ para escrita clinica |
| ANS RN 305      | Controle de acesso a dados de saude      | MFA por nivel de sensibilidade   |
| ISO 27001 A.9.4 | Controle de acesso a sistemas            | MFA baseado em risco             |

### 11.2 Registros de Auditoria MFA

Todo evento MFA gera registro contendo:

| Campo              | Descricao                       | Exemplo                       |
| ------------------ | ------------------------------- | ----------------------------- |
| `event_id`         | Identificador unico do evento   | `mfa-evt-2026-04-08-001`      |
| `timestamp`        | Data/hora UTC com microsegundos | `2026-04-08T14:30:00.123456Z` |
| `user_id`          | Identificador do usuario        | `USR-001`                     |
| `session_id`       | Identificador da sessao         | `sess-abc-123`                |
| `challenge_level`  | Nivel de step-up solicitado     | `L2`                          |
| `factor_used`      | Fator apresentado               | `biometric_fingerprint`       |
| `result`           | Resultado (success/failure)     | `success`                     |
| `failure_reason`   | Motivo da falha (se aplicavel)  | `score_below_threshold`       |
| `workstation_id`   | Estacao de trabalho             | `WS-UTI-3A-001`               |
| `action_requested` | Acao que disparou o step-up     | `prontuario.exportar`         |
| `risk_score`       | Score de risco no momento       | `45`                          |
| `response_time_ms` | Tempo de resposta do usuario    | `2340`                        |

---

_Documento gerado para a plataforma Velya. Uso interno - Seguranca e Compliance._
