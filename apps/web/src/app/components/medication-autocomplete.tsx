'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { PHARMACY_STOCK, type PharmacyStockItem } from '../../lib/fixtures/pharmacy-stock';
import { useDebouncedValue } from './use-debounced-value';

/**
 * Medication autocomplete combobox. Same "doesn't break typing" pattern as
 * PatientAutocomplete: parent owns `value`, internal `query` is preserved
 * while focused. Sources both a hardcoded list of common Brazilian hospital
 * meds AND the live PHARMACY_STOCK from fixtures so prescribers can pick
 * either a generic name or a specific lot in stock.
 */

interface MedicationOption {
  /** Display name */
  name: string;
  /** Source: 'common' (hardcoded) or 'stock' (PHARMACY_STOCK) */
  source: 'common' | 'stock';
  /** Stock item if source = 'stock' */
  stockItem?: PharmacyStockItem;
}

const COMMON_MEDS: string[] = [
  'Dipirona 500mg',
  'Paracetamol 500mg',
  'Ibuprofeno 600mg',
  'Diclofenaco 50mg',
  'Cetoprofeno 100mg',
  'Tramadol 50mg',
  'Morfina 10mg/mL',
  'Codeína 30mg',
  'Fentanil 0.05mg/mL',
  'Amoxicilina 500mg',
  'Amoxicilina + Clavulanato 875mg',
  'Cefalexina 500mg',
  'Cefepime 1g',
  'Ceftriaxona 1g',
  'Vancomicina 500mg',
  'Meropenem 1g',
  'Piperacilina + Tazobactam 4.5g',
  'Metronidazol 500mg',
  'Azitromicina 500mg',
  'Ciprofloxacino 400mg',
  'Levofloxacino 500mg',
  'Sulfametoxazol + Trimetoprima 800/160mg',
  'Omeprazol 40mg',
  'Pantoprazol 40mg',
  'Ranitidina 50mg',
  'Ondansetrona 8mg',
  'Bromoprida 10mg',
  'Furosemida 40mg',
  'Hidroclorotiazida 25mg',
  'Espironolactona 25mg',
  'Losartana 50mg',
  'Captopril 25mg',
  'Enalapril 10mg',
  'Anlodipino 5mg',
  'Atenolol 25mg',
  'Metoprolol 25mg',
  'Sinvastatina 40mg',
  'Atorvastatina 20mg',
  'Insulina NPH 100UI/mL',
  'Insulina Regular 100UI/mL',
  'Glargina 100UI/mL',
  'Heparina 5000UI',
  'Enoxaparina 40mg',
  'Varfarina 5mg',
  'Clopidogrel 75mg',
  'AAS 100mg',
  'Hidrocortisona 100mg',
  'Prednisona 20mg',
  'Dexametasona 4mg',
  'Salbutamol spray',
  'Ipratrópio spray',
  'Budesonida 400mcg',
  'Soro fisiológico 0.9% 500mL',
  'Ringer lactato 500mL',
  'Glicose 5% 500mL',
  'Noradrenalina 4mg/4mL',
  'Adrenalina 1mg/mL',
  'Dopamina 50mg/10mL',
  'Dobutamina 250mg/20mL',
  'Midazolam 5mg/mL',
  'Propofol 200mg/20mL',
  'Cetamina 50mg/mL',
  'Etomidato 20mg/10mL',
];

interface MedicationAutocompleteProps {
  value: string;
  onChange: (medication: string, stockItem?: PharmacyStockItem) => void;
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export function MedicationAutocomplete({
  value,
  onChange,
  id,
  label,
  placeholder = 'Digite o nome do medicamento...',
  required = false,
}: MedicationAutocompleteProps) {
  const reactId = useId();
  const listboxId = `${id}-${reactId}-listbox`;

  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const isFocusedRef = useRef(false);

  // Sync external value → internal query, but ONLY when not focused
  useEffect(() => {
    if (isFocusedRef.current) return;
    setQuery(value);
  }, [value]);

  const debounced = useDebouncedValue(query, 80);

  const results = useMemo<MedicationOption[]>(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/);
    const matches = (haystack: string) => tokens.every((t) => haystack.toLowerCase().includes(t));

    const fromStock = PHARMACY_STOCK.filter((item) => matches(item.name)).map((item) => ({
      name: item.name,
      source: 'stock' as const,
      stockItem: item,
    }));

    const fromCommon = COMMON_MEDS.filter(
      (name) => matches(name) && !fromStock.some((s) => s.name.toLowerCase() === name.toLowerCase()),
    ).map((name) => ({ name, source: 'common' as const }));

    return [...fromStock, ...fromCommon].slice(0, 10);
  }, [debounced]);

  function handleSelect(opt: MedicationOption) {
    setQuery(opt.name);
    onChange(opt.name, opt.stockItem);
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
    onChange(next, undefined);
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-400 ml-0.5">
            *
          </span>
        )}
      </label>
      <input
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
        className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
      />
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-2xl max-h-72 overflow-y-auto"
        >
          {results.length === 0 && debounced.trim().length >= 2 && (
            <li className="px-3 py-2 text-sm text-slate-500">Nenhum medicamento encontrado</li>
          )}
          {results.map((opt, idx) => {
            const isHighlighted = idx === highlightedIdx;
            return (
              <li
                key={`${opt.source}-${opt.name}-${idx}`}
                id={`${listboxId}-option-${idx}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt);
                }}
                onMouseEnter={() => setHighlightedIdx(idx)}
                className={`px-3 py-2 cursor-pointer ${
                  isHighlighted ? 'bg-blue-700/40' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-900 font-semibold">{opt.name}</span>
                  {opt.source === 'stock' && (
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-green-900/40 text-green-800 border border-green-700/60">
                      em estoque
                    </span>
                  )}
                </div>
                {opt.stockItem && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    Lote {opt.stockItem.lot} · valid. {opt.stockItem.expiry} ·{' '}
                    {opt.stockItem.stockQty} {opt.stockItem.unit}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
