# Padrões de Formulário — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09
**Bibliotecas:** React Hook Form v7 + Zod v3 + @hookform/resolvers

---

## 1. Visão Geral

Formulários são o principal mecanismo de entrada de dados na plataforma Velya. Desde admissão de pacientes até registro de medicação e passagem de plantão, a qualidade dos formulários impacta diretamente a segurança do paciente e a eficiência operacional.

### 1.1 Princípios

1. **Validação antes do servidor**: Zod valida no cliente antes de enviar
2. **Feedback instantâneo**: Erros aparecem imediatamente, não apenas no submit
3. **Recuperação de dados**: Drafts persistidos, nenhum dado perdido por acidente
4. **Auditoria de ações sensíveis**: Confirmação forte para ações irreversíveis
5. **Touch-first**: Otimizado para dispositivos móveis e teclado virtual
6. **Acessível**: Labels, error messages, focus management por teclado

---

## 2. Arquitetura de Formulário

### 2.1 Stack Técnico

```
Componente React (shadcn/ui Form)
  └── React Hook Form (gerenciamento de estado)
       ├── Zod Schema (validação)
       │    └── @hookform/resolvers (bridge)
       ├── FormField (campo tipado)
       │    ├── FormLabel
       │    ├── FormControl (Input/Select/etc)
       │    ├── FormDescription
       │    └── FormMessage (erro)
       └── onSubmit → Server Action ou API call
```

### 2.2 Padrão Base

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Schema
const patientSchema = z.object({
  name: z
    .string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido'),
  birthDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Data inválida'),
  room: z.string().min(1, 'Quarto é obrigatório'),
  bed: z.string().min(1, 'Leito é obrigatório'),
  attendingDoctor: z.string().min(1, 'Médico responsável é obrigatório'),
  notes: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

// Componente
export function PatientAdmissionForm() {
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: '',
      cpf: '',
      birthDate: '',
      room: '',
      bed: '',
      attendingDoctor: '',
      notes: '',
    },
  });

  async function onSubmit(values: PatientFormValues) {
    try {
      await admitPatient(values);
      toast.success('Paciente admitido com sucesso');
      form.reset();
    } catch (error) {
      toast.error('Erro ao admitir paciente');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome completo *</FormLabel>
              <FormControl>
                <Input placeholder="Nome do paciente" {...field} />
              </FormControl>
              <FormDescription>Conforme documento de identificação</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* ... outros campos */}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Admitindo...' : 'Admitir paciente'}
        </Button>
      </form>
    </Form>
  );
}
```

---

## 3. Validação com Zod

### 3.1 Validação Síncrona

```tsx
const medicationSchema = z.object({
  patientId: z.string().uuid('ID do paciente inválido'),
  medicationId: z.string().uuid('ID do medicamento inválido'),
  dosage: z
    .number()
    .positive('Dosagem deve ser positiva')
    .max(10000, 'Dosagem excede limite máximo'),
  unit: z.enum(['mg', 'ml', 'g', 'UI', 'gotas'], {
    errorMap: () => ({ message: 'Selecione uma unidade válida' }),
  }),
  route: z.enum(['oral', 'iv', 'im', 'sc', 'topica', 'inalatoria'], {
    errorMap: () => ({ message: 'Selecione uma via de administração válida' }),
  }),
  scheduledTime: z.string().datetime('Horário inválido'),
  notes: z.string().max(500, 'Observações devem ter no máximo 500 caracteres').optional(),
});
```

### 3.2 Validação Assíncrona

```tsx
const userSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .refine(async (email) => {
      const exists = await checkEmailExists(email);
      return !exists;
    }, 'Este email já está em uso'),

  cpf: z
    .string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'Formato de CPF inválido')
    .refine(async (cpf) => {
      const valid = await validateCpf(cpf);
      return valid;
    }, 'CPF inválido ou já cadastrado'),

  coren: z
    .string()
    .optional()
    .refine(async (coren) => {
      if (!coren) return true;
      return await validateCoren(coren);
    }, 'COREN inválido'),
});
```

### 3.3 Validação Condicional

```tsx
const handoffSchema = z
  .object({
    type: z.enum(['routine', 'emergency', 'transfer']),
    emergencyReason: z.string().optional(),
    transferDestination: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'emergency' && !data.emergencyReason) {
        return false;
      }
      return true;
    },
    {
      message: 'Motivo da emergência é obrigatório',
      path: ['emergencyReason'],
    },
  )
  .refine(
    (data) => {
      if (data.type === 'transfer' && !data.transferDestination) {
        return false;
      }
      return true;
    },
    {
      message: 'Destino da transferência é obrigatório',
      path: ['transferDestination'],
    },
  );
```

### 3.4 Schemas Compostos

```tsx
// Schemas base reutilizáveis
const addressSchema = z.object({
  street: z.string().min(1, 'Rua é obrigatória'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, 'Bairro é obrigatório'),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado deve ter 2 caracteres'),
  zipCode: z.string().regex(/^\d{5}-\d{3}$/, 'CEP inválido'),
});

const contactSchema = z.object({
  phone: z.string().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone inválido'),
  email: z.string().email('Email inválido').optional(),
  emergencyContact: z.string().min(1, 'Contato de emergência é obrigatório'),
  emergencyPhone: z.string().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone inválido'),
});

// Schema composto
const fullPatientSchema = z.object({
  // Dados pessoais
  name: z.string().min(3),
  cpf: z.string(),
  birthDate: z.string(),
  gender: z.enum(['M', 'F', 'O']),

  // Composição
  address: addressSchema,
  contact: contactSchema,

  // Dados clínicos
  allergies: z.array(z.string()),
  comorbidities: z.array(z.string()),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
});
```

### 3.5 Mensagens em Português

```tsx
// Customização global de mensagens Zod
const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return { message: `Deve ter no mínimo ${issue.minimum} caracteres` };
      }
      if (issue.type === 'number') {
        return { message: `Deve ser no mínimo ${issue.minimum}` };
      }
      break;
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return { message: `Deve ter no máximo ${issue.maximum} caracteres` };
      }
      break;
    case z.ZodIssueCode.invalid_type:
      if (issue.expected === 'string') {
        return { message: 'Campo obrigatório' };
      }
      break;
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: 'Email inválido' };
      }
      break;
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(customErrorMap);
```

---

## 4. Draft e Dirty State

### 4.1 Persistência de Rascunho

Para formulários longos (admissão, handoff), o estado é salvo automaticamente em localStorage:

```tsx
function useFormDraft<T extends z.ZodSchema>(key: string, schema: T, defaultValues: z.infer<T>) {
  // Recupera rascunho salvo
  const savedDraft = useMemo(() => {
    try {
      const stored = localStorage.getItem(`form-draft:${key}`);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return schema.safeParse(parsed).success ? parsed : null;
    } catch {
      return null;
    }
  }, [key, schema]);

  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues: savedDraft || defaultValues,
  });

  // Salva automaticamente a cada mudança
  useEffect(() => {
    const subscription = form.watch((values) => {
      localStorage.setItem(`form-draft:${key}`, JSON.stringify(values));
    });
    return () => subscription.unsubscribe();
  }, [form, key]);

  // Limpa rascunho após submit
  const clearDraft = useCallback(() => {
    localStorage.removeItem(`form-draft:${key}`);
  }, [key]);

  // Indica se há rascunho salvo
  const hasDraft = !!savedDraft;

  return { form, clearDraft, hasDraft };
}
```

### 4.2 Aviso de Saída com Dados Não Salvos

```tsx
function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}

// Uso
function AdmissionForm() {
  const { form } = useFormDraft('admission', schema, defaults);
  useUnsavedChangesWarning(form.formState.isDirty);

  // ...
}
```

### 4.3 Banner de Rascunho Recuperado

```tsx
function DraftRecoveryBanner({ onRestore, onDiscard, savedAt }: DraftRecoveryProps) {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Rascunho encontrado</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>Um rascunho foi salvo em {formatDateTime(savedAt)}.</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDiscard}>
            Descartar
          </Button>
          <Button size="sm" onClick={onRestore}>
            Restaurar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

---

## 5. Auditoria de Ações Sensíveis

### 5.1 Ações que Requerem Confirmação Forte

| Ação                            | Nível de Confirmação                    |
| ------------------------------- | --------------------------------------- |
| Administrar medicação           | Dialog com nome do paciente + medicação |
| Pular medicação                 | Dialog com motivo obrigatório           |
| Alta de paciente                | Dialog com checklist de pendências      |
| Excluir registro                | Dialog com digitação de confirmação     |
| Escalar permissão (break-glass) | Dialog com justificativa + timer        |
| Alterar prescrição              | Dialog com diff do antes/depois         |

### 5.2 Dialog de Confirmação Forte

```tsx
function StrongConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  onConfirm,
  variant = 'destructive',
  requireTyping,
}: StrongConfirmationProps) {
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const isConfirmEnabled = requireTyping ? typed === confirmText : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {requireTyping && (
          <div className="space-y-2">
            <Label>
              Digite <strong>{confirmText}</strong> para confirmar:
            </Label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmText}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Justificativa *</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Descreva o motivo desta ação"
            required
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant={variant}
            onClick={() => onConfirm(reason)}
            disabled={!isConfirmEnabled || !reason.trim()}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 5.3 Registro de Auditoria no Submit

```tsx
async function onSubmitWithAudit(values: FormValues, action: string, session: Session) {
  const result = await submitForm(values);

  if (result.success) {
    await logAuditEvent({
      action,
      userId: session.user.id,
      userName: session.user.name,
      timestamp: new Date().toISOString(),
      details: {
        formValues: sanitizeForAudit(values),
        ip: session.ip,
        userAgent: navigator.userAgent,
      },
    });
  }

  return result;
}
```

---

## 6. Touch-First Mobile

### 6.1 Regras de Input Mobile

1. **Tamanho mínimo de toque**: Inputs com `min-height: 44px`
2. **Font size mínimo**: `16px` em inputs para evitar zoom automático no iOS
3. **Espaçamento entre campos**: `gap-4` mínimo para evitar toques acidentais
4. **Autocomplete**: Atributos HTML para sugestão nativa do browser
5. **Input type correto**: `tel`, `email`, `number`, `date` para teclado adequado

### 6.2 Teclado Virtual Awareness

```tsx
// Detecta teclado virtual aberto
function useVirtualKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if ('virtualKeyboard' in navigator) {
      navigator.virtualKeyboard.overlaysContent = true;
      const handler = () => {
        const { height } = navigator.virtualKeyboard.boundingRect;
        setIsKeyboardOpen(height > 0);
      };
      navigator.virtualKeyboard.addEventListener('geometrychange', handler);
      return () => navigator.virtualKeyboard.removeEventListener('geometrychange', handler);
    }

    // Fallback: detecta via resize
    const initialHeight = window.innerHeight;
    const handler = () => {
      setIsKeyboardOpen(window.innerHeight < initialHeight * 0.75);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return isKeyboardOpen;
}
```

### 6.3 Scroll para Campo com Erro

```tsx
function scrollToFirstError(errors: FieldErrors) {
  const firstErrorKey = Object.keys(errors)[0]
  if (firstErrorKey) {
    const element = document.querySelector(`[name="${firstErrorKey}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      ;(element as HTMLElement).focus()
    }
  }
}

// Uso no form
<form
  onSubmit={form.handleSubmit(onSubmit, (errors) => {
    scrollToFirstError(errors)
  })}
>
```

### 6.4 Layout Mobile de Formulário

```tsx
// Grid responsivo para formulários
function FormGrid({ children, columns = 2 }: { children: React.ReactNode; columns?: number }) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 && 'grid-cols-1 md:grid-cols-2',
        columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
      )}
    >
      {children}
    </div>
  );
}

// Campo que ocupa toda a largura
function FormFieldFull({ children }: { children: React.ReactNode }) {
  return <div className="col-span-full">{children}</div>;
}
```

---

## 7. Foco e Navegação por Teclado

### 7.1 Tab Order

- Tab navega entre campos na ordem visual
- Shift+Tab volta ao campo anterior
- Enter submete o form (em campos de texto) ou avança (em campos select)
- Escape cancela/fecha popovers e dropdowns

### 7.2 Autofocus

```tsx
// Primeiro campo focado ao montar
<FormField
  name="name"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Nome</FormLabel>
      <FormControl>
        <Input {...field} autoFocus />
      </FormControl>
    </FormItem>
  )}
/>
```

### 7.3 Focus Management em Steps

```tsx
function StepForm({ steps, currentStep }: StepFormProps) {
  const stepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Foca primeiro input do step ao mudar
    const firstInput = stepRef.current?.querySelector('input, select, textarea');
    if (firstInput) {
      (firstInput as HTMLElement).focus();
    }
  }, [currentStep]);

  return <div ref={stepRef}>{steps[currentStep].content}</div>;
}
```

---

## 8. Tipos de Input Especializados

### 8.1 Input de CPF com Máscara

```tsx
function CpfInput({ value, onChange, ...props }: InputProps) {
  function formatCpf(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  return (
    <Input
      {...props}
      value={formatCpf(value || '')}
      onChange={(e) => onChange?.(formatCpf(e.target.value))}
      inputMode="numeric"
      placeholder="000.000.000-00"
    />
  );
}
```

### 8.2 Input de Telefone

```tsx
function PhoneInput({ value, onChange, ...props }: InputProps) {
  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    }
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  }

  return (
    <Input
      {...props}
      value={formatPhone(value || '')}
      onChange={(e) => onChange?.(formatPhone(e.target.value))}
      type="tel"
      inputMode="tel"
      placeholder="(00) 00000-0000"
    />
  );
}
```

### 8.3 Escala de Dor (0-10)

```tsx
function PainScaleInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const levels = Array.from({ length: 11 }, (_, i) => i);

  return (
    <div className="space-y-2">
      <Label>Nível de dor (0-10)</Label>
      <div className="flex gap-1">
        {levels.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium transition-colors',
              'border hover:bg-accent',
              value === level && getPainColor(level),
              value === level ? 'text-white border-transparent' : 'text-foreground',
            )}
            aria-label={`Dor nível ${level}`}
            aria-pressed={value === level}
          >
            {level}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{getPainDescription(value)}</p>
    </div>
  );
}

function getPainColor(level: number): string {
  if (level === 0) return 'bg-green-500';
  if (level <= 3) return 'bg-lime-500';
  if (level <= 6) return 'bg-yellow-500';
  if (level <= 8) return 'bg-orange-500';
  return 'bg-red-500';
}

function getPainDescription(level: number): string {
  if (level === 0) return 'Sem dor';
  if (level <= 3) return 'Dor leve';
  if (level <= 6) return 'Dor moderada';
  if (level <= 8) return 'Dor intensa';
  return 'Pior dor possível';
}
```

---

## 9. Formulários Multi-Step

### 9.1 Wizard Pattern

```tsx
function FormWizard<T extends z.ZodSchema>({
  steps,
  schema,
  defaultValues,
  onSubmit,
}: FormWizardProps<T>) {
  const [currentStep, setCurrentStep] = useState(0);
  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
  });

  const currentStepSchema = steps[currentStep].schema;

  async function handleNext() {
    const fields = steps[currentStep].fields;
    const isValid = await form.trigger(fields);
    if (isValid) {
      if (currentStep < steps.length - 1) {
        setCurrentStep((prev) => prev + 1);
      } else {
        form.handleSubmit(onSubmit)();
      }
    }
  }

  function handleBack() {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator steps={steps} currentStep={currentStep} />

      {/* Form content */}
      <Form {...form}>
        <form className="space-y-4">{steps[currentStep].content}</form>
      </Form>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
          Voltar
        </Button>
        <Button onClick={handleNext}>
          {currentStep < steps.length - 1 ? 'Próximo' : 'Concluir'}
        </Button>
      </div>
    </div>
  );
}
```

### 9.2 Step Indicator

```tsx
function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <nav aria-label="Progresso do formulário">
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => (
          <li key={index} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                index < currentStep && 'bg-primary text-primary-foreground',
                index === currentStep && 'border-2 border-primary text-primary',
                index > currentStep && 'border text-muted-foreground',
              )}
            >
              {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span
              className={cn(
                'text-sm hidden sm:inline',
                index === currentStep ? 'font-medium' : 'text-muted-foreground',
              )}
            >
              {step.title}
            </span>
            {index < steps.length - 1 && (
              <div
                className={cn('h-px w-8 sm:w-16', index < currentStep ? 'bg-primary' : 'bg-border')}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

---

## 10. Tratamento de Erros

### 10.1 Erros de Validação (Client)

```tsx
// Mensagens de erro aparecem abaixo de cada campo
<FormMessage /> // shadcn/ui component que exibe form.formState.errors

// Estilo: texto vermelho, ícone de alerta, font-size sm
// Aparece com animação fadeIn suave
```

### 10.2 Erros do Servidor

```tsx
async function onSubmit(values: FormValues) {
  try {
    const result = await createPatient(values);

    if (result.error) {
      // Erros de campo específicos do servidor
      if (result.fieldErrors) {
        Object.entries(result.fieldErrors).forEach(([field, message]) => {
          form.setError(field as any, { type: 'server', message });
        });
        return;
      }

      // Erro genérico
      toast.error(result.error);
      return;
    }

    toast.success('Operação realizada com sucesso');
  } catch (error) {
    toast.error('Erro de comunicação com o servidor. Tente novamente.');
  }
}
```

### 10.3 Indicador de Submissão

```tsx
<Button type="submit" disabled={form.formState.isSubmitting}>
  {form.formState.isSubmitting ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Salvando...
    </>
  ) : (
    'Salvar'
  )}
</Button>
```

---

## 11. Padrões por Domínio

### 11.1 Formulários por Tipo

| Formulário            | Steps | Draft | Confirmação | Auditoria |
| --------------------- | ----- | ----- | ----------- | --------- |
| Login                 | 1     | Não   | Não         | Sim       |
| Admissão de paciente  | 3-4   | Sim   | Sim         | Sim       |
| Registro de medicação | 1     | Não   | Forte       | Sim       |
| Registro de dor       | 1     | Não   | Não         | Sim       |
| Resposta de chamada   | 1     | Não   | Não         | Sim       |
| Passagem de plantão   | 3+    | Sim   | Sim         | Sim       |
| Cadastro de usuário   | 2     | Sim   | Sim         | Sim       |
| Configurações         | 1     | Não   | Não         | Sim       |

### 11.2 Regras de UX por Tipo

- **Formulários críticos** (medicação, admissão): Fundo destacado, borda colorida, confirmação obrigatória
- **Formulários rápidos** (dor, chamada): Mínimo de campos, submit com um toque
- **Formulários longos** (handoff, admissão): Steps, progresso visível, draft automático
- **Formulários de configuração**: Salvar automático por campo (debounced)

---

## 12. Performance

### 12.1 Regras de Performance

1. **Uncontrolled inputs**: React Hook Form usa refs, evitando re-renders
2. **Watch seletivo**: `form.watch('specificField')` ao invés de `form.watch()`
3. **Lazy validation**: Valida no blur e submit, não a cada keystroke (exceto quando necessário)
4. **Memoize options**: Arrays de opções em `useMemo` para selects
5. **Debounce async validation**: 300ms mínimo para validações assíncronas

### 12.2 Métricas

| Métrica                    | Target                  |
| -------------------------- | ----------------------- |
| Tempo de render do form    | < 50ms                  |
| Tempo de validação (sync)  | < 10ms                  |
| Tempo de validação (async) | < 500ms                 |
| Re-renders por keystroke   | 0 (campos uncontrolled) |
| Tempo até feedback de erro | < 200ms (on blur)       |

---

## 13. Testes de Formulário

### 13.1 Estratégia

```tsx
// Unit test: Schema Zod
describe('patientSchema', () => {
  it('rejeita CPF inválido', () => {
    const result = patientSchema.safeParse({ cpf: '000.000.000-00' });
    expect(result.success).toBe(false);
  });

  it('aceita dados válidos', () => {
    const result = patientSchema.safeParse(validPatientData);
    expect(result.success).toBe(true);
  });
});

// Component test: Interação
describe('PatientAdmissionForm', () => {
  it('mostra erro quando campo obrigatório vazio', async () => {
    render(<PatientAdmissionForm />);
    await userEvent.click(screen.getByText('Admitir paciente'));
    expect(screen.getByText('Nome deve ter no mínimo 3 caracteres')).toBeInTheDocument();
  });

  it('submete com dados válidos', async () => {
    render(<PatientAdmissionForm />);
    await userEvent.type(screen.getByLabelText('Nome completo'), 'João Silva');
    // ... preencher outros campos
    await userEvent.click(screen.getByText('Admitir paciente'));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
  });
});
```

---

## 14. Referências

- [React Hook Form Documentation](https://react-hook-form.com)
- [Zod Documentation](https://zod.dev)
- [shadcn/ui Form Component](https://ui.shadcn.com/docs/components/form)
- [@hookform/resolvers](https://github.com/react-hook-form/resolvers)
