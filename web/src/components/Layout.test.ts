import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { auth, initAuth, signIn, signOut } from '../lib/auth.svelte';
import AuthButton from './AuthButton.svelte';
import Layout from './Layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>page</p>' }));

beforeEach(async () => {
  localStorage.clear();
  await signOut();
  await initAuth();
});

describe('AuthButton', () => {
  it('toggles between sign in and sign out', async () => {
    render(AuthButton);
    screen.getByTestId('sign-in').click();
    expect(await screen.findByTestId('sign-out')).toBeInTheDocument();
    expect(auth.signedIn).toBe(true);
    screen.getByTestId('sign-out').click();
    expect(await screen.findByTestId('sign-in')).toBeInTheDocument();
  });
});

describe('Layout', () => {
  it('sets the document title and body class', () => {
    render(Layout, { variant: 'recipe', title: "Sym's Meatloaf Recipe", children });
    expect(document.title).toBe("Sym's Meatloaf Recipe");
    expect(document.body).toHaveClass('bg-light');
    expect(screen.getByTestId('home-link')).toBeInTheDocument();
  });

  it('only gates the upload button on sign-in', async () => {
    render(Layout, { variant: 'index', title: "JB's Kitchen", children });
    expect(document.body).toHaveClass('container');
    expect(screen.getByText('page')).toBeInTheDocument();
    expect(screen.queryByTestId('upload-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-link')).not.toBeInTheDocument();
    await signIn();
    expect(await screen.findByTestId('upload-button')).toBeInTheDocument();
    screen.getByTestId('upload-button').click();
    expect(await screen.findByTestId('upload-dialog')).toBeInTheDocument();
  });
});
