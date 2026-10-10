<script lang="ts">
  import { ApiError, extractRecipe } from '../lib/api';
  import { getToken } from '../lib/auth.svelte';
  import { navigate } from '../lib/router.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const MAX_BYTES = 8 * 1024 * 1024;
  const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  let file = $state<File | null>(null);
  let preview = $state<string | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let dragging = $state(false);

  function setFile(f: File | null | undefined): void {
    error = null;
    if (preview) URL.revokeObjectURL?.(preview);
    preview = null;
    file = null;
    if (!f) return;
    if (!TYPES.includes(f.type)) {
      error = 'Image must be JPEG, PNG, WebP or GIF';
      return;
    }
    if (f.size > MAX_BYTES) {
      error = 'Image too large (max 8MB)';
      return;
    }
    file = f;
    preview = URL.createObjectURL?.(f) ?? null;
  }

  function imageFrom(items: DataTransferItemList | undefined): File | null {
    for (const item of items ?? []) {
      if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile();
    }
    return null;
  }

  function onpaste(e: ClipboardEvent): void {
    const f = imageFrom(e.clipboardData?.items);
    if (f) {
      e.preventDefault();
      setFile(f);
    }
  }

  function ondrop(e: DragEvent): void {
    e.preventDefault();
    dragging = false;
    setFile(e.dataTransfer?.files?.[0]);
  }

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (!file || busy) return;
    busy = true;
    error = null;
    try {
      const token = await getToken();
      if (!token) throw new ApiError(401, 'unauthorized', 'Please sign in again');
      const recipe = await extractRecipe(file, token);
      onclose();
      navigate(`/routes/${recipe.path}`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Upload failed';
      busy = false;
    }
  }

  function onkeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && !busy) onclose();
  }
</script>

<svelte:document {onpaste} />
<svelte:window {onkeydown} />

<div class="modal-backdrop fade show"></div>
<div
  class="modal d-block"
  tabindex="-1"
  role="dialog"
  aria-modal="true"
  aria-labelledby="upload-title"
  data-testid="upload-dialog"
>
  <div class="modal-dialog modal-dialog-centered">
    <form class="modal-content" onsubmit={submit}>
      <div class="modal-header">
        <h2 class="modal-title fs-5" id="upload-title">Add recipe from image</h2>
        <button
          type="button"
          class="btn-close"
          aria-label="Close"
          disabled={busy}
          onclick={onclose}
        ></button>
      </div>
      <div class="modal-body">
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="border rounded p-3 text-center mb-3 {dragging ? 'bg-light border-primary' : ''}"
          tabindex="0"
          role="group"
          aria-label="Paste or drop an image here"
          data-testid="upload-paste-target"
          {ondrop}
          ondragover={(e) => {
            e.preventDefault();
            dragging = true;
          }}
          ondragleave={() => (dragging = false)}
        >
          {#if preview}
            <img
              src={preview}
              alt="Selected upload preview"
              class="img-fluid rounded mb-2"
              style="max-height: 200px"
            />
          {/if}
          <div class="text-muted small" data-testid="upload-file-name">
            {file ? file.name : 'Paste an image (Ctrl/Cmd+V), drop one here, or choose a file'}
          </div>
        </div>
        <label for="upload-file" class="form-label">Image file</label>
        <input
          id="upload-file"
          type="file"
          class="form-control"
          accept="image/jpeg,image/png,image/webp,image/gif"
          data-testid="upload-file-input"
          disabled={busy}
          onchange={(e) => setFile(e.currentTarget.files?.[0])}
        />
        {#if busy}
          <div
            class="progress mt-3"
            role="progressbar"
            aria-label="Extracting recipe"
            data-testid="upload-progress"
          >
            <div class="progress-bar progress-bar-striped progress-bar-animated w-100">
              Extracting recipe…
            </div>
          </div>
        {/if}
        {#if error}
          <div class="alert alert-danger mt-3 mb-0" role="alert" data-testid="upload-error">
            {error}
          </div>
        {/if}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" disabled={busy} onclick={onclose}
          >Cancel</button
        >
        <button type="submit" class="btn btn-primary" data-testid="upload-submit" disabled={!file || busy}
          >{busy ? 'Uploading…' : 'Upload'}</button
        >
      </div>
    </form>
  </div>
</div>
