# Padrões de Tabela e Grid — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09
**Biblioteca:** TanStack Table v8 + TanStack Virtual v3

---

## 1. Visão Geral

Tabelas são o principal componente de visualização de dados na plataforma Velya. Listas de pacientes, medicações, chamadas, logs de auditoria e escalas de equipe dependem de tabelas robustas, performáticas e acessíveis.

### 1.1 Princípios

1. **Headless-first**: TanStack Table fornece lógica, nosso design system fornece a UI
2. **Type-safe**: Colunas tipadas com os dados do domínio
3. **Padronizado**: Um componente `<DataTable />` base para toda a aplicação
4. **Responsivo**: Estratégia mobile-first com fallback para cards
5. **Acessível**: Navegação por teclado, ARIA roles, screen reader support
6. **Performático**: Virtualização para datasets grandes

---

## 2. Componente DataTable Base

### 2.1 Arquitetura

```
components/data/
├── data-table.tsx                  # Componente principal
├── data-table-toolbar.tsx          # Barra de ferramentas (filtros, busca)
├── data-table-pagination.tsx       # Paginação
├── data-table-column-header.tsx    # Header com sorting
├── data-table-row-actions.tsx      # Menu de ações por linha
├── data-table-faceted-filter.tsx   # Filtro por facetas
├── data-table-view-options.tsx     # Visibilidade de colunas
├── data-table-skeleton.tsx         # Loading skeleton
├── data-table-empty.tsx            # Estado vazio
└── data-table-mobile-card.tsx      # Card derivado para mobile
```

### 2.2 Interface Principal

```tsx
interface DataTableProps<TData, TValue> {
  // Obrigatórios
  columns: ColumnDef<TData, TValue>[]
  data: TData[]

  // Estado
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  emptyMessage?: string
  emptyIcon?: LucideIcon

  // Features
  enableSorting?: boolean           // default: true
  enableFiltering?: boolean         // default: true
  enableColumnVisibility?: boolean  // default: true
  enableRowSelection?: boolean      // default: false
  enablePagination?: boolean        // default: true
  enableVirtualization?: boolean    // default: false

  // Toolbar
  searchPlaceholder?: string
  searchColumn?: string
  filterableColumns?: FilterableColumn[]
  toolbarActions?: React.ReactNode

  // Seleção
  onSelectionChange?: (rows: TData[]) => void
  bulkActions?: BulkAction<TData>[]

  // Paginação
  pageSize?: number                 // default: 20
  pageSizeOptions?: number[]        // default: [10, 20, 50, 100]

  // Mobile
  mobileCardRenderer?: (row: TData) => React.ReactNode
  mobilePriorityColumns?: string[]
  mobileBreakpoint?: 'sm' | 'md'   // default: 'md'

  // Virtualização
  estimateSize?: number             // default: 48
  overscan?: number                 // default: 10
}
```

### 2.3 Implementação Base

```tsx
'use client'

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTableToolbar } from './data-table-toolbar'
import { DataTablePagination } from './data-table-pagination'
import { DataTableSkeleton } from './data-table-skeleton'
import { DataTableEmpty } from './data-table-empty'
import { useMediaQuery } from '@/hooks/use-media-query'

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  isError,
  onRetry,
  emptyMessage,
  enableSorting = true,
  enableFiltering = true,
  enableColumnVisibility = true,
  enableRowSelection = false,
  enablePagination = true,
  searchPlaceholder,
  searchColumn,
  filterableColumns,
  toolbarActions,
  onSelectionChange,
  bulkActions,
  pageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  mobileCardRenderer,
  mobileBreakpoint = 'md',
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const isMobile = useMediaQuery(
    mobileBreakpoint === 'sm' ? '(max-width: 639px)' : '(max-width: 767px)'
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(enableSorting && {
      getSortedRowModel: getSortedRowModel(),
      onSortingChange: setSorting,
    }),
    ...(enableFiltering && {
      getFilteredRowModel: getFilteredRowModel(),
      onColumnFiltersChange: setColumnFilters,
    }),
    ...(enablePagination && {
      getPaginationRowModel: getPaginationRowModel(),
    }),
    ...(enableRowSelection && {
      onRowSelectionChange: setRowSelection,
    }),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: { pageSize },
    },
  })

  // Loading state
  if (isLoading) {
    return <DataTableSkeleton columns={columns.length} rows={pageSize} />
  }

  // Error state
  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar dados"
        description="Não foi possível carregar a tabela."
        onRetry={onRetry}
      />
    )
  }

  // Mobile card view
  if (isMobile && mobileCardRenderer) {
    return (
      <div className="space-y-3">
        <DataTableToolbar
          table={table}
          searchPlaceholder={searchPlaceholder}
          searchColumn={searchColumn}
          filterableColumns={filterableColumns}
          actions={toolbarActions}
        />
        {table.getRowModel().rows.length === 0 ? (
          <DataTableEmpty message={emptyMessage} />
        ) : (
          table.getRowModel().rows.map((row) => (
            <div key={row.id}>
              {mobileCardRenderer(row.original)}
            </div>
          ))
        )}
        {enablePagination && <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />}
      </div>
    )
  }

  // Desktop table view
  return (
    <div className="space-y-4">
      <DataTableToolbar
        table={table}
        searchPlaceholder={searchPlaceholder}
        searchColumn={searchColumn}
        filterableColumns={filterableColumns}
        actions={toolbarActions}
        bulkActions={bulkActions}
        selectedCount={Object.keys(rowSelection).length}
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="sticky top-0 bg-muted/50 backdrop-blur"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-48">
                  <DataTableEmpty message={emptyMessage} />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />}
    </div>
  )
}
```

---

## 3. Sorting

### 3.1 Column Header com Sort

```tsx
import { Column } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
  className?: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('-ml-3 h-8 data-[state=open]:bg-accent', className)}
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {title}
      {column.getIsSorted() === 'desc' ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : column.getIsSorted() === 'asc' ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  )
}
```

### 3.2 Regras de Sorting

- Sorting padrão é ascendente no primeiro clique, descendente no segundo, sem sorting no terceiro
- Colunas de data: sort descendente por padrão (mais recente primeiro)
- Colunas de status: sort por severidade (crítico > urgente > estável)
- Multi-column sort com Shift+click
- Sort indicator visível no header
- Sort persistido na URL via query params (quando aplicável)

---

## 4. Filtering

### 4.1 Filtro de Busca Global

```tsx
function DataTableToolbar<TData>({
  table,
  searchPlaceholder = 'Buscar...',
  searchColumn,
  filterableColumns,
}: ToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center gap-2">
        {searchColumn && (
          <Input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchColumn)?.getFilterValue() as string) ?? ''}
            onChange={(e) => table.getColumn(searchColumn)?.setFilterValue(e.target.value)}
            className="h-9 w-[250px]"
          />
        )}
        {filterableColumns?.map((column) => (
          <DataTableFacetedFilter
            key={column.id}
            column={table.getColumn(column.id)}
            title={column.title}
            options={column.options}
          />
        ))}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-9 px-2"
          >
            Limpar filtros
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
```

### 4.2 Filtro por Facetas

```tsx
function DataTableFacetedFilter<TData>({
  column,
  title,
  options,
}: FacetedFilterProps<TData>) {
  const facets = column?.getFacetedUniqueValues()
  const selectedValues = new Set(column?.getFilterValue() as string[])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {selectedValues.size > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedValues.size}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${title.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Sem resultados.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isSelected) {
                        selectedValues.delete(option.value)
                      } else {
                        selectedValues.add(option.value)
                      }
                      column?.setFilterValue(
                        selectedValues.size ? Array.from(selectedValues) : undefined
                      )
                    }}
                  >
                    <div className={cn(
                      'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                      isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50'
                    )}>
                      {isSelected && <Check className="h-4 w-4" />}
                    </div>
                    {option.icon && <option.icon className="mr-2 h-4 w-4" />}
                    <span>{option.label}</span>
                    {facets?.get(option.value) && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {facets.get(option.value)}
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

---

## 5. Column Visibility

```tsx
function DataTableViewOptions<TData>({ table }: { table: Table<TData> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto h-9">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table.getAllColumns()
          .filter((col) => col.getCanHide())
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              {column.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Regras de visibilidade:**

- Colunas essenciais (nome, status) não podem ser escondidas (`enableHiding: false`)
- Visibilidade persistida em localStorage por tabela
- Preset de colunas por role (enfermeiro vê colunas diferentes de médico)
- Reset para padrão disponível

---

## 6. Row Actions

### 6.1 Menu de Ações

```tsx
function DataTableRowActions<TData>({ row, actions }: RowActionsProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Abrir menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            onClick={() => action.onClick(row.original)}
            disabled={action.disabled?.(row.original)}
            className={action.variant === 'destructive' ? 'text-destructive' : undefined}
          >
            {action.icon && <action.icon className="mr-2 h-4 w-4" />}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### 6.2 Padrão de Ações por Domínio

| Domínio | Ações Típicas |
|---|---|
| Pacientes | Ver detalhes, Editar, Registrar dor, Registrar chamada |
| Medicação | Administrar, Pular, Ver prescrição, Histórico |
| Chamadas | Atender, Encaminhar, Registrar resolução |
| Auditoria | Ver detalhes, Exportar, Filtrar por operador |
| Workforce | Editar escala, Trocar turno, Ver perfil |

---

## 7. Row Selection e Bulk Actions

### 7.1 Coluna de Seleção

```tsx
const selectionColumn: ColumnDef<any> = {
  id: 'select',
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Selecionar todos"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      aria-label="Selecionar linha"
    />
  ),
  enableSorting: false,
  enableHiding: false,
}
```

### 7.2 Barra de Bulk Actions

```tsx
function BulkActionBar<TData>({
  selectedCount,
  actions,
  onClearSelection,
}: BulkActionBarProps<TData>) {
  if (selectedCount === 0) return null

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
      <span className="text-sm font-medium">
        {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
      </span>
      <Separator orientation="vertical" className="h-4" />
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant || 'outline'}
          size="sm"
          onClick={action.onClick}
        >
          {action.icon && <action.icon className="mr-2 h-4 w-4" />}
          {action.label}
        </Button>
      ))}
      <Button variant="ghost" size="sm" onClick={onClearSelection} className="ml-auto">
        Limpar seleção
      </Button>
    </div>
  )
}
```

---

## 8. Sticky Headers

```tsx
// Implementação via CSS
<div className="max-h-[600px] overflow-auto rounded-lg border">
  <Table>
    <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
      {/* headers */}
    </TableHeader>
    <TableBody>
      {/* rows */}
    </TableBody>
  </Table>
</div>
```

**Regras:**

- Header sticky sempre que tabela tem scroll vertical
- Background opaco (não transparente) para não sobrepor conteúdo
- Shadow sutil para separação visual do header
- z-index controlado para não conflitar com modals/popovers

---

## 9. Empty, Loading e Retry States

### 9.1 Skeleton Loading

```tsx
function DataTableSkeleton({ columns, rows }: { columns: number; rows: number }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: columns }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### 9.2 Empty State

```tsx
function DataTableEmpty({ message, icon: Icon = Inbox }: DataTableEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Icon className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">
        {message || 'Nenhum registro encontrado'}
      </p>
    </div>
  )
}
```

### 9.3 Retry State

```tsx
function DataTableError({ message, onRetry }: DataTableErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <AlertTriangle className="h-10 w-10 text-destructive/50" />
      <p className="text-sm text-muted-foreground">
        {message || 'Erro ao carregar dados'}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
```

---

## 10. Virtualização

### 10.1 Quando Virtualizar

| Cenário | Virtualizar? |
|---|---|
| < 100 linhas | Não |
| 100-500 linhas com paginação | Não |
| 500+ linhas sem paginação | Sim |
| Logs de auditoria (scroll infinito) | Sim |
| Tabela com linhas expansíveis | Sim se > 200 linhas |

### 10.2 Implementação com TanStack Virtual

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualizedTable<TData>({ table }: { table: Table<TData> }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const { rows } = table.getRowModel()

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // altura estimada da row em px
    overscan: 10,
  })

  return (
    <div ref={parentRef} className="max-h-[600px] overflow-auto rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          {/* headers normais */}
        </TableHeader>
        <TableBody>
          <tr style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            <td colSpan={99} style={{ padding: 0 }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index]
                return (
                  <TableRow
                    key={row.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      width: '100%',
                      display: 'flex',
                    }}
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} style={{ flex: 1 }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </td>
          </tr>
        </TableBody>
      </Table>
    </div>
  )
}
```

---

## 11. Estratégia Mobile

### 11.1 Abordagem por Prioridade de Colunas

Em telas menores, nem todas as colunas cabem. A estratégia é:

1. **Colunas prioritárias**: Sempre visíveis (nome, status, ação principal)
2. **Colunas secundárias**: Escondidas em mobile, visíveis em tablet+
3. **Colunas terciárias**: Apenas em desktop

```tsx
const columns: ColumnDef<Patient>[] = [
  {
    accessorKey: 'name',
    header: 'Nome',
    meta: { priority: 'high' },          // Sempre visível
  },
  {
    accessorKey: 'status',
    header: 'Status',
    meta: { priority: 'high' },          // Sempre visível
  },
  {
    accessorKey: 'room',
    header: 'Quarto',
    meta: { priority: 'medium' },        // Tablet+
  },
  {
    accessorKey: 'doctor',
    header: 'Médico',
    meta: { priority: 'low' },           // Desktop only
  },
  {
    accessorKey: 'lastUpdate',
    header: 'Última atualização',
    meta: { priority: 'low' },           // Desktop only
  },
]
```

### 11.2 Cards Derivados para Mobile

```tsx
function PatientMobileCard({ patient }: { patient: Patient }) {
  return (
    <Card className="border-l-4" style={{ borderLeftColor: getStatusColor(patient.status) }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">{patient.name}</p>
            <p className="text-sm text-muted-foreground">
              Quarto {patient.room} | Leito {patient.bed}
            </p>
          </div>
          <StatusChip variant={patient.status} label={patient.statusLabel} />
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span>{patient.doctor}</span>
          <span>{formatRelativeTime(patient.lastUpdate)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

### 11.3 Row Drawer para Mobile

Ao tocar em uma row/card no mobile, abre um drawer com todos os dados da linha:

```tsx
function RowDetailDrawer<TData>({ row, columns, open, onClose }: RowDrawerProps<TData>) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[80vh]">
        <SheetHeader>
          <SheetTitle>Detalhes</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          {columns.map((col) => (
            <div key={col.id} className="flex justify-between border-b pb-2">
              <span className="text-sm text-muted-foreground">{col.header}</span>
              <span className="text-sm font-medium">{row[col.accessorKey]}</span>
            </div>
          ))}
        </div>
        <SheetFooter>
          {/* Ações da linha */}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

---

## 12. Definição de Colunas por Domínio

### 12.1 Tabela de Pacientes

```tsx
const patientColumns: ColumnDef<Patient>[] = [
  { id: 'select', /* checkbox */ },
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Paciente" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <PatientAvatar name={row.original.name} size="sm" />
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.medicalRecordNumber}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => <StatusChip variant={row.original.status} label={row.original.statusLabel} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'room',
    header: 'Quarto/Leito',
    cell: ({ row }) => `${row.original.room}/${row.original.bed}`,
  },
  {
    accessorKey: 'attendingDoctor',
    header: 'Médico',
  },
  {
    accessorKey: 'admissionDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Admissão" />,
    cell: ({ row }) => formatDate(row.original.admissionDate),
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} actions={patientActions} />,
  },
]
```

---

## 13. Paginação

```tsx
function DataTablePagination<TData>({ table, pageSizeOptions }: PaginationProps<TData>) {
  return (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Linhas por página</span>
        <Select
          value={`${table.getState().pagination.pageSize}`}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-6">
        <span className="text-sm text-muted-foreground">
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

## 14. Acessibilidade de Tabelas

### 14.1 Checklist

- [ ] `<table>` com `role="grid"` quando interativa
- [ ] `<th>` com `scope="col"` ou `scope="row"`
- [ ] Sort buttons com `aria-sort="ascending"` ou `"descending"`
- [ ] Checkboxes com `aria-label` descritivo
- [ ] Focus management: Tab navega entre controles, setas dentro do grid
- [ ] Screen reader: Anuncia contagem de resultados, página atual
- [ ] High contrast mode: Bordas visíveis, não apenas por cor

### 14.2 Live Regions

```tsx
// Anuncia mudanças para screen readers
<div role="status" aria-live="polite" className="sr-only">
  {table.getFilteredRowModel().rows.length} resultados encontrados.
  Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}.
</div>
```

---

## 15. Performance

### 15.1 Regras

- **Memoização**: `useMemo` para colunas estáticas, `useCallback` para handlers
- **Virtualização**: Ativar para > 500 linhas sem paginação
- **Lazy columns**: Colunas com cálculo pesado usam `cell` lazy
- **Debounce**: Input de busca com 300ms de debounce
- **Pagination server-side**: Para datasets > 1000 registros

### 15.2 Métricas

| Métrica | Target |
|---|---|
| Render initial (100 rows) | < 50ms |
| Sort toggle | < 100ms |
| Filter apply | < 150ms |
| Virtual scroll (10k rows) | 60fps |
| Mobile card render (50 items) | < 100ms |

---

## 16. Referências

- [TanStack Table Documentation](https://tanstack.com/table)
- [TanStack Virtual Documentation](https://tanstack.com/virtual)
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/data-table)
- [WAI-ARIA Table Pattern](https://www.w3.org/WAI/ARIA/apd/patterns/table/)
