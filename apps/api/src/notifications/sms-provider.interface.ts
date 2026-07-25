/**
 * Extension point for sending SMS (Africa's Talking, Twilio, ...).
 *
 * Explicit limitation: no real SMS gateway is wired up here — this project
 * has no account/API credentials for one, so any code calling a real
 * gateway's API would be untestable/unverifiable. A future
 * `AfricasTalkingSmsProvider implements SmsProvider` is added later and
 * swapped in via the `SMS_PROVIDER` DI token once real credentials exist;
 * nothing else in the codebase needs to change. Mirrors the
 * AccountingProvider extension-point pattern.
 */
export interface SmsSendResult {
  success: boolean;
  error?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(to: string, message: string): Promise<SmsSendResult>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
