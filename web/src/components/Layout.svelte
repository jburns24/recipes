<script lang="ts">
  import type { Snippet } from 'svelte';
  import AuthButton from './AuthButton.svelte';
  import UploadDialog from './UploadDialog.svelte';
  import { auth } from '../lib/auth.svelte';

  let {
    variant,
    title,
    children,
  }: { variant: 'index' | 'recipe' | 'plain'; title: string; children: Snippet } = $props();

  let uploadOpen = $state(false);

  // The legacy index styled <body class="container">; recipe pages used <body class="bg-light">.
  $effect(() => {
    document.title = title;
    document.body.className = variant === 'index' ? 'container' : 'bg-light';
  });
</script>

<div class="app-toolbar" data-testid="toolbar">
  {#if variant !== 'index'}
    <a href="/" class="btn btn-sm btn-outline-secondary" data-testid="home-link">Home</a>
  {/if}
  {#if auth.signedIn}
    <button
      type="button"
      class="btn btn-sm btn-primary"
      data-testid="upload-button"
      onclick={() => (uploadOpen = true)}>Add recipe from image</button
    >
  {/if}
  <AuthButton />
</div>

{@render children()}

{#if uploadOpen && auth.signedIn}
  <UploadDialog onclose={() => (uploadOpen = false)} />
{/if}
