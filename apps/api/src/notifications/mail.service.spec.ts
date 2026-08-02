import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

describe('MailService', () => {
  let service: MailService;
  let sendMailMock: jest.Mock<(...args: any[]) => Promise<any>>;

  beforeEach(async () => {
    sendMailMock = jest.fn<(...args: any[]) => Promise<any>>();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'smtp') {
                return {
                  host: 'smtp.example.com',
                  port: 587,
                  user: 'user',
                  pass: 'pass',
                  from: 'PayrollFiti <noreply@payrollfiti.com>',
                };
              }
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get(MailService);
  });

  it('sends mail via the nodemailer transport with the expected shape', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'abc' });

    await service.sendMail('user@example.com', 'Subject', '<p>hi</p>');

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Subject',
        html: '<p>hi</p>',
      }),
    );
  });

  it('swallows a transport rejection and never throws', async () => {
    sendMailMock.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(
      service.sendMail('user@example.com', 'Subject', '<p>hi</p>'),
    ).resolves.toBeUndefined();
  });

  describe('with no SMTP_HOST configured', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string) =>
                key === 'smtp' ? { host: '', port: 587, from: 'x' } : undefined,
            },
          },
        ],
      }).compile();
      service = module.get(MailService);
    });

    it('logs the mail instead of attempting a real send, and never throws', async () => {
      await expect(
        service.sendMail(
          'employee@example.com',
          'Invite',
          '<a href="http://localhost:4200/accept-invite?token=abc123">link</a>',
        ),
      ).resolves.toBeUndefined();
      // The whole point is a developer can read the link from the log —
      // asserting the transport was never touched is what actually proves
      // this path doesn't attempt (and silently fail) a real send.
      expect(sendMailMock).not.toHaveBeenCalled();
    });
  });
});
