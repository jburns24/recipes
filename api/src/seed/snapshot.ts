import { load, type CheerioAPI } from 'cheerio';
import type { Instruction, Recipe } from '@recipes/shared';
import { cleanText } from './text.js';
import { extractRecipeLd, readLdFields } from './jsonld.js';

export interface ExtractedImage {
  data: Buffer;
  ext: string;
  /** diagnostics: attributes of the chosen <img> (without the data URI) */
  note: string;
}

export interface SnapshotResult {
  /** Parsed fields; may be sparse when the page has no Recipe JSON-LD (see overrides). */
  recipe: Partial<Omit<Recipe, 'slug' | 'category' | 'image'>>;
  hasJsonLd: boolean;
  image?: ExtractedImage;
}

export interface SnapshotOptions {
  /** Substring that must appear in the hero <img>'s attributes (excluding src). */
  imageMatch?: string;
  /** Skip images smaller than this many bytes (icons, avatars, thumbnails). */
  minImageBytes?: number;
}

const EXT: Record<string, string> = {
  jpeg: 'jpg',
  jpg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
};

/** "https://x/y/Foo-Bar-500x375.jpg?x=1" -> "foo-bar" */
function imageStem(url: string): string {
  const file = url.split('?')[0]?.split('/').pop() ?? '';
  return file
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/-\d+x\d+$/, '')
    .toLowerCase();
}

/** SingleFile header comment carries the original URL. */
export function singleFileUrl(html: string): string | undefined {
  return /Page saved with SingleFile\s+url:\s*(\S+)/.exec(html.slice(0, 1000))?.[1];
}

interface Candidate {
  data: Buffer;
  ext: string;
  attrs: string;
  index: number;
}

function candidates($: CheerioAPI, minBytes: number): Candidate[] {
  const out: Candidate[] = [];
  $('img').each((index, el) => {
    const src = $(el).attr('src') ?? '';
    const m = /^data:image\/([a-z+]+);base64,(.+)$/s.exec(src);
    if (!m) return;
    const data = Buffer.from(m[2] ?? '', 'base64');
    if (data.length < minBytes) return;
    const attrs = Object.entries(el.attribs)
      .filter(([k]) => k !== 'src')
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    out.push({ data, ext: EXT[m[1] ?? ''] ?? 'jpg', attrs, index });
  });
  return out;
}

export function pickHeroImage(
  $: CheerioAPI,
  ldImageUrls: string[],
  opts: SnapshotOptions = {},
): ExtractedImage | undefined {
  const list = candidates($, opts.minImageBytes ?? 15_000);
  if (!list.length) return undefined;
  let hero: Candidate | undefined;
  if (opts.imageMatch) {
    hero = list.find((c) => c.attrs.includes(opts.imageMatch as string));
  } else {
    const stems = [...ldImageUrls, $('meta[property="og:image"]').attr('content') ?? '']
      .map(imageStem)
      .filter(Boolean);
    hero = list.find((c) => stems.some((s) => c.attrs.toLowerCase().includes(s)));
    // otherwise first sizeable image that has a text description
    hero ??= list[0];
  }
  return (
    hero && {
      data: hero.data,
      ext: hero.ext,
      note: `img#${hero.index} ${hero.attrs.slice(0, 160)}`,
    }
  );
}

/**
 * eatwell101.com keeps its JSON-LD without recipeInstructions; the steps live in
 * `<div id=dro class=dr><p><strong>1.</strong> text ...`. Un-numbered paragraphs
 * (intro lines, ads) are skipped.
 */
export function parseNumberedDirections($: CheerioAPI): Instruction[] {
  const out: Instruction[] = [];
  $('#dro p').each((_, p) => {
    const first = $(p).children().first();
    if (!first.is('strong') || !/^\d+\.?$/.test(cleanText(first.text()))) return;
    first.remove();
    const text = cleanText($(p).text());
    if (text) out.push({ text });
  });
  return out;
}

export function parseSnapshot(html: string, opts: SnapshotOptions = {}): SnapshotResult {
  const $ = load(html);
  const node = extractRecipeLd($);
  const image = pickHeroImage($, node ? readLdFields(node).imageUrls : [], opts);
  if (!node) {
    // No Recipe JSON-LD: only provenance can be recovered automatically; see overrides.ts.
    const url = singleFileUrl(html);
    return {
      recipe: url ? { source_url: url } : {},
      hasJsonLd: false,
      ...(image ? { image } : {}),
    };
  }

  const f = readLdFields(node);
  if (!f.instructions.length) f.instructions = parseNumberedDirections($);
  const sourceUrl = f.url ?? singleFileUrl(html);
  const recipe: SnapshotResult['recipe'] = {
    ...(f.title ? { title: f.title } : {}),
    ...(f.subtitle ? { subtitle: f.subtitle } : {}),
    ...(f.prepTime ? { prepTime: f.prepTime } : {}),
    ...(f.cookTime ? { cookTime: f.cookTime } : {}),
    ...(f.totalTime ? { totalTime: f.totalTime } : {}),
    ...(f.serves ? { serves: f.serves } : {}),
    ingredients: f.ingredients.length ? [{ items: f.ingredients }] : [],
    instructions: f.instructions,
    tips: [],
    ...(sourceUrl ? { source_url: sourceUrl.replace(/#.*$/, '') } : {}),
  };
  return { recipe, hasJsonLd: true, ...(image ? { image } : {}) };
}
