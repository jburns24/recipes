import type { RecipeDto } from './types';

export interface TreeNode {
  name: string;
  /** Full path ("dinner/quick" or "dinner/quick/meatloaf"). */
  path: string;
  children: TreeNode[];
  /** True for recipe leaves. */
  leaf: boolean;
}

/** Build the category tree; sibling order follows first appearance in `recipes`. */
export function buildTree(recipes: RecipeDto[]): TreeNode[] {
  const root: TreeNode = { name: '.', path: '', children: [], leaf: false };
  for (const r of recipes) {
    let node = root;
    const segs = [...r.category];
    segs.forEach((seg, i) => {
      const path = segs.slice(0, i + 1).join('/');
      let child = node.children.find((c) => !c.leaf && c.name === seg);
      if (!child) {
        child = { name: seg, path, children: [], leaf: false };
        node.children.push(child);
      }
      node = child;
    });
    node.children.push({ name: r.slug, path: r.path, children: [], leaf: true });
  }
  return root.children;
}

export interface TreeLine {
  /** Indent + branch characters, e.g. "│   ├── ". */
  prefix: string;
  name: string;
  /** Present for recipe leaves. */
  href?: string;
}

/** Flatten like `tree`: ├── │   └── with 4-char indents. */
export function treeLines(nodes: TreeNode[], indent = ''): TreeLine[] {
  const out: TreeLine[] = [];
  nodes.forEach((n, i) => {
    const last = i === nodes.length - 1;
    const prefix = indent + (last ? '└── ' : '├── ');
    if (n.leaf) out.push({ prefix, name: `${n.name}.html`, href: `/routes/${n.path}` });
    else {
      out.push({ prefix, name: n.name });
      out.push(...treeLines(n.children, indent + (last ? '    ' : '│   ')));
    }
  });
  return out;
}
