export type Route =
  { name: 'index' } | { name: 'recipe'; path: string } | { name: 'not-found'; path: string };

/** Strip the legacy ".html" suffix. Returns the canonical pathname. */
export function canonicalPath(pathname: string): string {
  let p = pathname;
  if (p === '/index.html') return '/';
  if (p.endsWith('.html')) p = p.slice(0, -'.html'.length);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

export function parseRoute(pathname: string): Route {
  const p = canonicalPath(pathname);
  if (p === '/') return { name: 'index' };
  const m = /^\/routes\/(.+)$/.exec(p);
  if (m?.[1]) {
    const segs = m[1].split('/').map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return '';
      }
    });
    // at least category + slug
    if (segs.length >= 2 && segs.every(Boolean)) return { name: 'recipe', path: segs.join('/') };
  }
  return { name: 'not-found', path: p };
}

export const router = $state<{ route: Route }>({ route: { name: 'index' } });

function sync(): void {
  const canonical = canonicalPath(window.location.pathname);
  if (canonical !== window.location.pathname) {
    window.history.replaceState(
      null,
      '',
      canonical + window.location.search + window.location.hash,
    );
  }
  router.route = parseRoute(canonical);
}

/** Navigate with the history API. Legacy ".html" targets are redirected to the clean path. */
export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- parsed once, never mutated
  const url = new URL(to, window.location.origin);
  const target = canonicalPath(url.pathname) + url.search + url.hash;
  if (opts.replace) window.history.replaceState(null, '', target);
  else window.history.pushState(null, '', target);
  router.route = parseRoute(url.pathname);
  window.scrollTo?.(0, 0);
}

/** Start listening for back/forward and same-origin link clicks. Returns a cleanup function. */
export function startRouter(): () => void {
  sync();
  const onPop = () => sync();
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a || a.target || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('/') || href.startsWith('//') || href.startsWith('/api/')) return;
    e.preventDefault();
    navigate(href);
  };
  window.addEventListener('popstate', onPop);
  document.addEventListener('click', onClick);
  return () => {
    window.removeEventListener('popstate', onPop);
    document.removeEventListener('click', onClick);
  };
}
