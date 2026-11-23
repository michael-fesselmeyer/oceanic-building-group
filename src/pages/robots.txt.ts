// robots.txt, written once at build time. Crawling is always allowed:
// before launch each page carries its own noindex tag (see Seo.astro), and
// search engines can only obey that tag if they are allowed to read the page.
import type { APIRoute } from 'astro';

export const GET: APIRoute = () =>
  new Response('User-agent: *\nAllow: /\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
