import type { Intake } from '../intake';

/** How the spam check went for a lead that is being sent. */
export type SpamCheck = 'passed' | 'not-run';

/** A validated enquiry on its way to the office. */
export interface Lead {
  intake: Intake;
  spamCheck: SpamCheck;
  /**
   * Stable for identical submissions. Channels pass it to their provider as
   * an idempotency key, so a double click or a resent form is delivered once.
   */
  key: string;
}

/**
 * Why a channel could not deliver. `quota` is a provider's daily or monthly
 * cap; `rate-limited` is too many requests at once; `rejected` is a request
 * the provider refused (bad key, unverified sender); `unavailable` is a
 * timeout, network failure or provider error.
 */
export type FailureReason = 'quota' | 'rate-limited' | 'rejected' | 'unavailable';

/** `detail` names the provider's error code. It never holds personal data. */
export type SendResult = { ok: true } | { ok: false; reason: FailureReason; detail?: string };

/** One way of telling the office about a lead: email today, SMS later. */
export interface Channel {
  name: string;
  /**
   * A lead counts as delivered only when every required channel succeeds.
   * An optional channel (SMS) that fails is logged and otherwise ignored.
   */
  required: boolean;
  send(lead: Lead): Promise<SendResult>;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
