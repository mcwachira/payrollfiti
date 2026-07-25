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
});
