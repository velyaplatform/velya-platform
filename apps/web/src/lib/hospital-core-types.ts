/**
 * Hospital core types.
 *
 * Aligns with docs/product/hospital-core-model-reformulation.md v1.0.
 * FHIR-R4-inspired domain model adapted to Brazilian regulation
 * (ANVISA RDC 50/2002, RDC 7/2010, RDC 36/2013, CFM 2.380/2024,
 * CFM 2.271/2020, CFM 2.147/2016, COFEN 543/2017).
 *
 * Design rules:
 *   - Zero runtime code. This module is pure types / interfaces / string-literal enums.
 *   - All IDs are `string`. All dates / datetimes are ISO 8601 strings.
 *   - All cross-entity references are by ID, never by name. String text matching is banned.
 *   - TypeScript strict-mode compatible.
 *
 * Integrity rules (enforced by fixture + consumers, not by the type system alone):
 *   - Location.parentId forms a single tree (bed -> room -> ward -> floor -> building -> hospital).
 *   - UnidadeAssistencial.locationId must point at a Location with physicalType === 'ward'.
 *   - UnidadeAssistencial.leitoIds must be Locations with physicalType === 'bed' whose
 *     parent chain resolves to that unit's locationId.
 *   - HealthcareService.unidadeIds is the single source of truth for
 *     "which specialties operate on which floor".
 *   - Internacao.medicoAssistenteRoleId must be a PractitionerRole with codigo === 'assistente'
 *     whose especialidadeIds intersect the especialidade of servicoPrimarioId.
 *   - Internacao.locationAtualId must be a Location with physicalType === 'bed'
 *     and operationalStatus === 'O' while the encounter is active.
 *
 * Cross-entity reference map:
 *
 *   Hospital.id
 *     -> Location.hospitalId
 *     -> Organization.hospitalId
 *
 *   Location.id
 *     -> Location.parentId            (physical tree)
 *     -> UnidadeAssistencial.locationId
 *     -> UnidadeAssistencial.leitoIds[]
 *     -> Internacao.locationAtualId
 *     -> TransferenciaInterna.origemLocationId / destinoLocationId
 *
 *   Organization.id
 *     -> Organization.parentId        (admin tree)
 *     -> Location.managingOrganizationId
 *     -> UnidadeAssistencial.organizationId
 *     -> HealthcareService.providedByOrganizationId
 *     -> PractitionerRole.organizationId
 *
 *   UnidadeAssistencial.id
 *     -> HealthcareService.unidadeIds[]
 *     -> PractitionerRole.locationIds[]
 *     -> Turno.unidadeId
 *     -> PresencaFisica.unidadeAtualId
 *     -> Internacao.unidadeAtualId
 *
 *   Especialidade.id
 *     -> HealthcareService.especialidadeId
 *     -> PractitionerRole.especialidadeIds[]
 *     -> RegistroProfissional.rqeEspecialidadeIds[]
 *     -> Internacao.especialidadePrimariaId
 *     -> CareTeamParticipante.especialidadeId
 *
 *   HealthcareService.id
 *     -> UnidadeAssistencial.healthcareServiceIds[]
 *     -> PractitionerRole.healthcareServiceIds[]
 *     -> Internacao.servicoPrimarioId
 *
 *   ProfissionalSaude.id
 *     -> PractitionerRole.profissionalId
 *     -> PresencaFisica.profissionalId
 *     -> CareTeamParticipante.profissionalId
 *     -> Organization.responsavelId
 *     -> UnidadeAssistencial.coordenadorId / responsavelTecnicoId
 *     -> ClassificacaoRisco.avaliadorId
 *
 *   PractitionerRole.id
 *     -> Turno.practitionerRoleId / substitutoRoleId
 *     -> Internacao.medicoAssistenteRoleId
 *     -> InterconsultaConsultor.roleId
 *     -> TransferenciaInterna.solicitadoPorRoleId / receptorRoleId
 *     -> CareTeamParticipante.roleId
 *     -> InternacaoAlta.medicoAltaRoleId
 *
 *   Paciente.id
 *     -> Internacao.pacienteId
 *     -> CareTeam.pacienteId
 *
 *   Internacao.id
 *     -> TransferenciaInterna.internacaoId
 *     -> CareTeam.internacaoId
 */

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/**
 * Attach an `id` field to any shape T. Useful when composing payloads that
 * must carry an identifier without redefining the base interface.
 *
 * Example: `type NewHospital = WithId<Omit<Hospital, 'id'>>;`
 */
export type WithId<T> = T & { id: string };

// ---------------------------------------------------------------------------
// Hospital
// ---------------------------------------------------------------------------

export type HospitalPorte = 'pequeno' | 'medio' | 'grande' | 'extra';
export type HospitalTipo = 'geral' | 'especializado';
export type HospitalNatureza = 'publico' | 'privado' | 'filantropico' | 'misto';
export type HospitalNivelComplexidade = 'primario' | 'secundario' | 'terciario' | 'quaternario';
export type HospitalCertificacao =
  | 'ONA_1'
  | 'ONA_2'
  | 'ONA_3'
  | 'JCI'
  | 'Qmentum'
  | 'HIMSS_6'
  | 'HIMSS_7';

/**
 * Root entity. Every Location, Organization and UnidadeAssistencial belongs
 * to exactly one Hospital via its hospitalId.
 *
 * Relationships:
 *   - Hospital.id referenced by Location.hospitalId and Organization.hospitalId.
 *   - enderecoId points at the external address catalog.
 */
export interface Hospital {
  id: string;
  nome: string;
  /** CNES (Cadastro Nacional de Estabelecimentos de Saude). */
  cnes: string;
  /** CNPJ of the legal entity. */
  cnpj: string;
  porte: HospitalPorte;
  tipo: HospitalTipo;
  natureza: HospitalNatureza;
  nivelComplexidade: HospitalNivelComplexidade;
  certificacoes: HospitalCertificacao[];
  enderecoId: string;
}

// ---------------------------------------------------------------------------
// Location (physical hierarchy)
// ---------------------------------------------------------------------------

/** Physical location granularity, from building down to a single bed. */
export type PhysicalType = 'building' | 'wing' | 'level' | 'ward' | 'room' | 'bed' | 'corridor';

/**
 * Operational status for a bed-level Location (FHIR v2 OperationalStatus).
 *  - O: occupied
 *  - U: unoccupied
 *  - K: contaminated (needs cleaning)
 *  - I: isolated
 *  - H: housekeeping (being cleaned)
 *  - C: closed (blocked)
 */
export type BedOperationalStatus =
  | 'O' // occupied
  | 'U' // unoccupied
  | 'K' // contaminated (needs cleaning)
  | 'I' // isolated
  | 'H' // housekeeping
  | 'C'; // closed (blocked)

export type IsolamentoTipo = 'contato' | 'goticulas' | 'aerossois' | 'protetor';
export type SexoDesignado = 'M' | 'F' | 'misto';
export type TipoLeitoSus =
  | 'clinico'
  | 'cirurgico'
  | 'obstetrico'
  | 'pediatrico'
  | 'uti_adulto_i'
  | 'uti_adulto_ii'
  | 'uti_adulto_iii'
  | 'uti_neo_i'
  | 'uti_neo_ii'
  | 'uti_neo_iii'
  | 'uti_ped'
  | 'uci'
  | 'queimados'
  | 'psiquiatria'
  | 'hospital_dia';

/**
 * Physical location node. Locations form a single tree rooted at the hospital:
 * bed -> room -> ward -> level -> wing -> building -> hospital.
 *
 * Location.id is referenced by:
 *   - Location.parentId (self-referential physical tree)
 *   - UnidadeAssistencial.locationId (the ward-level node)
 *   - UnidadeAssistencial.leitoIds[] (child beds)
 *   - Internacao.locationAtualId (current bed of an encounter)
 *   - TransferenciaInterna.origemLocationId / destinoLocationId
 */
export interface Location {
  id: string;
  nome: string;
  physicalType: PhysicalType;
  /** Parent node in the physical tree; absent only at the top of the tree. */
  parentId?: string;
  hospitalId: string;
  /** A ward may be "managed by" a department (Organization.id). */
  managingOrganizationId?: string;
  status: 'active' | 'suspended' | 'inactive';
  /** Only meaningful when physicalType === 'bed'. */
  operationalStatus?: BedOperationalStatus;
  /** Total bed capacity (typically set at ward level). */
  capacidade?: number;
  coordenadas?: { andar: number; setor: string; sala?: string };
  isolamento?: IsolamentoTipo;
  /** Only meaningful when physicalType === 'bed'. */
  sexoDesignado?: SexoDesignado;
  /** Only meaningful when physicalType === 'bed'. */
  tipoLeitoSus?: TipoLeitoSus;
}

// ---------------------------------------------------------------------------
// Organization (administrative hierarchy)
// ---------------------------------------------------------------------------

export type OrgType = 'hospital' | 'department' | 'unit' | 'specialty_service' | 'team';

/**
 * Administrative unit. Organizations form a tree independent from the
 * physical Location tree.
 *
 * Organization.id is referenced by:
 *   - Organization.parentId (self-referential admin tree)
 *   - Location.managingOrganizationId
 *   - UnidadeAssistencial.organizationId
 *   - HealthcareService.providedByOrganizationId
 *   - PractitionerRole.organizationId
 */
export interface Organization {
  id: string;
  nome: string;
  tipo: OrgType;
  parentId?: string;
  hospitalId: string;
  /** ProfissionalSaude.id of the person heading this org. */
  responsavelId?: string;
  /** Applicable regulations (e.g. "RDC 7/2010", "CFM 2.271/2020"). */
  regulamentacao?: string[];
}

// ---------------------------------------------------------------------------
// UnidadeAssistencial (ward/unit with RDC 50 regulation)
// ---------------------------------------------------------------------------

export type UnidadeTipo =
  | 'pronto_socorro'
  | 'ambulatorio'
  | 'internacao_clinica'
  | 'internacao_cirurgica'
  | 'internacao_obstetrica'
  | 'internacao_pediatrica'
  | 'uti_adulto'
  | 'uti_pediatrica'
  | 'uti_neonatal'
  | 'uti_coronariana'
  | 'uti_queimados'
  | 'uci_adulto'
  | 'uci_pediatrica'
  | 'ucinco'
  | 'ucinca'
  | 'unidade_avc'
  | 'centro_cirurgico'
  | 'centro_obstetrico'
  | 'hospital_dia'
  | 'hemodinamica'
  | 'endoscopia'
  | 'oncologia'
  | 'psiquiatria'
  | 'reabilitacao'
  | 'sadt'
  | 'cme'
  | 'banco_sangue'
  | 'farmacia_hospitalar'
  | 'nutricao'
  | 'apoio_administrativo'
  | 'apoio_logistico'
  | 'apoio_diagnostico';

export type NivelCuidado =
  | 'minimo'
  | 'intermediario'
  | 'alta_dependencia'
  | 'semi_intensivo'
  | 'intensivo';

export type UnidadeCriticidade = 'baixa' | 'media' | 'alta' | 'critica';

/**
 * A care unit (ala/unidade). Bridges the physical ward Location, the
 * administrative Organization, and the HealthcareService catalog.
 *
 * Integrity rules (spec section 4):
 *   - locationId MUST point to a Location with physicalType === 'ward'.
 *   - leitoIds MUST be a subset of Locations with physicalType === 'bed'
 *     whose parent chain resolves to locationId.
 *
 * UnidadeAssistencial.id is referenced by:
 *   - HealthcareService.unidadeIds[]
 *   - PractitionerRole.locationIds[]
 *   - Turno.unidadeId
 *   - PresencaFisica.unidadeAtualId
 *   - Internacao.unidadeAtualId
 */
export interface UnidadeAssistencial {
  id: string;
  /** Human-readable name: "UTI Adulto - Ala 1". */
  nome: string;
  /** Short display code: "UTI-A1". */
  codigo: string;
  tipo: UnidadeTipo;
  /** Free-form refinement (e.g. "coronariana", "neonatal_tipo_iii"). */
  subtipo?: string;
  nivelCuidado: NivelCuidado;

  /** Location.id with physicalType === 'ward'. */
  locationId: string;
  /** Organization.id with tipo === 'unit'. */
  organizationId: string;

  capacidadeTotal: number;
  /** Location ids with physicalType === 'bed'. */
  leitoIds: string[];

  /** "24h" or an opening-hours string like "07:00-19:00". */
  horarioFuncionamento: '24h' | string;
  criticidade: UnidadeCriticidade;

  regulamentacoes: string[];

  /** ProfissionalSaude.id of the unit coordinator. */
  coordenadorId?: string;
  /** ProfissionalSaude.id of the medical responsible-technical (RT). */
  responsavelTecnicoId?: string;

  /** HealthcareService ids operating on this floor. */
  healthcareServiceIds: string[];

  criadoEm: string;
  atualizadoEm: string;
}

// ---------------------------------------------------------------------------
// Especialidade
// ---------------------------------------------------------------------------

export type ConselhoProfissional =
  | 'CRM'
  | 'COREN'
  | 'CRF'
  | 'CREFITO'
  | 'CRN'
  | 'CRP'
  | 'CFFa'
  | 'CRO'
  | 'CRESS'
  | 'CRB';

export type CategoriaEspecialidade =
  | 'clinica'
  | 'cirurgica'
  | 'pediatrica'
  | 'diagnostica'
  | 'apoio'
  | 'critica'
  | 'mental'
  | 'reabilitacao'
  | 'multidisciplinar';

/**
 * Specialty catalog (CFM 55 specialties + multiprofissional equivalents).
 *
 * NOTE: this entity does not contain "typical wards". The specialty <-> unit
 * relation is modeled exclusively via HealthcareService.
 *
 * Especialidade.id is referenced by:
 *   - HealthcareService.especialidadeId
 *   - PractitionerRole.especialidadeIds[]
 *   - RegistroProfissional.rqeEspecialidadeIds[]
 *   - Internacao.especialidadePrimariaId
 *   - CareTeamParticipante.especialidadeId
 */
export interface Especialidade {
  /** Slug id, e.g. 'cardiologia', 'fisioterapia_respiratoria'. */
  id: string;
  nome: string;
  conselho: ConselhoProfissional;
  /** CFM specialty code; only set when conselho === 'CRM'. */
  cfmCodigo?: string;
  categoria: CategoriaEspecialidade;
  /** Years of medical residency; absent when not applicable. */
  residenciaAnos?: number;
  descricao: string;
  areasAtuacao: string[];
}

// ---------------------------------------------------------------------------
// HealthcareService
// ---------------------------------------------------------------------------

export type ModeloCobertura =
  | 'plantao_24_7_presencial'
  | 'diarista_horizontal'
  | 'sobreaviso'
  | 'ambulatorial'
  | 'hospitalista';

/**
 * A specialty operating in one or more units. Single source of truth for
 * "which specialties are available on which floor".
 *
 * HealthcareService.id is referenced by:
 *   - UnidadeAssistencial.healthcareServiceIds[]
 *   - PractitionerRole.healthcareServiceIds[]
 *   - Internacao.servicoPrimarioId
 */
export interface HealthcareService {
  id: string;
  /** Display name: "Cardiologia em UTI Adulto - Ala 1". */
  nome: string;
  especialidadeId: string;
  /** UnidadeAssistencial ids where the service operates. */
  unidadeIds: string[];
  /** Organization.id of the owning department. */
  providedByOrganizationId: string;
  modeloCobertura: ModeloCobertura;
  dimensionamento?: {
    /** Staffing ratio, e.g. "1/10", "2/15". */
    profissionaisPorLeitos: string;
    /** Regulation backing the ratio, e.g. "RDC 7/2010". */
    regulamentacao: string;
  };
  /** For non-24/7 services. */
  horarioInicio?: string;
  /** For non-24/7 services. */
  horarioFim?: string;
  ativo: boolean;
}

// ---------------------------------------------------------------------------
// ProfissionalSaude + PractitionerRole
// ---------------------------------------------------------------------------

export type CategoriaProfissional =
  | 'medico'
  | 'enfermeiro'
  | 'tecnico_enfermagem'
  | 'auxiliar_enfermagem'
  | 'fisioterapeuta'
  | 'nutricionista'
  | 'fonoaudiologo'
  | 'psicologo'
  | 'terapeuta_ocupacional'
  | 'assistente_social'
  | 'farmaceutico'
  | 'dentista'
  | 'biomedico'
  | 'tecnico_radiologia'
  | 'maqueiro'
  | 'higienizacao'
  | 'manutencao'
  | 'recepcao'
  | 'coordenador_assistencial'
  | 'diretor_clinico'
  | 'diretor_tecnico';

/**
 * A single professional registration (council + number + UF).
 * One ProfissionalSaude may carry several (e.g. CRM-SP + CRM-RJ).
 */
export interface RegistroProfissional {
  conselho: ConselhoProfissional;
  numero: string;
  uf: string;
  /** Especialidade ids for which the RQE (Registro de Qualificacao de Especialista) is active. */
  rqeEspecialidadeIds?: string[];
  validadeEm?: string;
}

/**
 * A person who works in the hospital. Identity + credentialing only.
 * Operational assignments live in PractitionerRole.
 *
 * ProfissionalSaude.id is referenced by:
 *   - PractitionerRole.profissionalId
 *   - PresencaFisica.profissionalId
 *   - CareTeamParticipante.profissionalId
 *   - UnidadeAssistencial.coordenadorId / responsavelTecnicoId
 *   - Organization.responsavelId
 *   - ClassificacaoRisco.avaliadorId
 */
export interface ProfissionalSaude {
  id: string;
  nome: string;
  cpf: string;
  dataNascimento: string;
  categoria: CategoriaProfissional;
  /** Multi-registry support (a person can have several active councils). */
  registros: RegistroProfissional[];
  email: string;
  telefone?: string;
  ramal?: string;
  ativo: boolean;
  dataAdmissao: string;
  dataDesligamento?: string;
}

export type PractitionerRoleCodigo =
  | 'assistente'
  | 'plantonista'
  | 'diarista'
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

/**
 * Binding of a ProfissionalSaude to a set of services, locations and
 * especialidades, with a defined role code and workload. One person can
 * hold several simultaneous PractitionerRoles.
 *
 * Integrity rule: Internacao.medicoAssistenteRoleId must be a role with
 * codigo === 'assistente' whose especialidadeIds intersect the especialidade
 * of the encounter's servicoPrimarioId.
 *
 * PractitionerRole.id is referenced by:
 *   - Turno.practitionerRoleId / substitutoRoleId
 *   - Internacao.medicoAssistenteRoleId
 *   - InterconsultaConsultor.roleId
 *   - TransferenciaInterna.solicitadoPorRoleId / receptorRoleId
 *   - CareTeamParticipante.roleId
 *   - InternacaoAlta.medicoAltaRoleId
 */
export interface PractitionerRole {
  id: string;
  profissionalId: string;
  /** Organization.id (department) that holds this role. */
  organizationId: string;
  /** HealthcareService ids delivered under this role. */
  healthcareServiceIds: string[];
  /** UnidadeAssistencial ids where this role is exercised. */
  locationIds: string[];
  /** Especialidade ids attached to this role. */
  especialidadeIds: string[];
  codigo: PractitionerRoleCodigo;
  /** Weekly contracted hours. */
  cargaHoraria: number;
  inicioVigencia: string;
  fimVigencia?: string;
  ativo: boolean;
}

// ---------------------------------------------------------------------------
// Escala (shift / presence)
// ---------------------------------------------------------------------------

export type TurnoTipo =
  | 'matutino'
  | 'vespertino'
  | 'noturno'
  | 'plantao_12'
  | 'plantao_24'
  | 'sobreaviso';

export type TurnoStatus =
  | 'agendado'
  | 'em_andamento'
  | 'concluido'
  | 'ausencia'
  | 'substituido';

/**
 * A scheduled shift: who will staff which unit, when.
 * unidadeId references UnidadeAssistencial.id.
 */
export interface Turno {
  id: string;
  practitionerRoleId: string;
  /** UnidadeAssistencial.id where the shift is worked. */
  unidadeId: string;
  tipo: TurnoTipo;
  /** ISO datetime. */
  inicioEm: string;
  /** ISO datetime. */
  fimEm: string;
  status: TurnoStatus;
  /** PractitionerRole.id of the substitute when status === 'substituido'. */
  substitutoRoleId?: string;
  observacoes?: string;
}

export type PresencaStatus = 'presente' | 'em_pausa' | 'off_turno' | 'ausente';

/** Physical presence (badge-in / badge-out) measured in real time. */
export interface PresencaFisica {
  id: string;
  profissionalId: string;
  turnoId: string;
  badgeInEm?: string;
  badgeOutEm?: string;
  /** UnidadeAssistencial.id where the person is currently standing. */
  unidadeAtualId?: string;
  status: PresencaStatus;
}

// ---------------------------------------------------------------------------
// Paciente + Internacao + Transferencia
// ---------------------------------------------------------------------------

export type Sexo = 'M' | 'F' | 'indeterminado';
export type NivelRisco = 'baixo' | 'medio' | 'alto' | 'critico';

export interface AlergiaPaciente {
  substancia: string;
  reacao: string;
  severidade: 'leve' | 'moderada' | 'grave' | 'anafilatica';
}

export interface AlertaPaciente {
  codigo: string;
  descricao: string;
  desde: string;
}

export interface ConvenioPaciente {
  nome: string;
  numero: string;
  plano: string;
  validadeEm?: string;
}

/**
 * UNIFIED Paciente. Replaces the previous divergent `patients.ts` and
 * `patients-list.ts` schemas.
 *
 * Current ward / bed / diagnosis are NOT stored here. They live on the
 * active Internacao (encounter) for the patient.
 *
 * Paciente.id is referenced by:
 *   - Internacao.pacienteId
 *   - CareTeam.pacienteId
 */
export interface Paciente {
  /** UUID. */
  id: string;
  /** Medical Record Number, human-visible (e.g. "MRN-001"). */
  mrn: string;
  nome: string;
  nomeSocial?: string;
  cpf?: string;
  cns?: string;
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
  convenio?: ConvenioPaciente;
  alergias: AlergiaPaciente[];
  alertas: AlertaPaciente[];
}

export type ViaAdmissao =
  | 'emergencia'
  | 'eletiva'
  | 'transferencia_externa'
  | 'direto_uti'
  | 'maternidade';

export type StatusInternacao =
  | 'em_admissao'
  | 'internado'
  | 'alta_solicitada'
  | 'em_transferencia'
  | 'alta_completada'
  | 'obito'
  | 'evasao';

export type TipoAlta =
  | 'melhorada'
  | 'curada'
  | 'a_pedido'
  | 'administrativa'
  | 'transferencia_externa'
  | 'obito_com_necropsia'
  | 'obito_sem_necropsia'
  | 'evasao'
  | 'desistencia';

export type ManchesterNivel = 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul';
export type ScpCofen =
  | 'minimos'
  | 'intermediarios'
  | 'alta_dependencia'
  | 'semi_intensivo'
  | 'intensivo';

/** Interconsultation request on an open Internacao. */
export interface Consultor {
  /** PractitionerRole.id of the consultor. */
  roleId: string;
  tipo: 'parecer' | 'acompanhamento';
  solicitadoEm: string;
  respostaEm?: string;
}

/**
 * Alias kept for forward-readability in code that speaks of "interconsultas".
 * Same shape as {@link Consultor}.
 */
export type InterconsultaConsultor = Consultor;

/**
 * Internacao (encounter). Anchors the clinical episode: patient +
 * current location + primary service + assistant physician + care team.
 *
 * Integrity rules (spec section 4):
 *   - locationAtualId must be a Location with physicalType === 'bed' and
 *     operationalStatus === 'O'.
 *   - medicoAssistenteRoleId must be a PractitionerRole with codigo
 *     'assistente' whose especialidadeIds intersect the especialidade of
 *     servicoPrimarioId.
 *   - unidadeAtualId is derived from locationAtualId's parent chain.
 *
 * Internacao.id is referenced by:
 *   - TransferenciaInterna.internacaoId
 *   - CareTeam.internacaoId
 */
export interface Internacao {
  id: string;
  pacienteId: string;
  numeroAtendimento: string;
  admissao: {
    em: string;
    via: ViaAdmissao;
    origem?: string;
    classificacaoRisco?: {
      manchester: ManchesterNivel;
      avaliadorId: string;
      em: string;
    };
  };
  status: StatusInternacao;
  locationAtualId: string;
  unidadeAtualId: string;
  servicoPrimarioId: string;
  especialidadePrimariaId: string;
  medicoAssistenteRoleId: string;
  consultores: Consultor[];
  careTeamId: string;
  cidPrincipal?: string;
  cidsSecundarios: string[];
  hipoteseDiagnostica?: string;
  scpAtual?: ScpCofen;
  newsScore?: number;
  transferencias: string[];
  alta?: {
    em: string;
    tipo: TipoAlta;
    sumario: string;
    medicoAltaRoleId: string;
    cidAlta: string;
    destino?: string;
  };
  criadoEm: string;
  atualizadoEm: string;
}

export type TipoTransferencia =
  | 'step_up'
  | 'step_down'
  | 'lateral'
  | 'reserva_cirurgia'
  | 'retorno_unidade';

/**
 * Internal transfer within the hospital. Every bed change is a
 * TransferenciaInterna row; the Internacao keeps only the current bed.
 */
export interface TransferenciaInterna {
  id: string;
  internacaoId: string;
  /** Location.id of the origin bed. */
  origemLocationId: string;
  /** Location.id of the destination bed. */
  destinoLocationId: string;
  tipo: TipoTransferencia;
  motivo: string;
  /** PractitionerRole.id of the requester. */
  solicitadoPorRoleId: string;
  solicitadoEm: string;
  executadoEm?: string;
  /** PractitionerRole.id of the receiver at the destination. */
  receptorRoleId?: string;
  transporteChecklistCompleto: boolean;
  observacoes?: string;
}

// ---------------------------------------------------------------------------
// CareTeam
// ---------------------------------------------------------------------------

export type CareTeamStatus = 'ativo' | 'suspenso' | 'encerrado';

export type CareTeamPapel =
  | 'medico_assistente'
  | 'enfermeiro_referencia'
  | 'farmaceutico_clinico'
  | 'nutricionista'
  | 'fisioterapeuta'
  | 'assistente_social'
  | 'psicologo'
  | 'medico_consultor'
  | 'familiar'
  | 'cuidador';

/** A single participant row in a CareTeam. */
export interface CareTeamParticipante {
  profissionalId: string;
  /** PractitionerRole.id this participant is acting under. */
  roleId: string;
  papel: CareTeamPapel;
  especialidadeId?: string;
  desde: string;
  ate?: string;
}

/**
 * CareTeam: the stable roster around a patient's episode. Consultores on
 * Internacao are rotating; the CareTeam is the persistent group (assistente,
 * enfermeiro de referencia, farmaceutico clinico, assistente social, etc).
 */
export interface CareTeam {
  id: string;
  /** Optional link to a specific episode; absent for longitudinal teams. */
  internacaoId?: string;
  pacienteId: string;
  status: CareTeamStatus;
  participantes: CareTeamParticipante[];
}
