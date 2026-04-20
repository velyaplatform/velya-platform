// Gerador automático de persona pt-BR para agents que não têm mapping manual.
// Invocado pelo companyLoader — entrega nome/cargo/descrição prontos para a UI.

const POOL_MASCULINE = [
  "Aurélio",
  "Breno",
  "Caio",
  "Davi",
  "Enzo",
  "Fernando",
  "Gabriel",
  "Heitor",
  "Ivan",
  "Joaquim",
  "Kauã",
  "Lorenzo",
  "Miguel",
  "Nicolas",
  "Osvaldo",
  "Pietro",
  "Quirino",
  "Raul",
  "Samuel",
  "Theo",
  "Adriano",
  "Bernardo",
  "César",
  "Danilo",
  "Erick",
  "Fabrício",
  "Guilherme",
  "Hugo",
  "Ítalo",
  "Jonas",
  "Leandro",
  "Murilo",
  "Noel",
  "Otávio",
  "Paulo",
  "Ruan",
  "Saulo",
  "Tomás",
  "Vítor",
  "Yuri",
] as const;

const POOL_FEMININE = [
  "Aline",
  "Bruna",
  "Carla",
  "Dandara",
  "Elisa",
  "Flávia",
  "Giulia",
  "Heloísa",
  "Iara",
  "Júlia",
  "Kaylane",
  "Laura",
  "Maitê",
  "Nina",
  "Olívia",
  "Pietra",
  "Raíssa",
  "Sofia",
  "Talita",
  "Valentina",
  "Amanda",
  "Bianca",
  "Camila",
  "Débora",
  "Eduarda",
  "Fernanda",
  "Gabriela",
  "Helena",
  "Isadora",
  "Joana",
  "Lívia",
  "Manuela",
  "Natália",
  "Priscila",
  "Renata",
  "Tainá",
  "Verônica",
  "Yasmin",
  "Zuleica",
] as const;

const PRIMARY_SURNAMES = [
  "Almeida",
  "Andrade",
  "Barreto",
  "Bastos",
  "Batista",
  "Borges",
  "Campos",
  "Carvalho",
  "Castro",
  "Cavalcanti",
  "Cunha",
  "Dias",
  "Diniz",
  "Duarte",
  "Ferreira",
  "Figueiredo",
  "Freitas",
  "Gonçalves",
  "Leal",
  "Lima",
  "Maciel",
  "Machado",
  "Mendes",
  "Moraes",
  "Nascimento",
  "Nery",
  "Oliveira",
  "Pereira",
  "Prado",
  "Queiroz",
  "Ramalho",
  "Rezende",
  "Rocha",
  "Sampaio",
  "Silva",
  "Soares",
  "Souza",
  "Teles",
  "Torres",
  "Vieira",
] as const;

const SECONDARY_SURNAMES = [
  "Aragão",
  "Azevedo",
  "Barbosa",
  "Barroso",
  "Bezerra",
  "Botelho",
  "Bragança",
  "Caldas",
  "Cerqueira",
  "Cordeiro",
  "Costa",
  "Delgado",
  "Espíndola",
  "Ferraz",
  "Fontoura",
  "Frota",
  "Guimarães",
  "Lacerda",
  "Marinho",
  "Meireles",
  "Mendonça",
  "Montenegro",
  "Nogueira",
  "Parente",
  "Peixoto",
  "Pimentel",
  "Prates",
  "Quintela",
  "Rangel",
  "Ribeiro",
  "Siqueira",
  "Tavares",
  "Teixeira",
  "Valverde",
  "Vasconcelos",
  "Viana",
  "Villela",
  "Xavier",
  "Uchôa",
] as const;

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function inferGenderFromName(name: string): "m" | "f" {
  const lower = name.toLowerCase();
  // heurística: terminações femininas comuns em pt-BR
  if (
    /a$/.test(lower) ||
    /(ana|ela|ina|ila|ora|ssa|ice|ide|lie|ela|ssa)$/.test(lower) ||
    /(mariana|juliana|mariel|luiza|ânia)/.test(lower)
  ) {
    return "f";
  }
  return "m";
}

function titleCase(s: string): string {
  return s
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Dicionário pt-BR para termos recorrentes em cargos/descrições de agents
const ROLE_GLOSSARY: Array<[RegExp, string]> = [
  [/agent$/i, ""],
  [/\breviewer\b/gi, "Revisor"],
  [/\bauditor\b/gi, "Auditor"],
  [/\banalyst\b/gi, "Analista"],
  [/\bmanager\b/gi, "Gerente"],
  [/\bcoordinator\b/gi, "Coordenador"],
  [/\bsupervisor\b/gi, "Supervisor"],
  [/\barchitect\b/gi, "Arquiteto"],
  [/\bdesigner\b/gi, "Designer"],
  [/\bhunter\b/gi, "Caçador"],
  [/\bscanner\b/gi, "Vigilante"],
  [/\bwriter\b/gi, "Redator"],
  [/\boperator\b/gi, "Operador"],
  [/\bhealer\b/gi, "Operador"],
  [/\btroubleshooter\b/gi, "Especialista"],
  [/\bplanner\b/gi, "Planejador"],
  [/\bbreaker\b/gi, "Quebrador"],
  [/\bfailure\b/gi, "Falha"],
  [/\btriage\b/gi, "Triagem"],
  [/\bhealth\b/gi, "Saúde"],
  [/\bsafety\b/gi, "Segurança"],
  [/\bsecurity\b/gi, "Segurança"],
  [/\bgap\b/gi, "Lacuna"],
  [/\binjection\b/gi, "Injeção"],
  [/\bprivacy\b/gi, "Privacidade"],
  [/\bleak\b/gi, "Vazamento"],
  [/\bgovernance\b/gi, "Governança"],
  [/\bcompliance\b/gi, "Conformidade"],
  [/\bquality\b/gi, "Qualidade"],
  [/\bruntime\b/gi, "Execução"],
  [/\bci\b/gi, "CI"],
  [/\brepo settings\b/gi, "Configurações do Repositório"],
  [/\bblind spot\b/gi, "Ponto Cego"],
  [/\badversarial\b/gi, "Adversarial"],
  [/\bchaos\b/gi, "Caos"],
  [/\bcost\b/gi, "Custo"],
  [/\bexplosion\b/gi, "Explosão"],
  [/\bmarket\b/gi, "Mercado"],
  [/\bintelligence\b/gi, "Inteligência"],
  [/\bmarketing\b/gi, "Marketing"],
  [/\bcopy\b/gi, "Redação"],
  [/\bdelegation\b/gi, "Delegação"],
  [/\bnaming\b/gi, "Nomenclatura"],
  [/\bpin rot\b/gi, "Controle de Pins"],
  [/\bbootstrap\b/gi, "Inicialização"],
  [/\bdrift\b/gi, "Desvio"],
  [/\bclinical\b/gi, "Clínico"],
  [/\bcouncil\b/gi, "Conselho"],
  [/\bobservability\b/gi, "Observabilidade"],
  [/\bdomain model\b/gi, "Modelo de Domínio"],
  [/\bfinops\b/gi, "Financeiro"],
  [/\biam\b/gi, "Identidade"],
  [/\bplatform\b/gi, "Plataforma"],
  [/\bservice\b/gi, "Serviço"],
  [/\bapi\b/gi, "API"],
  [/\bui\b/gi, "Interface"],
  [/\baudit\b/gi, "Auditoria"],
  [/\badr\b/gi, "ADR"],
  [/\binfra\b/gi, "Infraestrutura"],
  [/\bred team\b/gi, "Time Adversarial"],
  [/\bproduction readiness\b/gi, "Prontidão para Produção"],
  [/\bgit ?ops\b/gi, "GitOps"],
  [/\beks\b/gi, "EKS"],
  [/\bk8s\b/gi, "Kubernetes"],
  [/\bargocd\b/gi, "ArgoCD"],
  [/\bai platform\b/gi, "Plataforma de IA"],
  [/\bmeta[- ]?governance\b/gi, "Meta-Governança"],
  [/\bbackend\b/gi, "Backend"],
  [/\bfrontend\b/gi, "Frontend"],
  [/\btest\b/gi, "Teste"],
  [/\bgate\b/gi, "Portão"],
  [/\bperformance\b/gi, "Desempenho"],
  [/\bregression\b/gi, "Regressão"],
  [/\blatency\b/gi, "Latência"],
  [/\bmonitor(ing)?\b/gi, "Monitoramento"],
  [/\bdeploy(ment)?\b/gi, "Deploy"],
  [/\brelease\b/gi, "Release"],
  [/\bincident\b/gi, "Incidente"],
  [/\bresponse\b/gi, "Resposta"],
  [/\bdrift\b/gi, "Desvio"],
  [/\bhealth\b/gi, "Saúde"],
  [/\btriager?\b/gi, "Triador"],
  [/\bspecialist\b/gi, "Especialista"],
  [/\bgovernor\b/gi, "Guardião"],
  [/\bguardian\b/gi, "Guardião"],
];

export function translateRole(englishName: string): string {
  let out = englishName;
  for (const [rx, sub] of ROLE_GLOSSARY) {
    out = out.replace(rx, sub);
  }
  const cleaned = titleCase(out.replace(/\s+/g, " ").trim());
  if (!cleaned) return "Especialista";
  // Se contém "Especialista" (ex: "Grafana Especialista"), transforma em "Especialista em <resto>"
  if (/\bEspecialista\b/.test(cleaned)) {
    const domain = cleaned.replace(/\bEspecialista\b/g, "").replace(/\s+/g, " ").trim();
    return domain ? `Especialista em ${domain}` : "Especialista";
  }
  // Se já começa com um cargo óbvio (Gerente, Analista, Revisor, etc.), manter.
  if (/^(Gerente|Analista|Revisor|Auditor|Coordenador|Supervisor|Arquiteto|Designer|Redator|Operador|Caçador|Planejador|Guardião|Triador|Monitor)/.test(cleaned)) {
    return cleaned;
  }
  return `Especialista em ${cleaned}`;
}

export function detectLeadership(
  role: string,
  id: string,
): "ceo" | "conselheiro" | "gerente" | "coordenador" | "supervisor" | null {
  if (id === "executive/ceo") return "ceo";
  const lower = role.toLowerCase();
  if (/(conselh|council)/.test(lower)) return "conselheiro";
  if (/\bgerente\b|\bmanager\b/.test(lower)) return "gerente";
  if (/\bcoordenad|\bcoordinator\b/.test(lower)) return "coordenador";
  if (/\bsupervisor\b/.test(lower)) return "supervisor";
  return null;
}

export interface AutoPersona {
  firstName: string;
  lastName: string;
  role: string;
  gender: "m" | "f";
  descriptionPtBr: string;
  leadership: "ceo" | "conselheiro" | "gerente" | "coordenador" | "supervisor" | null;
}

export function autoPersonaFor(params: {
  id: string;
  englishName: string;
  englishDescription: string;
}): AutoPersona {
  const { id, englishName, englishDescription } = params;
  const role = translateRole(englishName || id);
  const gender = inferGenderFromName(id) as "m" | "f";
  const firstPool = gender === "m" ? POOL_MASCULINE : POOL_FEMININE;
  const firstName = firstPool[hashString(`${id}:first`) % firstPool.length];
  const primarySurname =
    PRIMARY_SURNAMES[hashString(`${id}:primary-surname`) % PRIMARY_SURNAMES.length];
  const secondarySurname =
    SECONDARY_SURNAMES[hashString(`${id}:secondary-surname`) % SECONDARY_SURNAMES.length];
  let tertiarySurname =
    PRIMARY_SURNAMES[hashString(`${id}:tertiary-surname`) % PRIMARY_SURNAMES.length];
  if (tertiarySurname === primarySurname) {
    tertiarySurname =
      PRIMARY_SURNAMES[
        (hashString(`${id}:tertiary-surname`) + 11) % PRIMARY_SURNAMES.length
      ];
  }
  const lastName = `${primarySurname} ${secondarySurname} ${tertiarySurname}`;
  // Descrição curta derivada do campo em inglês (melhor que o original inglês quando o usuário lê).
  const descriptionPtBr =
    `Especialista da área: ${role}. Descrição original (em inglês para referência técnica): ${englishDescription}`;
  return {
    firstName,
    lastName,
    role,
    gender,
    descriptionPtBr,
    leadership: detectLeadership(role, id),
  };
}
