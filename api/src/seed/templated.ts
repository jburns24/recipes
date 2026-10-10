import { load } from 'cheerio';
import type { Recipe, IngredientGroup, Instruction } from '@recipes/shared';
import { cleanText } from './text.js';

export interface TemplatedResult {
  recipe: Omit<Recipe, 'slug' | 'category' | 'image'>;
  /** Relative src of the <img>, resolved against the html file's directory. */
  imageSrc?: string;
}

const META_KEYS: Record<string, 'prepTime' | 'cookTime' | 'totalTime' | 'serves'> = {
  'prep time': 'prepTime',
  'cook time': 'cookTime',
  'total time': 'totalTime',
  serves: 'serves',
  yield: 'serves',
};

type Section = 'none' | 'ingredients' | 'instructions' | 'tips';

function sectionOf(heading: string): Section {
  const h = heading.toLowerCase();
  if (h.startsWith('ingredient')) return 'ingredients';
  if (h.startsWith('instruction') || h.startsWith('direction') || h.startsWith('method'))
    return 'instructions';
  if (h.includes('tip') || h.includes('note')) return 'tips';
  return 'none';
}

/** "<strong>Lead:</strong> rest" -> { lead: "Lead", text: "rest" } */
function parseStep($li: ReturnType<ReturnType<typeof load>>): Instruction {
  const strong = $li.children('strong').first();
  const full = cleanText($li.text());
  if (strong.length && $li.contents().first().is('strong')) {
    const lead = cleanText(strong.text()).replace(/:$/, '');
    const text = cleanText(full.slice(cleanText(strong.text()).length));
    if (lead && text) return { lead, text };
  }
  return { text: full };
}

/**
 * Parses the two hand-authored layouts under src/routes:
 *  - Bootstrap card (.card-body): h1.card-title, optional <em> subtitle, meta box
 *    (strong "Label:" value<br>), h5 sections, optional h6 ingredient groups
 *  - plain <article class="recipe"> (tom-kha-gai): h1, "Author/Total Time/Yield"
 *    paragraph, h2 sections
 */
export function parseTemplatedPage(html: string): TemplatedResult {
  const $ = load(html);
  const root = $('.card-body').length ? $('.card-body').first() : $('article, body').first();
  const title = cleanText($('h1').first().text());

  const meta: Partial<Record<'prepTime' | 'cookTime' | 'totalTime' | 'serves', string>> = {};
  let subtitle: string | undefined;
  const ingredients: IngredientGroup[] = [];
  const instructions: Instruction[] = [];
  const tips: string[] = [];
  let section: Section = 'none';
  let group: string | undefined;

  // Meta lines: <strong>Label:</strong> value up to the next <br>/<strong>
  const readMeta = (container: ReturnType<typeof $>): void => {
    container.find('strong').each((_, el) => {
      const label = cleanText($(el).text()).replace(/:$/, '').toLowerCase();
      let value = '';
      let n = el.nextSibling;
      while (n && !(n.type === 'tag' && (n.name === 'br' || n.name === 'strong'))) {
        value += n.type === 'text' ? (n as unknown as { data: string }).data : $(n).text();
        n = n.nextSibling;
      }
      const key = META_KEYS[label];
      if (key && cleanText(value)) meta[key] = cleanText(value);
      if (label === 'author' && cleanText(value)) subtitle ??= `By ${cleanText(value)}`;
    });
  };

  root.find('h1, h2, h5, h6, ul, ol, p, div.p-3').each((_, node) => {
    const $n = $(node);
    const tag = node.tagName;
    if ($n.closest('li').length) return;
    if (tag === 'h1') return;
    if (tag === 'h2' || tag === 'h5') {
      section = sectionOf(cleanText($n.text()));
      group = undefined;
      return;
    }
    if (tag === 'h6') {
      group = cleanText($n.text());
      return;
    }
    if (tag === 'div') {
      readMeta($n);
      return;
    }
    if (tag === 'p') {
      if ($n.find('strong').length && section === 'none') return readMeta($n);
      const text = cleanText($n.text());
      if (!text) return;
      if (section === 'tips') tips.push(text);
      else if (section === 'none' && !subtitle) subtitle = text;
      return;
    }
    const items = $n
      .children('li')
      .toArray()
      .map((li) => $(li));
    if (section === 'ingredients') {
      const list = items.map((li) => cleanText(li.text())).filter(Boolean);
      if (list.length) ingredients.push(group ? { group, items: list } : { items: list });
    } else if (section === 'instructions') {
      instructions.push(...items.map(parseStep).filter((s) => s.text));
    } else if (section === 'tips') {
      tips.push(...items.map((li) => cleanText(li.text())).filter(Boolean));
    }
  });

  const imageSrc = $('img').first().attr('src');
  return {
    recipe: {
      title,
      ...(subtitle ? { subtitle } : {}),
      ...meta,
      ingredients,
      instructions,
      tips,
    },
    ...(imageSrc ? { imageSrc } : {}),
  };
}
