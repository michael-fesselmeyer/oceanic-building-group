// The built Worker the intake tests post to, shared by playwright.config.ts
// (which starts it) and the specs (which read what it logged). Two copies run
// from the same build: one with Cloudflare's always-pass Turnstile test
// secret and one with the always-fail secret. Both send email to the log
// transport, and the check answers Cloudflare's test secrets itself, so no
// request leaves the machine for a mail or spam service.
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number(process.env.E2E_PORT ?? 4173);

export interface WorkerUnderTest {
  port: number;
  baseURL: string;
  /** Everything the Worker printed, including each redacted `[intake]` line. */
  logFile: string;
  env: Record<string, string>;
}

function worker(offset: number, turnstileSecret: string): WorkerUnderTest {
  const workerPort = port + offset;
  return {
    port: workerPort,
    baseURL: `http://localhost:${workerPort}`,
    logFile: join(tmpdir(), `oceanic-worker-${workerPort}.log`),
    env: {
      // Lets `astro preview` hand these to the Worker; none of them is a secret.
      CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
      EMAIL_TRANSPORT: 'log',
      LEAD_NOTIFICATION_EMAIL: 'office@example.test',
      LEAD_FROM_EMAIL: 'website@example.test',
      TURNSTILE_SECRET_KEY: turnstileSecret,
    },
  };
}

/** Accepts every spam-check token. The "worker" project's base address. */
export const passingWorker = worker(1, '1x0000000000000000000000000000000AA');

/** Refuses every spam-check token. */
export const failingWorker = worker(2, '2x0000000000000000000000000000000AA');
