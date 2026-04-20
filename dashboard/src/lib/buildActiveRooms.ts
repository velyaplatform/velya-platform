import type { CompanyMapData, EngineeringAgent, Product } from "@/types/company";
import type {
  AgentStatus,
  SquadState,
  DelegationEntry,
  CoordinationHandoffEntry,
} from "@/types/state";
import { deriveAgentStatuses } from "./deriveAgentStatus";
import { personaForAgent, fullName } from "./agentPersona";

export interface RoomAgent {
  id: string;
  displayName: string;
  role: string;
  gender: "male" | "female";
  status: AgentStatus;
  task?: string;
  col: number;
  row: number;
}

export interface RoomData {
  id: string;
  name: string;
  product: Product;
  agents: RoomAgent[];
}

const MAX_COLS = 3;

/**
 * Agrupa agents atualmente ativos (working, checkpoint, delivering, done) por escritório
 * e devolve salas prontas pra renderização 2D. Usa tanto activeStates (opensquad) quanto
 * delegations (engenharia) como fontes de status.
 *
 * Se não houver nenhum agent ativo, retorna array vazio.
 */
export function buildActiveRooms(params: {
  company: CompanyMapData | null;
  activeStates: Map<string, SquadState>;
  delegations: DelegationEntry[];
  handoffs?: CoordinationHandoffEntry[];
}): RoomData[] {
  const { company, activeStates, delegations, handoffs } = params;
  if (!company) return [];

  const knownAgentIds = new Set(
    company.offices.flatMap((office) => office.agents.map((agent) => agent.id)),
  );
  const statuses = deriveAgentStatuses(
    activeStates,
    delegations,
    knownAgentIds,
    handoffs,
  );

  // Mapa id → agent + office para lookup
  const agentInfo = new Map<
    string,
    { agent: EngineeringAgent; officeId: string; officeName: string; product: Product }
  >();
  for (const office of company.offices) {
    for (const a of office.agents) {
      agentInfo.set(a.id, {
        agent: a,
        officeId: office.id,
        officeName: office.name,
        product: office.product,
      });
    }
  }

  // Agrupa por officeId
  const grouped = new Map<
    string,
    { officeId: string; officeName: string; product: Product; agents: RoomAgent[] }
  >();

  for (const [agentId, st] of statuses) {
    if (st.status === "idle") continue;
    // Procurar o agent no company data: pode vir como id direto (engineering) ou composto (squad/local)
    let info = agentInfo.get(agentId);
    if (!info && agentId.includes("/")) {
      info = agentInfo.get(agentId);
    }
    if (!info) continue;

    const persona = personaForAgent(info.agent.id, {
      displayName: info.agent.displayName,
      role: info.agent.role,
      descriptionPtBr: info.agent.descriptionPtBr,
      gender: info.agent.gender,
      leadership: info.agent.leadership ?? null,
    });

    const roomAgent: RoomAgent = {
      id: agentId,
      displayName: fullName(persona),
      role: persona.role,
      gender: persona.gender === "m" ? "male" : "female",
      status: st.status,
      task: st.currentTask,
      col: 0,
      row: 0,
    };

    const bucket = grouped.get(info.officeId) ?? {
      officeId: info.officeId,
      officeName: info.officeName,
      product: info.product,
      agents: [],
    };
    bucket.agents.push(roomAgent);
    grouped.set(info.officeId, bucket);
  }

  // Atribui col/row dentro de cada sala e constrói RoomData
  const rooms: RoomData[] = [];
  for (const bucket of grouped.values()) {
    bucket.agents.forEach((a, idx) => {
      a.col = (idx % MAX_COLS) + 1;
      a.row = Math.floor(idx / MAX_COLS) + 1;
    });
    rooms.push({
      id: bucket.officeId,
      name: bucket.officeName,
      product: bucket.product,
      agents: bucket.agents,
    });
  }

  // Ordena: executive > council > office (hospital, lince) > shared > squad-ala; com prioridade de produto
  const productOrder: Record<Product, number> = { hospitalar: 1, lince: 2, shared: 3 };
  rooms.sort((a, b) => {
    const p = productOrder[a.product] - productOrder[b.product];
    if (p !== 0) return p;
    return a.name.localeCompare(b.name);
  });

  return rooms;
}
