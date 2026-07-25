import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Job } from 'bullmq';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationChannel } from './notification-channel.enum';
import { NotificationDeliverJobData } from './notifications.queue';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

const makeJob = (
  data: NotificationDeliverJobData,
): Job<NotificationDeliverJobData> => ({ data }) as Job<NotificationDeliverJobData>;

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;
  let prisma: any;
  let mailService: any;
  let smsProvider: any;
  let pushProvider: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: asyncMock({
          id: 'user-1',
          email: 'user@example.com',
          phone: null,
        }),
      },
    };
    mailService = { sendMail: asyncMock(undefined) };
    smsProvider = { send: asyncMock({ success: true }) };
    pushProvider = { send: asyncMock({ success: true }) };

    processor = new NotificationsProcessor(
      prisma,
      mailService,
      smsProvider,
      pushProvider,
    );
  });

  it('sends an email with the rendered template for the EMAIL channel', async () => {
    await processor.process(
      makeJob({
        tenantId: 't1',
        userId: 'user-1',
        type: 'PAYROLL_RUN_COMPLETED',
        message: 'Payroll done',
        channels: [NotificationChannel.EMAIL],
      }),
    );

    expect(mailService.sendMail).toHaveBeenCalledWith(
      'user@example.com',
      'Payroll run completed',
      '<p>Payroll done</p>',
    );
  });

  it('skips SMS and logs a warning when the user has no phone on file', async () => {
    await processor.process(
      makeJob({
        tenantId: 't1',
        userId: 'user-1',
        type: 'PAYROLL_RUN_COMPLETED',
        message: 'Payroll done',
        channels: [NotificationChannel.SMS],
      }),
    );

    expect(smsProvider.send).not.toHaveBeenCalled();
  });

  it('sends SMS via the provider when the user has a phone on file', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      phone: '+254700000000',
    });

    await processor.process(
      makeJob({
        tenantId: 't1',
        userId: 'user-1',
        type: 'PAYROLL_RUN_COMPLETED',
        message: 'Payroll done',
        channels: [NotificationChannel.SMS],
      }),
    );

    expect(smsProvider.send).toHaveBeenCalledWith(
      '+254700000000',
      'Payroll done',
    );
  });

  it('sends push via the provider for the PUSH channel', async () => {
    await processor.process(
      makeJob({
        tenantId: 't1',
        userId: 'user-1',
        type: 'PAYROLL_RUN_COMPLETED',
        message: 'Payroll done',
        channels: [NotificationChannel.PUSH],
      }),
    );

    expect(pushProvider.send).toHaveBeenCalledWith(
      'user-1',
      'Payroll run completed',
      'Payroll done',
    );
  });

  it('does nothing when the user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await processor.process(
      makeJob({
        tenantId: 't1',
        userId: 'gone',
        type: 'PAYROLL_RUN_COMPLETED',
        message: 'Payroll done',
        channels: [NotificationChannel.EMAIL],
      }),
    );

    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it('falls back to the default template for an unknown type', async () => {
    await processor.process(
      makeJob({
        tenantId: 't1',
        userId: 'user-1',
        type: 'SOME_UNKNOWN_TYPE',
        message: 'hello',
        channels: [NotificationChannel.EMAIL],
      }),
    );

    expect(mailService.sendMail).toHaveBeenCalledWith(
      'user@example.com',
      'PayrollFiti Notification',
      '<p>hello</p>',
    );
  });
});
