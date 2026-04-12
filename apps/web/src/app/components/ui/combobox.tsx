'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

/**
 * VelyaCombobox — searchable select primitive.
 *
 * Light-theme dropdown with typeahead filtering, keyboard navigation
 * (Arrow keys, Home/End, Enter, Escape), and ARIA combobox semantics.
 * Built on `@radix-ui/react-popover` (positioning + focus management)
 * and `cmdk` (list filtering + active-descendant navigation).
 *
 * Intended to replace plain `<select>` elements in filter bars where the
 * option count or label length makes native selects painful on mobile.
 */
export interface VelyaComboboxOption {
  value: string;
  label: string;
  hint?: string;
}

export interface VelyaComboboxProps {
  options: VelyaComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  contentClassName?: string;
  /** Optional icon rendered before the placeholder/label on the trigger */
  leadingIcon?: React.ReactNode;
}

export const VelyaCombobox = React.forwardRef<HTMLButtonElement, VelyaComboboxProps>(
  function VelyaCombobox(
    {
      options,
      value,
      onChange,
      placeholder = 'Selecione...',
      searchPlaceholder = 'Buscar...',
      emptyText = 'Nenhum resultado encontrado.',
      disabled = false,
      ariaLabel,
      className,
      contentClassName,
      leadingIcon,
    },
    ref,
  ) {
    const [open, setOpen] = React.useState(false);
    const listboxId = React.useId();

    const selected = options.find((o) => o.value === value);

    return (
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            ref={ref}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-label={ariaLabel ?? placeholder}
            disabled={disabled}
            className={cn(
              'inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm',
              'transition-colors hover:border-neutral-300',
              'focus-visible:outline-none focus-visible:border-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-200',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-200',
              'data-[state=open]:border-neutral-400 data-[state=open]:ring-2 data-[state=open]:ring-neutral-200',
              className,
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              {leadingIcon ? (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-neutral-500">
                  {leadingIcon}
                </span>
              ) : null}
              <span
                className={cn(
                  'truncate',
                  selected ? 'text-neutral-900' : 'text-neutral-500',
                )}
              >
                {selected?.label ?? placeholder}
              </span>
            </span>
            <ChevronsUpDown
              className="h-4 w-4 shrink-0 text-neutral-400"
              aria-hidden="true"
            />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            sideOffset={6}
            align="start"
            className={cn(
              'z-50 w-[var(--radix-popover-trigger-width)] min-w-[12rem] overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-900 shadow-lg',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              contentClassName,
            )}
            onOpenAutoFocus={(e) => {
              // Let cmdk focus its input instead of the popover content root.
              e.preventDefault();
            }}
          >
            <Command
              id={listboxId}
              className="flex w-full flex-col"
              // cmdk handles Arrow/Home/End/Enter and aria-activedescendant
              loop
            >
              <div className="flex items-center border-b border-neutral-200 px-3">
                <CommandInput
                  placeholder={searchPlaceholder}
                  className={cn(
                    'flex h-11 w-full bg-transparent py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-500',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                />
              </div>
              <CommandList className="max-h-[260px] overflow-y-auto overflow-x-hidden p-1">
                <CommandEmpty className="px-3 py-6 text-center text-sm text-neutral-500">
                  {emptyText}
                </CommandEmpty>
                <CommandGroup>
                  {options.map((option) => {
                    const isSelected = option.value === value;
                    return (
                      <CommandItem
                        key={option.value}
                        // cmdk filters on `value` by default; include label so
                        // users can type the visible label to filter.
                        value={`${option.label} ${option.hint ?? ''} ${option.value}`}
                        onSelect={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={cn(
                          'relative flex min-h-[44px] cursor-pointer select-none items-start gap-2 rounded-md px-3 py-2 text-sm text-neutral-900 outline-none',
                          'transition-colors',
                          'data-[selected=true]:bg-neutral-100 data-[selected=true]:text-neutral-900',
                          'aria-disabled:pointer-events-none aria-disabled:opacity-50',
                        )}
                      >
                        <Check
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0 text-neutral-900',
                            isSelected ? 'opacity-100' : 'opacity-0',
                          )}
                          aria-hidden="true"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{option.label}</span>
                          {option.hint ? (
                            <span className="truncate text-xs text-neutral-500">
                              {option.hint}
                            </span>
                          ) : null}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  },
);
