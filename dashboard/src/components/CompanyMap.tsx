import { useSquadStore } from "@/store/useSquadStore";
import { OfficeSection } from "./OfficeSection";
import { ActiveAlaPanel } from "./ActiveAlaPanel";
import { WorkingNowPanel } from "./WorkingNowPanel";
import { deriveAgentStatuses } from "@/lib/deriveAgentStatus";
import { OperationsPulsePanel } from "./OperationsPulsePanel";
import { ContextRoutingPanel } from "./ContextRoutingPanel";

export function CompanyMap() {
  const company = useSquadStore((s) => s.company);
  const activeStates = useSquadStore((s) => s.activeStates);
  const searchTerm = useSquadStore((s) => s.searchTerm);
  const setSearchTerm = useSquadStore((s) => s.setSearchTerm);
  const filterOfficeId = useSquadStore((s) => s.filterOfficeId);
  const setFilterOffice = useSquadStore((s) => s.setFilterOffice);
  const filterProduct = useSquadStore((s) => s.filterProduct);
  const setFilterProduct = useSquadStore((s) => s.setFilterProduct);
  const delegations = useSquadStore((s) => s.delegations);
  const handoffs = useSquadStore((s) => s.handoffs);

  if (!company) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-dim, #8a8a92)",
          fontSize: 13,
        }}
      >
        carregando estrutura da empresa…
      </div>
    );
  }

  const totalAgents = company.offices.reduce((sum, o) => sum + o.agents.length, 0);
  const totalOffices = company.offices.filter((o) => o.agents.length > 0).length;
  const knownAgentIds = new Set(
    company.offices.flatMap((office) => office.agents.map((agent) => agent.id)),
  );
  const derivedStatuses = deriveAgentStatuses(
    activeStates,
    delegations,
    knownAgentIds,
    handoffs,
  );
  const workingCount = Array.from(derivedStatuses.values()).filter((status) => status.status === "working").length;

  const productFiltered = filterProduct === "all"
    ? company.offices
    : filterProduct === "shared"
      ? company.offices.filter((o) => o.product === "shared")
      : company.offices.filter((o) => o.product === filterProduct || o.product === "shared");

  const filteredOffices = filterOfficeId
    ? productFiltered.filter((o) => o.id === filterOfficeId)
    : productFiltered;

  const executive = filteredOffices.find((o) => o.hierarchy === "executive");
  const council = filteredOffices.find((o) => o.hierarchy === "council");
  const offices = filteredOffices.filter((o) => o.hierarchy === "office");
  const alas = filteredOffices.filter((o) => o.hierarchy === "squad-ala");

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: "16px 20px 80px",
        background: "var(--bg, #0a0a0e)",
        backgroundImage:
          "radial-gradient(circle at 50% 0%, #16161e 0%, #0a0a0e 70%)",
      }}
    >
      <header
        style={{
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "1px solid var(--border, #2a2a30)",
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "var(--fg, #e5e5ea)",
            letterSpacing: 0.3,
          }}
        >
          Operação ao Vivo · Empresa Multi-Produto
        </h1>
        <span style={{ fontSize: 11, color: "var(--fg-dim, #8a8a92)" }}>
          {totalAgents} agentes especialistas · {totalOffices} núcleos · produtos: Velya Hospitalar + Lince SOC · status ao vivo via ledger + state.json + handoffs contextuais
        </span>
        {workingCount > 0 && (
          <span
            style={{
              fontSize: 11,
              color: "#22c55e",
              marginLeft: "auto",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 8px #22c55e",
                animation: "pulse 1.4s infinite",
              }}
            />
            {workingCount} trabalhando agora
          </span>
        )}
      </header>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        {([
          { id: "all", label: "Todos os produtos", color: "#8a8a92" },
          { id: "hospitalar", label: "Velya Hospitalar", color: "#0ea5e9" },
          { id: "lince", label: "Lince SOC", color: "#ef4444" },
          { id: "shared", label: "Compartilhado", color: "#64748b" },
        ] as const).map((b) => {
          const active = filterProduct === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setFilterProduct(b.id)}
              style={{
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.4,
                background: active ? `${b.color}22` : "transparent",
                color: active ? b.color : "var(--fg-dim, #8a8a92)",
                border: `1px solid ${active ? b.color : "var(--border, #2a2a30)"}`,
                borderRadius: 6,
                cursor: "pointer",
                transition: "all 140ms",
              }}
            >
              {b.label}
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar funcionário, cargo ou descrição…"
          style={{
            flex: 1,
            minWidth: 220,
            padding: "8px 12px",
            fontSize: 12,
            background: "var(--bg-panel, #141418)",
            border: "1px solid var(--border, #2a2a30)",
            borderRadius: 6,
            color: "var(--fg, #e5e5ea)",
            outline: "none",
          }}
        />
        <select
          value={filterOfficeId ?? ""}
          onChange={(e) => setFilterOffice(e.target.value || null)}
          style={{
            padding: "8px 12px",
            fontSize: 12,
            background: "var(--bg-panel, #141418)",
            border: "1px solid var(--border, #2a2a30)",
            borderRadius: 6,
            color: "var(--fg, #e5e5ea)",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="">Todos os núcleos</option>
          {company.offices
            .filter((o) => o.agents.length > 0)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.agents.length})
              </option>
            ))}
        </select>
        {(searchTerm || filterOfficeId) && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setFilterOffice(null);
            }}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              background: "transparent",
              border: "1px solid var(--border, #2a2a30)",
              borderRadius: 6,
              color: "var(--fg-dim, #8a8a92)",
              cursor: "pointer",
            }}
          >
            limpar
          </button>
        )}
      </div>

      <OperationsPulsePanel />
      <ContextRoutingPanel />
      <WorkingNowPanel />
      <ActiveAlaPanel />

      {executive && executive.agents.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <OfficeSection office={executive} liveStates={activeStates} />
        </div>
      )}

      {council && council.agents.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <OfficeSection office={council} liveStates={activeStates} />
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        {offices.map((office) => (
          <OfficeSection key={office.id} office={office} liveStates={activeStates} />
        ))}
      </div>

      {alas.length > 0 && (
        <div>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--fg-dim, #8a8a92)",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              margin: "0 0 8px 4px",
            }}
          >
            Alas Operacionais
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 12,
            }}
          >
            {alas.map((office) => (
              <OfficeSection key={office.id} office={office} liveStates={activeStates} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
