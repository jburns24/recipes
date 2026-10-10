import type { CheerioAPI } from 'cheerio';
import type { Instruction } from '@recipes/shared';
import { cleanText, parseIsoDuration } from './text.js';

type Json = unknown;
type Obj = Record<string, unknown>;

const isObj = (x: Json): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

/** SingleFile/WordPress sometimes wrap JSON-LD in `// <![CDATA[ ... // ]]>`. */
export function stripCdata(text: string): string {
  return text
    .replace(/^\s*(?:\/\/\s*)?<!\[CDATA\[/, '')
    .replace(/(?:\/\/\s*)?\]\]>\s*$/, '')
    .trim();
}

/** Find the first node whose @type is (or includes) Recipe, searching @graph and arrays. */
export function findRecipeNode(root: Json): Obj | undefined {
  if (Array.isArray(root)) {
    for (const item of root) {
      const hit = findRecipeNode(item);
      if (hit) return hit;
    }
    return undefined;
  }
  if (!isObj(root)) return undefined;
  const type = root['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return root;
  return findRecipeNode(root['@graph']);
}

export function extractRecipeLd($: CheerioAPI): Obj | undefined {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const node = findRecipeNode(JSON.parse(stripCdata($(el).text())));
      if (node) return node;
    } catch {
      // ignore malformed blocks, try the next one
    }
  }
  return undefined;
}

export function parseServes(y: Json): string | undefined {
  const list = (Array.isArray(y) ? y : [y]).map((v) => cleanText(String(v ?? ''))).filter(Boolean);
  if (!list.length) return undefined;
  // prefer an entry with words ("12 servings") over a bare number
  return list.find((v) => /[a-z]/i.test(v)) ?? list[0];
}

function stepText(step: Obj): string {
  return cleanText(step['text'] ?? step['name']);
}

export function parseInstructions(raw: Json): Instruction[] {
  if (typeof raw === 'string') {
    return cleanText(raw)
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((text) => ({ text }))
      .filter((i) => i.text);
  }
  if (!Array.isArray(raw)) return [];
  const out: Instruction[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const text = cleanText(item);
      if (text) out.push({ text });
    } else if (isObj(item) && item['@type'] === 'HowToSection') {
      const name = cleanText(item['name']);
      const steps = parseInstructions(item['itemListElement']);
      steps.forEach((s, i) => out.push(i === 0 && name && !s.lead ? { lead: name, ...s } : s));
    } else if (isObj(item)) {
      const text = stepText(item);
      if (text) out.push({ text });
    }
  }
  return out;
}

export function ldImageUrls(img: Json): string[] {
  if (typeof img === 'string') return [img];
  if (Array.isArray(img)) return img.flatMap(ldImageUrls);
  if (isObj(img) && typeof img['url'] === 'string') return [img['url']];
  return [];
}

export interface LdFields {
  title?: string;
  subtitle?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  serves?: string;
  ingredients: string[];
  instructions: Instruction[];
  imageUrls: string[];
  url?: string;
}

export function readLdFields(node: Obj): LdFields {
  const ing = node['recipeIngredient'];
  const main = node['mainEntityOfPage'];
  const url =
    (typeof node['url'] === 'string' && node['url']) ||
    (typeof main === 'string' && main.startsWith('http') && main) ||
    (isObj(main) && typeof main['@id'] === 'string' && main['@id']) ||
    undefined;
  return {
    title: cleanText(node['name'] ?? node['headline']) || undefined,
    subtitle: cleanText(node['description'] ?? node['Description']) || undefined,
    prepTime: parseIsoDuration(node['prepTime']),
    cookTime: parseIsoDuration(node['cookTime']),
    totalTime: parseIsoDuration(node['totalTime']),
    serves: parseServes(node['recipeYield']),
    ingredients: (Array.isArray(ing) ? ing : []).map(cleanText).filter(Boolean),
    instructions: parseInstructions(node['recipeInstructions']),
    imageUrls: ldImageUrls(node['image']),
    url: url || undefined,
  };
}
