import { describe, expect, it } from 'vitest';
import { recipe } from '../fixtures';
import { buildTree, treeLines } from './tree';

describe('treeLines', () => {
  it('renders tree(1)-style branches with links for leaves', () => {
    const lines = treeLines(
      buildTree([
        recipe({ category: ['breakfast'], slug: 'pancakes', path: 'breakfast/pancakes' }),
        recipe({ category: ['dinner', 'quick'], slug: 'a', path: 'dinner/quick/a' }),
        recipe({ category: ['dinner', 'quick'], slug: 'b', path: 'dinner/quick/b' }),
        recipe({ category: ['dinner', 'salad'], slug: 'c', path: 'dinner/salad/c' }),
      ]),
    );
    expect(lines.map((l) => l.prefix + l.name)).toEqual([
      '├── breakfast',
      '│   └── pancakes.html',
      '└── dinner',
      '    ├── quick',
      '    │   ├── a.html',
      '    │   └── b.html',
      '    └── salad',
      '        └── c.html',
    ]);
    expect(lines[1]?.href).toBe('/routes/breakfast/pancakes');
    expect(lines[0]?.href).toBeUndefined();
  });

  it('puts recipes and sub-categories of the same category side by side', () => {
    const lines = treeLines(
      buildTree([
        recipe({ category: ['snacks'], slug: 'dip', path: 'snacks/dip' }),
        recipe({
          category: ['snacks', 'dehydrator'],
          slug: 'jerky',
          path: 'snacks/dehydrator/jerky',
        }),
      ]),
    );
    expect(lines.map((l) => l.prefix + l.name)).toEqual([
      '└── snacks',
      '    ├── dip.html',
      '    └── dehydrator',
      '        └── jerky.html',
    ]);
  });
});
