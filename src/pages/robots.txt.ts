// robots.txt, written once at build time. See robotsTxt() in src/lib/sitemap.ts
// for the rules; it names the sitemap only on a launched build.
import type { APIRoute } from 'astro';
import { robotsTxt } from '../lib/sitemap';
import { launched } from '../lib/site';

export const GET: APIRoute = ({ site, url }) =>
  new Response(robotsTxt(site ?? url.origin, launched), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
