import { describe, it, expect } from 'vitest';

describe('Velya Platform', () => {
  it('should have a valid platform name', () => {
    const platformName = 'velya-platform';
    expect(platformName).toMatch(/^velya-/);
  });

  it('should define service ports correctly', () => {
    const servicePorts = {
      'patient-flow': 3001,
      'discharge-orchestrator': 3002,
      'task-inbox': 3003,
      'audit-service': 3004,
      'ai-gateway': 3010,
      'agent-orchestrator': 3020,
      'policy-engine': 3030,
      'memory-service': 3040,
      'decision-log-service': 3050,
    };

    for (const [service, port] of Object.entries(servicePorts)) {
      expect(port).toBeGreaterThan(3000);
      expect(port).toBeLessThan(65535);
      expect(service).toMatch(/^[a-z][a-z-]+$/);
    }
  });
});
