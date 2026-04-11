'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/** Rotas onde o tour NÃO deve abrir — telas pré-login e callbacks. */
const AUTH_ROUTES = new Set(['/login', '/register', '/verify']);

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface TourStep {
  target: string;
  title: string;
  body: string;
  placement: Placement;
}

const STORAGE_KEY = 'velya:onboarding-completed-v1';
const START_EVENT = 'velya:start-onboarding';
const COMPLETED_EVENT = 'velya:onboarding-completed';

const STEPS: TourStep[] = [
  {
    target: '.app-sidebar',
    title: 'Navegação principal',
    body: 'A barra lateral à esquerda agrupa os módulos por área (Assistencial, Gestão, Administração). Os itens são filtrados pelo seu papel automaticamente.',
    placement: 'right',
  },
  {
    target: '.topbar-alerts',
    title: 'Alertas críticos',
    body: 'Pacientes com NEWS2 alto, altas bloqueadas e prescrições falhas aparecem aqui em tempo real. Clique para ver a lista completa.',
    placement: 'bottom',
  },
  {
    target: '[aria-label*="Assistente de IA"]',
    title: 'Assistente de IA',
    body: 'Pressione Ctrl+J para abrir o assistente. Ele respeita a sua função: médicos veem capacidades clínicas, faturamento vê códigos TUSS, etc.',
    placement: 'left',
  },
  {
    target: 'button[aria-label*="Favoritos"]',
    title: 'Favoritos e Recentes',
    body: 'Clique no ícone de estrela em qualquer detalhe para favoritar. Os pacientes que você abriu aparecem em "Recentes" automaticamente.',
    placement: 'bottom',
  },
  {
    target: '#sidebar-suggestion',
    title: 'Suas sugestões importam',
    body: 'Viu algo que pode melhorar? Use este campo para enviar sua sugestão direto para o time. Pressione Ctrl+K a qualquer momento para abrir o palette de comandos.',
    placement: 'top',
  },
];

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const EMPTY_RECT: TargetRect = { top: 0, left: 0, width: 0, height: 0 };

function readCompletedFlag(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function writeCompletedFlag(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // ignore (private mode / storage disabled)
  }
}

function dispatchCompletedEvent(reason: 'completed' | 'skipped'): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent(COMPLETED_EVENT, { detail: { reason } }));
  } catch {
    // ignore
  }
}

export function OnboardingTour() {
  const pathname = usePathname();
  const isOnAuthRoute = AUTH_ROUTES.has(pathname ?? '');

  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<TargetRect>(EMPTY_RECT);
  const [hasTarget, setHasTarget] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

  // Initial mount: activate tour if not completed AND not on auth route.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (isOnAuthRoute) {
      return;
    }
    if (!readCompletedFlag()) {
      setIsActive(true);
      setStepIndex(0);
    }
  }, [isOnAuthRoute]);

  // Listen for external re-trigger (só fora das rotas de auth).
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handler = () => {
      if (isOnAuthRoute) {
        return;
      }
      setStepIndex(0);
      setIsActive(true);
    };
    window.addEventListener(START_EVENT, handler);
    return () => window.removeEventListener(START_EVENT, handler);
  }, [isOnAuthRoute]);

  // Se mudou pra rota de auth, fecha o tour.
  useEffect(() => {
    if (isOnAuthRoute && isActive) {
      setIsActive(false);
      setStepIndex(0);
    }
  }, [isOnAuthRoute, isActive]);

  const currentStep = STEPS[stepIndex];

  const measureTarget = useCallback(() => {
    if (typeof window === 'undefined' || !currentStep) {
      return;
    }
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    let element: Element | null = null;
    try {
      element = document.querySelector(currentStep.target);
    } catch {
      element = null;
    }
    if (!element) {
      setHasTarget(false);
      setRect(EMPTY_RECT);
      return;
    }
    const bounds = element.getBoundingClientRect();
    if (bounds.width === 0 && bounds.height === 0) {
      setHasTarget(false);
      setRect(EMPTY_RECT);
      return;
    }
    setHasTarget(true);
    setRect({
      top: bounds.top,
      left: bounds.left,
      width: bounds.width,
      height: bounds.height,
    });
  }, [currentStep]);

  useLayoutEffect(() => {
    if (!isActive) {
      return;
    }
    measureTarget();
  }, [isActive, stepIndex, measureTarget]);

  // Track resize + scroll + DOM changes.
  useEffect(() => {
    if (!isActive || typeof window === 'undefined') {
      return;
    }
    const handler = () => measureTarget();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(handler);
      observer.observe(document.documentElement);
    }
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [isActive, measureTarget]);

  const finishTour = useCallback((reason: 'completed' | 'skipped') => {
    writeCompletedFlag();
    dispatchCompletedEvent(reason);
    setIsActive(false);
    setStepIndex(0);
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((prev) => {
      if (prev >= STEPS.length - 1) {
        finishTour('completed');
        return prev;
      }
      return prev + 1;
    });
  }, [finishTour]);

  const goBack = useCallback(() => {
    setStepIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  // Keyboard: Escape skips, focus trap on "Próximo".
  useEffect(() => {
    if (!isActive || typeof window === 'undefined') {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finishTour('skipped');
        return;
      }
      if (event.key === 'Tab') {
        // Trap focus on the "Próximo" button.
        event.preventDefault();
        nextButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isActive, finishTour]);

  // Auto-focus the primary action when a step becomes visible.
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const id = window.requestAnimationFrame(() => {
      nextButtonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isActive, stepIndex]);

  // Tooltip position based on placement + target rect.
  const tooltipStyle = useMemo<React.CSSProperties>(() => {
    if (!currentStep) {
      return {};
    }
    if (!hasTarget) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
    const gap = 16;
    const maxWidth = 384; // max-w-sm
    switch (currentStep.placement) {
      case 'right':
        return {
          top: Math.max(16, rect.top),
          left: Math.min(viewport.width - maxWidth - 16, rect.left + rect.width + gap),
        };
      case 'left':
        return {
          top: Math.max(16, rect.top),
          left: Math.max(16, rect.left - maxWidth - gap),
        };
      case 'top':
        return {
          top: Math.max(16, rect.top - gap),
          left: Math.max(
            16,
            Math.min(viewport.width - maxWidth - 16, rect.left + rect.width / 2 - maxWidth / 2),
          ),
          transform: 'translateY(-100%)',
        };
      case 'bottom':
      default:
        return {
          top: rect.top + rect.height + gap,
          left: Math.max(
            16,
            Math.min(viewport.width - maxWidth - 16, rect.left + rect.width / 2 - maxWidth / 2),
          ),
        };
    }
  }, [currentStep, hasTarget, rect, viewport.width]);

  if (!isActive || !currentStep) {
    return null;
  }

  const isLastStep = stepIndex === STEPS.length - 1;
  const isFirstStep = stepIndex === 0;
  const totalSteps = STEPS.length;
  const backdropClickHandler = () => goNext();

  return (
    <div
      aria-hidden={false}
      data-testid="onboarding-tour"
      className="pointer-events-none"
    >
      {hasTarget ? (
        <>
          {/* Top strip */}
          <div
            className="fixed left-0 right-0 top-0 bg-black/70 z-[200] pointer-events-auto cursor-pointer"
            style={{ height: Math.max(0, rect.top) }}
            onClick={backdropClickHandler}
            aria-hidden="true"
          />
          {/* Bottom strip */}
          <div
            className="fixed left-0 right-0 bg-black/70 z-[200] pointer-events-auto cursor-pointer"
            style={{
              top: rect.top + rect.height,
              bottom: 0,
            }}
            onClick={backdropClickHandler}
            aria-hidden="true"
          />
          {/* Left strip */}
          <div
            className="fixed bg-black/70 z-[200] pointer-events-auto cursor-pointer"
            style={{
              top: rect.top,
              left: 0,
              width: Math.max(0, rect.left),
              height: rect.height,
            }}
            onClick={backdropClickHandler}
            aria-hidden="true"
          />
          {/* Right strip */}
          <div
            className="fixed bg-black/70 z-[200] pointer-events-auto cursor-pointer"
            style={{
              top: rect.top,
              left: rect.left + rect.width,
              right: 0,
              height: rect.height,
            }}
            onClick={backdropClickHandler}
            aria-hidden="true"
          />
          {/* Spotlight border */}
          <div
            className="fixed z-[205] border-2 border-blue-400 rounded-lg shadow-2xl pointer-events-none"
            style={{
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
            }}
            aria-hidden="true"
          />
        </>
      ) : (
        <div
          className="fixed inset-0 bg-black/70 z-[200] pointer-events-auto cursor-pointer"
          onClick={backdropClickHandler}
          aria-hidden="true"
        />
      )}

      {/* Tooltip card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-step-title"
        aria-describedby="onboarding-step-body"
        className="fixed z-[210] bg-white border-2 border-blue-500 text-slate-900 rounded-xl p-5 max-w-sm shadow-2xl pointer-events-auto"
        style={tooltipStyle}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-700">
            Tour guiado
          </span>
          <span
            className="text-xs text-slate-600 font-mono"
            aria-label={`Passo ${stepIndex + 1} de ${totalSteps}`}
          >
            {stepIndex + 1} / {totalSteps}
          </span>
        </div>
        <h2
          id="onboarding-step-title"
          className="text-lg font-bold text-slate-900 mb-2"
        >
          {currentStep.title}
        </h2>
        <p
          id="onboarding-step-body"
          className="text-sm text-slate-700 leading-relaxed mb-4"
        >
          {currentStep.body}
        </p>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => finishTour('skipped')}
            className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-md text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Pular
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={isFirstStep}
              className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-md text-sm font-semibold bg-slate-50 border border-slate-300 text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Voltar
            </button>
            <button
              type="button"
              ref={nextButtonRef}
              onClick={goNext}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold bg-blue-600 border border-blue-400 text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {isLastStep ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
