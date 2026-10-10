<script lang="ts">
  import { onMount } from 'svelte';
  import Layout from './components/Layout.svelte';
  import IndexTree from './components/IndexTree.svelte';
  import RecipePage from './components/RecipePage.svelte';
  import StatusMessage from './components/StatusMessage.svelte';
  import { ApiError, fetchRecipe, fetchRecipes } from './lib/api';
  import { initAuth } from './lib/auth.svelte';
  import { router, startRouter } from './lib/router.svelte';
  import type { RecipeDto } from './lib/types';

  type Load<T> =
    | { state: 'loading' }
    | { state: 'ok'; data: T }
    | { state: 'missing' }
    | { state: 'error'; message: string };

  let recipes = $state<Load<RecipeDto[]>>({ state: 'loading' });
  let recipe = $state<Load<RecipeDto>>({ state: 'loading' });

  onMount(() => {
    void initAuth();
    return startRouter();
  });

  const route = $derived(router.route);

  $effect(() => {
    const r = route;
    let cancelled = false;
    if (r.name === 'index') {
      recipes = { state: 'loading' };
      fetchRecipes().then(
        (data) => !cancelled && (recipes = { state: 'ok', data }),
        (e: unknown) => !cancelled && (recipes = { state: 'error', message: messageOf(e) }),
      );
    } else if (r.name === 'recipe') {
      recipe = { state: 'loading' };
      fetchRecipe(r.path).then(
        (data) => !cancelled && (recipe = { state: 'ok', data }),
        (e: unknown) =>
          !cancelled &&
          (recipe =
            e instanceof ApiError && e.status === 404
              ? { state: 'missing' }
              : { state: 'error', message: messageOf(e) }),
      );
    }
    return () => {
      cancelled = true;
    };
  });

  const messageOf = (e: unknown): string => (e instanceof Error ? e.message : 'Unexpected error');

  const pageTitle = $derived(
    route.name === 'recipe' && recipe.state === 'ok'
      ? `${recipe.data.title} Recipe`
      : route.name === 'not-found'
        ? "Not found - JB's Kitchen"
        : "JB's Kitchen",
  );
</script>

<Layout variant={route.name === 'index' ? 'index' : route.name === 'recipe' ? 'recipe' : 'plain'} title={pageTitle}>
  {#if route.name === 'index'}
    <h1 class="text-center">JB's Kitchen</h1>
    {#if recipes.state === 'ok'}
      <IndexTree recipes={recipes.data} />
    {:else if recipes.state === 'error'}
      <StatusMessage kind="error" message={recipes.message} />
    {:else}
      <StatusMessage kind="loading" />
    {/if}
  {:else if route.name === 'recipe'}
    {#if recipe.state === 'ok'}
      <RecipePage recipe={recipe.data} />
    {:else if recipe.state === 'missing'}
      <StatusMessage kind="not-found" title="Recipe not found" />
    {:else if recipe.state === 'error'}
      <StatusMessage kind="error" message={recipe.message} />
    {:else}
      <StatusMessage kind="loading" />
    {/if}
  {:else}
    <StatusMessage kind="not-found" title="Page not found" />
  {/if}
</Layout>
