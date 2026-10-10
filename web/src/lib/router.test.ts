import { afterEach, describe, expect, it } from 'vitest';
import { canonicalPath, navigate, parseRoute, router, startRouter } from './router.svelte';

describe('parseRoute', () => {
  it('maps paths to routes', () => {
    expect(parseRoute('/')).toEqual({ name: 'index' });
    expect(parseRoute('/routes/dinner/quick/meatloaf')).toEqual({
      name: 'recipe',
      path: 'dinner/quick/meatloaf',
    });
    expect(parseRoute('/routes/meatloaf')).toEqual({ name: 'not-found', path: '/routes/meatloaf' });
    expect(parseRoute('/nope')).toEqual({ name: 'not-found', path: '/nope' });
  });

  it('treats the legacy .html suffix as the clean path', () => {
    expect(canonicalPath('/routes/dinner/quick/meatloaf.html')).toBe(
      '/routes/dinner/quick/meatloaf',
    );
    expect(canonicalPath('/index.html')).toBe('/');
    expect(parseRoute('/routes/breakfast/sourdough-pancakes.html')).toEqual({
      name: 'recipe',
      path: 'breakfast/sourdough-pancakes',
    });
  });
});

describe('router', () => {
  let stop: (() => void) | undefined;
  afterEach(() => {
    stop?.();
    window.history.replaceState(null, '', '/');
  });

  it('redirects a legacy .html URL on start', () => {
    window.history.replaceState(null, '', '/routes/drinks/butter-beer.html');
    stop = startRouter();
    expect(window.location.pathname).toBe('/routes/drinks/butter-beer');
    expect(router.route).toEqual({ name: 'recipe', path: 'drinks/butter-beer' });
  });

  it('navigates with the history API and follows popstate', () => {
    stop = startRouter();
    navigate('/routes/drinks/butter-beer.html');
    expect(window.location.pathname).toBe('/routes/drinks/butter-beer');
    expect(router.route.name).toBe('recipe');
    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(router.route).toEqual({ name: 'index' });
  });

  it('intercepts same-origin link clicks', () => {
    stop = startRouter();
    const a = document.createElement('a');
    a.setAttribute('href', '/routes/dinner/quick/meatloaf');
    document.body.append(a);
    a.click();
    a.remove();
    expect(window.location.pathname).toBe('/routes/dinner/quick/meatloaf');
    expect(router.route.name).toBe('recipe');
  });
});
