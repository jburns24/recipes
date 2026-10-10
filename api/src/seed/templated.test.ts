import { describe, expect, it } from 'vitest';
import { parseTemplatedPage } from './templated.js';

const card = `<html><body><div class="card"><div class="card-body">
<h1 class="card-title">Sym's Meatloaf</h1>
<p class="text-center text-muted mb-4"><em>Classic &amp; comforting.</em></p>
<div class="mb-4 p-3 bg-light rounded">
  <strong>Prep Time:</strong> 15 minutes<br>
  <strong>Cook Time:</strong> 1 hour<br>
  <strong>Total Time:</strong> 1 hour 15 minutes<br>
  <strong>Serves:</strong> 6-8 people
</div>
<h5>Ingredients</h5>
<ul><li>1 lb beef</li><li>2 eggs</li></ul>
<h6>For Serving</h6>
<ul><li>Cilantro</li></ul>
<h5>Instructions</h5>
<ol>
  <li><strong>Preheat oven:</strong> Heat to 350°F.</li>
  <li>Plain step with no lead.</li>
</ol>
<h5>Tips &amp; Notes</h5>
<ul><li>Do not overmix.</li></ul>
</div><img src="meatloaf.jpg" alt="x"></div></body></html>`;

const article = `<body><article class="recipe"><header><h1>Authentic Tom Kha Gai</h1>
<p><strong>Author:</strong> Seonkyoung<br>
<strong>Total Time:</strong> 20 mins<br>
<strong>Yield:</strong> 4</p>
<img src="tom-kha-gai.jpg" alt="x"></header>
<section><h2>Ingredients</h2><ul><li>2 cups broth</li></ul></section>
<section><h2>Instructions</h2><ol><li>Boil.</li><li>Serve!</li></ol></section></article></body>`;

describe('parseTemplatedPage', () => {
  it('parses the bootstrap card layout', () => {
    const { recipe, imageSrc } = parseTemplatedPage(card);
    expect(recipe).toEqual({
      title: "Sym's Meatloaf",
      subtitle: 'Classic & comforting.',
      prepTime: '15 minutes',
      cookTime: '1 hour',
      totalTime: '1 hour 15 minutes',
      serves: '6-8 people',
      ingredients: [
        { items: ['1 lb beef', '2 eggs'] },
        { group: 'For Serving', items: ['Cilantro'] },
      ],
      instructions: [
        { lead: 'Preheat oven', text: 'Heat to 350°F.' },
        { text: 'Plain step with no lead.' },
      ],
      tips: ['Do not overmix.'],
    });
    expect(imageSrc).toBe('meatloaf.jpg');
  });

  it('parses the article layout (author, total time, yield)', () => {
    const { recipe, imageSrc } = parseTemplatedPage(article);
    expect(recipe.title).toBe('Authentic Tom Kha Gai');
    expect(recipe.subtitle).toBe('By Seonkyoung');
    expect(recipe.totalTime).toBe('20 mins');
    expect(recipe.serves).toBe('4');
    expect(recipe.ingredients).toEqual([{ items: ['2 cups broth'] }]);
    expect(recipe.instructions).toEqual([{ text: 'Boil.' }, { text: 'Serve!' }]);
    expect(imageSrc).toBe('tom-kha-gai.jpg');
  });

  it('treats a notes paragraph as a tip', () => {
    const html = `<div class="card-body"><h1>T</h1><h5>Ingredients</h5><ul><li>a</li></ul>
      <h5>Instructions</h5><ol><li>b</li></ol><h5>Notes</h5><p>Keep it hot.</p></div>`;
    expect(parseTemplatedPage(html).recipe.tips).toEqual(['Keep it hot.']);
  });
});
