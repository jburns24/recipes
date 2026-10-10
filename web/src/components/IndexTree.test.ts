import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { recipe } from '../fixtures';
import IndexTree from './IndexTree.svelte';

describe('IndexTree', () => {
  it('renders a monospace <pre> tree with a link per recipe', () => {
    render(IndexTree, {
      recipes: [
        recipe(),
        recipe({ slug: 'tom-kha-gai', path: 'dinner/quick/tom-kha-gai' }),
        recipe({ category: ['drinks'], slug: 'butter-beer', path: 'drinks/butter-beer' }),
      ],
    });
    const tree = screen.getByTestId('index-tree');
    expect(tree.tagName).toBe('PRE');
    expect(tree.textContent).toContain('.\n├── dinner\n│   └── quick\n');
    expect(tree.textContent).toContain('│       ├── meatloaf.html\n');
    expect(tree.textContent).toContain('└── drinks\n    └── butter-beer.html\n');
    const links = screen.getAllByTestId('index-link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/routes/dinner/quick/meatloaf',
      '/routes/dinner/quick/tom-kha-gai',
      '/routes/drinks/butter-beer',
    ]);
    expect(links[0]).toHaveTextContent('meatloaf.html');
  });
});
