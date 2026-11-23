// Sends a lead through every enabled channel. The endpoint only ever talks to
// the notifier, so adding a channel (SMS) changes the list of channels, not
// the endpoint.
import type { Channel, FailureReason, Lead, Logger } from './types';

export interface ChannelFailure {
  channel: string;
  required: boolean;
  reason: FailureReason;
  detail?: string;
}

export interface NotifyResult {
  /** True when every required channel delivered the lead. */
  delivered: boolean;
  failures: ChannelFailure[];
}

export interface Notifier {
  notify(lead: Lead): Promise<NotifyResult>;
}

export function createNotifier(channels: Channel[], logger: Logger): Notifier {
  if (!channels.some((channel) => channel.required)) {
    throw new Error('The notifier needs at least one required channel.');
  }

  return {
    async notify(lead) {
      const results = await Promise.all(
        channels.map(async (channel) => {
          try {
            return { channel, result: await channel.send(lead) };
          } catch {
            // A channel should report failures, not throw; treat a throw as an outage.
            return {
              channel,
              result: { ok: false as const, reason: 'unavailable' as const, detail: 'threw' },
            };
          }
        }),
      );

      const failures: ChannelFailure[] = [];
      for (const { channel, result } of results) {
        if (result.ok) continue;
        failures.push({
          channel: channel.name,
          required: channel.required,
          reason: result.reason,
          detail: result.detail,
        });
        const line = `[intake] ${channel.name} failed: ${result.reason}${result.detail ? ` (${result.detail})` : ''}`;
        if (channel.required) logger.error(line);
        else logger.warn(line);
      }

      return { delivered: !failures.some((failure) => failure.required), failures };
    },
  };
}
