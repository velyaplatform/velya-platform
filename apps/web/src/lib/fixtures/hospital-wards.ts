/**
 * Centralized fixture for hospital wards / sectors / units.
 * Each ward records its operating rules: sector type, capacity, opening
 * hours, mandatory checklists, ANVISA regulation, isolation rules,
 * required staff types, and the medical specialties that work there.
 *
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type WardType =
  | 'pronto-socorro' // Emergency
  | 'ambulatorio' // Outpatient
  | 'internacao-clinica' // Inpatient medical
  | 'internacao-cirurgica' // Inpatient surgical
  | 'uti-adulto' // Adult ICU
  | 'uti-pediatrica' // Pediatric ICU
  | 'uti-neonatal' // Neonatal ICU
  | 'uti-coronariana' // Coronary ICU
  | 'uti-queimados' // Burn ICU
  | 'centro-cirurgico' // OR
  | 'centro-obstetrico' // L&D
  | 'maternidade' // Maternity ward
  | 'pediatria' // Pediatric ward
  | 'oncologia' // Oncology
  | 'hemodialise' // Dialysis
  | 'hemodinamica' // Cath lab
  | 'endoscopia' // Endoscopy
  | 'radiologia' // Imaging
  | 'laboratorio' // Lab
  | 'farmacia' // Pharmacy
  | 'banco-sangue' // Blood bank
  | 'cme' // CME (sterilization)
  | 'nutricao' // Food service
  | 'lavanderia' // Laundry
  | 'higienizacao' // Cleaning HQ
  | 'morgue' // Morgue
  | 'almoxarifado' // Warehouse
  | 'ti-data-center' // IT
  | 'engenharia-clinica' // Biomedical eng.
  | 'manutencao-predial' // Facility maint.
  | 'recepcao' // Reception
  | 'faturamento' // Billing
  | 'rh' // HR
  | 'reabilitacao' // Rehab/PT
  | 'psiquiatria' // Psych ward
  | 'oncologia-radioterapia'; // Radiation therapy

export type IsolationLevel =
  | 'nenhum'
  | 'contato'
  | 'goticulas'
  | 'aerossois'
  | 'protetor';

export type CriticalityLevel = 'baixa' | 'media' | 'alta' | 'critica';

export interface HospitalWard {
  id: string; // e.g. 'uti-adulto-01'
  name: string; // 'UTI Adulto - Ala 1'
  type: WardType;
  /** Building / floor / section reference */
  location: { building: string; floor: number; sector: string };
  /** Total beds / chairs / boxes capacity */
  capacity: number;
  /** Currently occupied count (mock) */
  occupied?: number;
  /** Operating hours */
  operatingHours: '24h' | string; // e.g. '24h' or '07:00-19:00'
  /** Criticality */
  criticality: CriticalityLevel;
  /** Standard isolation rule */
  isolationLevel: IsolationLevel;
  /** Specialties that work in this ward (ids matching medical-specialties.ts) */
  specialties: string[];
  /** Required professional roles (matching staff.ts ProfessionalRole ids) */
  requiredRoles: string[];
  /** Mandatory checklists / SOPs */
  checklists: string[];
  /** Equipment required (Asset types) */
  requiredEquipment: string[];
  /** Brazilian regulations governing the ward */
  regulatoryBasis: string[];
  /** Operating rules in plain Portuguese — what makes this ward unique */
  operatingRules: string[];
  /** Coordinator role/name (mock) */
  coordinator?: string;
}

export const HOSPITAL_WARDS: HospitalWard[] = [
  // ============================================================
  // UTIs
  // ============================================================
  {
    id: 'uti-adulto-01',
    name: 'UTI Adulto - Ala 1',
    type: 'uti-adulto',
    location: { building: 'Bloco A', floor: 4, sector: 'Ala Norte' },
    capacity: 12,
    occupied: 10,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'contato',
    specialties: ['medicina-intensiva', 'cardiologia', 'pneumologia', 'nefrologia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem', 'fisioterapeuta', 'farmaceutico'],
    checklists: [
      'Bundle de prevenção de PAV (pneumonia associada à ventilação)',
      'Bundle de prevenção de ICSRC (infecção de corrente sanguínea)',
      'Checklist diário de metas (despertar, extubação, profilaxia TVP)',
      'Passagem de plantão SBAR',
    ],
    requiredEquipment: [
      'ventilador-mecanico',
      'monitor-multiparametrico',
      'bomba-infusao',
      'desfibrilador',
      'carro-parada',
      'ecografo-point-of-care',
    ],
    regulatoryBasis: [
      'ANVISA RDC 7/2010 (UTI)',
      'ANVISA RDC 50/2002 (Infraestrutura)',
      'Portaria MS 895/2017',
    ],
    operatingRules: [
      'Proporção mínima de 1 enfermeiro para cada 8 leitos e 1 técnico a cada 2 leitos conforme RDC 7/2010',
      'Visitas restritas a 30 minutos, máximo 2 acompanhantes por leito, sob orientação da equipe',
      'Passagem de plantão multiprofissional obrigatória no início de cada turno',
      'Avaliação diária de metas terapêuticas e critérios de alta por rounds multidisciplinares',
      'Monitorização hemodinâmica contínua 24h com registro horário em prontuário',
    ],
    coordinator: 'Dra. Marina Albuquerque',
  },
  {
    id: 'uti-adulto-02',
    name: 'UTI Adulto - Ala 2',
    type: 'uti-adulto',
    location: { building: 'Bloco A', floor: 4, sector: 'Ala Sul' },
    capacity: 10,
    occupied: 8,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'contato',
    specialties: ['medicina-intensiva', 'neurologia', 'cirurgia-geral'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem', 'fisioterapeuta'],
    checklists: [
      'Bundle de prevenção de PAV',
      'Checklist de sedação e delirium (RASS/CAM-ICU)',
      'Passagem de plantão SBAR',
    ],
    requiredEquipment: [
      'ventilador-mecanico',
      'monitor-multiparametrico',
      'bomba-infusao',
      'desfibrilador',
    ],
    regulatoryBasis: ['ANVISA RDC 7/2010 (UTI)', 'ANVISA RDC 50/2002'],
    operatingRules: [
      'Leitos de isolamento de contato dedicados para pacientes colonizados por MDR',
      'Higienização das mãos auditada por observação direta em todos os plantões',
      'Troca de circuito de ventilador somente quando sujo ou danificado, conforme protocolo',
      'Uso racional de antimicrobianos com revisão diária da CCIH',
    ],
    coordinator: 'Dr. Rafael Montenegro',
  },
  {
    id: 'uti-pediatrica-01',
    name: 'UTI Pediátrica',
    type: 'uti-pediatrica',
    location: { building: 'Bloco B', floor: 3, sector: 'Ala Pediátrica' },
    capacity: 8,
    occupied: 6,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'contato',
    specialties: ['pediatria', 'medicina-intensiva-pediatrica', 'cardiologia-pediatrica'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem', 'fisioterapeuta'],
    checklists: [
      'Checklist pediátrico de segurança do paciente',
      'Bundle de prevenção de PAV pediátrica',
      'Escala de dor FLACC/EVA em cada plantão',
    ],
    requiredEquipment: [
      'ventilador-mecanico-pediatrico',
      'monitor-multiparametrico',
      'bomba-infusao-seringa',
      'incubadora',
      'desfibrilador-pediatrico',
    ],
    regulatoryBasis: ['ANVISA RDC 7/2010 (UTI)', 'Portaria MS 930/2012 (UTI Neonatal e Pediátrica)'],
    operatingRules: [
      'Prescrições medicamentosas obrigatoriamente calculadas por peso (mg/kg) com dupla checagem',
      'Presença de acompanhante permitida 24h por leito conforme ECA',
      'Proporção mínima 1 enfermeiro para cada 5 leitos pediátricos críticos',
      'Ambiente lúdico e controle de ruído <45 dB para favorecer recuperação',
    ],
    coordinator: 'Dra. Helena Barbosa',
  },
  {
    id: 'uti-neonatal-01',
    name: 'UTI Neonatal',
    type: 'uti-neonatal',
    location: { building: 'Bloco B', floor: 2, sector: 'Ala Materno-Infantil' },
    capacity: 10,
    occupied: 7,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'protetor',
    specialties: ['neonatologia', 'pediatria'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem', 'fisioterapeuta'],
    checklists: [
      'Checklist de cateter umbilical',
      'Bundle de prevenção de sepse neonatal',
      'Protocolo canguru (Método Mãe Canguru)',
    ],
    requiredEquipment: [
      'incubadora',
      'ventilador-neonatal',
      'fototerapia',
      'bomba-infusao-seringa',
      'monitor-neonatal',
    ],
    regulatoryBasis: [
      'ANVISA RDC 7/2010 (UTI)',
      'Portaria MS 930/2012',
      'Portaria MS 1.683/2007 (Método Canguru)',
    ],
    operatingRules: [
      'Temperatura ambiente controlada entre 24-26°C e umidade 40-60% para termorregulação neonatal',
      'Método Canguru estimulado sempre que clinicamente estável, registrado em prontuário',
      'Aleitamento materno estimulado; banco de leite deve fornecer leite humano pasteurizado na indisponibilidade',
      'Manuseio mínimo agrupado a cada 3h para preservar sono do neonato',
      'Lavagem cirúrgica das mãos obrigatória antes de manipular qualquer neonato',
    ],
    coordinator: 'Dra. Juliana Nakamura',
  },
  {
    id: 'uti-coronariana-01',
    name: 'UTI Coronariana (Unidade Coronariana)',
    type: 'uti-coronariana',
    location: { building: 'Bloco A', floor: 5, sector: 'Ala Cardiovascular' },
    capacity: 8,
    occupied: 6,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'nenhum',
    specialties: ['cardiologia', 'medicina-intensiva'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem', 'fisioterapeuta'],
    checklists: [
      'Protocolo de dor torácica (porta-ECG < 10 min)',
      'Bundle de IAM com supra (protocolo porta-balão < 90 min)',
      'Checklist de terapia trombolítica',
    ],
    requiredEquipment: [
      'monitor-multiparametrico',
      'desfibrilador',
      'bomba-balao-intra-aortico',
      'marcapasso-temporario',
      'ecg-12-derivacoes',
    ],
    regulatoryBasis: ['ANVISA RDC 7/2010 (UTI)', 'Diretriz SBC para Unidade Coronariana'],
    operatingRules: [
      'ECG em até 10 minutos da chegada do paciente com dor torácica (meta porta-ECG)',
      'Tempo porta-balão inferior a 90 minutos para IAM com supradesnivelamento de ST',
      'Monitorização contínua de ECG, PAM e oximetria em 100% dos leitos',
      'Equipe treinada em ACLS com reciclagem anual obrigatória',
    ],
    coordinator: 'Dr. Eduardo Tavares',
  },
  {
    id: 'uti-queimados-01',
    name: 'UTI de Queimados',
    type: 'uti-queimados',
    location: { building: 'Bloco C', floor: 2, sector: 'Centro de Queimados' },
    capacity: 6,
    occupied: 4,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'protetor',
    specialties: ['cirurgia-plastica', 'medicina-intensiva', 'cirurgia-geral'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem', 'fisioterapeuta'],
    checklists: [
      'Protocolo de reposição volêmica Parkland',
      'Checklist de curativo em sala estéril',
      'Protocolo de analgesia multimodal para queimados',
    ],
    requiredEquipment: [
      'cama-hidraulica-fluidizada',
      'ventilador-mecanico',
      'monitor-multiparametrico',
      'banheira-hidroterapia',
    ],
    regulatoryBasis: [
      'ANVISA RDC 7/2010 (UTI)',
      'Portaria MS 1.273/2000 (Centros de Tratamento de Queimados)',
    ],
    operatingRules: [
      'Ambiente com temperatura controlada entre 28-32°C para minimizar perdas térmicas',
      'Curativos realizados em sala estéril com paramentação cirúrgica completa',
      'Reposição volêmica orientada por Parkland nas primeiras 24h, ajustada por diurese horária',
      'Nutrição hipercalórica e hiperproteica iniciada em até 24h da admissão',
      'Isolamento protetor obrigatório — acesso restrito com paramentação',
    ],
    coordinator: 'Dr. Fernando Aguiar',
  },

  // ============================================================
  // Internações
  // ============================================================
  {
    id: 'internacao-clinica-01',
    name: 'Internação Clínica - Ala 3A',
    type: 'internacao-clinica',
    location: { building: 'Bloco A', floor: 3, sector: 'Ala A' },
    capacity: 30,
    occupied: 24,
    operatingHours: '24h',
    criticality: 'media',
    isolationLevel: 'nenhum',
    specialties: ['clinica-medica', 'cardiologia', 'pneumologia', 'nefrologia', 'endocrinologia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem', 'planejador-alta'],
    checklists: [
      'Avaliação de risco de queda (Morse)',
      'Avaliação de risco de lesão por pressão (Braden)',
      'Checklist de reconciliação medicamentosa',
      'Plano de alta iniciado em até 24h',
    ],
    requiredEquipment: [
      'cama-hospitalar',
      'monitor-beira-leito',
      'bomba-infusao',
      'oximetro-portatil',
    ],
    regulatoryBasis: ['ANVISA RDC 50/2002', 'Portaria MS 529/2013 (Segurança do Paciente)'],
    operatingRules: [
      'Round multidisciplinar diário com definição de plano terapêutico e meta de alta',
      'Identificação do paciente por dois identificadores em toda ação assistencial',
      'Reconciliação medicamentosa obrigatória na admissão, transferência e alta',
      'Avaliação de risco de queda e lesão por pressão a cada plantão',
    ],
    coordinator: 'Enfa. Patrícia Souza',
  },
  {
    id: 'internacao-clinica-02',
    name: 'Internação Clínica - Ala 3B (Isolamentos)',
    type: 'internacao-clinica',
    location: { building: 'Bloco A', floor: 3, sector: 'Ala B' },
    capacity: 16,
    occupied: 12,
    operatingHours: '24h',
    criticality: 'alta',
    isolationLevel: 'goticulas',
    specialties: ['infectologia', 'clinica-medica', 'pneumologia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist de precaução de contato/gotículas/aerossóis',
      'Auditoria diária de higienização de superfícies',
    ],
    requiredEquipment: [
      'cama-hospitalar',
      'monitor-beira-leito',
      'filtro-hepa',
      'dispensador-epi',
    ],
    regulatoryBasis: [
      'ANVISA RDC 50/2002',
      'ANVISA Nota Técnica 04/2020 (Precauções)',
      'Portaria MS 2.616/1998 (CCIH)',
    ],
    operatingRules: [
      'Quartos de isolamento com pressão negativa para casos suspeitos de aerossóis (TB, sarampo, COVID)',
      'Paramentação de EPI auditada na entrada e saída do quarto',
      'Restrição de visitas conforme grau de precaução, com orientação documentada',
      'Limpeza terminal com desinfetante de alto nível após alta ou transferência',
    ],
    coordinator: 'Enf. Daniel Ferreira',
  },
  {
    id: 'internacao-cirurgica-01',
    name: 'Internação Cirúrgica - Ala 5A',
    type: 'internacao-cirurgica',
    location: { building: 'Bloco A', floor: 5, sector: 'Ala A' },
    capacity: 28,
    occupied: 20,
    operatingHours: '24h',
    criticality: 'media',
    isolationLevel: 'nenhum',
    specialties: ['cirurgia-geral', 'ortopedia', 'urologia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem', 'fisioterapeuta'],
    checklists: [
      'Checklist pré-operatório',
      'Escala de dor pós-operatória (EVA) a cada 4h',
      'Protocolo ERAS de recuperação acelerada',
    ],
    requiredEquipment: [
      'cama-hospitalar',
      'bomba-infusao',
      'monitor-beira-leito',
      'bomba-analgesia-controlada',
    ],
    regulatoryBasis: ['ANVISA RDC 50/2002', 'Protocolo OMS de Cirurgia Segura'],
    operatingRules: [
      'Deambulação precoce estimulada nas primeiras 24h pós-operatórias quando aplicável',
      'Avaliação de dor e prescrição analgésica multimodal em todos os turnos',
      'Profilaxia de TVP conforme escore de Caprini obrigatória para pós-cirúrgicos',
      'Curativos de ferida operatória avaliados diariamente com registro fotográfico em evolução',
    ],
    coordinator: 'Enfa. Larissa Mendes',
  },
  {
    id: 'internacao-cirurgica-02',
    name: 'Internação Cirúrgica - Ala 5B (Ortopedia)',
    type: 'internacao-cirurgica',
    location: { building: 'Bloco A', floor: 5, sector: 'Ala B' },
    capacity: 22,
    occupied: 17,
    operatingHours: '24h',
    criticality: 'media',
    isolationLevel: 'nenhum',
    specialties: ['ortopedia', 'cirurgia-geral'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem', 'fisioterapeuta'],
    checklists: [
      'Checklist de pós-operatório ortopédico',
      'Avaliação neurovascular de extremidade operada',
    ],
    requiredEquipment: [
      'cama-hospitalar-ortopedica',
      'trapezio-ortopedico',
      'bomba-infusao',
      'crioterapia',
    ],
    regulatoryBasis: ['ANVISA RDC 50/2002'],
    operatingRules: [
      'Avaliação neurovascular periférica (pulso, cor, sensibilidade) de 4/4h em membro operado',
      'Fisioterapia motora iniciada em até 24h pós-operatório quando liberado pela equipe médica',
      'Profilaxia antitrombótica mecânica e farmacológica obrigatória para cirurgias de grande porte',
    ],
    coordinator: 'Enfa. Camila Ribeiro',
  },

  // ============================================================
  // Emergência e Ambulatório
  // ============================================================
  {
    id: 'pronto-socorro-adulto-01',
    name: 'Pronto-Socorro Adulto',
    type: 'pronto-socorro',
    location: { building: 'Bloco Térreo', floor: 1, sector: 'Emergência' },
    capacity: 40,
    occupied: 32,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'goticulas',
    specialties: ['medicina-emergencia', 'clinica-medica', 'cirurgia-geral', 'ortopedia', 'cardiologia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem', 'recepcao'],
    checklists: [
      'Classificação de risco Manchester em até 10 minutos da chegada',
      'Protocolo de sepse (bundle primeira hora)',
      'Protocolo de dor torácica',
      'Protocolo de AVC (porta-agulha < 60 min)',
    ],
    requiredEquipment: [
      'monitor-multiparametrico',
      'desfibrilador',
      'ventilador-transporte',
      'ecg-12-derivacoes',
      'carro-parada',
      'ecografo-point-of-care',
    ],
    regulatoryBasis: [
      'Portaria MS 2.048/2002 (Urgência e Emergência)',
      'Portaria MS 1.600/2011 (Rede de Urgência)',
      'ANVISA RDC 50/2002',
    ],
    operatingRules: [
      'Acolhimento com classificação de risco Manchester obrigatório na chegada de todo paciente',
      'Protocolos tempo-dependentes (sepse, AVC, IAM, trauma) monitorados com indicadores diários',
      'Sala vermelha deve manter prontidão de reanimação 24h com carro de parada conferido por plantão',
      'Notificação compulsória de agravos conforme lista MS/SES',
    ],
    coordinator: 'Dr. Bruno Caetano',
  },
  {
    id: 'pronto-socorro-pediatrico-01',
    name: 'Pronto-Socorro Pediátrico',
    type: 'pronto-socorro',
    location: { building: 'Bloco B', floor: 1, sector: 'Emergência Pediátrica' },
    capacity: 20,
    occupied: 14,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'goticulas',
    specialties: ['pediatria', 'medicina-emergencia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem', 'recepcao'],
    checklists: [
      'Classificação de risco pediátrico',
      'Protocolo de febre sem sinais localizatórios',
      'Protocolo de bronquiolite/asma',
    ],
    requiredEquipment: [
      'monitor-pediatrico',
      'desfibrilador-pediatrico',
      'carro-parada-pediatrico',
      'balanca-pediatrica',
      'nebulizador',
    ],
    regulatoryBasis: [
      'Portaria MS 2.048/2002',
      'ECA (Lei 8.069/1990) — presença de acompanhante',
    ],
    operatingRules: [
      'Presença de acompanhante legal garantida 24h conforme ECA',
      'Medicações sempre calculadas por peso (mg/kg) com dupla checagem',
      'Ambiente acolhedor com separação do PS adulto; sala de hidratação/observação dedicada',
      'Triagem pediátrica com escalas específicas por faixa etária',
    ],
    coordinator: 'Dra. Sofia Cavalcanti',
  },
  {
    id: 'ambulatorio-central-01',
    name: 'Ambulatório Multiespecialidades',
    type: 'ambulatorio',
    location: { building: 'Bloco D', floor: 1, sector: 'Ambulatório' },
    capacity: 60,
    occupied: 45,
    operatingHours: '07:00-19:00',
    criticality: 'baixa',
    isolationLevel: 'nenhum',
    specialties: [
      'clinica-medica',
      'cardiologia',
      'endocrinologia',
      'dermatologia',
      'ginecologia',
      'ortopedia',
      'neurologia',
    ],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem', 'recepcao'],
    checklists: [
      'Checklist de agendamento e confirmação',
      'Triagem de sinais vitais pré-consulta',
    ],
    requiredEquipment: [
      'maca-exame',
      'esfigmomanometro',
      'otoscopio',
      'oftalmoscopio',
      'ecg-12-derivacoes',
    ],
    regulatoryBasis: ['ANVISA RDC 50/2002', 'Lei 13.787/2018 (Prontuário Eletrônico)'],
    operatingRules: [
      'Agendamento prévio obrigatório; encaixes apenas via regulação',
      'Tempo máximo de espera de 30 minutos além do horário agendado com comunicação ao paciente',
      'Prontuário eletrônico atualizado ao término de cada consulta antes de chamar próximo paciente',
      'Consultas de retorno agendadas no momento da alta ambulatorial',
    ],
    coordinator: 'Enfa. Vera Lúcia Paiva',
  },

  // ============================================================
  // Centro Cirúrgico
  // ============================================================
  {
    id: 'centro-cirurgico-sala-01',
    name: 'Centro Cirúrgico - Sala 1 (Geral)',
    type: 'centro-cirurgico',
    location: { building: 'Bloco A', floor: 2, sector: 'Centro Cirúrgico' },
    capacity: 1,
    occupied: 1,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'protetor',
    specialties: ['cirurgia-geral', 'anestesiologia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist de Cirurgia Segura OMS (Sign In, Time Out, Sign Out)',
      'Conferência de instrumental e compressas pré e pós-cirurgia',
      'Checklist de integridade de material estéril',
    ],
    requiredEquipment: [
      'mesa-cirurgica',
      'foco-cirurgico',
      'bisturi-eletrico',
      'monitor-anestesia',
      'carro-anestesia',
      'aspirador-cirurgico',
    ],
    regulatoryBasis: [
      'ANVISA RDC 50/2002',
      'OMS Cirurgia Segura Salva Vidas',
      'Resolução CFM 2.174/2017 (Prática anestésica)',
    ],
    operatingRules: [
      'Checklist de Cirurgia Segura OMS obrigatório antes de toda incisão, com pausa da equipe (Time Out)',
      'Contagem de compressas, gazes e instrumentais antes da abertura e ao fechamento da cavidade',
      'Profilaxia antimicrobiana administrada em até 60 minutos antes da incisão',
      'Temperatura da sala entre 18-24°C e umidade 30-60% conforme RDC 50',
      'Paramentação cirúrgica completa exigida para toda equipe em campo',
    ],
    coordinator: 'Dra. Beatriz Linhares',
  },
  {
    id: 'centro-cirurgico-sala-02',
    name: 'Centro Cirúrgico - Sala 2 (Ortopédica)',
    type: 'centro-cirurgico',
    location: { building: 'Bloco A', floor: 2, sector: 'Centro Cirúrgico' },
    capacity: 1,
    occupied: 0,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'protetor',
    specialties: ['ortopedia', 'anestesiologia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist de Cirurgia Segura OMS',
      'Conferência de implantes ortopédicos e validade',
    ],
    requiredEquipment: [
      'mesa-cirurgica-ortopedica',
      'arco-c-radioscopia',
      'motor-ortopedico',
      'foco-cirurgico',
      'monitor-anestesia',
    ],
    regulatoryBasis: ['ANVISA RDC 50/2002', 'OMS Cirurgia Segura'],
    operatingRules: [
      'Checklist de Cirurgia Segura OMS obrigatório com marcação do sítio cirúrgico pelo cirurgião',
      'Uso de chumbo e dosimetria para toda equipe durante fluoroscopia',
      'Conferência e rastreabilidade de implantes ortopédicos por lote',
    ],
    coordinator: 'Dr. Marcelo Queiroz',
  },
  {
    id: 'centro-cirurgico-sala-03',
    name: 'Centro Cirúrgico - Sala 3 (Cardiovascular)',
    type: 'centro-cirurgico',
    location: { building: 'Bloco A', floor: 2, sector: 'Centro Cirúrgico' },
    capacity: 1,
    occupied: 1,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'protetor',
    specialties: ['cirurgia-cardiovascular', 'anestesiologia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist de Cirurgia Segura OMS',
      'Checklist de circulação extracorpórea',
      'Conferência de sangue e hemocomponentes reservados',
    ],
    requiredEquipment: [
      'maquina-cec-perfusao',
      'mesa-cirurgica',
      'monitor-anestesia-avancado',
      'ecografo-transesofagico',
      'desfibrilador-interno',
    ],
    regulatoryBasis: [
      'ANVISA RDC 50/2002',
      'Resolução CFM 2.174/2017',
    ],
    operatingRules: [
      'Equipe de perfusão obrigatória com certificação específica presente durante CEC',
      'Reserva de hemocomponentes confirmada antes da indução anestésica',
      'Time Out ampliado com perfusionista, cirurgião, anestesista e enfermeiro',
    ],
    coordinator: 'Dr. André Vasconcelos',
  },
  {
    id: 'centro-cirurgico-sala-04',
    name: 'Centro Cirúrgico - Sala 4 (Neurocirurgia)',
    type: 'centro-cirurgico',
    location: { building: 'Bloco A', floor: 2, sector: 'Centro Cirúrgico' },
    capacity: 1,
    occupied: 0,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'protetor',
    specialties: ['neurocirurgia', 'anestesiologia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist de Cirurgia Segura OMS',
      'Checklist de neuronavegação e microscópio',
    ],
    requiredEquipment: [
      'microscopio-cirurgico',
      'neuronavegador',
      'craniotomo',
      'mesa-cirurgica-neuro',
      'monitor-pic',
    ],
    regulatoryBasis: ['ANVISA RDC 50/2002'],
    operatingRules: [
      'Ressonância/TC pré-operatória disponível em sala para planejamento neurocirúrgico',
      'Monitorização neurofisiológica intraoperatória em casos selecionados',
      'Controle rigoroso de temperatura corporal e pressão intracraniana',
    ],
    coordinator: 'Dra. Clarissa Andrade',
  },

  // ============================================================
  // Centro Obstétrico e Maternidade
  // ============================================================
  {
    id: 'centro-obstetrico-01',
    name: 'Centro Obstétrico',
    type: 'centro-obstetrico',
    location: { building: 'Bloco B', floor: 2, sector: 'Materno-Infantil' },
    capacity: 6,
    occupied: 3,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'protetor',
    specialties: ['obstetricia', 'anestesiologia', 'neonatologia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist de parto seguro OMS',
      'Protocolo de hemorragia pós-parto',
      'Checklist de cesariana',
    ],
    requiredEquipment: [
      'cama-pph',
      'cardiotocografo',
      'mesa-reanimacao-neonatal',
      'foco-cirurgico',
      'aspirador-cirurgico',
    ],
    regulatoryBasis: [
      'ANVISA RDC 36/2008 (Serviços de Atenção Obstétrica e Neonatal)',
      'Lei 11.108/2005 (Acompanhante no parto)',
      'Rede Cegonha — Portaria MS 1.459/2011',
    ],
    operatingRules: [
      'Acompanhante de livre escolha garantido à parturiente durante trabalho de parto, parto e pós-parto',
      'Boas práticas de parto humanizado (liberdade de posição, sem enema/tricotomia de rotina)',
      'Contato pele a pele imediato e aleitamento na primeira hora (Golden Hour) quando possível',
      'Protocolo de hemorragia pós-parto com kit dedicado e treinamento da equipe',
      'Partograma atualizado em tempo real durante trabalho de parto',
    ],
    coordinator: 'Dra. Isabela Moura',
  },
  {
    id: 'maternidade-01',
    name: 'Maternidade / Alojamento Conjunto',
    type: 'maternidade',
    location: { building: 'Bloco B', floor: 3, sector: 'Materno-Infantil' },
    capacity: 24,
    occupied: 18,
    operatingHours: '24h',
    criticality: 'media',
    isolationLevel: 'nenhum',
    specialties: ['obstetricia', 'neonatologia', 'pediatria'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist de alta da puérpera',
      'Triagem neonatal (teste do pezinho, orelhinha, olhinho, coraçãozinho, linguinha)',
      'Orientação de aleitamento materno',
    ],
    requiredEquipment: [
      'berco-neonatal',
      'cama-obstetrica',
      'balanca-neonatal',
      'oximetro-neonatal',
    ],
    regulatoryBasis: [
      'ANVISA RDC 36/2008',
      'Lei 11.265/2006 (Aleitamento)',
      'Iniciativa Hospital Amigo da Criança (IHAC)',
    ],
    operatingRules: [
      'Alojamento conjunto mãe-bebê 24h obrigatório desde o nascimento',
      'Incentivo ao aleitamento materno exclusivo; proibido uso de chupetas e bicos artificiais (IHAC)',
      'Realização de todas as triagens neonatais antes da alta hospitalar',
      'Acompanhante permitido 24h conforme Lei 11.108/2005',
    ],
    coordinator: 'Enfa. Regina Capobianco',
  },

  // ============================================================
  // Pediatria, Oncologia, Psiquiatria, Reabilitação
  // ============================================================
  {
    id: 'pediatria-01',
    name: 'Enfermaria Pediátrica',
    type: 'pediatria',
    location: { building: 'Bloco B', floor: 4, sector: 'Pediatria' },
    capacity: 20,
    occupied: 14,
    operatingHours: '24h',
    criticality: 'media',
    isolationLevel: 'contato',
    specialties: ['pediatria'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Escala de dor pediátrica (FLACC/Faces)',
      'Checklist de dupla checagem pediátrica',
      'Avaliação de maus-tratos (notificação compulsória)',
    ],
    requiredEquipment: [
      'cama-pediatrica',
      'monitor-pediatrico',
      'bomba-infusao-seringa',
      'balanca-pediatrica',
    ],
    regulatoryBasis: ['ECA Lei 8.069/1990', 'ANVISA RDC 50/2002'],
    operatingRules: [
      'Presença de acompanhante 24h garantida por lei (ECA)',
      'Medicações pediátricas prescritas por peso com dupla checagem obrigatória antes da administração',
      'Espaço lúdico e brinquedoteca disponíveis (Lei 11.104/2005)',
      'Notificação compulsória de suspeita de maus-tratos ao Conselho Tutelar',
    ],
    coordinator: 'Enfa. Priscila Domingues',
  },
  {
    id: 'oncologia-01',
    name: 'Oncologia - Quimioterapia Ambulatorial',
    type: 'oncologia',
    location: { building: 'Bloco C', floor: 3, sector: 'Oncologia' },
    capacity: 16,
    occupied: 12,
    operatingHours: '07:00-19:00',
    criticality: 'alta',
    isolationLevel: 'protetor',
    specialties: ['oncologia-clinica', 'hematologia'],
    requiredRoles: ['medico', 'enfermeiro', 'farmaceutico', 'tecnico-enfermagem'],
    checklists: [
      'Dupla checagem de prescrição oncológica',
      'Conferência de manipulação em cabine de fluxo laminar',
      'Checklist de extravasamento de quimioterápico',
    ],
    requiredEquipment: [
      'cadeira-quimioterapia',
      'bomba-infusao',
      'cabine-fluxo-laminar',
      'kit-extravasamento',
    ],
    regulatoryBasis: [
      'ANVISA RDC 220/2004 (Terapia Antineoplásica)',
      'Portaria MS 874/2013 (Política Nacional de Oncologia)',
    ],
    operatingRules: [
      'Manipulação de quimioterápicos somente em cabine de segurança biológica classe II por farmacêutico habilitado',
      'Dupla checagem independente de prescrição, diluição e administração (conferência 4 olhos)',
      'Paramentação específica (luvas duplas, avental, máscara) para manuseio de antineoplásicos',
      'Kit de extravasamento disponível em cada sala e equipe treinada para uso imediato',
      'Descarte de resíduo quimioterápico como resíduo químico perigoso conforme RDC 222/2018',
    ],
    coordinator: 'Dra. Mariana Pacheco',
  },
  {
    id: 'psiquiatria-01',
    name: 'Enfermaria Psiquiátrica',
    type: 'psiquiatria',
    location: { building: 'Bloco D', floor: 2, sector: 'Saúde Mental' },
    capacity: 18,
    occupied: 13,
    operatingHours: '24h',
    criticality: 'alta',
    isolationLevel: 'nenhum',
    specialties: ['psiquiatria'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Avaliação de risco de suicídio/auto-agressão em todos os turnos',
      'Checklist de pertences e objetos potencialmente lesivos',
      'Protocolo de contenção mecânica/química',
    ],
    requiredEquipment: [
      'cama-hospitalar-antisuicidio',
      'monitor-multiparametrico',
    ],
    regulatoryBasis: [
      'Lei 10.216/2001 (Reforma Psiquiátrica)',
      'Portaria MS 3.088/2011 (RAPS)',
      'Resolução CFM 1.598/2000 (Contenção)',
    ],
    operatingRules: [
      'Internação voluntária, involuntária ou compulsória documentada nos termos da Lei 10.216/2001',
      'Ambiente livre de objetos contundentes, cintos, cadarços e materiais de risco',
      'Contenção mecânica somente com prescrição médica, reavaliação a cada 30 minutos e registro',
      'Equipe multidisciplinar obrigatória (psiquiatra, psicólogo, enfermeiro, assistente social, TO)',
      'Visitas monitoradas em horários estabelecidos com triagem de pertences',
    ],
    coordinator: 'Dr. Gustavo Lemos',
  },
  {
    id: 'reabilitacao-01',
    name: 'Centro de Reabilitação / Fisioterapia',
    type: 'reabilitacao',
    location: { building: 'Bloco D', floor: 1, sector: 'Reabilitação' },
    capacity: 30,
    occupied: 22,
    operatingHours: '07:00-19:00',
    criticality: 'baixa',
    isolationLevel: 'nenhum',
    specialties: ['fisiatria', 'ortopedia', 'neurologia'],
    requiredRoles: ['fisioterapeuta', 'enfermeiro', 'medico'],
    checklists: [
      'Avaliação funcional inicial e plano de tratamento',
      'Checklist de higienização de equipamentos entre pacientes',
    ],
    requiredEquipment: [
      'esteira-ergometrica',
      'bicicleta-ergometrica',
      'tens-fes',
      'ultrassom-terapeutico',
      'paralela-marcha',
    ],
    regulatoryBasis: [
      'ANVISA RDC 50/2002',
      'Resolução COFFITO 424/2013',
    ],
    operatingRules: [
      'Plano terapêutico individualizado reavaliado a cada 10 sessões',
      'Higienização de equipamentos e macas entre cada paciente',
      'Registro de evolução em prontuário após cada atendimento',
      'Atendimento com tempo mínimo de 30 minutos por sessão individual',
    ],
    coordinator: 'Ft. Rodrigo Teixeira',
  },

  // ============================================================
  // Diagnóstico e Terapia
  // ============================================================
  {
    id: 'hemodialise-01',
    name: 'Unidade de Hemodiálise',
    type: 'hemodialise',
    location: { building: 'Bloco C', floor: 1, sector: 'Terapia Renal' },
    capacity: 20,
    occupied: 18,
    operatingHours: '06:00-22:00',
    criticality: 'alta',
    isolationLevel: 'contato',
    specialties: ['nefrologia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist pré-sessão (peso, PA, acesso vascular)',
      'Protocolo de desinfecção de máquinas entre sessões',
      'Controle de qualidade da água de diálise',
    ],
    requiredEquipment: [
      'maquina-hemodialise',
      'sistema-tratamento-agua',
      'balanca-pre-pos',
      'monitor-multiparametrico',
    ],
    regulatoryBasis: [
      'ANVISA RDC 11/2014 (Serviços de Diálise)',
      'Portaria MS 389/2014',
    ],
    operatingRules: [
      'Pacientes seguem agenda fixa (geralmente 3x/semana) com sessões de 3-4 horas',
      'Máquina de diálise e linhas devem passar por desinfecção completa entre cada sessão',
      'Controle microbiológico e químico mensal da água tratada conforme RDC 11/2014',
      'Sorologia (HBV, HCV, HIV) atualizada a cada 6 meses para todos os pacientes em programa',
      'Isolamento de máquinas dedicadas para pacientes HBV positivos',
    ],
    coordinator: 'Dra. Letícia Monteiro',
  },
  {
    id: 'hemodinamica-01',
    name: 'Hemodinâmica / Sala de Cateterismo',
    type: 'hemodinamica',
    location: { building: 'Bloco A', floor: 1, sector: 'Hemodinâmica' },
    capacity: 2,
    occupied: 1,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'protetor',
    specialties: ['cardiologia', 'hemodinamica', 'radiologia-intervencionista'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist pré-procedimento intervencionista',
      'Checklist de materiais e stents',
      'Controle de dose de radiação por paciente',
    ],
    requiredEquipment: [
      'arco-hemodinamica',
      'injetora-contraste',
      'monitor-multiparametrico',
      'desfibrilador',
      'bomba-balao-intra-aortico',
    ],
    regulatoryBasis: [
      'ANVISA RDC 50/2002',
      'CNEN NN-3.01 (Proteção Radiológica)',
      'Portaria MS 453/1998',
    ],
    operatingRules: [
      'Uso obrigatório de EPI plumbífero e dosímetro individual para toda equipe',
      'Registro de dose de radiação recebida pelo paciente em todo procedimento',
      'Rastreabilidade de stents e dispositivos implantados por número de lote',
      'Sala em prontidão 24h para protocolo porta-balão em IAM com supra',
    ],
    coordinator: 'Dr. Henrique Morais',
  },
  {
    id: 'endoscopia-01',
    name: 'Endoscopia e Colonoscopia',
    type: 'endoscopia',
    location: { building: 'Bloco C', floor: 2, sector: 'Diagnóstico' },
    capacity: 4,
    occupied: 2,
    operatingHours: '07:00-19:00',
    criticality: 'media',
    isolationLevel: 'protetor',
    specialties: ['gastroenterologia', 'anestesiologia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist pré-procedimento endoscópico',
      'Protocolo de reprocessamento de endoscópios',
      'Checklist de sedação consciente',
    ],
    requiredEquipment: [
      'video-endoscopio',
      'colonoscopio',
      'lavadora-endoscopios',
      'monitor-multiparametrico',
      'carro-sedacao',
    ],
    regulatoryBasis: [
      'ANVISA RDC 6/2013 (Reprocessamento de produtos para saúde)',
      'ANVISA RDC 15/2012 (Processamento)',
      'ANVISA RDC 50/2002',
    ],
    operatingRules: [
      'Reprocessamento de endoscópios em lavadora automatizada com rastreabilidade por ciclo',
      'Jejum mínimo de 8 horas obrigatório e confirmado antes do procedimento',
      'Monitorização contínua durante sedação com capnografia quando indicada',
      'Testes de vazamento (leak test) obrigatórios antes e após reprocessamento',
    ],
    coordinator: 'Dra. Tatiane Alves',
  },
  {
    id: 'radiologia-01',
    name: 'Radiologia e Diagnóstico por Imagem',
    type: 'radiologia',
    location: { building: 'Bloco A', floor: 1, sector: 'Imagem' },
    capacity: 8,
    occupied: 5,
    operatingHours: '24h',
    criticality: 'alta',
    isolationLevel: 'protetor',
    specialties: ['radiologia', 'radiologia-intervencionista'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist de segurança em RM (metal, marca-passo, implantes)',
      'Conferência de gestação antes de exame com radiação',
      'Checklist de contraste iodado/gadolínio e função renal',
    ],
    requiredEquipment: [
      'tomografo',
      'ressonancia-magnetica',
      'raio-x-fixo',
      'raio-x-portatil',
      'ultrassom',
      'mamografo',
    ],
    regulatoryBasis: [
      'Portaria MS 453/1998 (Proteção Radiológica)',
      'CNEN NN-3.01',
      'ANVISA RDC 330/2019 (Radiodiagnóstico)',
    ],
    operatingRules: [
      'Princípio ALARA (As Low As Reasonably Achievable) na prescrição e execução de exames com radiação',
      'Questionário de segurança em RM obrigatório (marca-passo, clipes, implantes metálicos)',
      'Avaliação de função renal (creatinina) antes de administrar contraste iodado',
      'Controle de qualidade periódico dos equipamentos com laudo de física médica',
      'Área controlada com sinalização e limite de acesso durante exames radiológicos',
    ],
    coordinator: 'Dr. Paulo Ramiro',
  },
  {
    id: 'laboratorio-central-01',
    name: 'Laboratório de Análises Clínicas',
    type: 'laboratorio',
    location: { building: 'Bloco A', floor: 0, sector: 'Apoio Diagnóstico' },
    capacity: 0,
    operatingHours: '24h',
    criticality: 'alta',
    isolationLevel: 'protetor',
    specialties: ['patologia-clinica'],
    requiredRoles: ['enfermeiro', 'tecnico-enfermagem', 'farmaceutico'],
    checklists: [
      'Controle de qualidade interno diário por bancada',
      'Checklist de cadeia de custódia pré-analítica',
      'Protocolo de valores críticos (comunicação imediata)',
    ],
    requiredEquipment: [
      'analisador-bioquimica',
      'analisador-hematologia',
      'analisador-gasometria',
      'centrifuga',
      'microscopio',
      'capela-biosseguranca',
    ],
    regulatoryBasis: [
      'ANVISA RDC 302/2005 (Laboratórios Clínicos)',
      'PALC/SBPC (Programa de Acreditação)',
      'ANVISA RDC 50/2002',
    ],
    operatingRules: [
      'Controle de qualidade interno em todas as bancadas a cada turno, com registro em sistema',
      'Valores críticos comunicados imediatamente ao médico assistente com registro do receptor',
      'Cadeia de custódia da amostra desde a coleta até o descarte com rastreabilidade',
      'Tempo de liberação (TAT) monitorado por indicador para exames de urgência',
      'Descarte de resíduos biológicos conforme PGRSS e RDC 222/2018',
    ],
    coordinator: 'Dra. Cristiane Arruda',
  },

  // ============================================================
  // Farmácia, Banco de Sangue, CME
  // ============================================================
  {
    id: 'farmacia-central-01',
    name: 'Farmácia Central Hospitalar',
    type: 'farmacia',
    location: { building: 'Bloco A', floor: 0, sector: 'Farmácia' },
    capacity: 0,
    operatingHours: '24h',
    criticality: 'alta',
    isolationLevel: 'nenhum',
    specialties: ['farmacia-hospitalar'],
    requiredRoles: ['farmaceutico', 'tecnico-enfermagem'],
    checklists: [
      'Dupla checagem de medicamentos de alta vigilância',
      'Conferência diária de medicamentos controlados (Portaria 344)',
      'Controle de temperatura de geladeiras (termolábeis)',
    ],
    requiredEquipment: [
      'armario-controlados',
      'geladeira-termolabeis',
      'cabine-fluxo-laminar',
      'carro-dispensacao',
    ],
    regulatoryBasis: [
      'Portaria SVS 344/1998 (Substâncias Controladas)',
      'ANVISA RDC 44/2009 (Farmácias)',
      'Lei 13.021/2014',
    ],
    operatingRules: [
      'Medicamentos controlados (Portaria 344) armazenados em armário com chave e balanço diário',
      'Dose unitária individualizada por paciente como padrão de dispensação',
      'Revisão farmacêutica da prescrição antes da dispensação (farmacovigilância ativa)',
      'Controle de temperatura de geladeiras com registro contínuo e alerta para desvios',
      'Medicamentos de alta vigilância (insulina, heparina, cloreto de potássio) com rotulagem diferenciada',
    ],
    coordinator: 'Dra. Fernanda Koscheck',
  },
  {
    id: 'banco-sangue-01',
    name: 'Agência Transfusional / Banco de Sangue',
    type: 'banco-sangue',
    location: { building: 'Bloco A', floor: 0, sector: 'Hemoterapia' },
    capacity: 0,
    operatingHours: '24h',
    criticality: 'critica',
    isolationLevel: 'protetor',
    specialties: ['hematologia', 'hemoterapia'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist pré-transfusional (identificação, grupo ABO, Rh)',
      'Prova cruzada obrigatória antes de liberação de concentrado',
      'Checklist de reação transfusional',
    ],
    requiredEquipment: [
      'geladeira-hemoterapia',
      'freezer-plasma',
      'agitador-plaquetas',
      'centrifuga-refrigerada',
      'kit-prova-cruzada',
    ],
    regulatoryBasis: [
      'ANVISA RDC 34/2014 (Ciclo do Sangue)',
      'Portaria MS 158/2016',
      'Lei 10.205/2001',
    ],
    operatingRules: [
      'Compatibilidade ABO/Rh e prova cruzada obrigatórias antes de toda liberação de hemocomponente',
      'Dupla checagem à beira do leito antes de iniciar transfusão (identificação positiva do receptor)',
      'Monitorização do paciente nos primeiros 15 minutos da transfusão para detecção de reação',
      'Rastreabilidade completa doador-receptor por número de bolsa e lote',
      'Temperatura de armazenamento monitorada 24h (hemácias 2-6°C, plasma <-20°C)',
    ],
    coordinator: 'Dra. Silvana Petrucci',
  },
  {
    id: 'cme-01',
    name: 'Central de Material e Esterilização (CME)',
    type: 'cme',
    location: { building: 'Bloco A', floor: 1, sector: 'CME' },
    capacity: 0,
    operatingHours: '24h',
    criticality: 'alta',
    isolationLevel: 'protetor',
    specialties: [],
    requiredRoles: ['enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Teste Bowie-Dick diário em autoclaves',
      'Controle biológico semanal por autoclave',
      'Rastreabilidade de ciclo por lote e instrumental',
    ],
    requiredEquipment: [
      'autoclave-vapor',
      'autoclave-peroxido',
      'lavadora-ultrassonica',
      'termo-seladora',
      'secadora-instrumentais',
    ],
    regulatoryBasis: [
      'ANVISA RDC 15/2012 (Processamento de Produtos para Saúde)',
      'ANVISA RDC 50/2002',
    ],
    operatingRules: [
      'Fluxo unidirecional sujo → limpo → esterilizado sem cruzamento de áreas',
      'Teste Bowie-Dick diário e controle biológico semanal de cada autoclave com registro',
      'Rastreabilidade completa de cada instrumental por ciclo e lote de esterilização',
      'Validação de processos (limpeza, desinfecção, esterilização) com laudos técnicos',
      'Área de recepção de materiais sujos fisicamente separada da área de preparo e estéril',
    ],
    coordinator: 'Enfa. Marta Figueiredo',
  },

  // ============================================================
  // Radioterapia
  // ============================================================
  {
    id: 'radioterapia-01',
    name: 'Radioterapia',
    type: 'oncologia-radioterapia',
    location: { building: 'Bloco C', floor: -1, sector: 'Radioterapia' },
    capacity: 2,
    occupied: 1,
    operatingHours: '07:00-19:00',
    criticality: 'alta',
    isolationLevel: 'protetor',
    specialties: ['radioterapia', 'oncologia-clinica'],
    requiredRoles: ['medico', 'enfermeiro', 'tecnico-enfermagem'],
    checklists: [
      'Checklist diário de controle de qualidade do acelerador linear',
      'Conferência de plano de tratamento por física médica',
      'Checklist de posicionamento e imobilização do paciente',
    ],
    requiredEquipment: [
      'acelerador-linear',
      'tomografo-simulador',
      'sistema-planejamento-rt',
      'mascaras-imobilizacao',
    ],
    regulatoryBasis: [
      'CNEN NN-3.06 (Radioterapia)',
      'Portaria MS 453/1998',
      'ANVISA RDC 20/2006',
    ],
    operatingRules: [
      'Plano terapêutico aprovado por radio-oncologista e físico médico antes da primeira aplicação',
      'Controle de qualidade diário/mensal/anual do acelerador linear conforme CNEN NN-3.06',
      'Bunker blindado com intertravamento de porta e sinalização luminosa de feixe ligado',
      'Conferência diária de identificação do paciente e dose prescrita antes de cada sessão',
      'Dosimetria individual de toda equipe com leitura mensal',
    ],
    coordinator: 'Dr. Alberto Fontenelle',
  },
];

// ============================================================
// Helpers
// ============================================================

export function getWardById(id: string): HospitalWard | undefined {
  return HOSPITAL_WARDS.find((w) => w.id === id);
}

export function getWardsByType(type: WardType): HospitalWard[] {
  return HOSPITAL_WARDS.filter((w) => w.type === type);
}

export const WARD_TYPE_LABELS: Record<WardType, string> = {
  'pronto-socorro': 'Pronto-Socorro',
  ambulatorio: 'Ambulatório',
  'internacao-clinica': 'Internação Clínica',
  'internacao-cirurgica': 'Internação Cirúrgica',
  'uti-adulto': 'UTI Adulto',
  'uti-pediatrica': 'UTI Pediátrica',
  'uti-neonatal': 'UTI Neonatal',
  'uti-coronariana': 'UTI Coronariana',
  'uti-queimados': 'UTI de Queimados',
  'centro-cirurgico': 'Centro Cirúrgico',
  'centro-obstetrico': 'Centro Obstétrico',
  maternidade: 'Maternidade',
  pediatria: 'Pediatria',
  oncologia: 'Oncologia',
  hemodialise: 'Hemodiálise',
  hemodinamica: 'Hemodinâmica',
  endoscopia: 'Endoscopia',
  radiologia: 'Radiologia e Imagem',
  laboratorio: 'Laboratório de Análises Clínicas',
  farmacia: 'Farmácia Hospitalar',
  'banco-sangue': 'Banco de Sangue / Agência Transfusional',
  cme: 'Central de Material e Esterilização',
  nutricao: 'Serviço de Nutrição e Dietética',
  lavanderia: 'Lavanderia Hospitalar',
  higienizacao: 'Higienização e Limpeza',
  morgue: 'Necrotério',
  almoxarifado: 'Almoxarifado Central',
  'ti-data-center': 'TI / Data Center',
  'engenharia-clinica': 'Engenharia Clínica',
  'manutencao-predial': 'Manutenção Predial',
  recepcao: 'Recepção',
  faturamento: 'Faturamento',
  rh: 'Recursos Humanos',
  reabilitacao: 'Reabilitação / Fisioterapia',
  psiquiatria: 'Psiquiatria',
  'oncologia-radioterapia': 'Radioterapia',
};

export function getOccupancyRate(ward: HospitalWard): number {
  if (!ward.occupied || !ward.capacity) return 0;
  return Math.round((ward.occupied / ward.capacity) * 100);
}
