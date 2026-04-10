'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * AI Assistant Panel — global slide-out chat that respects the per-user
 * AI policy. Triggered by Cmd/Ctrl+J or by clicking the floating action
 * button at the bottom-right of the screen. Closed by Escape or backdrop.
 *
 * The panel reads the user's policy from /api/ai/policy on first open
 * and renders only the capability shortcuts the user is authorized for.
 * Sending a message hits /api/ai/chat with the chosen capability — the
 * server enforces the gate again so a hand-crafted request can't bypass.
 */

type AiCapability =
  | 'ai.summarize-patient-record'
  | 'ai.suggest-differential-diagnosis'
  | 'ai.suggest-medication'
  | 'ai.suggest-icd10'
  | 'ai.suggest-tuss-code'
  | 'ai.generate-discharge-summary-draft'
  | 'ai.translate-medical-jargon'
  | 'ai.explain-lab-result'
  | 'ai.suggest-cleaning-checklist'
  | 'ai.suggest-supplier-evaluation'
  | 'ai.search-knowledge-base'
  | 'ai.chat-clinical'
  | 'ai.chat-administrative'
  | 'ai.chat-unrestricted'
  | 'ai.execute-bulk-actions'
  | 'ai.modify-system-settings'
  | 'ai.access-audit-trail';

interface PolicyResponse {
  authenticated: boolean;
  professionalRole: string;
  email: string;
  policy: {
    label: string;
    capabilities: AiCapability[];
    maxTokensPerRequest: number;
    maxRequestsPerHour: number;
    requireCitations: boolean;
  };
}

interface AgentSource {
  label: string;
  href: string;
}

interface AgentPendingAction {
  label: string;
  toolId: string;
  args: Record<string, unknown>;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  capability?: AiCapability | 'ai.agent';
  citations?: { title: string; href: string }[];
  evidence?: string[];
  confidence?: 'low' | 'medium' | 'high';
  rateLimitRemaining?: number;
  /** Agent-mode specific: structured sources and pending actions */
  agentSources?: AgentSource[];
  agentPendingAction?: AgentPendingAction;
  agentIntent?: { toolId: string; confidence: number; matchedPattern: string };
  agentSuggestions?: string[];
}

/** Special pseudo-capability that routes to /api/ai/agent (natural-language tool dispatch). */
const AGENT_PSEUDO_CAPABILITY = 'ai.agent' as const;

const CAPABILITY_QUICK_LABELS: Partial<
  Record<AiCapability | typeof AGENT_PSEUDO_CAPABILITY, { label: string; prompt: string }>
> = {
  'ai.agent': {
    label: 'Agente Velya (busca natural)',
    prompt: 'Me traga pacientes da UTI com vancomicina que talvez recebam alta hoje.',
  },
  'ai.chat-clinical': {
    label: 'Conversa clínica',
    prompt: 'Tenho uma dúvida clínica sobre um paciente.',
  },
  'ai.chat-administrative': {
    label: 'Conversa administrativa',
    prompt: 'Preciso de ajuda com fluxo administrativo.',
  },
  'ai.chat-unrestricted': {
    label: 'Modo administrador',
    prompt: 'Investigar atividade do sistema.',
  },
  'ai.summarize-patient-record': {
    label: 'Resumir prontuário',
    prompt: 'Resuma o prontuário do paciente em até 5 bullets.',
  },
  'ai.suggest-differential-diagnosis': {
    label: 'Diagnóstico diferencial',
    prompt: 'Sugira diagnósticos diferenciais para o quadro descrito.',
  },
  'ai.suggest-medication': {
    label: 'Sugerir medicamento',
    prompt: 'Sugira medicamento e posologia para o cenário descrito.',
  },
  'ai.suggest-icd10': {
    label: 'CID-10',
    prompt: 'Sugira códigos CID-10 para o quadro.',
  },
  'ai.suggest-tuss-code': {
    label: 'Código TUSS',
    prompt: 'Sugira códigos TUSS para o procedimento descrito.',
  },
  'ai.generate-discharge-summary-draft': {
    label: 'Rascunho de alta',
    prompt: 'Gere um rascunho de sumário de alta a partir do quadro.',
  },
  'ai.translate-medical-jargon': {
    label: 'Traduzir jargão médico',
    prompt: 'Traduza este termo médico para linguagem leiga.',
  },
  'ai.explain-lab-result': {
    label: 'Explicar resultado de exame',
    prompt: 'Explique este resultado de exame.',
  },
  'ai.suggest-cleaning-checklist': {
    label: 'Checklist de limpeza',
    prompt: 'Sugira checklist de limpeza terminal segundo ANVISA RDC 63/2011.',
  },
  'ai.search-knowledge-base': {
    label: 'Buscar na base',
    prompt: 'Buscar na base de conhecimento interna.',
  },
};

export function AiAssistantPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [policy, setPolicy] = useState<PolicyResponse | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [activeCapability, setActiveCapability] = useState<
    AiCapability | typeof AGENT_PSEUDO_CAPABILITY | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load policy when opened
  useEffect(() => {
    if (!isOpen || policy || policyError) return;
    fetch('/api/ai/policy', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            setPolicyError('Faça login para usar a IA.');
          } else {
            setPolicyError('Não foi possível carregar a política de IA.');
          }
          return;
        }
        const data = (await res.json()) as PolicyResponse;
        setPolicy(data);
        if (data.policy.capabilities.length > 0) {
          // Default to the agent if the user can search the knowledge base
          // (the agent endpoint is gated behind ai.search-knowledge-base).
          if (data.policy.capabilities.includes('ai.search-knowledge-base')) {
            setActiveCapability(AGENT_PSEUDO_CAPABILITY);
          } else {
            const preferredOrder: AiCapability[] = [
              'ai.chat-clinical',
              'ai.chat-administrative',
              'ai.chat-unrestricted',
            ];
            const preferred = preferredOrder.find((c) => data.policy.capabilities.includes(c));
            setActiveCapability(preferred ?? data.policy.capabilities[0]);
          }
        }
      })
      .catch(() => setPolicyError('Erro de rede ao consultar política de IA.'));
  }, [isOpen, policy, policyError]);

  // ⌘J / Ctrl+J to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsOpen((open) => !open);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Focus textarea on open
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const callAgent = useCallback(async (query: string): Promise<ChatMessage> => {
    const res = await fetch('/api/ai/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as { error?: string };
      return { role: 'system', content: `⚠ ${errorData.error ?? `Erro ${res.status}`}` };
    }
    const data = (await res.json()) as {
      mode: string;
      query: string;
      intent: { toolId: string; confidence: number; matchedPattern: string };
      result: {
        status: string;
        summary: string;
        sources?: AgentSource[];
        pendingAction?: AgentPendingAction;
      };
      text: string;
      suggestions?: string[];
      rateLimit?: { remaining: number };
    };
    return {
      role: 'assistant',
      content: data.text,
      capability: AGENT_PSEUDO_CAPABILITY,
      agentSources: data.result.sources,
      agentPendingAction: data.result.pendingAction,
      agentIntent: data.intent,
      agentSuggestions: data.suggestions,
      rateLimitRemaining: data.rateLimit?.remaining,
    };
  }, []);

  const confirmAction = useCallback(async (pa: AgentPendingAction) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ toolId: pa.toolId, args: pa.args }),
      });
      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string };
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: `⚠ ${errorData.error ?? `Erro ${res.status}`}` },
        ]);
        return;
      }
      const data = (await res.json()) as {
        result: { status: string; summary: string; sources?: AgentSource[] };
      };
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.result.summary,
          capability: AGENT_PSEUDO_CAPABILITY,
          agentSources: data.result.sources,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: '⚠ Erro de rede ao confirmar ação.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !activeCapability || isLoading) return;
    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      capability: activeCapability,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    const queryText = input.trim();
    setInput('');
    setIsLoading(true);
    try {
      // ----- Agent mode: natural-language tool dispatch -----
      if (activeCapability === AGENT_PSEUDO_CAPABILITY) {
        const reply = await callAgent(queryText);
        setMessages((prev) => [...prev, reply]);
        return;
      }

      // ----- Chat mode: existing /api/ai/chat path -----
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          capability: activeCapability,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          context: { moduleId: typeof window !== 'undefined' ? window.location.pathname : undefined },
        }),
      });
      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string };
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            content: `⚠ ${errorData.error ?? `Erro ${res.status}`}`,
          },
        ]);
        return;
      }
      const data = (await res.json()) as {
        reply: string;
        capability: AiCapability;
        citations?: { title: string; href: string }[];
        evidence?: string[];
        confidence?: 'low' | 'medium' | 'high';
        rateLimit?: { remaining: number };
      };
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          capability: data.capability,
          citations: data.citations,
          evidence: data.evidence,
          confidence: data.confidence,
          rateLimitRemaining: data.rateLimit?.remaining,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: '⚠ Erro de rede ao chamar a IA.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, activeCapability, isLoading, messages, callAgent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <>
      {/* Floating action button */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Abrir assistente de IA (Ctrl+J)"
        aria-expanded={isOpen}
        title="Assistente de IA — Ctrl+J"
        className="fixed bottom-24 right-6 z-[80] min-h-[52px] min-w-[52px] px-4 py-2.5 rounded-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold shadow-2xl border-2 border-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        <span aria-hidden="true">{'\u2728'}</span> IA
      </button>

      {!isOpen ? null : (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-panel-title"
          className="fixed inset-0 z-[90] flex items-stretch justify-end"
        >
          <button
            type="button"
            aria-label="Fechar assistente de IA"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/60 cursor-default"
          />
          <aside className="relative w-full max-w-lg h-full bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl">
            <header className="flex items-start justify-between p-4 border-b border-slate-700 bg-slate-800">
              <div>
                <h2 id="ai-panel-title" className="text-lg font-bold text-slate-100">
                  <span aria-hidden="true">{'\u2728'}</span> Assistente Velya
                </h2>
                {policy && (
                  <p className="text-xs text-slate-300 mt-1">
                    Política: <strong className="text-blue-300">{policy.policy.label}</strong> ·{' '}
                    {policy.policy.capabilities.length} capacidades
                  </p>
                )}
                {policyError && (
                  <p role="alert" className="text-xs text-red-300 mt-1 font-medium">
                    {policyError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-md bg-slate-800 border border-slate-600 text-slate-100 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            {policy && policy.policy.capabilities.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-700 flex flex-wrap gap-2">
                {/* Agent pseudo-capability — always first when ai.search-knowledge-base is granted */}
                {policy.policy.capabilities.includes('ai.search-knowledge-base') && (
                  <button
                    key={AGENT_PSEUDO_CAPABILITY}
                    type="button"
                    onClick={() => {
                      setActiveCapability(AGENT_PSEUDO_CAPABILITY);
                      const quick = CAPABILITY_QUICK_LABELS[AGENT_PSEUDO_CAPABILITY];
                      if (quick && !input.trim()) setInput(quick.prompt);
                    }}
                    aria-pressed={activeCapability === AGENT_PSEUDO_CAPABILITY}
                    className={`min-h-[40px] px-3 py-2 rounded-md text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                      activeCapability === AGENT_PSEUDO_CAPABILITY
                        ? 'bg-blue-700 text-white border-blue-500'
                        : 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700'
                    }`}
                  >
                    {CAPABILITY_QUICK_LABELS[AGENT_PSEUDO_CAPABILITY]?.label}
                  </button>
                )}
                {policy.policy.capabilities
                  .filter((c) => CAPABILITY_QUICK_LABELS[c])
                  .map((c) => {
                    const isActive = activeCapability === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setActiveCapability(c);
                          const quick = CAPABILITY_QUICK_LABELS[c];
                          if (quick && !input.trim()) setInput(quick.prompt);
                        }}
                        aria-pressed={isActive}
                        className={`min-h-[40px] px-3 py-2 rounded-md text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                          isActive
                            ? 'bg-blue-700 text-white border-blue-500'
                            : 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700'
                        }`}
                      >
                        {CAPABILITY_QUICK_LABELS[c]?.label}
                      </button>
                    );
                  })}
              </div>
            )}

            <div
              className="flex-1 overflow-y-auto p-4 space-y-3"
              role="log"
              aria-live="polite"
              aria-label="Histórico de conversa"
            >
              {messages.length === 0 && !isLoading && (
                <div className="text-center text-slate-400 text-sm py-8">
                  <p>Pronto para ajudar.</p>
                  <p className="text-xs mt-2">
                    Selecione uma capacidade acima e descreva o que precisa. Use{' '}
                    <kbd className="bg-slate-800 border border-slate-600 px-1.5 py-0.5 rounded text-slate-100">
                      Ctrl+Enter
                    </kbd>{' '}
                    para enviar.
                  </p>
                </div>
              )}
              {messages.map((m, idx) => {
                if (m.role === 'system') {
                  return (
                    <div
                      key={idx}
                      role="alert"
                      className="bg-red-900/40 border border-red-700 text-red-100 text-sm rounded-lg px-3 py-2"
                    >
                      {m.content}
                    </div>
                  );
                }
                return (
                  <div
                    key={idx}
                    className={`rounded-lg px-3 py-2 max-w-[90%] ${
                      m.role === 'user'
                        ? 'ml-auto bg-blue-700 text-white'
                        : 'mr-auto bg-slate-800 text-slate-100 border border-slate-700'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    {m.role === 'assistant' && m.confidence && (
                      <div className="mt-2 text-[11px] text-slate-300">
                        Confiança: <strong className="text-blue-300">{m.confidence}</strong>
                        {m.rateLimitRemaining !== undefined && (
                          <>
                            {' · '}Restantes na hora:{' '}
                            <strong className="text-slate-100">{m.rateLimitRemaining}</strong>
                          </>
                        )}
                      </div>
                    )}
                    {m.citations && m.citations.length > 0 && (
                      <ul className="mt-2 text-[11px] text-slate-300 space-y-1 border-t border-slate-700 pt-2">
                        {m.citations.map((c, i) => (
                          <li key={i}>
                            ↳{' '}
                            <a
                              href={c.href}
                              className="text-blue-300 hover:text-blue-200 underline"
                            >
                              {c.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.evidence && m.evidence.length > 0 && (
                      <details className="mt-2 text-[11px] text-slate-400">
                        <summary className="cursor-pointer hover:text-slate-200">
                          Evidências usadas ({m.evidence.length})
                        </summary>
                        <ul className="mt-1 list-disc list-inside space-y-0.5">
                          {m.evidence.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {m.role === 'assistant' && m.agentSources && m.agentSources.length > 0 && (
                      <ul className="mt-2 text-[11px] text-slate-300 space-y-1 border-t border-slate-700 pt-2">
                        {m.agentSources.map((s, i) => (
                          <li key={i}>
                            ↳{' '}
                            <a
                              href={s.href}
                              className="text-blue-300 hover:text-blue-200 underline"
                            >
                              {s.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.role === 'assistant' && m.agentPendingAction && (
                      <div className="mt-3 border-t border-slate-700 pt-2">
                        <button
                          type="button"
                          onClick={() => void confirmAction(m.agentPendingAction!)}
                          disabled={isLoading}
                          className="min-h-[40px] px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60"
                        >
                          ✓ {m.agentPendingAction.label}
                        </button>
                        <p className="text-[10px] text-amber-200 mt-1">
                          Esta ação grava dados — confirmação humana obrigatória.
                        </p>
                      </div>
                    )}
                    {m.role === 'assistant' && m.agentSuggestions && m.agentSuggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-700 pt-2">
                        {m.agentSuggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setInput(s)}
                            className="text-[11px] px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-100 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {isLoading && (
                <div className="mr-auto bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                  <span aria-hidden="true">{'\u23F3'}</span> Pensando...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <footer className="p-4 border-t border-slate-700 bg-slate-800">
              <label htmlFor="ai-panel-input" className="sr-only">
                Mensagem para a IA
              </label>
              <textarea
                id="ai-panel-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeCapability
                    ? 'Escreva sua pergunta — Ctrl+Enter envia'
                    : 'Selecione uma capacidade acima primeiro'
                }
                disabled={!activeCapability || isLoading || !!policyError}
                rows={3}
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-slate-400">
                  IA é advisória — decisões clínicas exigem profissional habilitado
                </p>
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || !activeCapability || isLoading}
                  className="min-h-[44px] px-5 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Enviar
                </button>
              </div>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
