<script lang="ts">
  import { auth, signIn, signOut } from '../lib/auth.svelte';
</script>

{#if auth.ready}
  {#if auth.signedIn}
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary"
      data-testid="sign-out"
      title={auth.email ?? undefined}
      onclick={() => signOut()}>Sign out</button
    >
  {:else}
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary"
      data-testid="sign-in"
      onclick={() => signIn()}
      >{import.meta.env.DEV && auth.mode === 'dev' ? 'Sign in (dev)' : 'Sign in with Google'}</button
    >
  {/if}
  {#if auth.error}<span class="text-danger small" role="alert" data-testid="auth-error">{auth.error}</span>{/if}
{/if}
