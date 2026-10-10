<script lang="ts">
  import type { RecipeDto } from '../lib/types';

  let { recipe }: { recipe: RecipeDto } = $props();

  const meta = $derived(
    [
      ['Prep Time', recipe.prepTime],
      ['Cook Time', recipe.cookTime],
      ['Total Time', recipe.totalTime],
      ['Serves', recipe.serves],
    ].filter((m): m is [string, string] => !!m[1]),
  );
  const space = ' ';
  const hasIngredients = $derived(recipe.ingredients.some((g) => g.items.length > 0));
</script>

<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-md-8 col-lg-6">
      <div class="card shadow-sm">
        <div class="card-body">
          <h1 class="card-title text-center mb-4" data-testid="recipe-title">{recipe.title}</h1>
          {#if recipe.subtitle}
            <p class="text-center text-muted mb-4" data-testid="recipe-subtitle">
              <em>{recipe.subtitle}</em>
            </p>
          {/if}
          {#if meta.length > 0}
            <div class="mb-4 p-3 bg-light rounded" data-testid="recipe-meta">
              {#each meta as [label, value], i (label)}
                <strong>{label}:</strong>
                {value}{#if i < meta.length - 1}<br />{/if}
              {/each}
            </div>
          {/if}
          {#if hasIngredients}
            <h5>Ingredients</h5>
            {#each recipe.ingredients as group, gi (gi)}
              {#if group.group}<h6>{group.group}</h6>{/if}
              <ul>
                {#each group.items as item, i (i)}<li>{item}</li>{/each}
              </ul>
            {/each}
          {/if}
          {#if recipe.instructions.length > 0}
            <h5>Instructions</h5>
            <ol>
              {#each recipe.instructions as step, i (i)}
                <li>
                  {#if step.lead}<strong>{step.lead}:</strong>{space}{/if}{step.text}
                </li>
              {/each}
            </ol>
          {/if}
          {#if recipe.tips.length > 0}
            <h5>Tips &amp; Notes</h5>
            <ul data-testid="recipe-tips">
              {#each recipe.tips as tip, i (i)}<li>{tip}</li>{/each}
            </ul>
          {/if}
        </div>
        {#if recipe.image}
          <div class="text-center pb-4">
            <img
              src={recipe.image}
              alt={recipe.title}
              style="max-width: 350px; width: 100%; height: auto; border-radius: 8px; margin-top: 1rem;"
            />
          </div>
        {/if}
        {#if recipe.source_url}
          <p class="text-center small pb-3 mb-0">
            <a href={recipe.source_url} rel="noopener noreferrer" target="_blank" data-testid="recipe-source">Original source</a>
          </p>
        {/if}
      </div>
    </div>
  </div>
</div>
