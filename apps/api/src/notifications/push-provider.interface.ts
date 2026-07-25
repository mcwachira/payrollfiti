/**
 * Extension point for sending mobile/web push (FCM, APNs, Web Push, ...).
 *
 * Explicit limitation: no real push gateway is wired up here, and this
 * schema has no device-token storage yet — a real provider is expected to
 * own token registration/lookup internally. A future
 * `FcmPushProvider implements PushProvider` is added later and swapped in
 * via the `PUSH_PROVIDER` DI token once real credentials and token storage
 * exist; nothing else in the codebase needs to change. Mirrors the
 * AccountingProvider extension-point pattern.
 */
export interface PushSendResult {
  success: boolean;
  error?: string;
}

export interface PushProvider {
  readonly name: string;
  send(userId: string, title: string, body: string): Promise<PushSendResult>;
}

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
