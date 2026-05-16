import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClientId } from './clientId';

describe('createClientId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses a fallback when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});

    expect(createClientId('room')).toMatch(/^room-/);
  });
});
