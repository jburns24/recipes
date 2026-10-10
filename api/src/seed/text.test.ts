import { describe, expect, it } from 'vitest';
import { cleanText, parseIsoDuration, slugify } from './text.js';

describe('parseIsoDuration', () => {
  it.each([
    ['PT10M', '10 minutes'],
    ['PT1M', '1 minute'],
    ['PT1H', '1 hour'],
    ['PT1H15M', '1 hour 15 minutes'],
    ['PT120M', '2 hours'],
    ['PT125M', '2 hours 5 minutes'],
    ['P0Y0M0DT0H40M0.000S', '40 minutes'],
    ['P0Y0M0DT2H0M0.000S', '2 hours'],
    ['P1DT8H10M', '1 day 8 hours 10 minutes'],
    ['PT8H', '8 hours'],
  ])('%s -> %s', (iso, expected) => {
    expect(parseIsoDuration(iso)).toBe(expected);
  });

  it.each([['PT0M'], ['P0D'], ['nonsense'], [''], [undefined], [42]])('%s -> undefined', (v) => {
    expect(parseIsoDuration(v)).toBeUndefined();
  });
});

describe('cleanText', () => {
  it('decodes entities and collapses whitespace incl. nbsp', () => {
    expect(cleanText('165&deg;,  10&ndash;12   minutes &mdash; done')).toBe(
      '165°, 10–12 minutes — done',
    );
  });
  it('returns empty string for non-strings', () => {
    expect(cleanText(undefined)).toBe('');
  });
});

describe('slugify', () => {
  it('makes kebab slugs', () => {
    expect(slugify("Sym's Meatloaf & Gravy!")).toBe('syms-meatloaf-gravy');
  });
});
