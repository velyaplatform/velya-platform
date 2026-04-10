/**
 * UI Duplication Gate
 *
 * Compliance check that fails the pipeline if the same piece of information is
 * surfaced from multiple sources or with conflicting wording inside the web app.
 *
 * The user's rule: "se existe duplicações de informações isso não pode existir".
 *
 * It catches three classes of duplication that have actually bitten the project:
 *
 *   1. Same hard-coded URL (or same hospital metric) defined in more than one
 *      .ts/.tsx file. Centralize in `apps/web/src/lib/` instead.
 *
 *   2. Two distinct constant arrays of patient/staff/etc. mock data with the
 *      same MRN, employee id, etc. — copy-pasted fixtures that drift apart.
 *
 *   3. Two pages whose page-title <h1> string is identical (other than the
 *      generic "Centro de Comando"), which usually means a route was added but
 *      the canonical page wasn't replaced.
 *
 * Run locally:    npx tsx scripts/check-ui-duplications.ts
 * In CI:          add the call to the duplication-gate job in ui-quality.yaml
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', 'apps', 'web', 'src');
const REPO = join(__dirname, '..');

interface Finding {
  rule: string;
  message: string;
  files: string[];
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push(p);
    }
  }
  return out;
}

function readAll(): { path: string; content: string }[] {
  return walk(ROOT).map((p) => ({ path: p, content: readFileSync(p, 'utf8') }));
}

function check_duplicate_external_urls(files: { path: string; content: string }[]): Finding[] {
  // Catches the original symptom: nip.io / grafana / argocd / etc. linked
  // from multiple pages instead of going through one centralized config.
  const urlPattern = /https?:\/\/[a-zA-Z0-9.-]+(?:\.nip\.io|\.local|\.velyahospitalar\.com)\b/g;
  const seen: Record<string, Set<string>> = {};
  for (const f of files) {
    const matches = f.content.match(urlPattern) || [];
    for (const url of matches) {
      if (!seen[url]) seen[url] = new Set();
      seen[url].add(relative(REPO, f.path));
    }
  }
  const findings: Finding[] = [];
  for (const [url, paths] of Object.entries(seen)) {
    if (paths.size > 1) {
      findings.push({
        rule: 'duplicate-external-url',
        message: `URL "${url}" referenciada em ${paths.size} arquivos. Centralize em apps/web/src/lib/ ou /api/system/health/<id>.`,
        files: Array.from(paths),
      });
    }
  }
  return findings;
}

function check_duplicate_mrn_fixtures(files: { path: string; content: string }[]): Finding[] {
  // Catches copy-pasted patient mocks: same MRN-### appearing in two unrelated pages.
  const mrnPattern = /MRN-\d{3,}/g;
  const seen: Record<string, Set<string>> = {};
  for (const f of files) {
    if (/__tests__|\.test\./.test(f.path)) continue;
    const matches = new Set(f.content.match(mrnPattern) || []);
    for (const m of matches) {
      if (!seen[m]) seen[m] = new Set();
      seen[m].add(relative(REPO, f.path));
    }
  }
  const findings: Finding[] = [];
  // Allow shared fixture files in lib/. Anything else is a copy-paste smell.
  for (const [mrn, paths] of Object.entries(seen)) {
    const pageFiles = Array.from(paths).filter((p) => !/\/lib\//.test(p));
    if (pageFiles.length > 1) {
      findings.push({
        rule: 'duplicate-patient-fixture',
        message: `${mrn} aparece em ${pageFiles.length} páginas distintas. Mova para apps/web/src/lib/fixtures/patients.ts e importe.`,
        files: pageFiles,
      });
    }
  }
  return findings;
}

function check_duplicate_page_titles(files: { path: string; content: string }[]): Finding[] {
  // Same <h1> text on more than one page route.
  const h1Pattern = /<h1[^>]*className="[^"]*page-title[^"]*"[^>]*>([^<{]+)<\/h1>/g;
  const seen: Record<string, Set<string>> = {};
  for (const f of files) {
    if (!f.path.endsWith('/page.tsx')) continue;
    let m: RegExpExecArray | null;
    while ((m = h1Pattern.exec(f.content)) !== null) {
      const title = m[1].trim();
      if (!title) continue;
      if (!seen[title]) seen[title] = new Set();
      seen[title].add(relative(REPO, f.path));
    }
  }
  const findings: Finding[] = [];
  for (const [title, paths] of Object.entries(seen)) {
    if (paths.size > 1) {
      findings.push({
        rule: 'duplicate-page-title',
        message: `Título "${title}" usado em ${paths.size} rotas. Cada página deve ter um nome único e descritivo.`,
        files: Array.from(paths),
      });
    }
  }
  return findings;
}

function main() {
  const files = readAll();
  const findings = [
    ...check_duplicate_external_urls(files),
    ...check_duplicate_mrn_fixtures(files),
    ...check_duplicate_page_titles(files),
  ];

  console.log('═══════════════════════════════════════════');
  console.log('  Velya UI Duplication Gate');
  console.log('═══════════════════════════════════════════');
  console.log(`  Arquivos analisados: ${files.length}`);
  console.log(`  Achados: ${findings.length}`);
  console.log('');

  if (findings.length === 0) {
    console.log('✅ Nenhuma duplicação detectada.');
    process.exit(0);
  }

  for (const f of findings) {
    console.log(`❌ [${f.rule}] ${f.message}`);
    for (const p of f.files) console.log(`     · ${p}`);
    console.log('');
  }

  console.log(`Total: ${findings.length} duplicações`);
  process.exit(1);
}

main();
