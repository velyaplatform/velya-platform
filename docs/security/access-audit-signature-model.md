# Modelo de Acesso, Auditoria e Assinatura Digital

> Modelo completo de segurança do Velya Hospital OS: RBAC + ABAC + ReBAC, perfis profissionais
> com registros oficiais (CRM, COREN, CRF), assinatura digital ICP-Brasil, break-glass
> auditado, troca rápida de usuário e logoff automático.

---

## 1. Princípios

- **Zero trust** — toda requisição é autenticada, autorizada e auditada.
- **Least privilege** — privilégios mínimos por função e contexto.
- **Separation of duties** — ninguém é juiz e parte no mesmo fluxo.
- **Accountability** — todo acesso/ação identifica quem, quando, onde e por quê.
- **Auditability** — tudo deixa rastro imutável.
- **Break-glass controlado** — exceções existem, mas com fricção e alarme.

---

## 2. Autenticação

### 2.1. Protocolos

- **OIDC / OAuth 2.1** com IdP corporativo (Keycloak, Azure AD, ADFS).
- **SAML 2.0** suportado para integrações legadas.
- **MFA** obrigatório para todos os papéis clínicos e administrativos.
- **Biometria** (digital, facial) suportada em mobile via plataforma (Android/iOS).

### 2.2. Fatores MFA

- TOTP (authenticator apps).
- WebAuthn/FIDO2 (padrão preferido).
- Push notification com aprovação.
- Smartcard ICP-Brasil para assinatura.

### 2.3. Sessão

- **Access token** curto (15 min).
- **Refresh token** rotativo.
- **Logoff automático** por inatividade (parametrizável por perfil — 5 min em UTI, 30 min
  em consultório).
- **Troca rápida de usuário** — workstation compartilhada permite "sign-in over" sem fechar
  aplicação (via PIN + biometria).

---

## 3. Identidade profissional

Cada profissional tem atributos oficiais:

```ts
interface ProfessionalIdentity {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
  categories: ProfessionalCategory[];   // médico, enfermeiro, farmacêutico, ...
  registrations: {
    council: 'CRM' | 'COREN' | 'CRF' | 'CREFITO' | 'CRN' | 'CRP' | 'CRO';
    uf: string;
    number: string;
    status: 'active' | 'suspended' | 'expired';
    validatedAt: Date;
  }[];
  specialties: string[];
  signaturePolicy: 'icp-brasil' | 'institutional';
}
```

- Validação automática do status junto ao conselho quando API disponível.
- Suspensão ou expiração do registro bloqueia ações clínicas restritas (ex.: prescrição).
- Registro é exigido no escopo do token OIDC para operações que requerem responsabilidade
  legal.

---

## 4. Autorização

O Velya combina três modelos complementares:

### 4.1. RBAC (Role-Based)

Papéis pré-definidos com conjuntos de permissões:

- `physician`, `nurse`, `pharmacist`, `physiotherapist`, `nutritionist`, `social-worker`
- `billing-analyst`, `auditor`, `controller`
- `bed-manager`, `or-manager`
- `it-admin`, `dpo`

Cada papel carrega um conjunto base de permissões expressas em escopos OIDC + regras OPA.

### 4.2. ABAC (Attribute-Based)

Políticas Rego considerando atributos do sujeito, recurso e ambiente:

```rego
package clinical.prescribe

default allow = false

allow {
  input.subject.roles[_] == "physician"
  input.subject.registration.status == "active"
  input.resource.type == "Prescription"
  input.resource.patientId == input.context.assignedPatientId
  time.now_ns() >= input.subject.shift.startNs
  time.now_ns() <= input.subject.shift.endNs
}
```

### 4.3. ReBAC (Relationship-Based)

- Paciente -> equipe assistencial.
- Paciente -> responsável financeiro.
- Paciente -> familiar autorizado.

Relações são fatos armazenados em um grafo (`care-team`, `financial-responsible`,
`next-of-kin`) consultados pelas políticas ABAC.

### 4.4. Pipeline de decisão

```
request -> authn -> build subject -> load resource -> load relations
        -> OPA evaluate -> decision (allow|deny|reason)
        -> audit
```

Cada decisão é logada com os inputs sanitizados.

---

## 5. Break-Glass

Cenário: profissional precisa acessar dados de paciente fora do seu escopo normal
(emergência, cobertura de plantão, consulta urgente).

Processo:

1. UI mostra botão "Acesso Emergencial" claramente diferenciado.
2. Clique exige:
   - Justificativa textual estruturada.
   - Reconfirmar MFA.
   - Assinalar tipo de exceção.
3. Sistema concede acesso com TTL curto (ex.: 4 horas).
4. **Simultaneamente**:
   - Evento `BreakGlassActivated` gravado no event store.
   - Notificação síncrona ao DPO.
   - Notificação ao responsável clínico do paciente.
   - Alerta no Command Center.
5. Após o prazo, revisão obrigatória do uso por comitê:
   - Justificativa adequada? Escopo adequado? Dados acessados compatíveis com a justificativa?
6. Reincidência injustificada aciona processo disciplinar conforme política institucional.

---

## 6. Assinatura digital

### 6.1. ICP-Brasil

- Documentos clínicos relevantes (prescrição, evolução, laudo, alta, atestado) podem ser
  assinados com certificado ICP-Brasil (A1/A3).
- Suporte a certificado em nuvem (cloud HSM) e smartcard/token.
- Padrão de assinatura: **PAdES** para PDFs, **CAdES** para payloads, **XAdES** quando
  aplicável.
- Carimbo do tempo (timestamping) via Autoridade Carimbadora reconhecida.

### 6.2. Assinatura institucional

- Para situações que não exigem ICP-Brasil, o sistema usa assinatura eletrônica avançada
  com chave institucional + hash encadeado.
- Ainda assim, garante autoria, integridade e não-repúdio dentro do ecossistema.

### 6.3. Hash encadeado

Cada documento assinado carrega:

- `previousHash` — hash do documento anterior do mesmo paciente ou contexto.
- `hash` — hash do documento atual.
- Qualquer alteração retroativa quebra a cadeia e é detectada em auditoria.

### 6.4. Política por tipo de documento

| Documento | Assinatura mínima |
|---|---|
| Prescrição | ICP-Brasil ou institucional avançada |
| Prescrição de controlado | ICP-Brasil obrigatório |
| Evolução | Institucional avançada |
| Laudo | ICP-Brasil |
| Alta | ICP-Brasil |
| Atestado | ICP-Brasil |
| Consentimento | ICP-Brasil (paciente) |

---

## 7. Auditoria

### 7.1. O que é auditado

- Login / logout / troca de usuário.
- Cada acesso a recurso sensível (leitura, escrita).
- Break-glass.
- Mudanças de configuração.
- Mudanças de papel ou permissão.
- Assinaturas.
- Decisões de agents (em `shadow` e `active`).

### 7.2. Modelo do registro

```ts
interface AuditRecord {
  id: string;
  occurredAt: Date;
  actor: { id: string; type: 'user' | 'system' | 'agent'; };
  action: string;
  resource: { type: string; id: string; };
  result: 'allow' | 'deny';
  reason?: string;
  ipAddress: string;
  userAgent: string;
  tenantId: string;
  traceId: string;
}
```

### 7.3. Integridade

- Registros de auditoria são **append-only**, imutáveis.
- Armazenados com hash encadeado — tampering é detectável.
- Exportação diária assinada para storage WORM (S3 Object Lock, Glacier Vault Lock).
- Retenção mínima conforme LGPD/CFM (20 anos para prontuário).

---

## 8. Troca rápida de usuário

- Workstations compartilhadas (enfermagem, farmácia) permitem:
  - `Ctrl+Alt+U` ou botão visível.
  - Prompt rápido: PIN + biometria.
  - Sessão anterior suspensa, não encerrada (se política permite).
- Logoff automático ao detectar inatividade ou afastamento.
- Auditoria registra cada troca como transição de sessão.

---

## 9. Logoff automático

- Inatividade do teclado/mouse é o gatilho principal.
- Tempo parametrizável por perfil e tipo de workstation.
- Em beira-leito, logoff inclui wipe visual de dados sensíveis da tela.
- Sessão de profissional que sai do prédio (geolocalização corporativa) pode ser
  encerrada automaticamente por política.

---

## 10. LGPD — direitos do titular

- Acesso aos próprios dados via portal do paciente.
- Retificação via processo auditado.
- Apagamento: implementado como anonimização com preservação de registros regulatórios
  (prontuário tem retenção legal que prevalece).
- Portabilidade: exportação em FHIR Bundle assinado.
- Oposição e revogação de consentimento.
- DPO designado no módulo `access-governance`.

---

## 11. Segurança da infraestrutura

- TLS 1.3 obrigatório.
- mTLS entre serviços via Istio.
- Secrets em Vault + External Secrets.
- Segredos nunca em variáveis de ambiente claras em produção.
- Imagens assinadas (cosign) e verificadas em admission (Kyverno).
- CIS benchmark aplicado ao cluster.
- Scans de vulnerabilidade contínuos (Trivy, Grype).

---

## 12. Incidentes de segurança

- Playbook de resposta a incidentes.
- Detecção via SIEM (logs enviados via OTel -> Loki + integração).
- Comunicação ao DPO e ao titular conforme LGPD.
- Pós-mortem público para incidentes significativos.

---

## 13. Referências

- LGPD — Lei 13.709/2018.
- RDC 585/2021 ANVISA.
- CFM Resolução 1.821/2007 (prontuário eletrônico).
- ICP-Brasil — MP 2.200-2/2001.
- NIST SP 800-53, ISO 27001, ISO 27799.
- `docs/architecture/velya-hospital-platform-overview.md`
- `docs/patient-journey/patient-journey-architecture.md`
