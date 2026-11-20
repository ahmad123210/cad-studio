import { describe, it, expect } from 'vitest';
import { findCommand, suggestCommands, codeLabel } from '../../src/engine/commands.ts';

describe('command registry', () => {
  it('resolves Arabic and English aliases', () => {
    expect(findCommand('جدار')?.id).toBe('wall');
    expect(findCommand('W')?.id).toBe('wall');
    expect(findCommand('mi')?.id).toBe('mirror');
    expect(findCommand('نقل')?.id).toBe('move');
    expect(findCommand('???')).toBeUndefined();
  });
  it('suggests by prefix and labels keys', () => {
    expect(suggestCommands('ro').map((c) => c.id)).toContain('rotate');
    expect(codeLabel('KeyW')).toBe('W');
    expect(codeLabel('Digit4')).toBe('4');
  });
});
