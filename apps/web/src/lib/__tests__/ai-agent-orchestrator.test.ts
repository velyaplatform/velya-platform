import { describe, it, expect } from 'vitest';
import { classifyIntent, normalizeQuery } from '../ai-agent-orchestrator';

describe('ai-agent-orchestrator / normalizeQuery', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizeQuery('  TEXT  ')).toBe('text');
  });

  it('collapses internal whitespace runs', () => {
    expect(normalizeQuery('Dr.   Carlos    Silva')).toBe('dr. carlos silva');
  });

  it('strips ascii control characters', () => {
    expect(normalizeQuery('ab\u0000cd\u001fef')).toBe('ab cd ef');
  });

  it('returns an empty string for a fully whitespace input', () => {
    expect(normalizeQuery('   \t  ')).toBe('');
  });
});

describe('ai-agent-orchestrator / classifyIntent', () => {
  it('classifies "quem está de plantão na UTI" as search-staff', () => {
    const match = classifyIntent('quem está de plantão na UTI');
    expect(match.toolId).toBe('search-staff');
    expect(match.confidence).toBeGreaterThanOrEqual(0.85);
    expect(match.args).toMatchObject({ ward: 'uti', onDutyOnly: true });
  });

  it('classifies a ward + medication + discharge question as search-patients with all args', () => {
    const match = classifyIntent('me traga pacientes UTI com vancomicina alta hoje');
    expect(match.toolId).toBe('search-patients');
    expect(match.args).toMatchObject({
      ward: 'uti',
      medication: 'vancomicina',
      candidatesForDischarge: true,
    });
    expect(match.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies "preencha o handoff para Dr. Carlos" as propose-handoff with toUserName', () => {
    const match = classifyIntent('preencha o handoff para Dr. Carlos');
    expect(match.toolId).toBe('propose-handoff');
    expect(match.args).toMatchObject({ toUserName: 'carlos', confirm: false });
  });

  it('classifies "atualizar prescrição PRESC-001" as update-record for prescriptions', () => {
    const match = classifyIntent('atualizar prescrição PRESC-001');
    expect(match.toolId).toBe('update-record');
    expect(match.args).toMatchObject({
      moduleId: 'prescriptions',
      recordId: 'PRESC-001',
      confirm: false,
    });
  });

  it('classifies "o que existe na plataforma" as list-modules', () => {
    const match = classifyIntent('o que existe na plataforma');
    expect(match.toolId).toBe('list-modules');
    expect(match.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('falls back to semantic-search-modules with low confidence when nothing matches', () => {
    const match = classifyIntent('xyz random texto sem padrão');
    expect(match.toolId).toBe('semantic-search-modules');
    expect(match.confidence).toBeLessThan(0.6);
    expect(match.matchedPattern).toBe('fallback-semantic-search');
  });

  it('preserves the original raw query in semantic-search fallback args', () => {
    const match = classifyIntent('xyz totalmente aleatorio');
    expect(match.toolId).toBe('semantic-search-modules');
    expect(match.args).toMatchObject({ query: 'xyz totalmente aleatorio' });
  });

  it('classifies critical findings queries with high confidence', () => {
    const match = classifyIntent('me mostra os findings críticos');
    expect(match.toolId).toBe('list-cron-findings');
    expect(match.args).toMatchObject({ severity: 'critical' });
    expect(match.confidence).toBeGreaterThanOrEqual(0.9);
  });
});
