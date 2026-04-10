/**
 * Agent Self-Test (validação estática).
 *
 * Percorre todos os CRON_JOBS registrados em apps/web/src/lib/cron-jobs.ts
 * e verifica, para cada um, se existe um runner correspondente em
 * apps/web/src/lib/cron-runners.ts.
 *
 * Este script NÃO executa runners — é apenas um validador de contrato
 * estático, usado antes do deploy para garantir que nenhum job fica órfão.
 *
 * Saída: exit 0 quando todos os jobs têm runner (inclusive noopRunner);
 *        exit 1 quando pelo menos um runner está completamente ausente.
 *
 * Uso:
 *   npx tsx scripts/agent-self-test.ts
 */

import { CRON_JOBS } from '../apps/web/src/lib/cron-jobs';
import { getRunner } from '../apps/web/src/lib/cron-runners';

interface MissingEntry {
  id: string;
  surface: string;
  label: string;
}

function main(): number {
  const total = CRON_JOBS.length;
  const missing: MissingEntry[] = [];
  const presentBySurface = new Map<string, number>();
  const missingBySurface = new Map<string, number>();

  for (const job of CRON_JOBS) {
    const runner = getRunner(job.id);
    if (!runner) {
      missing.push({ id: job.id, surface: job.surface, label: job.label });
      missingBySurface.set(job.surface, (missingBySurface.get(job.surface) ?? 0) + 1);
    } else {
      presentBySurface.set(job.surface, (presentBySurface.get(job.surface) ?? 0) + 1);
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Velya — Agent Self-Test (validação estática de runners)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total de cron jobs registrados: ${total}`);
  console.log(`Runners encontrados:             ${total - missing.length}`);
  console.log(`Runners ausentes:                ${missing.length}`);
  console.log('');

  if (presentBySurface.size > 0) {
    console.log('Runners presentes por surface:');
    const surfaces = Array.from(presentBySurface.keys()).sort();
    for (const surface of surfaces) {
      console.log(`  • ${surface}: ${presentBySurface.get(surface)}`);
    }
    console.log('');
  }

  if (missing.length === 0) {
    console.log('Resultado: OK — todos os jobs possuem runner (real ou noop).');
    console.log('Exit code: 0');
    return 0;
  }

  console.log('Runners AUSENTES por surface:');
  const missingSurfaces = Array.from(missingBySurface.keys()).sort();
  for (const surface of missingSurfaces) {
    console.log(`  • ${surface}: ${missingBySurface.get(surface)}`);
  }
  console.log('');
  console.log('Detalhes dos runners ausentes:');
  for (const entry of missing) {
    console.log(`  - [${entry.surface}] ${entry.id} — ${entry.label}`);
  }
  console.log('');
  console.log('Resultado: FALHA — existem jobs sem runner correspondente.');
  console.log('Exit code: 1');
  return 1;
}

process.exit(main());
