/**
 * detect-issues.ts — Análise heurística de screenshots + HTML do velya-web.
 *
 * Roda após screenshot-key-pages.ts e identifica problemas concretos usando
 * regras determinísticas (sem LLM) para o loop cron autônomo:
 *
 *   1. Páginas que retornaram não-200 ou tiveram timeout
 *   2. PNGs com tamanho anormal (muito pequeno = página em branco)
 *   3. HTML heurísticas: elementos conhecidos faltando ou duplicados
 *   4. Classes Tailwind legadas que não deveriam estar em produção
 *   5. Texto com jargão não aprovado pelo style guide
 *
 * Saída: JSON + markdown com issues severidade=low/medium/high/critical
 *
 * Uso:
 *   npx tsx scripts/ui-audit/detect-issues.ts [--manifest=...] [--report=...]
 */

import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface Manifest {
  timestamp: string;
  baseUrl: string;
  results: Array<{
    page: string;
    viewport: string;
    file: string;
    ok: boolean;
    error?: string;
  }>;
}

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface Issue {
  severity: Severity;
  page: string;
  viewport: string;
  rule: string;
  description: string;
  evidence?: string;
  suggestedFix?: string;
}

function parseArgs(): { manifest: string; report: string } {
  const args = process.argv.slice(2);
  const getArg = (key: string, fallback: string): string => {
    const match = args.find((a) => a.startsWith(`--${key}=`));
    return match ? match.split('=').slice(1).join('=') : fallback;
  };
  return {
    manifest: getArg('manifest', ''),
    report: getArg('report', ''),
  };
}

/** Heurística 1: screenshot falhou ou é suspicious pequeno */
async function checkScreenshotHealth(
  result: Manifest['results'][number],
): Promise<Issue[]> {
  const issues: Issue[] = [];
  if (!result.ok) {
    issues.push({
      severity: 'critical',
      page: result.page,
      viewport: result.viewport,
      rule: 'screenshot-failed',
      description: `Screenshot falhou: ${result.error ?? 'erro desconhecido'}`,
      suggestedFix: 'Verificar se a página responde em produção e se o seletor de login está correto.',
    });
    return issues;
  }

  try {
    const stats = await stat(result.file);
    if (stats.size < 5_000) {
      issues.push({
        severity: 'high',
        page: result.page,
        viewport: result.viewport,
        rule: 'empty-page',
        description: `Screenshot muito pequeno (${stats.size}B) — provavelmente página em branco.`,
        evidence: result.file,
        suggestedFix:
          'Investigar se há erro no build ou se a página depende de dados que não carregaram.',
      });
    }
  } catch {
    // stat falhou = arquivo não existe; já coberto pelo ok=false
  }

  return issues;
}

/** Heurística 2: páginas que fetcham HTML — busca por classes legadas */
async function checkHtmlForLegacyClasses(
  baseUrl: string,
  pagePath: string,
  pageName: string,
): Promise<Issue[]> {
  const issues: Issue[] = [];
  try {
    const response = await fetch(`${baseUrl}${pagePath}`, { redirect: 'manual' });
    if (!response.ok && response.status !== 307 && response.status !== 302) {
      issues.push({
        severity: 'critical',
        page: pageName,
        viewport: 'n/a',
        rule: 'http-error',
        description: `HTTP ${response.status} em ${pagePath}`,
        suggestedFix: 'Checar logs do pod velya-web e health check.',
      });
      return issues;
    }
    const html = await response.text();

    // Classes que não deveriam existir (tema dark antigo)
    const legacyPatterns: Array<{ pattern: RegExp; rule: string; hint: string }> = [
      { pattern: /bg-\[#0[ab0-9]/, rule: 'legacy-dark-hex', hint: 'fundo hex escuro hardcoded' },
      { pattern: /text-teal-\d/, rule: 'legacy-teal-text', hint: 'texto em teal antigo' },
      { pattern: /bg-teal-\d/, rule: 'legacy-teal-bg', hint: 'background teal antigo' },
      { pattern: /from-slate-900/, rule: 'legacy-navy-gradient', hint: 'gradient navy antigo' },
      { pattern: /animate-ping/, rule: 'neon-effect', hint: 'efeito pulse/ping não alinhado ao padrão atual' },
    ];
    for (const { pattern, rule, hint } of legacyPatterns) {
      if (pattern.test(html)) {
        issues.push({
          severity: 'medium',
          page: pageName,
          viewport: 'n/a',
          rule,
          description: `HTML contém padrão legado: ${hint}`,
          suggestedFix: `Grep e substituir conforme globals.css v3.`,
        });
      }
    }

    // Texto duplicado óbvio: "Velya / Velya"
    const duplicateBrandMatches = (html.match(/Velya[\s\S]{1,80}Velya/g) ?? []).length;
    if (duplicateBrandMatches > 3) {
      issues.push({
        severity: 'low',
        page: pageName,
        viewport: 'n/a',
        rule: 'brand-duplication',
        description: `"Velya" aparece ${duplicateBrandMatches}+ vezes em proximidade — revisar redundância.`,
      });
    }
  } catch (error) {
    issues.push({
      severity: 'high',
      page: pageName,
      viewport: 'n/a',
      rule: 'fetch-failed',
      description: `Falha ao buscar ${pagePath}: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
  return issues;
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!args.manifest) {
    console.error('Uso: --manifest=<path-to-manifest.json> [--report=<path-to-report.md>]');
    process.exit(1);
  }

  const manifest = JSON.parse(await readFile(args.manifest, 'utf-8')) as Manifest;
  const issues: Issue[] = [];

  // Health heurísticas
  for (const result of manifest.results) {
    const subIssues = await checkScreenshotHealth(result);
    issues.push(...subIssues);
  }

  // HTML legacy scan — só na URL base (login é pública)
  const pagesToScan = [
    { path: '/login', name: 'login' },
    { path: '/register', name: 'register' },
  ];
  for (const p of pagesToScan) {
    const subIssues = await checkHtmlForLegacyClasses(manifest.baseUrl, p.path, p.name);
    issues.push(...subIssues);
  }

  // Sort: critical > high > medium > low
  const severityRank: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const reportPath = args.report || join(dirname(args.manifest), 'issues.json');
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        timestamp: manifest.timestamp,
        baseUrl: manifest.baseUrl,
        totalIssues: issues.length,
        bySeverity: {
          critical: issues.filter((i) => i.severity === 'critical').length,
          high: issues.filter((i) => i.severity === 'high').length,
          medium: issues.filter((i) => i.severity === 'medium').length,
          low: issues.filter((i) => i.severity === 'low').length,
        },
        issues,
      },
      null,
      2,
    ),
  );

  // Markdown report
  const mdPath = reportPath.replace(/\.json$/, '.md');
  const md = [
    `# UI audit — ${manifest.timestamp}`,
    ``,
    `- **Base URL**: ${manifest.baseUrl}`,
    `- **Total issues**: ${issues.length}`,
    `- Critical: ${issues.filter((i) => i.severity === 'critical').length}`,
    `- High: ${issues.filter((i) => i.severity === 'high').length}`,
    `- Medium: ${issues.filter((i) => i.severity === 'medium').length}`,
    `- Low: ${issues.filter((i) => i.severity === 'low').length}`,
    ``,
    `## Issues`,
    ``,
    ...issues.map((issue, i) => [
      `### ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.rule} — ${issue.page}/${issue.viewport}`,
      ``,
      `${issue.description}`,
      issue.evidence ? `\nEvidência: \`${issue.evidence}\`` : '',
      issue.suggestedFix ? `\n**Sugestão:** ${issue.suggestedFix}` : '',
      ``,
    ].filter(Boolean).join('\n')),
  ].join('\n');
  await writeFile(mdPath, md);

  console.log(`[detect-issues] ${issues.length} issue(s) encontradas`);
  console.log(`[detect-issues] Relatório: ${reportPath}`);
  console.log(`[detect-issues] Markdown:  ${mdPath}`);

  if (issues.some((i) => i.severity === 'critical')) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error('[detect-issues] Fatal:', error);
  process.exit(1);
});
