# Velya — Reformulacao do Core Model Hospitalar

**Versao:** 1.0
**Data:** 2026-04-12
**Baseado em:** pesquisa ANVISA RDC 50/2002, RDC 7/2010, RDC 36/2013, CFM 2.380/2024, CFM 2.271/2020, CFM 2.147/2016, COFEN 543/2017, FHIR R4 + Epic/Cerner/Tasy/MV patterns

---

## 1. Diagnostico do modelo atual

Velya tem **2 schemas de paciente divergentes**, **referencias string-based** ao inves de ID-based, **dados embutidos denormalizados** (bed.patient), e **fuzzy matching** para relacionamentos. Specialty→staff usa match de texto fragil. Patient→ward usa nome da ala. Nao ha integridade referencial.

**Impacto:** renomear "Ala 2A" orfana 40+ registros. Impossivel garantir que enfermeiro nao seja atribuido a especialidade que exige medico. Bed.patient fica stale apos transferencia.

## 2. Modelo-alvo (FHIR-inspired, adaptado ao Brasil)

### 2.1 Separacao Location (fisico) vs Organization (conceitual)

O hospital e **simultaneamente**:
- Fisicamente: predio → bloco → andar → ala → quarto → leito (hierarquia `Location`)
- Administrativamente: hospital → departamento → servico de especialidade (hierarquia `Organization`)
- Funcionalmente: servico de cardiologia operando na ala 3B com leitos X-Y (entidade `HealthcareService`)

Todas tres existem e se conectam por referencia. Velya atual junta tudo em `HospitalWard`.

### 2.2 Relacao runtime paciente ↔ local ↔ equipe ↔ especialidade

```
Encounter (internacao)
  ├─ subject: Patient
  ├─ serviceType: HealthcareService (especialidade primaria responsavel)
  ├─ serviceProvider: Organization (departamento owner)
  ├─ location[]: Location[] (historico de leitos desta internacao)
  ├─ participant[]: 
  │    - {type: ATND, individual: PractitionerRole} (medico assistente)
  │    - {type: CON, individual: PractitionerRole} (consultor cardio)
  │    - {type: CON, individual: PractitionerRole} (consultor pneumo)
  ├─ careTeam: CareTeam (roster estavel: enfermeiro, farmaceutico, AS)
  └─ statusHistory, classHistory
```

## 3. Entidades nucleares

### 3.1 Hospital
```typescript
interface Hospital {
  id: string;
  nome: string;
  cnes: string;
  cnpj: string;
  porte: 'pequeno' | 'medio' | 'grande' | 'extra';
  tipo: 'geral' | 'especializado';
  natureza: 'publico' | 'privado' | 'filantropico' | 'misto';
  nivelComplexidade: 'primario' | 'secundario' | 'terciario' | 'quaternario';
  certificacoes: ('ONA_1' | 'ONA_2' | 'ONA_3' | 'JCI' | 'Qmentum' | 'HIMSS_6' | 'HIMSS_7')[];
  enderecoId: string;
}
```

### 3.2 Location (hierarquia fisica)
```typescript
type PhysicalType = 'building' | 'wing' | 'level' | 'ward' | 'room' | 'bed' | 'corridor';

interface Location {
  id: string;
  nome: string;
  physicalType: PhysicalType;
  parentId?: string; // hierarquia
  hospitalId: string;
  managingOrganizationId?: string; // ala pode ser "gerenciada por" um departamento
  status: 'active' | 'suspended' | 'inactive';
  operationalStatus?: // so em level=bed
    | 'O' // occupied
    | 'U' // unoccupied  
    | 'K' // contaminated (precisa limpeza)
    | 'I' // isolated
    | 'H' // housekeeping (em limpeza)
    | 'C'; // closed (bloqueado)
  capacidade?: number; // para ward
  coordenadas?: { andar: number; setor: string; sala?: string };
  isolamento?: 'contato' | 'goticulas' | 'aerossois' | 'protetor';
  sexoDesignado?: 'M' | 'F' | 'misto'; // para leito
  tipoLeitoSus?: 'clinico' | 'cirurgico' | 'obstetrico' | 'pediatrico' | 'uti_adulto_i' | 'uti_adulto_ii' | 'uti_adulto_iii' | 'uti_neo_i' | 'uti_neo_ii' | 'uti_neo_iii' | 'uti_ped' | 'uci' | 'queimados' | 'psiquiatria' | 'hospital_dia';
}
```

### 3.3 Organization (hierarquia administrativa)
```typescript
type OrgType = 'hospital' | 'department' | 'unit' | 'specialty_service' | 'team';

interface Organization {
  id: string;
  nome: string;
  tipo: OrgType;
  parentId?: string;
  hospitalId: string;
  responsavelId?: string; // ProfissionalSaude id
  regulamentacao?: string[]; // RDC 7/2010, CFM 2.271/2020, etc.
}
```

### 3.4 UnidadeAssistencial (ala/unidade com regulamentacao RDC 50)

Une Location (fisico) + Organization (admin) + HealthcareService (conceitual):

```typescript
type UnidadeTipo =
  | 'pronto_socorro' | 'ambulatorio'
  | 'internacao_clinica' | 'internacao_cirurgica' | 'internacao_obstetrica' | 'internacao_pediatrica'
  | 'uti_adulto' | 'uti_pediatrica' | 'uti_neonatal' | 'uti_coronariana' | 'uti_queimados'
  | 'uci_adulto' | 'uci_pediatrica' | 'ucinco' | 'ucinca'
  | 'unidade_avc' | 'centro_cirurgico' | 'centro_obstetrico' | 'hospital_dia'
  | 'hemodinamica' | 'endoscopia' | 'oncologia' | 'psiquiatria' | 'reabilitacao'
  | 'sadt' | 'cme' | 'banco_sangue' | 'farmacia_hospitalar' | 'nutricao'
  | 'apoio_administrativo' | 'apoio_logistico' | 'apoio_diagnostico';

type NivelCuidado = 'minimo' | 'intermediario' | 'alta_dependencia' | 'semi_intensivo' | 'intensivo';

interface UnidadeAssistencial {
  id: string;
  nome: string; // "UTI Adulto - Ala 1"
  codigo: string; // "UTI-A1" (display curto)
  tipo: UnidadeTipo;
  subtipo?: string; // ex: "coronariana", "neonatal_tipo_iii"
  nivelCuidado: NivelCuidado;
  
  // Links a FHIR-style entidades
  locationId: string; // aponta ao Location fisico (physicalType=ward)
  organizationId: string; // aponta a Organization (tipo=unit)
  
  // Estrutura
  capacidadeTotal: number;
  leitoIds: string[]; // Location ids com physicalType=bed
  
  // Operacao
  horarioFuncionamento: '24h' | string; // ex "07:00-19:00"
  criticidade: 'baixa' | 'media' | 'alta' | 'critica';
  
  // Regulamentacao
  regulamentacoes: string[]; // ["ANVISA RDC 7/2010", "CFM 2.271/2020"]
  
  // Governanca
  coordenadorId?: string; // ProfissionalSaude id (antes era text)
  responsavelTecnicoId?: string; // medico RT
  
  // Especialidades que operam aqui (servicos)
  healthcareServiceIds: string[];
  
  // Auditoria
  criadoEm: string;
  atualizadoEm: string;
}
```

### 3.5 Especialidade (CFM 55 + multiprofissionais)

```typescript
type ConselhoProfissional = 'CRM' | 'COREN' | 'CRF' | 'CREFITO' | 'CRN' | 'CRP' | 'CFFa' | 'CRO' | 'CRESS' | 'CRB';

type CategoriaEspecialidade = 'clinica' | 'cirurgica' | 'pediatrica' | 'diagnostica' | 'apoio' | 'critica' | 'mental' | 'reabilitacao' | 'multidisciplinar';

interface Especialidade {
  id: string; // 'cardiologia', 'fisioterapia_respiratoria'
  nome: string;
  conselho: ConselhoProfissional;
  cfmCodigo?: string; // para CFM only
  categoria: CategoriaEspecialidade;
  residenciaAnos?: number; // null se nao for residencia medica
  descricao: string;
  areasAtuacao: string[];
  
  // NOTA: NAO contem typicalWards — a relacao e modelada via HealthcareService
}
```

### 3.6 HealthcareService (especialidade operando em unidade)

Chave-mestra que resolve "quais especialidades operam em qual ala":

```typescript
type ModeloCobertura = 
  | 'plantao_24_7_presencial' // obrigatorio UTI/UCO/PS/CO
  | 'diarista_horizontal' // cobertura diurna
  | 'sobreaviso' // on-call
  | 'ambulatorial' // consulta programada
  | 'hospitalista'; // modelo medicina hospitalar

interface HealthcareService {
  id: string;
  nome: string; // "Cardiologia em UTI Adulto - Ala 1"
  
  // Links
  especialidadeId: string;
  unidadeIds: string[]; // onde o servico opera (pode ser multi-unidade)
  providedByOrganizationId: string; // departamento owner
  
  // Cobertura
  modeloCobertura: ModeloCobertura;
  dimensionamento?: {
    profissionaisPorLeitos: string; // "1/10", "2/15"
    regulamentacao: string; // "RDC 7/2010"
  };
  
  // Escala
  horarioInicio?: string; // para nao-24/7
  horarioFim?: string;
  
  ativo: boolean;
}
```

### 3.7 ProfissionalSaude + PractitionerRole

```typescript
type CategoriaProfissional = 
  | 'medico' | 'enfermeiro' | 'tecnico_enfermagem' | 'auxiliar_enfermagem'
  | 'fisioterapeuta' | 'nutricionista' | 'fonoaudiologo' | 'psicologo'
  | 'terapeuta_ocupacional' | 'assistente_social' | 'farmaceutico'
  | 'dentista' | 'biomedico' | 'tecnico_radiologia'
  | 'maqueiro' | 'higienizacao' | 'manutencao' | 'recepcao'
  | 'coordenador_assistencial' | 'diretor_clinico' | 'diretor_tecnico';

interface ProfissionalSaude {
  id: string;
  nome: string;
  cpf: string;
  dataNascimento: string;
  categoria: CategoriaProfissional;
  
  // Registros profissionais (multi para quem tem varios)
  registros: {
    conselho: ConselhoProfissional;
    numero: string;
    uf: string;
    rqeEspecialidadeIds?: string[]; // Registro de Qualificacao de Especialista
    validadeEm?: string;
  }[];
  
  email: string;
  telefone?: string;
  ramal?: string;
  
  ativo: boolean;
  dataAdmissao: string;
  dataDesligamento?: string;
}

// Um profissional pode ter MULTIPLOS papeis (hospitalista na Ala 3B + consultor em ambulatorio)
interface PractitionerRole {
  id: string;
  profissionalId: string;
  organizationId: string; // departamento
  healthcareServiceIds: string[]; // servicos que presta
  locationIds: string[]; // locais onde atua (unidades)
  especialidadeIds: string[]; // especialidades deste papel
  
  codigo: // tipo de papel
    | 'assistente' // staff medico responsavel
    | 'plantonista' // cobertura vertical
    | 'diarista' // cobertura horizontal
    | 'coordenador_unidade' 
    | 'chefe_servico'
    | 'preceptor'
    | 'residente'
    | 'interno'
    | 'responsavel_tecnico'
    | 'enfermeiro_assistencial'
    | 'enfermeiro_coordenador'
    | 'tecnico'
    | 'auxiliar';
  
  cargaHoraria: number; // horas semanais
  inicioVigencia: string;
  fimVigencia?: string;
  ativo: boolean;
}
```

### 3.8 Escala (Schedule/Slot) — quem esta de plantao agora

```typescript
type TurnoTipo = 'matutino' | 'vespertino' | 'noturno' | 'plantao_12' | 'plantao_24' | 'sobreaviso';

interface Turno {
  id: string;
  practitionerRoleId: string;
  unidadeId: string; // onde trabalha este turno
  tipo: TurnoTipo;
  inicioEm: string; // ISO datetime
  fimEm: string;
  status: 'agendado' | 'em_andamento' | 'concluido' | 'ausencia' | 'substituido';
  substitutoRoleId?: string; // quem substituiu
  observacoes?: string;
}

// Presenca real (badge-in/badge-out)
interface PresencaFisica {
  id: string;
  profissionalId: string;
  turnoId: string;
  badgeInEm?: string;
  badgeOutEm?: string;
  unidadeAtualId?: string; // onde esta agora
  status: 'presente' | 'em_pausa' | 'off_turno' | 'ausente';
}
```

### 3.9 Paciente + Internacao + Transferencia

UNICO schema de paciente (merge de patients.ts + patients-list.ts):

```typescript
type Sexo = 'M' | 'F' | 'indeterminado';
type NivelRisco = 'baixo' | 'medio' | 'alto' | 'critico';

interface Paciente {
  id: string; // UUID
  mrn: string; // Medical Record Number, visivel "MRN-001"
  nome: string;
  nomeSocial?: string;
  cpf?: string;
  cns?: string; // Cartao SUS
  dataNascimento: string;
  sexo: Sexo;
  generoIdentidade?: string;
  tipoSanguineo?: string;
  fotoUrl?: string;
  
  contato: {
    telefone?: string;
    email?: string;
    enderecoId?: string;
  };
  
  convenio?: {
    nome: string;
    numero: string;
    plano: string;
    validadeEm?: string;
  };
  
  alergias: { substancia: string; reacao: string; severidade: 'leve' | 'moderada' | 'grave' | 'anafilatica' }[];
  alertas: { codigo: string; descricao: string; desde: string }[];
  
  // NAO contem ward/bed/diagnosis — isso vem do Encounter ativo
}

type ViaAdmissao = 'emergencia' | 'eletiva' | 'transferencia_externa' | 'direto_uti' | 'maternidade';
type StatusInternacao = 'em_admissao' | 'internado' | 'alta_solicitada' | 'em_transferencia' | 'alta_completada' | 'obito' | 'evasao';
type TipoAlta = 'melhorada' | 'curada' | 'a_pedido' | 'administrativa' | 'transferencia_externa' | 'obito_com_necropsia' | 'obito_sem_necropsia' | 'evasao' | 'desistencia';

interface Internacao {
  id: string;
  pacienteId: string;
  numeroAtendimento: string; // visivel "ATN-2026-00123"
  
  admissao: {
    em: string; // ISO datetime
    via: ViaAdmissao;
    origem?: string;
    classificacaoRisco?: { manchester: 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul'; avaliadorId: string; em: string };
  };
  
  status: StatusInternacao;
  
  // Local atual — computed view
  locationAtualId: string; // leito atual
  unidadeAtualId: string; // unidade atual (derivada do leito)
  
  // Especialidade
  servicoPrimarioId: string; // HealthcareService (e.g. "cardiologia em UTI")
  especialidadePrimariaId: string; // derivada do servico
  
  // Equipe
  medicoAssistenteRoleId: string; // PractitionerRole do ATND
  consultores: { // interconsultas ativas
    roleId: string;
    tipo: 'parecer' | 'acompanhamento';
    solicitadoEm: string;
    respostaEm?: string;
  }[];
  careTeamId: string;
  
  // Clinico
  cidPrincipal?: string;
  cidsSecundarios: string[];
  hipoteseDiagnostica?: string;
  scpAtual?: 'minimos' | 'intermediarios' | 'alta_dependencia' | 'semi_intensivo' | 'intensivo'; // COFEN 543
  newsScore?: number;
  
  // Historico de transferencias desta internacao
  transferencias: string[]; // TransferenciaInterna ids
  
  // Alta
  alta?: {
    em: string;
    tipo: TipoAlta;
    sumario: string;
    medicoAltaRoleId: string;
    cidAlta: string;
    destino?: string; // domicilio, hospital X, etc
  };
  
  criadoEm: string;
  atualizadoEm: string;
}

type TipoTransferencia = 'step_up' | 'step_down' | 'lateral' | 'reserva_cirurgia' | 'retorno_unidade';

interface TransferenciaInterna {
  id: string;
  internacaoId: string;
  origemLocationId: string;
  destinoLocationId: string;
  tipo: TipoTransferencia;
  motivo: string;
  solicitadoPorRoleId: string;
  solicitadoEm: string;
  executadoEm?: string;
  receptorRoleId?: string; // quem recebeu
  transporteChecklistCompleto: boolean;
  observacoes?: string;
}
```

### 3.10 CareTeam (roster estavel por episodio)

```typescript
interface CareTeam {
  id: string;
  internacaoId?: string;
  pacienteId: string;
  status: 'ativo' | 'suspenso' | 'encerrado';
  participantes: {
    profissionalId: string;
    roleId: string;
    papel: 'medico_assistente' | 'enfermeiro_referencia' | 'farmaceutico_clinico' | 'nutricionista' | 'fisioterapeuta' | 'assistente_social' | 'psicologo' | 'medico_consultor' | 'familiar' | 'cuidador';
    especialidadeId?: string;
    desde: string;
    ate?: string;
  }[];
}
```

## 4. Regras de integridade

1. Toda referencia entre entidades usa **ID**, nunca nome.
2. `Location.parentId` forma arvore unica (bed → room → ward → floor → building → hospital).
3. `UnidadeAssistencial.locationId` deve apontar a Location com physicalType=ward.
4. `UnidadeAssistencial.leitoIds` deve ser subset de Locations physicalType=bed com parentId chain ate locationId da unidade.
5. `HealthcareService.unidadeIds` define onde a especialidade opera — e a UNICA fonte de verdade para "cardiologia opera na UTI e UCO".
6. `Internacao.medicoAssistenteRoleId` deve ser um PractitionerRole com codigo=`assistente` e com ao menos uma especialidade compativel com `servicoPrimarioId.especialidadeId`.
7. `Internacao.locationAtualId` deve ser um Location physicalType=bed com operationalStatus=O.
8. Multi-especialidade: `Internacao.servicoPrimarioId` = owner; `consultores[]` = interconsultas.
9. Dimensionamento: quando Internacao cria/muda, verificar se `UnidadeAssistencial` ainda cumpre ratios COFEN/RDC.
10. Enfermagem SCP: atualizacao diaria obrigatoria por internacao (COFEN 543/2017).

## 5. Vistas canonicas (UI)

### 5.1 Ward Landing (Ala → tudo)

Painel da ala ao clicar em /wards/[id] ou /unidades/[id]:

```
┌────────────────────────────────────────────────────────────────┐
│  UTI Adulto - Ala 1                              [Editar]      │
│  Bloco A · 4º andar · Ala Norte                                │
├────────────────────────────────────────────────────────────────┤
│  OCUPACAO          EQUIPE AGORA         SLA ENFERMAGEM          │
│  10 / 12 (83%)     3 enf · 6 tec        OK (10h/pac/24h)        │
│  H: 1 em limpeza   2 medicos                                    │
│  C: 1 bloqueado    1 fisio              ALERTAS ATIVOS          │
│                                          2 criticos · 3 altos   │
├────────────────────────────────────────────────────────────────┤
│  ESPECIALIDADES QUE OPERAM                                      │
│  [Medicina Intensiva 24/7] [Cardiologia plantao] [Pneumo diar]  │
├────────────────────────────────────────────────────────────────┤
│  MAPA DE LEITOS (grid)                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                            │
│  │ 01 O │ │ 02 O │ │ 03 H │ │ 04 U │                            │
│  │ MRN1 │ │ MRN2 │ │      │ │      │                            │
│  └──────┘ └──────┘ └──────┘ └──────┘                            │
├────────────────────────────────────────────────────────────────┤
│  PACIENTES (tabela alternativa)                                 │
│  Leito │ Paciente  │ Espec. │ Assist.  │ SCP  │ Dias │ Alertas  │
│  01    │ Ana M.    │ Cardio │ Dr.Silva │ Int. │ 4    │ NEWS2 6  │
├────────────────────────────────────────────────────────────────┤
│  EQUIPE DO PLANTAO                                              │
│  Medicos: Dr.Silva (ATND cardio), Dr.Costa (plantao)            │
│  Enfermeiros: Ana (coord), Beatriz, Carla                       │
│  Tecnicos: x6                                                   │
│  Fisio: Pedro                                                   │
├────────────────────────────────────────────────────────────────┤
│  TRANSFERENCIAS PENDENTES                                       │
│  Entrada: MRN-045 vindo do PS (aguarda leito)                   │
│  Saida:   MRN-012 step-down para UCI (liberou as 14h)           │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Especialidade Landing (Especialidade → tudo)

Painel /specialties/[id]:

```
┌────────────────────────────────────────────────────────────────┐
│  CARDIOLOGIA                                 CFM: CAR          │
│  Conselho: CRM | Residencia: 3 anos                            │
├────────────────────────────────────────────────────────────────┤
│  UNIDADES ONDE OPERAMOS                                         │
│  [UTI Adulto - Ala 1] [UCO] [PS] [Ala 2A - Cardio]              │
│  plantao 24/7        plantao  plantao  diarista                  │
├────────────────────────────────────────────────────────────────┤
│  PROFISSIONAIS DESTA ESPECIALIDADE                              │
│  12 medicos, 8 com RQE ativo                                    │
│  Em plantao agora: Dr.Silva (UTI), Dra.Rocha (UCO)              │
├────────────────────────────────────────────────────────────────┤
│  PACIENTES SOB CUIDADO                                          │
│  18 internados, 5 em UTI, 13 em enfermaria                      │
│  Tabela: MRN, Nome, Leito, Unidade, Assist., Dias, Alertas      │
├────────────────────────────────────────────────────────────────┤
│  INTERCONSULTAS PENDENTES                                       │
│  3 solicitadas, 2 urgentes, 1 rotina                            │
└────────────────────────────────────────────────────────────────┘
```

### 5.3 Profissional Landing (Medico/Enfermeiro → tudo)

/employees/[id] ou /me:

```
┌────────────────────────────────────────────────────────────────┐
│  Dr. Marcos Silva                        CRM-SP 145332         │
│  Cardiologia (RQE) · Medicina Intensiva (RQE)                   │
├────────────────────────────────────────────────────────────────┤
│  PAPEIS ATIVOS                                                  │
│  • Assistente - Cardiologia - UTI Adulto (40h/sem)              │
│  • Plantonista - Cardiologia - UCO (24h)                        │
├────────────────────────────────────────────────────────────────┤
│  TURNO AGORA                                                    │
│  Plantao 12h - UTI Adulto - 07:00 as 19:00 (on-duty 07:02)      │
├────────────────────────────────────────────────────────────────┤
│  PACIENTES EM MEUS CUIDADOS                                     │
│  - Como assistente: 8 pacientes                                 │
│  - Como consultor: 3 interconsultas ativas                      │
└────────────────────────────────────────────────────────────────┘
```

## 6. Migracao dos fixtures

1. Criar `hospital-core-types.ts` (tipos novos)
2. Criar `hospital-core.ts` fixture unico que contem: hospital, locations, organizations, unidades, especialidades, services, profissionais, roles, turnos, pacientes, internacoes, careTeams
3. Derivar fixtures legados a partir do core (manter retro-compat por X semanas)
4. Migrar pages uma por uma para o core (wards, specialties, staff-on-duty, patients, beds, icu)

## 7. Plano de execucao

**Fase 1:** Types + fixture core (1 arquivo cada, completo)
**Fase 2:** Ward Landing (novo /wards/[id])
**Fase 3:** Specialty Landing (atualizar /specialties/[id])
**Fase 4:** Bed Map component (reutilizavel)
**Fase 5:** Migracao dos outros fixtures (patients, beds, staff) para serem *views* do core

## 8. Criterios de aceite

- Zero fuzzy text matching
- Todo ID reference resolve em O(1) via indices
- Single source of truth por entidade
- Ward Landing responde em <100ms em 300 pacientes
- Typecheck limpo
- Testes: relacionamentos transitivos (unidade → especialidades → profissionais → pacientes)
