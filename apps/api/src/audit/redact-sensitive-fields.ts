const SENSITIVE_KEY_PATTERN =
  /password|secret|rawkey|hashedkey|hashedpassword|tokenhash|accesstoken|refreshtoken|^token$/i;

/**
 * Recursively strips values of sensitive-looking keys before they're
 * persisted to AuditLog.before/after — AuditInterceptor logs raw HTTP
 * response/request bodies verbatim, which would otherwise put an API key's
 * one-time raw value, a webhook's signing secret, or a password hash into
 * the audit trail in plaintext, defeating the "shown once" guarantee those
 * features depend on. Matches by key name, not by value shape, so it
 * degrades safely (over-redacts) rather than missing a field with an
 * unexpected type.
 */
export function redactSensitiveFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? '[REDACTED]'
        : redactSensitiveFields(val);
    }
    return result as T;
  }
  return value;
}
