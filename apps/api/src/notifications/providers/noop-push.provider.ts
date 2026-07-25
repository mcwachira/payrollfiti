import { Injectable } from '@nestjs/common';
import { PushProvider, PushSendResult } from '../push-provider.interface';

/** Default provider: trivially succeeds without doing any real I/O. */
@Injectable()
export class NoopPushProvider implements PushProvider {
  readonly name = 'noop';

  async send(): Promise<PushSendResult> {
    return { success: true };
  }
}
