import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AppConfig } from '../../config/configuration';
import { SmsProvider, SmsSendResult } from '../sms-provider.interface';

const API_URL = 'https://api.africastalking.com/version1/messaging';

interface AfricasTalkingResponse {
  SMSMessageData?: {
    Message: string;
    Recipients: Array<{
      statusCode: number;
      number: string;
      status: string;
      cost: string;
      messageId: string;
    }>;
  };
}

/**
 * Africa's Talking SMS gateway — real HTTP API integration, following the
 * same config-gated pattern as PaystackProvider/MpesaProvider. Selected in
 * place of NoopSmsProvider by the factory in notifications.module.ts only
 * once AFRICAS_TALKING_API_KEY/USERNAME are set, so it's inert by default.
 */
@Injectable()
export class AfricasTalkingSmsProvider implements SmsProvider {
  readonly name = 'africas-talking';
  private readonly logger = new Logger(AfricasTalkingSmsProvider.name);

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async send(to: string, message: string): Promise<SmsSendResult> {
    const config = this.configService.get('africasTalking', { infer: true });
    if (!config.apiKey || !config.username) {
      this.logger.warn(
        'AFRICAS_TALKING_API_KEY/USERNAME not set — SMS not sent',
      );
      return { success: false, error: 'SMS provider not configured' };
    }

    const body = new URLSearchParams({
      username: config.username,
      to,
      message,
      ...(config.senderId ? { from: config.senderId } : {}),
    });

    try {
      const response = await axios.post<AfricasTalkingResponse>(API_URL, body, {
        headers: {
          apiKey: config.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      const recipient = response.data.SMSMessageData?.Recipients?.[0];
      if (recipient?.status === 'Success') {
        return { success: true };
      }
      return {
        success: false,
        error: recipient?.status ?? "Unknown Africa's Talking response",
      };
    } catch (error) {
      this.logger.error(
        "Failed to send SMS via Africa's Talking",
        error as Error,
      );
      return { success: false, error: (error as Error).message };
    }
  }
}
