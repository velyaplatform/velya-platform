'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getPatientByMrn } from '../../lib/fixtures/patients';
import { clearRecentPatients, useRecentPatients } from './recent-patients';

/**
 * Topbar dropdown that shows the most-recently-opened patients. Each row
 * resolves the MRN against the patients fixture so the user sees the full
 * name, ward, and diagnosis without leaving the current page.
 *
 * Closes on outside click and Escape. Uses aria-haspopup="menu" so screen
 * readers announce the trigger correctly.
 */
export function PatientQuickSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const recentMrns = useRecentPatients();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const resolved = recentMrns
    .map((mrn) => ({ mrn, patient: getPatientByMrn(mrn) }))
    .filter((entry) => entry.patient);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Pacientes recentes"
        className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-[var(--header-fg)] hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-neutral-200"
      >
        Recentes
        {recentMrns.length > 0 && (
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-neutral-900 text-white text-[10px] font-bold"
          >
            {recentMrns.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Pacientes recentes"
          className="absolute right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-xl shadow-2xl z-50 p-2 max-h-96 overflow-y-auto"
        >
          {resolved.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-6 px-3">
              Nenhum paciente recente. Os pacientes que você abrir aparecerão aqui.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-1" role="none">
                {resolved.map(({ mrn, patient }) =>
                  patient ? (
                    <li key={mrn} role="none">
                      <Link
                        href={`/patients/${mrn}`}
                        role="menuitem"
                        onClick={() => setIsOpen(false)}
                        className="block min-h-[44px] px-3 py-2 rounded-md hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-xs text-neutral-700">{mrn}</span>
                          <span className="text-sm text-neutral-900 font-semibold truncate">
                            {patient.name}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500 truncate">
                          {patient.age} anos · {patient.ward}
                          {patient.bed && ` · ${patient.bed}`} · {patient.diagnosis}
                        </div>
                      </Link>
                    </li>
                  ) : null,
                )}
              </ul>
              <div className="border-t border-neutral-200 mt-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    clearRecentPatients();
                    setIsOpen(false);
                  }}
                  className="w-full min-h-[40px] text-xs text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-md py-2 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                >
                  Limpar lista
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
