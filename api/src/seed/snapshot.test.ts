import { describe, expect, it } from 'vitest';
import { load } from 'cheerio';
import { findRecipeNode, parseInstructions, parseServes, stripCdata } from './jsonld.js';
import { parseNumberedDirections, parseSnapshot, singleFileUrl } from './snapshot.js';

// 1x1 transparent PNG
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const page = (ld: unknown, body = '') => `<!DOCTYPE html><html><!--
 Page saved with SingleFile
 url: https://example.com/post/
 saved date: x
--><head><script type="application/ld+json">${typeof ld === 'string' ? ld : JSON.stringify(ld)}</script></head><body>${body}</body></html>`;

describe('jsonld helpers', () => {
  it('strips CDATA wrappers', () => {
    expect(stripCdata('\n// <![CDATA[\n{"a":1}\n// ]]>\n')).toBe('{"a":1}');
  });
  it('finds a Recipe inside @graph and in type arrays', () => {
    expect(
      findRecipeNode({ '@graph': [{ '@type': 'Article' }, { '@type': 'Recipe', name: 'x' }] }),
    ).toMatchObject({
      name: 'x',
    });
    expect(findRecipeNode([{ '@type': ['Thing', 'Recipe'], name: 'y' }])).toMatchObject({
      name: 'y',
    });
    expect(findRecipeNode({ '@type': 'Article' })).toBeUndefined();
  });
  it('prefers a yield with words', () => {
    expect(parseServes(['12', '12 servings'])).toBe('12 servings');
    expect(parseServes(12)).toBe('12');
    expect(parseServes(undefined)).toBeUndefined();
  });
  it('flattens HowToSection and labels the first step', () => {
    const steps = parseInstructions([
      { '@type': 'HowToStep', text: 'Prep &amp; chop' },
      {
        '@type': 'HowToSection',
        name: 'Oven',
        itemListElement: [
          { '@type': 'HowToStep', text: 'Bake' },
          { '@type': 'HowToStep', text: 'Cool' },
        ],
      },
    ]);
    expect(steps).toEqual([
      { text: 'Prep & chop' },
      { lead: 'Oven', text: 'Bake' },
      { text: 'Cool' },
    ]);
  });
  it('accepts a plain string of instructions', () => {
    expect(parseInstructions('Mix well. Bake it.')).toEqual([
      { text: 'Mix well.' },
      { text: 'Bake it.' },
    ]);
  });
});

describe('parseSnapshot', () => {
  it('maps schema.org Recipe fields', () => {
    const html = page(
      '// <![CDATA[\n' +
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Recipe',
          name: 'Beer Cheese',
          description: 'Dip &mdash; great',
          prepTime: 'PT10M',
          cookTime: 'PT1H15M',
          totalTime: 'PT1H25M',
          recipeYield: ['12', '12 servings'],
          recipeIngredient: ['1 cup beer', '2 cups cheese '],
          recipeInstructions: [{ '@type': 'HowToStep', text: 'Melt.' }],
          url: 'https://site.example/beer-cheese/#recipe',
          image: ['https://site.example/img/Beer-Cheese-500x500.jpg'],
        }) +
        '\n// ]]>',
      `<img src="data:image/png;base64,${PNG}" data-lazy-src="https://site.example/img/Beer-Cheese.jpg">`,
    );
    const r = parseSnapshot(html, { minImageBytes: 1 });
    expect(r.hasJsonLd).toBe(true);
    expect(r.recipe).toEqual({
      title: 'Beer Cheese',
      subtitle: 'Dip — great',
      prepTime: '10 minutes',
      cookTime: '1 hour 15 minutes',
      totalTime: '1 hour 25 minutes',
      serves: '12 servings',
      ingredients: [{ items: ['1 cup beer', '2 cups cheese'] }],
      instructions: [{ text: 'Melt.' }],
      tips: [],
      source_url: 'https://site.example/beer-cheese/',
    });
    expect(r.image?.ext).toBe('png');
    expect(r.image?.data.length).toBeGreaterThan(0);
  });

  it('falls back to the SingleFile url and numbered DOM directions', () => {
    const html = page(
      { '@type': 'Recipe', name: 'Skillet', recipeIngredient: ['1 egg'] },
      '<div id=dro class=dr><p><strong>How to make:</strong><p><strong>1.</strong>&nbsp;Crack egg.<p><strong>2.</strong> Fry it.</div>',
    );
    const r = parseSnapshot(html);
    expect(r.recipe.source_url).toBe('https://example.com/post/');
    expect(r.recipe.instructions).toEqual([{ text: 'Crack egg.' }, { text: 'Fry it.' }]);
  });

  it('reports pages without Recipe JSON-LD so overrides can fill them in', () => {
    const r = parseSnapshot(page({ '@type': 'Article' }));
    expect(r.hasJsonLd).toBe(false);
    expect(r.recipe).toEqual({ source_url: 'https://example.com/post/' });
  });

  it('picks the hero image by imageMatch and skips small images', () => {
    const html = page(
      { '@type': 'Recipe', name: 'X' },
      `<img src="data:image/png;base64,${PNG}" alt="logo"><img src="data:image/png;base64,${PNG}" class="hero">`,
    );
    expect(
      parseSnapshot(html, { minImageBytes: 1, imageMatch: 'class=hero' }).image?.note,
    ).toContain('class=hero');
    expect(parseSnapshot(html).image).toBeUndefined(); // default 15KB floor
  });
});

describe('helpers', () => {
  it('singleFileUrl reads the header comment', () => {
    expect(singleFileUrl(page({}))).toBe('https://example.com/post/');
  });
  it('parseNumberedDirections ignores un-numbered paragraphs', () => {
    const $ = load('<div id=dro><p>Intro<p><strong>1.</strong> One</div>');
    expect(parseNumberedDirections($)).toEqual([{ text: 'One' }]);
  });
});
