'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

/**
 * Velya Button — shadcn/ui-style com variantes médicas.
 * Acento primary em teal com glow sutil.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e17] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-[0_0_16px_-2px_rgba(20,184,166,0.4)] hover:from-teal-400 hover:to-teal-500 hover:shadow-[0_0_24px_-2px_rgba(45,212,191,0.5)] hover:-translate-y-0.5',
        destructive:
          'bg-red-600 text-white shadow-[0_0_16px_-4px_rgba(239,68,68,0.5)] hover:bg-red-500 hover:shadow-[0_0_24px_-2px_rgba(239,68,68,0.6)]',
        outline:
          'border border-white/15 bg-white/[0.03] text-slate-100 hover:bg-white/[0.06] hover:border-teal-400/40 hover:text-teal-300',
        secondary:
          'bg-white/[0.06] text-slate-100 border border-white/[0.08] hover:bg-white/[0.1]',
        ghost: 'text-slate-300 hover:bg-white/[0.06] hover:text-slate-100',
        link: 'text-teal-400 underline-offset-4 hover:underline hover:text-teal-300',
        warning:
          'bg-amber-500/15 text-amber-300 border border-amber-500/35 hover:bg-amber-500/25',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-6 text-base',
        icon: 'h-10 w-10',
        xs: 'h-7 rounded-md px-2 text-xs',
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
