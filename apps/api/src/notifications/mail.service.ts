import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppConfig } from '../config/configuration';

export interface MailAttachment {
  filename: string;
  content: Buffer;
}

/**
 * Thin wrapper directly around the `nodemailer` SDK — mirrors the
 * `PaystackProvider`/`MpesaProvider` "wrap the SDK directly" pattern rather
 * than pulling in `@nestjs-modules/mailer`.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const smtp = this.configService.get('smtp', { infer: true });
      this.transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        auth:
          smtp.user && smtp.pass
            ? { user: smtp.user, pass: smtp.pass }
            : undefined,
      });
    }
    return this.transporter;
  }

  /**
   * Never throws — a failed email must never break the request that
   * triggered it. Mirrors AuditService.record's try/catch/log pattern.
   */
  async sendMail(
    to: string,
    subject: string,
    html: string,
    attachments?: MailAttachment[],
  ): Promise<void> {
    try {
      const smtp = this.configService.get('smtp', { infer: true });
      await this.getTransporter().sendMail({
        from: smtp.from,
        to,
        subject,
        html,
        attachments,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send mail to ${to}: ${subject}`,
        error as Error,
      );
    }
  }
}
