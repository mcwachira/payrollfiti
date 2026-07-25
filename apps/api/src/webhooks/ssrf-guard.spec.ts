import { describe, it, expect, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';

// Hostname-based URLs go through a real DNS lookup — mock it so this test
// (and CI, which may have no network access) doesn't depend on live DNS.
// IP-literal cases below never call lookup() at all (short-circuited by
// isIPv4/isIPv6 in the guard), so they exercise the real logic untouched.
// Jest's mock-hoisting requires the referenced variable to be prefixed
// with "mock" (enforced by babel-plugin-jest-hoist).
const mockLookup = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('node:dns/promises', () => ({
  lookup: (...args: any[]) => mockLookup(...args),
}));

import { assertPublicWebhookUrl } from './ssrf-guard';

describe('assertPublicWebhookUrl', () => {
  it('allows a public hostname that resolves to a public IP', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34' }]);
    await expect(
      assertPublicWebhookUrl('https://example.com/webhooks/payrollfiti'),
    ).resolves.toBeUndefined();
  });

  it('rejects a public-looking hostname that resolves to a private IP (DNS rebinding)', async () => {
    mockLookup.mockResolvedValue([{ address: '10.0.0.5' }]);
    await expect(
      assertPublicWebhookUrl('https://rebind.example.com/hook'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a hostname that fails to resolve', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(
      assertPublicWebhookUrl('https://does-not-exist.invalid/hook'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an invalid URL', async () => {
    await expect(assertPublicWebhookUrl('not-a-url')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a non-http(s) scheme', async () => {
    await expect(
      assertPublicWebhookUrl('ftp://example.com/hook'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects localhost by hostname', async () => {
    await expect(
      assertPublicWebhookUrl('http://localhost:3000/internal'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a loopback IPv4 literal', async () => {
    await expect(
      assertPublicWebhookUrl('http://127.0.0.1:5432/'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects the cloud metadata address', async () => {
    await expect(
      assertPublicWebhookUrl('http://169.254.169.254/latest/meta-data/'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects RFC1918 private ranges', async () => {
    await expect(assertPublicWebhookUrl('http://10.0.0.5/')).rejects.toThrow(
      BadRequestException,
    );
    await expect(assertPublicWebhookUrl('http://172.16.0.5/')).rejects.toThrow(
      BadRequestException,
    );
    await expect(assertPublicWebhookUrl('http://192.168.1.5/')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects the IPv6 loopback literal', async () => {
    await expect(assertPublicWebhookUrl('http://[::1]:3000/')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('allows a public IPv4 literal', async () => {
    await expect(
      assertPublicWebhookUrl('http://93.184.216.34/hook'),
    ).resolves.toBeUndefined();
  });
});
