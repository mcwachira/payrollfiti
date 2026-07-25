import { describe, it, expect, jest } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysService } from '../../api-keys/api-keys.service';

function makeContext(headers: Record<string, string> = {}) {
  const request: any = { headers, user: undefined };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('ApiKeyGuard', () => {
  it('throws UnauthorizedException when the X-API-Key header is missing', async () => {
    const apiKeysService = { validate: jest.fn() } as unknown as ApiKeysService;
    const guard = new ApiKeyGuard(apiKeysService);
    const { context } = makeContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(apiKeysService.validate).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException for an invalid/revoked key', async () => {
    const apiKeysService = {
      validate: jest
        .fn<(...args: any[]) => Promise<any>>()
        .mockResolvedValue(null),
    } as unknown as ApiKeysService;
    const guard = new ApiKeyGuard(apiKeysService);
    const { context } = makeContext({ 'x-api-key': 'pfk_bad' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('populates request.user.tenantId for a valid key', async () => {
    const apiKeysService = {
      validate: jest
        .fn<(...args: any[]) => Promise<any>>()
        .mockResolvedValue({ tenantId: 'tenant-1' }),
    } as unknown as ApiKeysService;
    const guard = new ApiKeyGuard(apiKeysService);
    const { context, request } = makeContext({ 'x-api-key': 'pfk_good' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      id: 'api-key',
      email: '',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
      employeeId: null,
    });
  });
});
