# Estratégia de Testes Frontend — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09
**Ferramentas:** Vitest, React Testing Library, Playwright, MSW

---

## 1. Visão Geral

A estratégia de testes frontend da Velya é projetada para garantir segurança e confiabilidade em um domínio hospitalar onde falhas de interface podem impactar diretamente o atendimento ao paciente. A pirâmide de testes prioriza cobertura ampla de unidade e componente, com testes E2E para fluxos críticos.

### 1.1 Princípios

1. **Testar comportamento, não implementação**: O que o usuário vê e faz
2. **Priorizar fluxos críticos**: Medicação, chamadas, handoff — testados E2E
3. **Fast feedback**: Testes unitários < 10s, suite completa < 5min
4. **Determinístico**: Sem flakiness, sem dependência de timing
5. **CI-first**: Testes executam em CI antes de merge
6. **Mobile-aware**: Testes consideram viewport mobile e touch

---

## 2. Pirâmide de Testes

```
                    ┌───────────┐
                    │    E2E    │   5-10% (Playwright)
                    │  Críticos │   Fluxos end-to-end
                    ├───────────┤
                    │Integration│   15-20%
                    │  Feature  │   Feature flows, API mocks
                    ├───────────┤
                    │ Component │   30-40%
                    │   Tests   │   Componentes isolados com interação
                    ├───────────┤
                    │   Unit    │   40-50% (Vitest)
                    │   Tests   │   Schemas, utils, hooks, formatters
                    └───────────┘
```

---

## 3. Testes Unitários (Vitest)

### 3.1 Configuração

```tsx
// vitest.config.ts (apps/web)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/test/**',
        'src/types/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

### 3.2 Setup

```tsx
// src/test/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user',
        name: 'Test User',
        email: 'test@velya.health',
        role: 'nurse',
        permissions: ['medication.view', 'medication.administer'],
      },
    },
    status: 'authenticated',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
```

### 3.3 O que Testar com Unit Tests

#### Zod Schemas

```tsx
// schemas/__tests__/patient-schema.test.ts
import { describe, it, expect } from 'vitest';
import { patientSchema } from '../patient-schema';

describe('patientSchema', () => {
  it('aceita dados válidos', () => {
    const result = patientSchema.safeParse({
      name: 'Maria Silva',
      cpf: '123.456.789-09',
      birthDate: '1990-05-15',
      room: '301',
      bed: 'A',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita nome muito curto', () => {
    const result = patientSchema.safeParse({
      name: 'AB',
      cpf: '123.456.789-09',
      birthDate: '1990-05-15',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('name');
  });

  it('rejeita CPF com formato inválido', () => {
    const result = patientSchema.safeParse({
      name: 'Maria Silva',
      cpf: '12345678909', // sem pontuação
      birthDate: '1990-05-15',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita data de nascimento futura', () => {
    const result = patientSchema.safeParse({
      name: 'Maria Silva',
      cpf: '123.456.789-09',
      birthDate: '2090-01-01',
    });
    expect(result.success).toBe(false);
  });
});
```

#### Utility Functions

```tsx
// lib/__tests__/utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate, formatRelativeTime, cn, getPainDescription } from '../utils';

describe('formatDate', () => {
  it('formata data em pt-BR', () => {
    expect(formatDate('2026-04-09')).toBe('09/04/2026');
  });

  it('retorna string vazia para data inválida', () => {
    expect(formatDate('')).toBe('');
  });
});

describe('getPainDescription', () => {
  it.each([
    [0, 'Sem dor'],
    [3, 'Dor leve'],
    [5, 'Dor moderada'],
    [8, 'Dor intensa'],
    [10, 'Pior dor possível'],
  ])('nível %i retorna "%s"', (level, expected) => {
    expect(getPainDescription(level)).toBe(expected);
  });
});

describe('cn', () => {
  it('mescla classes corretamente', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('px-4 py-1');
  });
});
```

#### Custom Hooks

```tsx
// hooks/__tests__/use-debounce.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../use-debounce';

describe('useDebounce', () => {
  it('retorna valor inicial imediatamente', () => {
    const { result } = renderHook(() => useDebounce('hello', 500));
    expect(result.current).toBe('hello');
  });

  it('retorna valor atualizado após delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 500), {
      initialProps: { value: 'hello' },
    });

    rerender({ value: 'world' });
    expect(result.current).toBe('hello');

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('world');

    vi.useRealTimers();
  });
});
```

---

## 4. Testes de Componente (React Testing Library)

### 4.1 Padrão de Teste de Componente

```tsx
// features/patients/__tests__/patient-list.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientList } from '../components/patient-list';
import { TestProviders } from '@/test/providers';

const mockPatients = [
  { id: '1', name: 'Maria Silva', status: 'critical', room: '301', bed: 'A' },
  { id: '2', name: 'João Santos', status: 'stable', room: '302', bed: 'B' },
];

describe('PatientList', () => {
  it('renderiza lista de pacientes', () => {
    render(
      <TestProviders>
        <PatientList patients={mockPatients} />
      </TestProviders>,
    );

    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('João Santos')).toBeInTheDocument();
  });

  it('mostra status chip correto', () => {
    render(
      <TestProviders>
        <PatientList patients={mockPatients} />
      </TestProviders>,
    );

    expect(screen.getByText('Crítico')).toBeInTheDocument();
    expect(screen.getByText('Estável')).toBeInTheDocument();
  });

  it('filtra pacientes por busca', async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <PatientList patients={mockPatients} />
      </TestProviders>,
    );

    await user.type(screen.getByPlaceholderText('Buscar paciente...'), 'Maria');

    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.queryByText('João Santos')).not.toBeInTheDocument();
  });

  it('mostra estado vazio quando sem pacientes', () => {
    render(
      <TestProviders>
        <PatientList patients={[]} />
      </TestProviders>,
    );

    expect(screen.getByText('Nenhum paciente encontrado')).toBeInTheDocument();
  });

  it('chama onSelect ao clicar no paciente', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <TestProviders>
        <PatientList patients={mockPatients} onSelect={onSelect} />
      </TestProviders>,
    );

    await user.click(screen.getByText('Maria Silva'));
    expect(onSelect).toHaveBeenCalledWith(mockPatients[0]);
  });
});
```

### 4.2 Test Providers Wrapper

```tsx
// src/test/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/providers/theme-provider';

const mockSession = {
  user: {
    id: 'test-user',
    name: 'Test User',
    email: 'test@velya.health',
    role: 'nurse',
    permissions: ['medication.view', 'medication.administer'],
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

export function TestProviders({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <SessionProvider session={mockSession}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

### 4.3 Testes de Formulário

```tsx
// features/medication/__tests__/administration-form.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdministrationForm } from '../components/administration-form';
import { TestProviders } from '@/test/providers';

describe('AdministrationForm', () => {
  const mockMedication = {
    id: 'med-1',
    name: 'Dipirona 500mg',
    patient: 'Maria Silva',
    route: 'oral',
    scheduledTime: '2026-04-09T14:00:00Z',
  };

  it('preenche campos automáticos', () => {
    render(
      <TestProviders>
        <AdministrationForm medication={mockMedication} />
      </TestProviders>,
    );

    expect(screen.getByDisplayValue('Dipirona 500mg')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Maria Silva')).toBeInTheDocument();
  });

  it('exibe confirmação antes de submeter', async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdministrationForm medication={mockMedication} />
      </TestProviders>,
    );

    await user.click(screen.getByText('Administrar'));

    expect(screen.getByText('Confirmar administração')).toBeInTheDocument();
    expect(screen.getByText(/Dipirona 500mg/)).toBeInTheDocument();
    expect(screen.getByText(/Maria Silva/)).toBeInTheDocument();
  });

  it('mostra erro de validação quando campo obrigatório vazio', async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdministrationForm medication={mockMedication} />
      </TestProviders>,
    );

    // Limpar campo obrigatório
    const dosageInput = screen.getByLabelText('Dosagem');
    await user.clear(dosageInput);
    await user.click(screen.getByText('Administrar'));

    await waitFor(() => {
      expect(screen.getByText(/Dosagem é obrigatória/i)).toBeInTheDocument();
    });
  });
});
```

---

## 5. Testes de Integração

### 5.1 MSW (Mock Service Worker)

```tsx
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/bff/patients', () => {
    return HttpResponse.json({
      data: [
        { id: '1', name: 'Maria Silva', status: 'critical', room: '301' },
        { id: '2', name: 'João Santos', status: 'stable', room: '302' },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });
  }),

  http.post('/api/bff/medications/:id/administer', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      administeredAt: new Date().toISOString(),
      administeredBy: 'test-user',
    });
  }),

  http.get('/api/bff/patients/:id/pain', ({ params }) => {
    return HttpResponse.json({
      records: [
        { id: 'p1', level: 7, timestamp: '2026-04-09T10:00:00Z', nurse: 'Ana' },
        { id: 'p2', level: 4, timestamp: '2026-04-09T14:00:00Z', nurse: 'Ana' },
      ],
    });
  }),
];

// src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 5.2 Teste de Feature Integrada

```tsx
// features/patients/__tests__/patient-journey.integration.test.tsx
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/mocks/server';
import { TestProviders } from '@/test/providers';
import { PatientJourneyPage } from '../components/patient-journey-page';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Patient Journey — Integration', () => {
  it('carrega e exibe timeline do paciente', async () => {
    render(
      <TestProviders>
        <PatientJourneyPage patientId="1" />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    });

    expect(screen.getByText('Medicação administrada')).toBeInTheDocument();
    expect(screen.getByText('Registro de dor')).toBeInTheDocument();
  });

  it('registra dor e atualiza timeline', async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <PatientJourneyPage patientId="1" />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText('Registrar dor')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Registrar dor'));

    // Selecionar nível 5
    await user.click(screen.getByLabelText('Dor nível 5'));

    // Confirmar
    await user.click(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(screen.getByText('Dor registrada com sucesso')).toBeInTheDocument();
    });
  });
});
```

---

## 6. Testes E2E (Playwright)

### 6.1 Configuração

```tsx
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Desktop
    { name: 'chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'edge', use: { ...devices['Desktop Edge'] } },
    { name: 'safari', use: { ...devices['Desktop Safari'] } },

    // Mobile
    { name: 'iphone-safari', use: { ...devices['iPhone 14'] } },
    {
      name: 'iphone-landscape',
      use: {
        ...devices['iPhone 14'],
        viewport: { width: 844, height: 390 },
      },
    },
    { name: 'android-chrome', use: { ...devices['Pixel 7'] } },
    {
      name: 'android-landscape',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 915, height: 412 },
      },
    },

    // Tablet
    { name: 'ipad', use: { ...devices['iPad Pro 11'] } },
    { name: 'android-tablet', use: { ...devices['Galaxy Tab S4'] } },
  ],
});
```

### 6.2 Testes E2E Críticos

```tsx
// e2e/medication-administration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Administração de Medicação', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'nurse@velya.health');
    await page.fill('[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('fluxo completo de administração', async ({ page }) => {
    // Navegar para medicação
    await page.click('text=Medicação');
    await page.waitForURL('/medication');

    // Selecionar medicação pendente
    await page.click('text=Dipirona 500mg');

    // Verificar dados da medicação
    await expect(page.locator('text=Paciente: Maria Silva')).toBeVisible();
    await expect(page.locator('text=Via: Oral')).toBeVisible();

    // Clicar administrar
    await page.click('button:has-text("Administrar")');

    // Confirmação
    await expect(page.locator('text=Confirmar administração')).toBeVisible();

    // Inserir senha para reauth
    await page.fill('[name="password"]', 'testpassword123');
    await page.click('button:has-text("Confirmar")');

    // Verificar sucesso
    await expect(page.locator('text=Medicação administrada com sucesso')).toBeVisible();

    // Verificar status atualizado
    await expect(page.locator('text=Administrada')).toBeVisible();
  });

  test('bloqueia administração sem reauth', async ({ page }) => {
    await page.goto('/medication');
    await page.click('text=Dipirona 500mg');
    await page.click('button:has-text("Administrar")');

    // Tentar confirmar sem senha
    await page.click('button:has-text("Confirmar")');

    // Botão deve estar desabilitado sem senha
    await expect(page.locator('button:has-text("Confirmar")')).toBeDisabled();
  });
});
```

### 6.3 Testes de Condições Especiais

```tsx
// e2e/degraded-mode.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Modo Degradado', () => {
  test('mostra banner quando offline', async ({ page, context }) => {
    await page.goto('/dashboard');

    // Simular offline
    await context.setOffline(true);

    // Aguardar detecção
    await page.waitForTimeout(2000);

    // Verificar banner
    await expect(page.locator('text=Sem conexão')).toBeVisible();
  });

  test('bloqueia ações em modo offline', async ({ page, context }) => {
    await page.goto('/medication');

    await context.setOffline(true);
    await page.waitForTimeout(2000);

    // Botão de administrar deve estar desabilitado
    const adminButton = page.locator('button:has-text("Administrar")');
    await expect(adminButton).toBeDisabled();
  });
});

// e2e/keyboard-navigation.spec.ts
test.describe('Navegação por Teclado', () => {
  test('navega formulário com Tab', async ({ page }) => {
    await page.goto('/patients/new');

    // Tab entre campos
    await page.keyboard.press('Tab');
    await expect(page.locator('[name="name"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[name="cpf"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[name="birthDate"]')).toBeFocused();
  });
});
```

---

## 7. Matriz de Compatibilidade

### 7.1 Desktop

| Browser | Versão    | Prioridade | Testes       |
| ------- | --------- | ---------- | ------------ |
| Chrome  | Últimas 2 | Alta       | E2E completo |
| Edge    | Últimas 2 | Alta       | E2E completo |
| Safari  | Últimas 2 | Média      | E2E críticos |
| Firefox | Últimas 2 | Baixa      | Smoke test   |

### 7.2 Mobile

| Device/Browser                     | Prioridade  | Testes                |
| ---------------------------------- | ----------- | --------------------- |
| iPhone Safari (últimos 3 iOS)      | **Crítica** | E2E completo + visual |
| Android Chrome (últimos 3 Android) | **Crítica** | E2E completo + visual |
| iPad Safari                        | Alta        | E2E críticos          |
| Android Tablet Chrome              | Média       | Smoke test            |

### 7.3 Condições de Teste

| Condição                     | Testar                              |
| ---------------------------- | ----------------------------------- |
| Portrait                     | Todos os fluxos mobile              |
| Landscape                    | Dashboard, tabelas, formulários     |
| Rede degradada (3G throttle) | Login, dashboard, medicação         |
| Teclado virtual aberto       | Formulários, busca                  |
| Tabelas grandes (500+ rows)  | Lista de pacientes, auditoria       |
| Dark mode                    | Visual regression em todas as telas |

---

## 8. UX e Visual Regression

### 8.1 Screenshot Testing

```tsx
// e2e/visual/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression — Dashboard', () => {
  test('dashboard desktop — light', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-desktop-light.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('dashboard desktop — dark', async ({ page }) => {
    await page.goto('/dashboard');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-desktop-dark.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('dashboard mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
```

---

## 9. Coverage e Targets

### 9.1 Targets de Cobertura

| Camada              | Target            | Métrica  |
| ------------------- | ----------------- | -------- |
| Schemas (Zod)       | 95%               | Lines    |
| Utils/Lib           | 90%               | Lines    |
| Hooks               | 85%               | Lines    |
| Components (UI)     | 80%               | Lines    |
| Features (Business) | 80%               | Lines    |
| E2E Flows           | 100% dos críticos | Cenários |

### 9.2 Fluxos Críticos (100% E2E)

- [ ] Login → Dashboard
- [ ] Admissão de paciente
- [ ] Administração de medicação (com reauth)
- [ ] Registro de dor
- [ ] Resposta a chamada
- [ ] Passagem de plantão (handoff)
- [ ] Break-glass access
- [ ] Logoff e lock screen

---

## 10. CI Pipeline

### 10.1 Workflow

```yaml
# .github/workflows/frontend-tests.yml
name: Frontend Tests

on:
  pull_request:
    paths: ['apps/web/**', 'packages/**']

jobs:
  unit-and-component:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run test -- --coverage
        working-directory: apps/web
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: apps/web/coverage

  e2e:
    runs-on: ubuntu-latest
    needs: unit-and-component
    strategy:
      matrix:
        project: [chrome, iphone-safari, android-chrome]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
        working-directory: apps/web
      - run: npx playwright test --project=${{ matrix.project }}
        working-directory: apps/web
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-${{ matrix.project }}
          path: apps/web/playwright-report
```

---

## 11. Convenções de Teste

### 11.1 Nomenclatura

- Arquivo: `<component>.test.tsx` ou `<module>.test.ts`
- Describe: Nome do componente ou módulo
- It: Frase descritiva em português, começando com verbo

### 11.2 Padrões

```tsx
// BOM: Testa comportamento
it('mostra erro quando CPF é inválido', ...)

// RUIM: Testa implementação
it('chama validateCpf com o valor do input', ...)

// BOM: Testa resultado do usuário
it('desabilita botão de submit enquanto envia', ...)

// RUIM: Testa estado interno
it('seta isSubmitting para true', ...)
```

### 11.3 Regras

1. **Não testar bibliotecas terceiras**: Não testar se shadcn/ui renderiza corretamente
2. **Não testar estilos CSS**: Exceto visual regression via screenshots
3. **Não usar IDs de teste desnecessários**: Preferir roles, labels, texto visível
4. **Cada teste é independente**: Sem dependência de ordem
5. **Mocks mínimos**: Mockar apenas o necessário (API, auth)

---

## 12. Referências

- [Vitest Documentation](https://vitest.dev)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro)
- [Playwright Documentation](https://playwright.dev)
- [MSW (Mock Service Worker)](https://mswjs.io)
- [Testing Trophy (Kent C. Dodds)](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
