import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Shorthand for `@CurrentUser() user: AuthenticatedRequestUser` when only the tenantId is needed */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId;
  },
);
