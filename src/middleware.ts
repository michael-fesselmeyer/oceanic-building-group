// Adds the security headers to every response the Worker generates (the
// intake endpoint, its redirects and its error answers). Static files get
// the same headers from public/_headers, which Cloudflare does not apply to
// Worker responses. Prerendered pages pass through here at build time, where
// headers are ignored.
import { defineMiddleware } from 'astro:middleware';
import { withSecurityHeaders } from './lib/security-headers';

export const onRequest = defineMiddleware(async (_context, next) => {
  return withSecurityHeaders(await next());
});
