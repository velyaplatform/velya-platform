# Matriz de Compatibilidade Mobile e Tablet — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09

---

## 1. Visão Geral

A plataforma Velya é utilizada por profissionais de saúde em dispositivos heterogêneos: iPhones pessoais, iPads nos postos de enfermagem, smartphones Android, e tablets Android em carrinhos de medicação. Esta matriz define a estratégia de compatibilidade, breakpoints e adaptações por dispositivo.

### 1.1 Princípios

1. **Mobile-first**: Design começa pelo menor viewport e expande
2. **Touch-native**: Toda interação funciona com toque, hover é enhancement
3. **Teste real**: Emuladores complementam mas não substituem device testing
4. **Degradação graceful**: Funciona em devices antigos com UX simplificada
5. **Performance mobile**: Budgets menores que desktop

---

## 2. Dispositivos Target

### 2.1 Smartphones

| Device | OS | Browser | Prioridade | Viewport |
|---|---|---|---|---|
| iPhone 14/15/16 | iOS 17-18 | Safari | **Crítica** | 390x844 |
| iPhone 13 | iOS 16-18 | Safari | **Crítica** | 390x844 |
| iPhone SE (3rd gen) | iOS 16-18 | Safari | Alta | 375x667 |
| iPhone 12 | iOS 15-18 | Safari | Alta | 390x844 |
| Samsung Galaxy S23/S24 | Android 13-15 | Chrome | **Crítica** | 360x780 |
| Samsung Galaxy A54 | Android 13-14 | Chrome | Alta | 360x800 |
| Pixel 7/8 | Android 13-15 | Chrome | Alta | 412x915 |
| Xiaomi Redmi Note 12 | Android 13-14 | Chrome | Média | 393x873 |
| Motorola Moto G | Android 12-14 | Chrome | Média | 360x800 |

### 2.2 Tablets

| Device | OS | Browser | Prioridade | Viewport |
|---|---|---|---|---|
| iPad Pro 11" | iPadOS 17-18 | Safari | **Crítica** | 834x1194 |
| iPad Air | iPadOS 17-18 | Safari | Alta | 820x1180 |
| iPad (10th gen) | iPadOS 16-18 | Safari | Alta | 810x1080 |
| iPad Mini | iPadOS 16-18 | Safari | Média | 744x1133 |
| Samsung Galaxy Tab S9 | Android 14 | Chrome | Alta | 800x1280 |
| Samsung Galaxy Tab A8 | Android 13-14 | Chrome | Média | 800x1280 |
| Lenovo Tab M10 | Android 12-13 | Chrome | Baixa | 800x1280 |

### 2.3 Versões Mínimas Suportadas

| Plataforma | Versão Mínima | Motivo |
|---|---|---|
| iOS | 16.0 | Container queries, :has(), CSS nesting |
| iPadOS | 16.0 | Mesmas APIs que iOS |
| Android | 12 (API 31) | Chrome 120+, features CSS modernas |
| Safari (iOS/iPad) | 16.0 | Corresponde ao iOS mínimo |
| Chrome (Android) | 120+ | Últimas 3 major versions |
| Samsung Internet | 23+ | Chromium-based equivalente |

---

## 3. Breakpoints e Estratégia Responsiva

### 3.1 Breakpoints

```css
/* Tailwind config */
screens: {
  'xs': '375px',    /* iPhone SE, phones pequenos */
  'sm': '640px',    /* Phones landscape, phablets */
  'md': '768px',    /* Tablets portrait */
  'lg': '1024px',   /* Tablets landscape, laptops pequenos */
  'xl': '1280px',   /* Desktops */
  '2xl': '1536px',  /* Monitores grandes */
}
```

### 3.2 Estratégia por Breakpoint

| Range | Classificação | Layout | Sidebar | Tabelas | Charts |
|---|---|---|---|---|---|
| < 375px | Phone pequeno | 1 coluna | Hidden | Cards | Simplificado |
| 375-639px | Phone | 1 coluna | Hidden (sheet) | Cards | Simplificado |
| 640-767px | Phone landscape | 1-2 colunas | Hidden (sheet) | Cols reduzidas | Adaptado |
| 768-1023px | Tablet portrait | 2 colunas | Overlay | Cols prioritárias | Normal |
| 1024-1279px | Tablet landscape | 2-3 colunas | Mini (icons) | Completo | Normal |
| 1280-1535px | Desktop | 3 colunas | Expandida | Completo | Normal |
| >= 1536px | Monitor grande | 3-4 colunas | Expandida | Completo + extras | Normal |

---

## 4. Estratégia por Tela

### 4.1 Login

| Aspecto | Mobile | Tablet | Desktop |
|---|---|---|---|
| Layout | Centralizado, full-width | Centralizado, max-w-sm | Centralizado, max-w-sm |
| Logo | Menor (h-8) | Normal (h-12) | Normal (h-12) |
| Inputs | Full-width, 44px height | Full-width | Full-width |
| Keyboard | inputMode="email", "password" | Mesmo | N/A |
| Biometria | Face ID / Fingerprint prompt | Mesmo | N/A |

### 4.2 Dashboard

| Aspecto | Mobile | Tablet | Desktop |
|---|---|---|---|
| Metric cards | 2 cols stacked | 2x2 grid | 4 cols |
| Charts | 1 coluna, height reduzido | 2 cols | 2-3 cols |
| Recent tables | Cards ou lista simplificada | Tabela compacta | Tabela completa |
| Refresh control | Pull-to-refresh | Botão | Auto-refresh selector |
| Period selector | Dropdown | Toggle group compacto | Toggle group completo |

### 4.3 Lista de Pacientes

| Aspecto | Mobile | Tablet | Desktop |
|---|---|---|---|
| Visualização | Cards com swipe actions | Tabela com cols prioritárias | Tabela completa |
| Busca | Full-width sticky top | Barra na toolbar | Barra na toolbar |
| Filtros | Bottom sheet | Popover | Inline faceted filters |
| Ações por paciente | Swipe left/right | Row actions dropdown | Row actions + botões |
| Detalhes | Nova página | Drawer lateral | Drawer lateral |

### 4.4 Detalhe do Paciente

| Aspecto | Mobile | Tablet | Desktop |
|---|---|---|---|
| Header | Compacto, avatar + nome | Completo com badges | Completo com badges |
| Tabs | Scrollável horizontal | Todas visíveis | Todas visíveis |
| Timeline | Vertical, compacta | Vertical, completa | Vertical, completa |
| Ações rápidas | FAB (floating action button) | Barra de ações | Barra de ações |
| Informações | Seções empilhadas | Grid 2 cols | Grid 2-3 cols |

### 4.5 Administração de Medicação

| Aspecto | Mobile | Tablet | Desktop |
|---|---|---|---|
| Lista de medicações | Cards com status proeminente | Tabela com cores | Tabela completa |
| Formulário de admin | Full-screen | Dialog | Dialog |
| Confirmação | Full-screen dialog | Dialog | Dialog |
| Scanner (futuro) | Camera API nativa | Camera API | N/A |
| Timer de dose | Notificação nativa (se PWA) | Banner fixo | Banner fixo |

### 4.6 Passagem de Plantão (Handoff)

| Aspecto | Mobile | Tablet | Desktop |
|---|---|---|---|
| Wizard steps | Full-screen por step | Sidebar + content | Sidebar + content |
| Lista de pacientes | Cards compactos | Cards com mais info | Tabela |
| Notas | Textarea full-width | Textarea + preview | Split view |
| Revisão | Scroll vertical | Scroll + summary | Panel lateral |
| Assinatura | Botão "Confirmar" | Botão + preview | Botão + preview |

### 4.7 Chamadas

| Aspecto | Mobile | Tablet | Desktop |
|---|---|---|---|
| Lista de chamadas | Cards com urgência | Board tipo kanban | Board tipo kanban |
| Chamada ativa | Full-screen overlay | Banner + detalhes | Panel lateral |
| Timer | Proeminente, centralizado | No banner | No panel |
| Resposta | Botões grandes (touch) | Botões + keyboard | Botões + keyboard |

### 4.8 Centro de Comando

| Aspecto | Mobile | Tablet | Desktop |
|---|---|---|---|
| Overview | Vertical scroll, seções | Grid 2 cols | Grid 3 cols |
| Mapa de leitos | Simplificado, scrollável | Completo | Completo |
| Alertas | Lista com swipe | Painel lateral | Painel lateral |
| KPIs | 2 cols | 3-4 cols | 4+ cols |

---

## 5. Touch Targets

### 5.1 Regras de Tamanho

| Elemento | Tamanho Mínimo | Espaçamento |
|---|---|---|
| Botão primário | 44x44px | 8px entre botões |
| Botão secundário | 44x44px | 8px entre botões |
| Link de texto | 44px height (padding) | 4px entre links |
| Checkbox/Radio | 44x44px hit area | 8px entre itens |
| Input field | 44px height | 12px entre fields |
| Tab | 44px height | 0 (adjacentes ok) |
| Row de tabela (mobile) | 48px height | 1px border |
| Card clicável | Min 48px height | 8px gap |
| Ícone de ação | 44x44px hit area | 8px entre ícones |
| Menu item | 44px height | 0 (separados por border) |

### 5.2 Implementação

```tsx
// Exemplo: botão com touch target adequado
<Button className="min-h-[44px] min-w-[44px]" />

// Exemplo: ícone com hit area maior que o visual
<button className="relative h-11 w-11 flex items-center justify-center">
  <Trash2 className="h-4 w-4" /> {/* Ícone visual pequeno */}
</button>

// Exemplo: link com padding adequado
<Link className="inline-flex items-center py-3 px-2 -mx-2" />
```

---

## 6. Safe Areas

### 6.1 Notch e Dynamic Island (iOS)

```css
/* CSS */
:root {
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-left: env(safe-area-inset-left, 0px);
  --safe-area-inset-right: env(safe-area-inset-right, 0px);
}

/* Viewport com safe areas */
meta[name="viewport"] content="..., viewport-fit=cover"

/* Aplicar safe areas */
.topbar {
  padding-top: max(var(--safe-area-inset-top), 12px);
}

.bottom-nav {
  padding-bottom: max(var(--safe-area-inset-bottom), 12px);
}

.sidebar {
  padding-left: max(var(--safe-area-inset-left), 16px);
}
```

### 6.2 Componente Safe Area

```tsx
function SafeAreaView({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('', className)}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {children}
    </div>
  )
}
```

### 6.3 Áreas Afetadas

| Área da UI | Safe Area Necessária |
|---|---|
| Topbar/Header | `safe-area-inset-top` |
| Bottom navigation | `safe-area-inset-bottom` |
| FAB (Floating Action Button) | `safe-area-inset-bottom` + offset |
| Sidebar esquerda | `safe-area-inset-left` |
| Sheet/Drawer de baixo | `safe-area-inset-bottom` |
| Full-screen modals | Todas as safe areas |
| Teclado virtual aberto | Reflow de conteúdo |

---

## 7. Problemas Específicos por Plataforma

### 7.1 iOS Safari

| Problema | Solução |
|---|---|
| Zoom em inputs < 16px | Font-size mínimo 16px em inputs |
| 100vh inclui barra de URL | Usar `100dvh` ou `100svh` |
| Bounce scroll | `overscroll-behavior: none` onde necessário |
| Position fixed com teclado | Usar `position: sticky` ou JS |
| Safe area com notch/island | `viewport-fit=cover` + `env(safe-area-inset-*)` |
| PWA splash screen delay | Splash images por resolução |
| Back swipe gesture | Não colocar conteúdo interativo na borda esquerda |
| Date input nativo | Usar input type="date" (melhor UX que custom picker) |

### 7.2 Android Chrome

| Problema | Solução |
|---|---|
| Fragmentação de devices | Testar em 3+ tamanhos representativos |
| Barra de navegação de software | `env(safe-area-inset-bottom)` |
| Teclado virtual esconde input | `scrollIntoView` no focus |
| Performance em devices baratos | Limitar animações, lazy load |
| Samsung Internet quirks | Testar separadamente |
| Pull-to-refresh conflita | Desabilitar em áreas de scroll horizontal |
| Notificações PWA | Registrar service worker corretamente |

### 7.3 iPadOS Safari

| Problema | Solução |
|---|---|
| Multi-tasking (split view) | Container queries para adaptar |
| Stage Manager | Testar em janelas redimensionáveis |
| Hover via Pencil | Implementar hover como enhancement |
| Landscape vs Portrait | Layouts diferentes via media query |
| External keyboard | Atalhos de teclado funcionais |
| Pointer events com Pencil | `@media (pointer: fine)` para ajustar |

### 7.4 Tablets Android

| Problema | Solução |
|---|---|
| Variedade de aspect ratios | Testar em 16:10 e 4:3 |
| Resolução baixa em tablets baratos | Design que funciona em 1280x800 |
| Chrome em tablet mode | `@media (min-width: 768px)` |
| Landscape como padrão | Preparar layout landscape como principal |

---

## 8. Testes por Dispositivo

### 8.1 Matriz de Testes

| Tela | iPhone Safari | Android Chrome | iPad Safari | Android Tablet | Desktop Chrome |
|---|---|---|---|---|---|
| Login | E2E + Visual | E2E + Visual | E2E | Smoke | E2E + Visual |
| Dashboard | E2E + Visual | E2E + Visual | E2E + Visual | Smoke | E2E + Visual |
| Pacientes (lista) | E2E + Visual | E2E | E2E | Smoke | E2E + Visual |
| Paciente (detalhe) | E2E | E2E | E2E | Smoke | E2E |
| Medicação | E2E + Visual | E2E + Visual | E2E | Smoke | E2E + Visual |
| Chamadas | E2E | E2E | E2E | Smoke | E2E |
| Handoff | E2E | Smoke | E2E | Smoke | E2E |
| Admin | Smoke | Smoke | Smoke | Smoke | E2E |
| Observability | Smoke | Smoke | Smoke | Smoke | E2E |

### 8.2 Condições de Teste

| Condição | Devices | Telas |
|---|---|---|
| Portrait | Todos os phones | Todas |
| Landscape | Phones + tablets | Dashboard, tabelas, formulários |
| Dark mode | iPhone + Android | Todas (visual regression) |
| Rede 3G throttle | iPhone + Android | Login, dashboard, medicação |
| Teclado virtual | iPhone + Android | Todos os formulários |
| Safe area (notch) | iPhone 14+ | Todas (visual) |
| Split view | iPad | Dashboard, pacientes |

---

## 9. Device Testing Strategy

### 9.1 Dispositivos Físicos (Obrigatório)

Mínimo para release:
- iPhone 14 ou 15 (iOS Safari)
- Samsung Galaxy S23 ou equivalente (Android Chrome)
- iPad Pro 11" (iPadOS Safari)

### 9.2 Emuladores/Simuladores

Para CI e desenvolvimento:
- Playwright com device profiles
- Xcode Simulator (iOS)
- Android Studio Emulator (Android)
- BrowserStack/Sauce Labs para matrix testing

### 9.3 Prioridade de Testes

```
1. iPhone Safari (portrait)     — 40% da base de usuários esperada
2. Android Chrome (portrait)    — 30% da base
3. iPad Safari (landscape)      — 15% da base (postos de enfermagem)
4. Desktop Chrome              — 10% da base
5. Outros                      — 5%
```

---

## 10. Métricas de Compatibilidade

| Métrica | Target |
|---|---|
| iOS Safari pass rate | > 99% dos testes |
| Android Chrome pass rate | > 99% dos testes |
| Visual regression false positives | < 5% |
| Mobile-specific bugs per release | < 2 |
| Touch target compliance | 100% dos elementos interativos |
| Safe area compliance | 100% das telas |

---

## 11. Referências

- [Apple Human Interface Guidelines — iOS](https://developer.apple.com/design/human-interface-guidelines/ios)
- [Material Design 3 — Android](https://m3.material.io)
- [Can I Use](https://caniuse.com)
- [BrowserStack Device Coverage](https://www.browserstack.com/docs/automate/selenium/browsers-and-os)
- [Playwright Device Descriptors](https://playwright.dev/docs/emulation#devices)
