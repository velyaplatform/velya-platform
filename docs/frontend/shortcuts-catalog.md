# Keyboard Shortcuts Catalog

Living catalog of all keyboard shortcuts. Source of truth is `apps/web/src/lib/shortcuts-config.ts`.

## Global

| Shortcut | Action | Description |
|----------|--------|-------------|
| `g p` | Navigate | Ir para Pacientes |
| `g t` | Navigate | Ir para Tarefas |
| `g a` | Navigate | Ir para Alertas |
| `g d` | Navigate | Ir para Alta |
| `g b` | Navigate | Ir para Leitos |
| `g l` | Navigate | Ir para Laboratorio |
| `g i` | Navigate | Ir para Imagem |
| `g s` | Navigate | Ir para Busca |
| `Ctrl+K` / `Cmd+K` | Command | Abre a paleta de comandos |
| `?` | Toggle | Exibe todos os atalhos de teclado |
| `Escape` | Command | Fecha paineis e overlays abertos |

## Pacientes (`/patients`)

| Shortcut | Action | Description |
|----------|--------|-------------|
| `n` | Command | Novo Paciente |
| `f` | Command | Filtrar pacientes |

## Tarefas (`/tasks`)

| Shortcut | Action | Description |
|----------|--------|-------------|
| `n` | Command | Nova Tarefa |

## Leitos (`/beds`)

| Shortcut | Action | Description |
|----------|--------|-------------|
| `f` | Command | Filtrar por status de ocupacao |

## Rules

- Single-key shortcuts never trigger destructive actions.
- All shortcuts are disabled when the focus is inside `<input>`, `<textarea>`, `<select>`, or `contentEditable`.
- Navigation uses a two-key sequence (`g` + letter within 500ms).
- Scoped shortcuts override global shortcuts when keys collide.
- New shortcuts must be added to `shortcuts-config.ts` and this catalog.

See ADR 0019 for architectural rationale.
