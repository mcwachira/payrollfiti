import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';

/**
 * Blocks webhook URLs that would let a tenant make the server issue
 * requests to internal/private network targets (SSRF) — e.g. cloud
 * metadata endpoints (169.254.169.254), localhost, or RFC1918 ranges
 * where the DB/Redis/internal admin routes live. This is a blocklist,
 * not a full sandbox: it doesn't defend against every SSRF technique
 * (e.g. HTTP redirects to a private target after the initial check), but
 * it closes the direct, trivial case and is checked again at dispatch
 * time (not just at create/update) to reduce the DNS-rebinding window.
 */
function isBlockedIPv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local, incl. cloud metadata 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) // 192.168.0.0/16
  );
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' || // loopback
    normalized.startsWith('fe80:') || // link-local
    normalized.startsWith('fc') || // unique local fc00::/7
    normalized.startsWith('fd') ||
    normalized.startsWith('::ffff:127.') || // IPv4-mapped loopback
    normalized.startsWith('::ffff:169.254.')
  );
}

export async function assertPublicWebhookUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException('Invalid webhook URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('Webhook URL must be http or https');
  }
  if (parsed.hostname === 'localhost') {
    throw new BadRequestException(
      'Webhook URL may not target localhost or an internal network address',
    );
  }

  let addresses: string[];
  try {
    if (isIPv4(parsed.hostname) || isIPv6(parsed.hostname)) {
      addresses = [parsed.hostname];
    } else {
      const results = await lookup(parsed.hostname, { all: true });
      addresses = results.map((r) => r.address);
    }
  } catch {
    throw new BadRequestException('Webhook URL hostname could not be resolved');
  }

  const blocked = addresses.some((addr) =>
    isIPv4(addr) ? isBlockedIPv4(addr) : isBlockedIPv6(addr),
  );
  if (blocked) {
    throw new BadRequestException(
      'Webhook URL may not target localhost or an internal network address',
    );
  }
}
