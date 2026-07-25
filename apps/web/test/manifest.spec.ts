import { describe, it, expect } from '@jest/globals';
import manifest from '../app/manifest';

describe('Web app manifest', () => {
  const result = manifest();

  it('is installable as a standalone app', () => {
    expect(result.display).toBe('standalone');
    expect(result.start_url).toBe('/');
  });

  it('declares at least one "any" and one "maskable" icon', () => {
    expect(result.icons?.some((icon) => icon.purpose === 'any')).toBe(true);
    expect(result.icons?.some((icon) => icon.purpose === 'maskable')).toBe(
      true,
    );
  });

  it('has a name and short_name', () => {
    expect(result.name).toBeTruthy();
    expect(result.short_name).toBeTruthy();
  });
});
