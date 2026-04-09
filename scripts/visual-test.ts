import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';

const BASE_URL = process.env.TEST_URL || 'http://velya.172.19.0.6.nip.io';
const SCREENSHOT_DIR = '/tmp/velya-screenshots';

if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

interface PageTest {
  name: string;
  path: string;
  viewport: { width: number; height: number };
  device: string;
  checks: string[];
}

const pages: PageTest[] = [
  // Desktop
  {
    name: 'login-desktop',
    path: '/login',
    viewport: { width: 1440, height: 900 },
    device: 'desktop',
    checks: ['form', 'inputs', 'button'],
  },
  {
    name: 'register-desktop',
    path: '/register',
    viewport: { width: 1440, height: 900 },
    device: 'desktop',
    checks: ['form', 'select', 'inputs'],
  },
  {
    name: 'verify-desktop',
    path: '/verify?email=test@test.com&devCode=123456',
    viewport: { width: 1440, height: 900 },
    device: 'desktop',
    checks: ['code-input'],
  },
  // Mobile iPhone
  {
    name: 'login-mobile',
    path: '/login',
    viewport: { width: 390, height: 844 },
    device: 'iPhone 14',
    checks: ['form', 'touch-targets'],
  },
  {
    name: 'register-mobile',
    path: '/register',
    viewport: { width: 390, height: 844 },
    device: 'iPhone 14',
    checks: ['form', 'scroll'],
  },
  // Tablet
  {
    name: 'login-tablet',
    path: '/login',
    viewport: { width: 768, height: 1024 },
    device: 'iPad',
    checks: ['form', 'centered'],
  },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results: { name: string; status: string; issues: string[]; screenshot: string }[] = [];

  for (const page of pages) {
    const context = await browser.newContext({ viewport: page.viewport });
    const p = await context.newPage();
    const issues: string[] = [];

    try {
      const response = await p.goto(`${BASE_URL}${page.path}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // Check HTTP status
      if (!response || response.status() !== 200) {
        issues.push(`HTTP ${response?.status() || 'no response'}`);
      }

      // Check for JS errors
      p.on('pageerror', (err) => issues.push(`JS Error: ${err.message}`));

      // Wait for content
      await p.waitForTimeout(2000);

      // Check page has content (not blank)
      const bodyText = await p.textContent('body');
      if (!bodyText || bodyText.trim().length < 20) {
        issues.push('Página parece vazia ou com pouco conteúdo');
      }

      // Check for overlapping elements
      const overlaps = await p.evaluate(() => {
        const issues: string[] = [];
        const elements = document.querySelectorAll('input, button, select, a');
        elements.forEach((el) => {
          const rect = (el as HTMLElement).getBoundingClientRect();
          if (rect.width < 30 || rect.height < 30) {
            issues.push(
              `Elemento pequeno demais: ${el.tagName}#${(el as HTMLElement).id || el.className?.toString().slice(0, 30)} (${Math.round(rect.width)}x${Math.round(rect.height)})`,
            );
          }
          if (rect.left < 0 || rect.top < -10) {
            issues.push(
              `Elemento fora da tela: ${el.tagName} (left=${Math.round(rect.left)}, top=${Math.round(rect.top)})`,
            );
          }
        });
        return issues;
      });
      issues.push(...overlaps);

      // Check touch targets on mobile
      if (page.device !== 'desktop') {
        const touchIssues = await p.evaluate(() => {
          const issues: string[] = [];
          const interactiveElements = document.querySelectorAll(
            'input, button, select, a, [role="button"]',
          );
          interactiveElements.forEach((el) => {
            const rect = (el as HTMLElement).getBoundingClientRect();
            if (rect.height < 40 && rect.width > 0 && rect.height > 0) {
              issues.push(
                `Touch target pequeno: ${el.tagName} "${(el as HTMLElement).textContent?.slice(0, 20)}" (h=${Math.round(rect.height)}px, min=44px)`,
              );
            }
          });
          return issues;
        });
        issues.push(...touchIssues);
      }

      // Check text readability (contrast)
      const textIssues = await p.evaluate(() => {
        const issues: string[] = [];
        const texts = document.querySelectorAll('p, span, label, h1, h2, h3, td, th');
        texts.forEach((el) => {
          const style = getComputedStyle(el as HTMLElement);
          const fontSize = parseFloat(style.fontSize);
          if (fontSize < 10 && (el as HTMLElement).textContent?.trim()) {
            issues.push(
              `Texto muito pequeno: "${(el as HTMLElement).textContent?.slice(0, 30)}" (${fontSize}px)`,
            );
          }
        });
        return issues;
      });
      issues.push(...textIssues);

      // Check for broken layout (horizontal scroll)
      const hasHorizontalScroll = await p.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      if (hasHorizontalScroll) {
        issues.push('Scroll horizontal detectado — layout pode estar quebrado');
      }

      // Screenshot
      const screenshotPath = `${SCREENSHOT_DIR}/${page.name}.png`;
      await p.screenshot({ path: screenshotPath, fullPage: true });

      results.push({
        name: page.name,
        status: issues.length === 0 ? 'PASS' : 'ISSUES',
        issues,
        screenshot: screenshotPath,
      });
    } catch (err) {
      issues.push(`Erro: ${(err as Error).message}`);
      results.push({ name: page.name, status: 'ERROR', issues, screenshot: '' });
    }

    await context.close();
  }

  await browser.close();

  // Print report
  console.log('\n══════════════════════════════════════════');
  console.log('  VELYA VISUAL TEST REPORT');
  console.log('══════════════════════════════════════════\n');

  let totalIssues = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'ISSUES' ? '⚠️' : '❌';
    console.log(`${icon} ${r.name} — ${r.status}`);
    if (r.issues.length > 0) {
      r.issues.forEach((i) => console.log(`   → ${i}`));
      totalIssues += r.issues.length;
    }
    if (r.screenshot) console.log(`   📸 ${r.screenshot}`);
    console.log('');
  }

  console.log('══════════════════════════════════════════');
  console.log(`  Total: ${results.length} telas, ${totalIssues} issues`);
  console.log('══════════════════════════════════════════\n');

  process.exit(totalIssues > 0 ? 1 : 0);
}

run().catch(console.error);
