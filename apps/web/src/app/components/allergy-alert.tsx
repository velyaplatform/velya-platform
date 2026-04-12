'use client';

import { useMemo } from 'react';
import { COCKPITS } from '../../lib/fixtures/patient-cockpits';

interface AllergyAlertProps {
  patientMrn: string;
  medication: string;
  onRecognize?: () => void;
  onCancel?: () => void;
}

const MEDICATION_CLASSES: Record<string, string[]> = {
  Amoxicilina: ['Penicilina', 'Betalactamico'],
  Cefepime: ['Cefalosporina', 'Betalactamico'],
  Ceftriaxona: ['Cefalosporina', 'Betalactamico'],
  Penicilina: ['Penicilina', 'Betalactamico'],
  Dipirona: ['AINE', 'Pirazolona'],
  Paracetamol: ['Analgesico'],
  Ibuprofeno: ['AINE'],
  Diclofenaco: ['AINE'],
  Morfina: ['Opioide'],
  Tramadol: ['Opioide'],
  Vancomicina: ['Glicopeptideo'],
  Heparina: ['Anticoagulante'],
  Enoxaparina: ['Anticoagulante', 'Heparina'],
};

interface AllergyMatch {
  allergy: string;
  reason: 'direct' | 'class';
  matchedClass?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function findAllergyMatch(allergies: string[], medication: string): AllergyMatch | null {
  const medTrimmed = medication.trim();
  if (medTrimmed === '') return null;

  const normalizedMed = normalize(medTrimmed);
  const classes = MEDICATION_CLASSES[medTrimmed] ?? [];

  for (const allergy of allergies) {
    const normalizedAllergy = normalize(allergy);
    if (normalizedAllergy === normalizedMed) {
      return { allergy, reason: 'direct' };
    }
    for (const className of classes) {
      if (normalize(className) === normalizedAllergy) {
        return { allergy, reason: 'class', matchedClass: className };
      }
    }
  }
  return null;
}

export default function AllergyAlert({
  patientMrn,
  medication,
  onRecognize,
  onCancel,
}: AllergyAlertProps) {
  const match = useMemo(() => {
    const cockpit = COCKPITS[patientMrn];
    if (!cockpit) return null;
    return findAllergyMatch(cockpit.allergies, medication);
  }, [patientMrn, medication]);

  if (!match) return null;

  const medTrimmed = medication.trim();
  const explanation =
    match.reason === 'direct'
      ? `Paciente alergico a ${match.allergy}, e ${medTrimmed} e exatamente a substancia relatada.`
      : `Paciente alergico a ${match.allergy}, e ${medTrimmed} e da classe dos ${match.matchedClass?.toLowerCase() ?? 'medicamentos relacionados'}.`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-lg border-2 border-neutral-300 bg-neutral-100 p-5 text-neutral-900 shadow-lg"
    >
      <h3 className="text-xl font-bold text-neutral-900">ALERGIA RELATADA</h3>
      <p className="mt-2 text-sm text-neutral-700">{explanation}</p>
      <p className="mt-1 text-xs text-neutral-700">
        Prontuario: <span className="font-semibold">{patientMrn}</span>
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRecognize}
          className="min-h-[44px] rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          Reconhecer e continuar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-md bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          Cancelar prescricao
        </button>
      </div>
    </div>
  );
}
