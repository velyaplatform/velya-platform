# Touch Targets e Safe Area Guidelines — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09

---

## 1. Visão Geral

Profissionais de saúde operam a plataforma Velya com pressa, mãos ocupadas (luvas, equipamentos) e em condições de iluminação variada. Touch targets adequados, safe areas corretas e comportamento de scroll previsível são essenciais para evitar erros operacionais.

### 1.1 Princípios

1. **Touch targets generosos**: Mínimo 44x44px, 48x48px para ações críticas
2. **Spacing defensivo**: Espaço entre alvos previne toques acidentais
3. **Safe areas respeitadas**: Conteúdo nunca escondido por notch, home indicator ou status bar
4. **Scroll previsível**: Sem scroll hijacking, sem saltos, sem conflitos de gesture
5. **Hover-free design**: Toda informação acessível sem hover
6. **Teclado virtual**: Layout adapta quando teclado abre

---

## 2. Touch Targets

### 2.1 Tamanhos Mínimos

| Tipo de Elemento      | Tamanho Mínimo     | Tamanho Recomendado | Contexto                  |
| --------------------- | ------------------ | ------------------- | ------------------------- |
| Botão primário        | 44x44px            | 48x48px             | Ações principais          |
| Botão secundário      | 44x44px            | 44x44px             | Ações auxiliares          |
| Botão de ação crítica | 48x48px            | 56x48px             | Medicação, chamada        |
| Ícone de ação         | 44x44px (hit area) | 44x44px (hit area)  | Ícones visuais menores ok |
| Link de texto         | 44px height        | 48px height         | Padding vertical no link  |
| Checkbox              | 44x44px (hit area) | 44x44px (hit area)  | Label clicável incluso    |
| Radio button          | 44x44px (hit area) | 44x44px (hit area)  | Label clicável incluso    |
| Switch/Toggle         | 44x28px mínimo     | 52x32px             | Largura maior que altura  |
| Tab                   | 44px height        | 48px height         | Largura flexível          |
| Dropdown trigger      | 44px height        | 48px height         | Full-width em mobile      |
| Input field           | 44px height        | 48px height         | Font-size 16px mínimo     |
| Row de lista/tabela   | 48px height        | 56px height         | Inclui padding            |
| Card clicável         | 48px min-height    | 64px min-height     | Área completa clicável    |
| Close button (X)      | 44x44px            | 44x44px             | Em modals, sheets         |
| Navigation item       | 44x44px            | 48x48px             | Sidebar/bottom nav        |
| Pagination button     | 44x44px            | 44x44px             | Botões de página          |

### 2.2 Implementação em Tailwind

```tsx
// Utilitários de touch target
const touchTarget = {
  base: 'min-h-[44px] min-w-[44px]',
  large: 'min-h-[48px] min-w-[48px]',
  critical: 'min-h-[48px] min-w-[56px]',
}

// Botão com touch target
<Button className="min-h-[44px] px-4">
  Ação
</Button>

// Ícone com hit area maior que visual
<button
  className="relative flex items-center justify-center h-11 w-11 rounded-md hover:bg-accent"
  aria-label="Excluir"
>
  <Trash2 className="h-4 w-4" /> {/* Ícone visual: 16px */}
</button>
{/* Hit area: 44px, ícone visual: 16px */}

// Checkbox com label clicável
<label className="flex items-center gap-3 py-3 px-2 -mx-2 cursor-pointer rounded-md hover:bg-accent">
  <Checkbox id="check-1" />
  <span className="text-sm">Opção do checkbox</span>
</label>
{/* Hit area inclui todo o label */}
```

### 2.3 Componente Touch Target Wrapper

```tsx
// Para elementos que precisam de hit area maior que o visual
function TouchTarget({
  children,
  className,
  size = 'base',
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  size?: 'base' | 'large';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'relative flex items-center justify-center',
        'rounded-md transition-colors',
        'hover:bg-accent active:bg-accent/80',
        size === 'base' ? 'h-11 w-11' : 'h-12 w-12',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// Uso
<TouchTarget aria-label="Editar paciente" onClick={handleEdit}>
  <Pencil className="h-4 w-4" />
</TouchTarget>;
```

---

## 3. Spacing entre Touch Targets

### 3.1 Regras de Espaçamento

| Cenário                       | Espaçamento Mínimo | Classe Tailwind        |
| ----------------------------- | ------------------ | ---------------------- |
| Botões adjacentes horizontais | 8px                | `gap-2`                |
| Botões adjacentes verticais   | 8px                | `gap-2` ou `space-y-2` |
| Ícones de ação em toolbar     | 4px                | `gap-1`                |
| Items de lista                | 1px (border)       | `divide-y`             |
| Cards em grid                 | 12px               | `gap-3`                |
| Form fields                   | 16px               | `space-y-4`            |
| Ações críticas vs destrutivas | 16px+              | `gap-4` ou separador   |
| Navigation items              | 4px                | `gap-1`                |

### 3.2 Anti-padrões

```
ERRADO: Botões colados sem espaço
┌──────────┐┌──────────┐
│ Aceitar  ││ Rejeitar │
└──────────┘└──────────┘

CORRETO: Espaço adequado entre botões
┌──────────┐  ┌──────────┐
│ Aceitar  │  │ Rejeitar │
└──────────┘  └──────────┘

AINDA MELHOR: Ações destrutivas separadas visualmente
┌──────────┐         ┌──────────┐
│ Aceitar  │         │ Rejeitar │
└──────────┘         └──────────┘
```

### 3.3 Separação de Ações Críticas

```tsx
// Separar ação principal de ação destrutiva
<div className="flex items-center justify-between">
  <Button variant="outline" onClick={handleCancel}>
    Cancelar
  </Button>
  <Button onClick={handleConfirm}>Confirmar administração</Button>
</div>;
{
  /* justify-between coloca máximo espaço entre os botões */
}
```

---

## 4. Safe Areas

### 4.1 Anatomia de Safe Areas

```
┌─────────────────────────────────────┐
│         STATUS BAR AREA             │  ← safe-area-inset-top
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │                               │  │
│  │      SAFE CONTENT AREA        │  │
│  │                               │  │
│  │                               │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│  ← safe-area-inset-left  right →   │
│         HOME INDICATOR              │  ← safe-area-inset-bottom
└─────────────────────────────────────┘
```

### 4.2 Configuração do Viewport

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
/>
```

**Notas:**

- `viewport-fit=cover` é necessário para que safe areas funcionem
- `maximum-scale=1` previne zoom acidental (mas acessibilidade — ver nota abaixo)
- Para acessibilidade: considerar `user-scalable=yes` e font-size adequado

### 4.3 CSS para Safe Areas

```css
/* Global — aplicar safe areas no root */
:root {
  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  --sar: env(safe-area-inset-right, 0px);
}

/* Topbar */
.topbar {
  padding-top: max(var(--sat), 0.75rem);
  /* Garante padding mínimo mesmo sem safe area */
}

/* Bottom navigation */
.bottom-nav {
  padding-bottom: max(var(--sab), 0.75rem);
}

/* Full-screen modal */
.fullscreen-modal {
  padding-top: var(--sat);
  padding-bottom: var(--sab);
  padding-left: var(--sal);
  padding-right: var(--sar);
}

/* FAB (Floating Action Button) */
.fab {
  bottom: calc(var(--sab) + 1rem);
  right: calc(var(--sar) + 1rem);
}

/* Sidebar em landscape com notch */
.sidebar {
  padding-left: max(var(--sal), 1rem);
}
```

### 4.4 Componentes com Safe Area

```tsx
// Layout principal com safe areas
function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <Topbar />
      <main className="flex-1">{children}</main>
      <MobileBottomNav />
    </div>
  );
}

// Bottom sheet com safe area
function BottomSheet({ children, open, onClose }: BottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="pb-[max(env(safe-area-inset-bottom),1rem)]">
        {children}
      </SheetContent>
    </Sheet>
  );
}

// Mobile bottom navigation
function MobileBottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 border-t bg-background md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-14">
        <NavItem icon={LayoutDashboard} label="Dashboard" href="/dashboard" />
        <NavItem icon={Users} label="Pacientes" href="/patients" />
        <NavItem icon={Pill} label="Medicação" href="/medication" />
        <NavItem icon={Phone} label="Chamadas" href="/calls" />
        <NavItem icon={Menu} label="Mais" href="/more" />
      </div>
    </nav>
  );
}
```

### 4.5 Dispositivos com Safe Areas

| Dispositivo            | Top                   | Bottom                | Left | Right |
| ---------------------- | --------------------- | --------------------- | ---- | ----- |
| iPhone 14+ (portrait)  | 59px (Dynamic Island) | 34px (home indicator) | 0    | 0     |
| iPhone 14+ (landscape) | 0                     | 21px                  | 59px | 59px  |
| iPhone SE              | 20px (status bar)     | 0                     | 0    | 0     |
| iPad Pro (portrait)    | 24px                  | 20px                  | 0    | 0     |
| Android (gesture nav)  | 24px                  | 16px                  | 0    | 0     |
| Android (button nav)   | 24px                  | 48px                  | 0    | 0     |

---

## 5. Scroll Previsível

### 5.1 Regras de Scroll

1. **Sem scroll hijacking**: Não alterar velocidade ou direção do scroll nativo
2. **Sem snap scroll** em áreas de conteúdo principal
3. **Scroll vertical padrão**: Para listas e conteúdo
4. **Scroll horizontal** apenas para: tabs, carrosséis horizontais, tabelas wide
5. **Indicador de scroll**: Mostrar que há mais conteúdo (fade, scroll indicator)
6. **Pull-to-refresh**: Apenas no nível da página, não em componentes internos
7. **Elastic scroll**: Respeitar bounce nativo do iOS, não desabilitar globalmente
8. **Scroll restoration**: Manter posição do scroll ao voltar na navegação

### 5.2 Áreas de Scroll

```tsx
// Scroll principal da página — comportamento nativo
<main className="flex-1 overflow-auto">
  {children}
</main>

// Tabela com scroll interno
<div className="max-h-[600px] overflow-auto rounded-lg border">
  <Table>{/* ... */}</Table>
</div>

// Tabs scrolláveis em mobile
<div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
  <div className="flex gap-1 min-w-max">
    {tabs.map(tab => <Tab key={tab.id} />)}
  </div>
</div>

// Sidebar scrollável
<aside className="h-screen overflow-y-auto overscroll-contain">
  <nav>{/* ... */}</nav>
</aside>
```

### 5.3 overscroll-behavior

```css
/* Previne scroll propagation em áreas internas */
.modal-content {
  overscroll-behavior: contain;
}

/* Previne pull-to-refresh em áreas scrolláveis internas */
.internal-scroll {
  overscroll-behavior-y: contain;
}

/* Permite bounce nativo na página principal */
body {
  overscroll-behavior: auto;
}
```

---

## 6. Teclado Virtual

### 6.1 Comportamento Esperado

Quando o teclado virtual abre:

1. O campo focado deve estar visível (não escondido pelo teclado)
2. O layout deve adaptar sem saltos visuais
3. Botões de ação do formulário devem permanecer acessíveis
4. Background não deve dar zoom

### 6.2 Detecção do Teclado

```tsx
function useVirtualKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // Visual Viewport API (melhor suporte)
    if (window.visualViewport) {
      function handleResize() {
        const viewport = window.visualViewport!;
        const keyboardH = window.innerHeight - viewport.height;
        setKeyboardHeight(Math.max(0, keyboardH));
        setIsKeyboardOpen(keyboardH > 100); // threshold
      }

      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }

    // Fallback: window resize
    const initialHeight = window.innerHeight;
    function handleResize() {
      const diff = initialHeight - window.innerHeight;
      setKeyboardHeight(Math.max(0, diff));
      setIsKeyboardOpen(diff > 100);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { keyboardHeight, isKeyboardOpen };
}
```

### 6.3 Scroll para Campo Focado

```tsx
function useScrollToFocusedField() {
  useEffect(() => {
    function handleFocus(e: FocusEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        // Delay para aguardar teclado abrir
        setTimeout(() => {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 300);
      }
    }

    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, []);
}
```

### 6.4 Input Types para Teclado Adequado

| Campo            | Input Type        | inputMode | Teclado                    |
| ---------------- | ----------------- | --------- | -------------------------- |
| Email            | `type="email"`    | `email`   | @ e . acessíveis           |
| Telefone         | `type="tel"`      | `tel`     | Numérico com + e -         |
| CPF              | `type="text"`     | `numeric` | Numérico                   |
| Número (dosagem) | `type="text"`     | `decimal` | Numérico com ponto         |
| Busca            | `type="search"`   | `search`  | Enter = "Buscar"           |
| Senha            | `type="password"` | -         | Alfanumérico com show/hide |
| Data             | `type="date"`     | -         | Date picker nativo         |
| Hora             | `type="time"`     | -         | Time picker nativo         |
| Texto geral      | `type="text"`     | `text`    | Alfanumérico padrão        |

### 6.5 Prevenção de Zoom no iOS

```css
/* Font-size mínimo de 16px em inputs previne zoom automático no iOS */
input,
select,
textarea {
  font-size: 16px; /* NUNCA menor que 16px em mobile */
}

/* Ou via Tailwind */
/* text-base = 16px (default) — nunca usar text-sm em inputs mobile */
```

---

## 7. Gestos

### 7.1 Gestos Suportados

| Gesto             | Uso na Velya                      | Implementação            |
| ----------------- | --------------------------------- | ------------------------ |
| Tap               | Ação principal (clicar)           | `onClick` padrão         |
| Long press        | Menu contextual                   | Custom handler (300ms)   |
| Swipe horizontal  | Ações em lista (aceitar/rejeitar) | Custom ou lib            |
| Swipe para baixo  | Pull-to-refresh (page level)      | Browser nativo ou custom |
| Pinch to zoom     | Desabilitado em formulários       | `maximum-scale=1`        |
| Two-finger scroll | Scroll natural                    | Nativo                   |
| Edge swipe (iOS)  | Back navigation                   | Nativo — não bloquear    |

### 7.2 Regras de Gestos

1. **Gestos são complementares**: Toda ação por gesto tem equivalente por botão
2. **Feedback visual**: Gesto em progresso mostra feedback (cores, ícones)
3. **Cancelável**: Gesto pode ser abortado voltando à posição original
4. **Descobrível**: Não depender do usuário descobrir gestos sozinho
5. **Não conflitar**: Swipe não pode conflitar com navegação do browser/OS

### 7.3 Swipe Actions em Lista

```tsx
function SwipeableListItem({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
}: SwipeableProps) {
  // Implementação com touch events
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState(0);

  function handleTouchStart(e: React.TouchEvent) {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const deltaX = e.touches[0].clientX - touchStart.current.x;
    const deltaY = e.touches[0].clientY - touchStart.current.y;

    // Ignorar se scroll vertical
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    setOffset(deltaX);
  }

  function handleTouchEnd() {
    if (offset > 80) onSwipeRight?.();
    if (offset < -80) onSwipeLeft?.();
    setOffset(0);
    touchStart.current = null;
  }

  return (
    <div className="relative overflow-hidden">
      {/* Background actions */}
      <div className="absolute inset-0 flex items-center justify-between px-4">
        <div
          className={cn(
            'text-success',
            offset > 40 && 'opacity-100',
            'opacity-0 transition-opacity',
          )}
        >
          {rightAction}
        </div>
        <div
          className={cn(
            'text-destructive',
            offset < -40 && 'opacity-100',
            'opacity-0 transition-opacity',
          )}
        >
          {leftAction}
        </div>
      </div>

      {/* Foreground content */}
      <div
        className="relative bg-background transition-transform"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
```

---

## 8. Hover-Free Design

### 8.1 Princípio

Todo conteúdo e funcionalidade acessível via hover deve ter alternativa para touch:

| Hover Pattern (Desktop) | Touch Alternative (Mobile)               |
| ----------------------- | ---------------------------------------- |
| Tooltip on hover        | Tap para mostrar / info icon com popover |
| Row actions on hover    | Sempre visíveis ou menu (three dots)     |
| Preview on hover        | Tap para expandir / long press           |
| Color change on hover   | Active state (`:active`)                 |
| Submenu on hover        | Tap para expandir menu                   |
| Card details on hover   | Tap para abrir detail view               |

### 8.2 Implementação

```tsx
// Desktop: hover mostra ações
// Mobile: ações sempre visíveis ou via menu
function TableRowActions({ row, isMobile }: RowActionsProps) {
  if (isMobile) {
    // Mobile: menu dropdown sempre visível
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>{/* actions */}</DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Desktop: botões aparecem no hover da row
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
      <Button variant="ghost" size="sm">
        Editar
      </Button>
      <Button variant="ghost" size="sm">
        Ver
      </Button>
    </div>
  );
}

// Tooltip acessível sem hover
function AccessibleTooltip({ content, children }: TooltipProps) {
  const isTouchDevice = useMediaQuery('(pointer: coarse)');

  if (isTouchDevice) {
    return (
      <Popover>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent>{content}</PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
}
```

### 8.3 Detecção de Capacidade de Hover

```css
/* Hover apenas em devices que suportam */
@media (hover: hover) and (pointer: fine) {
  .hover-action {
    opacity: 0;
    transition: opacity 150ms;
  }

  .group:hover .hover-action {
    opacity: 1;
  }
}

/* Touch devices: sempre visível */
@media (hover: none) or (pointer: coarse) {
  .hover-action {
    opacity: 1;
  }
}
```

---

## 9. Acessibilidade Touch

### 9.1 Checklist

- [ ] Todos os touch targets >= 44x44px
- [ ] Espaçamento >= 8px entre targets adjacentes
- [ ] Ações críticas >= 48x48px
- [ ] Labels visíveis em todos os controles
- [ ] Input font-size >= 16px (previne zoom iOS)
- [ ] Scroll natural sem hijacking
- [ ] Safe areas respeitadas em todos os layouts
- [ ] Teclado virtual não esconde campo focado
- [ ] Gestos têm alternativa por botão
- [ ] Hover content acessível por tap
- [ ] Focus ring visível para navegação por teclado externo
- [ ] `aria-label` em botões com apenas ícone
- [ ] Contraste adequado para uso ao ar livre (hospitais com janelas)

### 9.2 Testes Manuais

Para cada tela, verificar:

1. **Thumb zone**: Ações frequentes alcançáveis com polegar
2. **One-handed use**: Principais fluxos completáveis com uma mão
3. **Gloves compatibility**: Touch targets grandes o suficiente para luvas
4. **Screen rotation**: Layout adapta sem perder contexto
5. **Split keyboard (iPad)**: Formulários funcionam com teclado dividido

---

## 10. Performance de Touch

### 10.1 Regras

1. **Sem delay de 300ms**: CSS `touch-action: manipulation` elimina delay
2. **Feedback visual instantâneo**: `:active` state em < 50ms
3. **Passive event listeners**: `addEventListener('scroll', fn, { passive: true })`
4. **Will-change para animações**: `will-change: transform` em elementos que animam
5. **Sem layout thrashing**: Não ler e escrever DOM no mesmo frame

### 10.2 CSS para Touch Performance

```css
/* Eliminar 300ms tap delay */
html {
  touch-action: manipulation;
}

/* Active state rápido */
button,
a,
[role='button'] {
  -webkit-tap-highlight-color: transparent;
}

button:active,
a:active,
[role='button']:active {
  opacity: 0.8;
  transition: opacity 50ms;
}

/* Scroll performance */
.scroll-container {
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
}

/* Prevent text selection during swipe */
.swipeable {
  user-select: none;
  -webkit-user-select: none;
}
```

---

## 11. Referências

- [Apple HIG — Touch Targets](https://developer.apple.com/design/human-interface-guidelines/accessibility#Touch-targets)
- [Material Design — Touch Targets](https://m3.material.io/foundations/accessible-design/accessibility-basics#touch-targets)
- [WCAG 2.5.5 — Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Safe Area Insets — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
- [Visual Viewport API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API)
- [Designing for Touch — Josh Clark](https://abookapart.com/products/designing-for-touch)
