import { load } from 'cheerio';

/** Decode HTML entities, normalise whitespace (incl. nbsp), trim. */
export function cleanText(input: unknown): string {
  if (typeof input !== 'string') return '';
  const decoded = input.includes('&') ? load(`<p>${input}</p>`, null, false).text() : input;
  return decoded.replace(/\s+/g, ' ').trim();
}

/** "Dinner Quick" / "Sheet Pan" -> "dinner-quick" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const plural = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'}`;

/**
 * ISO-8601 duration -> human string matching the hand-written pages
 * ("15 minutes", "1 hour 15 minutes"). Returns undefined for zero/invalid.
 * Handles odd forms like "P0Y0M0DT2H0M0.000S" and "PT120M" (-> "2 hours").
 */
export function parseIsoDuration(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const m =
    /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      value.trim(),
    );
  if (!m) return undefined;
  const [, , , w, d, h, min, s] = m.map((x) => (x === undefined ? 0 : Number(x))) as number[];
  const totalMinutes = Math.round(
    (((d ?? 0) + (w ?? 0) * 7) * 24 + (h ?? 0)) * 60 + (min ?? 0) + (s ?? 0) / 60,
  );
  if (totalMinutes <= 0) return undefined;
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(plural(days, 'day'));
  if (hours) parts.push(plural(hours, 'hour'));
  if (minutes) parts.push(plural(minutes, 'minute'));
  return parts.join(' ');
}
