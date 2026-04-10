'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { PATIENTS, type PatientRecord } from '../../lib/fixtures/patients';

/**
 * Accessible patient autocomplete that does NOT break typing.
 *
 * The "doesn't break typing" trick: the component keeps an internal
 * `isFocused` flag, and the parent-to-child `value → query` sync effect
 * short-circuits whenever `isFocused` is true. External re-renders can
 * never overwrite the user's typing buffer mid-keystroke.
 *
 * Implements the WAI-ARIA combobox pattern with listbox popup.
 */
interface PatientAutocompleteProps {
  /** Currently selected MRN. Empty string when nothing is selected. */
  value: string;
  /** Called with the new MRN and the resolved patient (if any). */
  onChange: (mrn: string, patient?: PatientRecord) => void;
  /** Required HTML id (drives label/aria wiring) */
  id: string;
  /** Visible label */
  label: string;
  /** Placeholder for the input */
  placeholder?: string;
  /** Required field flag */
  required?: boolean;
  /** Optional inline help shown below the input */
  help?: string;
}

export function PatientAutocomplete({
  value,
  onChange,
  id,
  label,
  placeholder = 'Buscar por MRN, nome ou ala...',
  required = false,
  help,
}: PatientAutocompleteProps) {
  const reactId = useId();
  const listboxId = `${id}-${reactId}-listbox`;

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const isFocusedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync external value → internal query, but ONLY when not focused.
  // This is the "doesn't break typing" guard.
  useEffect(() => {
    if (isFocusedRef.current) return;
    if (!value) {
      setQuery('');
      return;
    }
    const patient = PATIENTS.find((p) => p.mrn === value);
    setQuery(patient ? `${patient.mrn} — ${patient.name}` : value);
  }, [value]);

  // Debounced query (80ms) so filtering doesn't run on every keystroke
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 80);
    return () => clearTimeout(t);
  }, [query]);

  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return [];
    return PATIENTS.filter((p) => {
      const hay = `${p.mrn} ${p.name} ${p.ward} ${p.diagnosis}`.toLowerCase();
      return q.split(/\s+/).every((token) => hay.includes(token));
    }).slice(0, 8);
  }, [debouncedQuery]);

  function handleSelect(patient: PatientRecord) {
    setQuery(`${patient.mrn} — ${patient.name}`);
    onChange(patient.mrn, patient);
    setIsOpen(false);
    setHighlightedIdx(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setHighlightedIdx((idx) => (results.length === 0 ? -1 : (idx + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setHighlightedIdx((idx) =>
        results.length === 0 ? -1 : (idx - 1 + results.length) % results.length,
      );
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIdx >= 0 && results[highlightedIdx]) {
        e.preventDefault();
        handleSelect(results[highlightedIdx]);
      }
      // Otherwise let the form submit naturally
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIdx(-1);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setHighlightedIdx(-1);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setQuery(next);
    setIsOpen(true);
    setHighlightedIdx(-1);
    // If the user clears or types something that no longer matches the
    // selected patient's display string, reset the parent value.
    if (value) {
      const patient = PATIENTS.find((p) => p.mrn === value);
      if (!patient || next !== `${patient.mrn} — ${patient.name}`) {
        onChange('', undefined);
      }
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          isFocusedRef.current = true;
          if (results.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
          isFocusedRef.current = false;
          // Delay close so click-on-option still fires
          setTimeout(() => setIsOpen(false), 150);
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          highlightedIdx >= 0 ? `${listboxId}-option-${highlightedIdx}` : undefined
        }
        className="w-full min-h-[44px] bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
      />
      {help && (
        <p id={`${id}-help`} className="text-xs text-slate-400">
          {help}
        </p>
      )}
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-2xl max-h-72 overflow-y-auto"
        >
          {results.length === 0 && debouncedQuery.trim().length >= 2 && (
            <li className="px-3 py-2 text-sm text-slate-400">Nenhum paciente encontrado</li>
          )}
          {results.map((p, idx) => {
            const isHighlighted = idx === highlightedIdx;
            return (
              <li
                key={p.mrn}
                id={`${listboxId}-option-${idx}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  // Use mousedown so we beat the input's onBlur
                  e.preventDefault();
                  handleSelect(p);
                }}
                onMouseEnter={() => setHighlightedIdx(idx)}
                className={`px-3 py-2 cursor-pointer ${
                  isHighlighted ? 'bg-blue-700/40' : 'hover:bg-slate-800'
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-blue-300 text-xs">{p.mrn}</span>
                  <span className="text-slate-100 font-semibold text-sm">{p.name}</span>
                </div>
                <div className="text-xs text-slate-400">
                  {p.age} anos · {p.ward}
                  {p.bed && ` · ${p.bed}`} · {p.diagnosis}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
