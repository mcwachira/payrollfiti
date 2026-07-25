import { Injectable } from '@nestjs/common';
import { SmsProvider, SmsSendResult } from '../sms-provider.interface';

/** Default provider: trivially succeeds without doing any real I/O. */
@Injectable()
export class NoopSmsProvider implements SmsProvider {
  readonly name = 'noop';

  async send(): Promise<SmsSendResult> {
    return { success: true };
  }
}
