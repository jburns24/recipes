<script lang="ts">
  import { buildTree, treeLines } from '../lib/tree';
  import type { RecipeDto } from '../lib/types';

  let { recipes }: { recipes: RecipeDto[] } = $props();
  const lines = $derived(treeLines(buildTree(recipes)));
</script>

<!-- prettier-ignore -->
<pre data-testid="index-tree" style="background:#fff;border-radius:8px;padding:2rem;max-width:700px;margin:2rem auto;font-size:1.1rem;">.
{#each lines as l (l.prefix + l.name + (l.href ?? ''))}{l.prefix}{#if l.href}<a href={l.href} data-testid="index-link">{l.name}</a>{:else}{l.name}{/if}
{/each}    </pre>
