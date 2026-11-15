// Minimal History API router: "/", "/p/<id>", "/admin". Paths under /packages/
// belong to the server (downloads), so the interface never uses them.

import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'package'; id: string }
  | { name: 'admin' }
  | { name: 'notFound' };

export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { name: 'home' };
  const pkg = /^\/p\/([^/]+)\/?$/.exec(pathname);
  if (pkg) return { name: 'package', id: decodeURIComponent(pkg[1]!) };
  if (/^\/admin\/?$/.test(pathname)) return { name: 'admin' };
  return { name: 'notFound' };
}

const EVENT = 'spkforge:navigate';

function scrollToHash(hash: string): void {
  const id = hash.replace(/^#/, '');
  if (!id) {
    window.scrollTo({ top: 0 });
    return;
  }
  // Wait a frame so the target route has rendered.
  requestAnimationFrame(() => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  });
}

export function navigate(to: string): void {
  const url = new URL(to, location.href);
  const samePath = url.pathname === location.pathname;
  history.pushState(null, '', url.pathname + url.search + url.hash);
  window.dispatchEvent(new Event(EVENT));
  if (url.hash) scrollToHash(url.hash);
  else if (!samePath) window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener(EVENT, update);
    if (location.hash) scrollToHash(location.hash);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return parseRoute(path);
}

/** In-app link: plain <a href> for the browser, client-side navigation on a normal click. */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  function handle(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }
  return <a href={href} onClick={handle} {...rest} />;
}
