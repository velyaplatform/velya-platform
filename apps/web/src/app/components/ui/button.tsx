'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

/**
 * Velya Button — estilo EHR/healthcare com acento azul médico (blue-600).
 * Sem glow ou efeitos gamer — sombra sutil, transição suave.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 active:bg-neutral-700',
        destructive:
          'bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 active:bg-neutral-700',
        outline:
          'border border-neutral-300 bg-white text-neutral-700 shadow-sm hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-900',
        secondary:
          'bg-neutral-100 text-neutral-900 border border-neutral-200 hover:bg-neutral-200',
        ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
        link: 'text-neutral-900 underline-offset-4 hover:underline hover:text-neutral-700',
        warning:
          'bg-neutral-100 text-neutral-800 border border-neutral-300 hover:bg-neutral-200',
        success:
          'bg-neutral-900 text-white shadow-sm hover:bg-neutral-800',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-6 text-base',
        icon: 'h-10 w-10',
        xs: 'h-7 rounded-md px-2.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  );
});

export { buttonVariants };
