# VelyaCombobox

Caixa de seleção com busca (typeahead) para substituir `<select>` nativo em
barras de filtro e formulários. Tema claro, acessível via teclado, toque
mínimo de 44px.

## Props

| Prop                | Tipo                              | Default                          |
| ------------------- | --------------------------------- | -------------------------------- |
| `options`           | `{ value, label, hint? }[]`       | —                                |
| `value`             | `string`                          | —                                |
| `onChange`          | `(value: string) => void`         | —                                |
| `placeholder`       | `string`                          | `'Selecione...'`                 |
| `searchPlaceholder` | `string`                          | `'Buscar...'`                    |
| `emptyText`         | `string`                          | `'Nenhum resultado encontrado.'` |
| `disabled`          | `boolean`                         | `false`                          |
| `ariaLabel`         | `string`                          | `placeholder`                    |
| `className`         | `string`                          | —                                |
| `contentClassName`  | `string`                          | —                                |
| `leadingIcon`       | `React.ReactNode`                 | —                                |

## Teclado

- `ArrowUp` / `ArrowDown` — navegar opções
- `Home` / `End` — primeira / última opção
- `Enter` — selecionar a opção ativa
- `Escape` — fechar o popover
- Digitação filtra imediatamente pelos campos `label`, `hint` e `value`.

## Uso básico

```tsx
import { VelyaCombobox } from '../components/ui/combobox';

const [ward, setWard] = useState('all');

<VelyaCombobox
  options={[
    { value: 'all', label: 'Todas as Alas' },
    { value: 'uti', label: 'UTI' },
    { value: 'cardio', label: 'Cardiologia' },
  ]}
  value={ward}
  onChange={setWard}
  placeholder="Filtrar por ala"
  ariaLabel="Filtro de ala"
/>;
```

## Com hint

A prop `hint` renderiza uma segunda linha em `text-xs text-neutral-500`
— útil para capacidade, código ou descrição.

```tsx
<VelyaCombobox
  options={[
    { value: 'uti', label: 'UTI', hint: '12 leitos · 3º andar' },
    { value: 'cardio', label: 'Cardiologia', hint: '20 leitos · 2º andar' },
  ]}
  value={ward}
  onChange={setWard}
/>
```

## Desabilitado

```tsx
<VelyaCombobox options={opts} value={val} onChange={setVal} disabled />
```

## Sem opções

Quando `options` está vazio ou o filtro não bate, exibe `emptyText`:

```tsx
<VelyaCombobox
  options={[]}
  value=""
  onChange={() => {}}
  emptyText="Nenhuma ala cadastrada."
/>
```

## Acessibilidade

- `role="combobox"` no trigger, `aria-expanded`, `aria-controls` apontando
  para o listbox.
- `cmdk` gerencia `aria-activedescendant` e `role="listbox"` / `role="option"`
  internamente.
- Altura mínima de 44px em trigger e itens garante alvo de toque confortável.
