<script lang="ts">
  let {
    kind,
    title,
    message,
  }: { kind: 'loading' | 'error' | 'not-found'; title?: string; message?: string } = $props();
</script>

<div class="container py-5" data-testid="status-{kind}">
  <div class="row justify-content-center">
    <div class="col-md-8 col-lg-6 text-center">
      {#if kind === 'loading'}
        <div class="spinner-border text-secondary" role="status">
          <span class="visually-hidden">Loading…</span>
        </div>
      {:else}
        <h1 class="h3 mb-3">{title ?? (kind === 'not-found' ? 'Not found' : 'Something went wrong')}</h1>
        {#if message}<p class="text-muted">{message}</p>{/if}
        <a href="/">Back to JB's Kitchen</a>
      {/if}
    </div>
  </div>
</div>
