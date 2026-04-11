'use client';

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

/**
 * Accessible form field wrapper. Renders the label, the child input, and
 * either an error or help message — wired together via aria-describedby
 * and aria-invalid. The parent only has to pass `id` matching the input.
 */
interface FormFieldProps {
  id: string;
  label: string;
  /** Inline help shown when there is no error */
  help?: string;
  /** Error message — when set, takes precedence over help and triggers aria-invalid */
  error?: string;
  /** Mark the field required (adds an asterisk and required attribute on supported children) */
  required?: boolean;
  /** The actual input/select/textarea element — must accept aria-* props */
  children: ReactNode;
}

export function FormField({ id, label, help, error, required, children }: FormFieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = errorId ?? helpId;

  // If the child is a single React element, inject ARIA props on it.
  // Otherwise (fragment, array, plain text), render it as-is.
  let childContent: ReactNode = children;
  const onlyChild = Children.toArray(children).find((c) => isValidElement(c));
  if (onlyChild && isValidElement(onlyChild)) {
    const element = onlyChild as ReactElement<{
      id?: string;
      'aria-describedby'?: string;
      'aria-invalid'?: boolean;
      required?: boolean;
    }>;
    childContent = cloneElement(element, {
      id: element.props.id ?? id,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : undefined,
      required: required ?? element.props.required,
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-700 ml-0.5">
            *
          </span>
        )}
      </label>
      {childContent}
      {!error && help && (
        <p id={helpId} className="text-xs text-slate-500">
          {help}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-xs text-red-700 mt-1 font-medium"
        >
          <span aria-hidden="true">{'\u26A0\uFE0F'}</span> {error}
        </p>
      )}
    </div>
  );
}
