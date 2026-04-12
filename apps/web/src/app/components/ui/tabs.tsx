'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../../lib/utils';

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex h-11 items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1',
        className,
      )}
      {...props}
    />
  );
});

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium text-neutral-500 transition-all',
        'hover:text-neutral-900',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:bg-neutral-100 data-[state=active]:text-neutral-900 data-[state=active]:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]',
        '[&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200',
        className,
      )}
      {...props}
    />
  );
});
