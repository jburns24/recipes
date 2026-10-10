import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recipe } from '../fixtures';
import { signIn } from '../lib/auth.svelte';
import { router, startRouter } from '../lib/router.svelte';
import UploadDialog from './UploadDialog.svelte';

const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', { type: 'image/png' });

const pasteEvent = (file: File) =>
  Object.assign(new Event('paste', { bubbles: true, cancelable: true }), {
    clipboardData: {
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
    },
  });

describe('UploadDialog', () => {
  let stop: () => void;
  beforeEach(async () => {
    await signIn();
    stop = startRouter();
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
  });
  afterEach(() => {
    stop();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('disables submit until an image is chosen', () => {
    render(UploadDialog, { onclose: () => {} });
    expect(screen.getByTestId('upload-submit')).toBeDisabled();
  });

  it('accepts a pasted image, posts it with the bearer token and navigates to the recipe', async () => {
    const fetchMock = vi.fn(async () => Response.json(recipe(), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const onclose = vi.fn();
    render(UploadDialog, { onclose });

    await fireEvent(screen.getByTestId('upload-paste-target'), pasteEvent(png()));
    expect(screen.getByTestId('upload-file-name')).toHaveTextContent('photo.png');
    await userEvent.click(screen.getByTestId('upload-submit'));

    await waitFor(() => expect(onclose).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/extract');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer dev-token' });
    expect((init.body as FormData).get('image')).toBeInstanceOf(File);
    expect(router.route).toEqual({ name: 'recipe', path: 'dinner/quick/meatloaf' });
  });

  it('accepts a file from the file input', async () => {
    render(UploadDialog, { onclose: () => {} });
    await userEvent.upload(screen.getByTestId('upload-file-input'), png());
    expect(screen.getByTestId('upload-submit')).toBeEnabled();
  });

  it('shows API errors and stays open', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { code: 'extraction_failed', message: 'No recipe found' } },
          { status: 502 },
        ),
      ),
    );
    const onclose = vi.fn();
    render(UploadDialog, { onclose });
    await userEvent.upload(screen.getByTestId('upload-file-input'), png());
    await userEvent.click(screen.getByTestId('upload-submit'));
    expect(await screen.findByTestId('upload-error')).toHaveTextContent('No recipe found');
    expect(onclose).not.toHaveBeenCalled();
    expect(screen.getByTestId('upload-submit')).toBeEnabled();
  });

  it('shows a progress bar while uploading', async () => {
    let finish: (r: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((r) => (finish = r))),
    );
    render(UploadDialog, { onclose: () => {} });
    await userEvent.upload(screen.getByTestId('upload-file-input'), png());
    await userEvent.click(screen.getByTestId('upload-submit'));
    expect(await screen.findByTestId('upload-progress')).toBeInTheDocument();
    expect(screen.getByTestId('upload-submit')).toBeDisabled();
    finish(Response.json(recipe(), { status: 201 }));
  });

  it('rejects non-image files client-side', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(UploadDialog, { onclose: () => {} });
    const input = screen.getByTestId('upload-file-input');
    await fireEvent.change(input, {
      target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] },
    });
    expect(screen.getByTestId('upload-error')).toHaveTextContent(/JPEG, PNG, WebP or GIF/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
