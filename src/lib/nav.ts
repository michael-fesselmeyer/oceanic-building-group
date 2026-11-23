/**
 * Whether a navigation link points at the page being shown.
 *
 * - `'page'`: the link is this very page.
 * - `'true'`: the link is the section this page belongs to
 *   (`/portfolio/` while viewing `/portfolio/some-project/`).
 * - `undefined`: unrelated. The home link (`/`) only ever matches the home page itself,
 *   because every path starts with `/`.
 *
 * Both paths are compared with a trailing slash, so `/portfolio` and `/portfolio/` agree and
 * `/portfolio-archive/` is not taken for part of `/portfolio/`.
 */
export type CurrentState = 'page' | 'true' | undefined;

const withSlash = (path: string) => (path.endsWith('/') ? path : `${path}/`);

export function currentState(pathname: string, href: string): CurrentState {
  const here = withSlash(pathname);
  const target = withSlash(href);
  if (here === target) return 'page';
  if (target === '/') return undefined;
  return here.startsWith(target) ? 'true' : undefined;
}
