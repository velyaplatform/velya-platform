import { useDeferredValue, useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { avatarFor, blinkFrame } from "@/lib/avatarFor";
import {
  productColor,
  productLabel,
  type LiveAgentRow,
} from "@/lib/dashboardModel";
import { useDashboardModel } from "@/hooks/useDashboardModel";
import {
  useSquadStore,
  type ProductFilter,
} from "@/store/useSquadStore";

const STATUS_ORDER: Record<LiveAgentRow["status"], number> = {
  working: 0,
  delivering: 1,
  checkpoint: 2,
  done: 3,
  idle: 4,
};

const GRID_COLUMNS =
  "56px minmax(190px, 1.35fr) minmax(180px, 1.1fr) minmax(180px, 1fr) 120px 120px minmax(240px, 1.8fr) 108px";

const columnHelper = createColumnHelper<LiveAgentRow>();

function matchesProductFilter(agent: LiveAgentRow, filterProduct: ProductFilter): boolean {
  if (filterProduct === "all") return true;
  if (filterProduct === "shared") return agent.products.includes("shared");
  return agent.products.includes(filterProduct) || agent.products.includes("shared");
}

function matchesStatusFilter(
  agent: LiveAgentRow,
  statusFilter: "all" | "working" | "waiting" | "idle",
): boolean {
  if (statusFilter === "all") return true;
  if (statusFilter === "working") {
    return agent.status === "working" || agent.status === "delivering";
  }
  if (statusFilter === "waiting") return agent.status === "checkpoint";
  return agent.status === "idle";
}

export function AgentsView() {
  const { directory, agents, metrics } = useDashboardModel();
  const searchTerm = useSquadStore((state) => state.searchTerm);
  const setSearchTerm = useSquadStore((state) => state.setSearchTerm);
  const filterOfficeId = useSquadStore((state) => state.filterOfficeId);
  const setFilterOffice = useSquadStore((state) => state.setFilterOffice);
  const filterProduct = useSquadStore((state) => state.filterProduct);
  const setFilterProduct = useSquadStore((state) => state.setFilterProduct);
  const selectAgent = useSquadStore((state) => state.selectAgent);
  const deferredSearch = useDeferredValue(searchTerm.trim().toLowerCase());
  const [statusFilter, setStatusFilter] = useState<
    "all" | "working" | "waiting" | "idle"
  >("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "status", desc: false },
  ]);
  const parentRef = useRef<HTMLDivElement>(null);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesSearch =
        deferredSearch.length === 0 ||
        agent.displayName.toLowerCase().includes(deferredSearch) ||
        agent.primaryRole.title.toLowerCase().includes(deferredSearch) ||
        agent.primaryRole.nucleusName.toLowerCase().includes(deferredSearch) ||
        agent.roles.some((role) => role.title.toLowerCase().includes(deferredSearch));

      return (
        matchesSearch &&
        matchesProductFilter(agent, filterProduct) &&
        (!filterOfficeId ||
          agent.roles.some((role) => role.nucleusId === filterOfficeId)) &&
        matchesStatusFilter(agent, statusFilter)
      );
    });
  }, [agents, deferredSearch, filterProduct, filterOfficeId, statusFilter]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "avatar",
        header: "",
        cell: ({ row }) => {
          const avatar = avatarFor(row.original.avatarId, row.original.gender);
          return (
            <img
              src={blinkFrame(avatar)}
              alt={row.original.displayName}
              style={{
                width: 32,
                height: 32,
                objectFit: "contain",
                imageRendering: "pixelated",
              }}
            />
          );
        },
        enableSorting: false,
      }),
      columnHelper.accessor((row) => row.displayName, {
        id: "name",
        header: "Nome",
        cell: ({ row }) => (
          <div className="agents-table__identity">
            <span className="agents-table__name">{row.original.displayName}</span>
            {row.original.roles.length > 1 && (
              <div className="agents-table__tags">
                {row.original.roles.slice(1, 3).map((role) => (
                  <span key={`${row.original.id}-${role.nucleusId}`} className="agents-tag">
                    {role.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.primaryRole.title, {
        id: "role",
        header: "Papel principal",
        cell: ({ getValue }) => (
          <span className="agents-table__truncate" title={getValue()}>
            {getValue()}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.primaryRole.nucleusName, {
        id: "office",
        header: "Núcleo",
        cell: ({ row, getValue }) => (
          <div className="agents-table__identity">
            <span className="agents-table__truncate" title={getValue()}>
              {getValue()}
            </span>
            {row.original.roles.length > 1 && (
              <span className="agents-table__subcopy">
                +{row.original.roles.length - 1} especialidade
                {row.original.roles.length > 2 ? "s" : ""}
              </span>
            )}
          </div>
        ),
      }),
      columnHelper.accessor((row) => productLabel(row.primaryRole.product), {
        id: "product",
        header: "Produto",
        sortingFn: (left, right) =>
          productLabel(left.original.primaryRole.product).localeCompare(
            productLabel(right.original.primaryRole.product),
            "pt-BR",
          ),
        cell: ({ row }) => (
          <span
            className="agents-badge"
            style={{
              color: productColor(row.original.primaryRole.product),
              background: `${productColor(row.original.primaryRole.product)}16`,
              borderColor: `${productColor(row.original.primaryRole.product)}33`,
            }}
          >
            {productLabel(row.original.primaryRole.product)}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.statusLabel, {
        id: "status",
        header: "Status",
        sortingFn: (left, right) =>
          STATUS_ORDER[left.original.status] - STATUS_ORDER[right.original.status],
        cell: ({ row }) => (
          <span
            className="agents-badge"
            style={{
              color: row.original.statusColor,
              background: `${row.original.statusColor}16`,
              borderColor: `${row.original.statusColor}33`,
            }}
          >
            {row.original.statusLabel}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.currentTask ?? "—", {
        id: "task",
        header: "Tarefa atual",
        cell: ({ getValue }) => (
          <span className="agents-table__truncate" title={getValue()}>
            {getValue()}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.sourceLabel, {
        id: "source",
        header: "Fonte",
        sortingFn: "alphanumeric",
        cell: ({ getValue }) => (
          <span className="agents-table__source">{getValue()}</span>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: filteredAgents,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 62,
    overscan: 12,
  });

  const visibleRows = rowVirtualizer.getVirtualItems();

  return (
    <section className="page-section">
      <div className="agents-summary">
        <span className="agents-summary__item agents-summary__item--working">
          🟢 {metrics.working} trabalhando
        </span>
        <span className="agents-summary__item agents-summary__item--waiting">
          🟡 {metrics.waiting} aguardando
        </span>
        <span className="agents-summary__item agents-summary__item--idle">
          ⚪ {metrics.idle} ociosos
        </span>
        {metrics.done > 0 && (
          <span className="agents-summary__item agents-summary__item--done">
            🟣 {metrics.done} concluídos
          </span>
        )}
        <span className="agents-summary__item">
          📋 {metrics.activeDelegations} delegações ({metrics.inProgressDelegations} exec,{" "}
          {metrics.blockedDelegations} bloq)
        </span>
        <span className="agents-summary__item">🏗️ {metrics.liveAlas} alas ao vivo</span>
      </div>

      <div className="agents-filters">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar nome, papel ou núcleo"
          className="dashboard-input"
        />
        <select
          value={filterProduct}
          onChange={(event) => setFilterProduct(event.target.value as ProductFilter)}
          className="dashboard-select"
        >
          <option value="all">Todos os produtos</option>
          <option value="hospitalar">Velya</option>
          <option value="lince">Lince</option>
          <option value="shared">Compartilhado</option>
        </select>
        <select
          value={filterOfficeId ?? ""}
          onChange={(event) => setFilterOffice(event.target.value || null)}
          className="dashboard-select"
        >
          <option value="">Todos os núcleos</option>
          {directory.offices.map((office) => (
            <option key={office.id} value={office.id}>
              {office.name}
            </option>
          ))}
        </select>
        <div className="agents-chips">
          {([
            ["all", "Todos"],
            ["working", "Trabalhando"],
            ["waiting", "Aguardando"],
            ["idle", "Ocioso"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={
                statusFilter === value
                  ? "agents-chip agents-chip--active"
                  : "agents-chip"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="agents-table">
        <div
          className="agents-table__header agents-table-grid"
          style={{ gridTemplateColumns: GRID_COLUMNS }}
        >
          {table.getHeaderGroups().map((headerGroup) =>
            headerGroup.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              return (
                <button
                  key={header.id}
                  type="button"
                  onClick={header.column.getToggleSortingHandler()}
                  className="agents-table__header-cell"
                  disabled={!header.column.getCanSort()}
                >
                  <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                  {sorted && <span>{sorted === "asc" ? "↑" : "↓"}</span>}
                </button>
              );
            }),
          )}
        </div>

        <div ref={parentRef} className="agents-table__body">
          {rows.length === 0 ? (
            <div className="dashboard-empty">
              Nenhum agente encontrado com os filtros atuais.
            </div>
          ) : (
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {visibleRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    className={`agents-table__row agents-table__row--${row.original.tone} agents-table-grid`}
                    style={{
                      gridTemplateColumns: GRID_COLUMNS,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => selectAgent(row.original.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectAgent(row.original.id);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div key={cell.id} className="agents-table__cell">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
