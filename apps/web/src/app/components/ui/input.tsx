'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        // Uso pl-3 / pr-3 explícitos para que tailwind-merge substitua
        // corretamente quando o consumer passa pl-9 (input com ícone à esquerda).
        // px-3 agrupado é mais difícil de sobrepor de forma confiável em
        // todos os cenários.
        // h-11 (44px) hits WCAG 2.2 AA minimum touch target on mobile/tablet.
        'flex h-11 w-full rounded-lg border border-neutral-300 bg-white pl-3 pr-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-500',
        'transition-colors focus-visible:outline-none focus-visible:border-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-200',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className,
      )}
      {...props}
    />
  );
});
