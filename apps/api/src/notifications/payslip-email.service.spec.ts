import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PayslipEmailService } from './payslip-email.service';
import { PrismaService } from '../prisma/prisma.service';
import { PayslipsService } from '../payslips/payslips.service';
import { MailService } from './mail.service';
import {
  PAYSLIP_EMAILS_DELIVER_JOB,
  PAYSLIP_EMAILS_QUEUE,
} from './payslip-emails.queue';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('PayslipEmailService', () => {
  let service: PayslipEmailService;
  let prisma: any;
  let payslipsService: any;
  let mailService: any;
  let payslipEmailsQueue: any;

  const baseEntry = {
    id: 'entry-1',
    employee: {
      id: 'emp-1',
      firstName: 'Jane',
      company: { tenantId: 'tenant-1' },
      user: { email: 'jane@acme.co.ke' },
    },
    payrollRun: { period: '2026-07' },
  };

  beforeEach(async () => {
    prisma = {
      payrollEntry: { findUnique: asyncMock(baseEntry) },
      payrollRun: {
        findUnique: asyncMock({ id: 'run-1', entries: [{ id: 'entry-1' }] }),
      },
    };
    payslipsService = { generate: asyncMock(Buffer.from('pdf-bytes')) };
    mailService = { sendMail: asyncMock(undefined) };
    payslipEmailsQueue = { add: asyncMock(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayslipEmailService,
        { provide: PrismaService, useValue: prisma },
        { provide: PayslipsService, useValue: payslipsService },
        { provide: MailService, useValue: mailService },
        {
          provide: getQueueToken(PAYSLIP_EMAILS_QUEUE),
          useValue: payslipEmailsQueue,
        },
      ],
    }).compile();

    service = module.get(PayslipEmailService);
  });

  describe('sendPayslipEmail', () => {
    it('generates the payslip and emails it to the linked user', async () => {
      await service.sendPayslipEmail('tenant-1', 'entry-1');

      expect(payslipsService.generate).toHaveBeenCalledWith(
        'tenant-1',
        'entry-1',
      );
      expect(mailService.sendMail).toHaveBeenCalledWith(
        'jane@acme.co.ke',
        expect.stringContaining('2026-07'),
        expect.any(String),
        [{ filename: 'payslip.pdf', content: expect.any(Buffer) }],
      );
    });

    it('skips silently when the employee has no linked user (no login)', async () => {
      prisma.payrollEntry.findUnique.mockResolvedValueOnce({
        ...baseEntry,
        employee: { ...baseEntry.employee, user: null },
      });

      await service.sendPayslipEmail('tenant-1', 'entry-1');

      expect(payslipsService.generate).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('never throws even when the entry lookup fails', async () => {
      prisma.payrollEntry.findUnique.mockRejectedValueOnce(
        new Error('db down'),
      );

      await expect(
        service.sendPayslipEmail('tenant-1', 'entry-1'),
      ).resolves.toBeUndefined();
    });

    it('does nothing for a cross-tenant entry', async () => {
      prisma.payrollEntry.findUnique.mockResolvedValueOnce({
        ...baseEntry,
        employee: {
          ...baseEntry.employee,
          company: { tenantId: 'other-tenant' },
        },
      });

      await service.sendPayslipEmail('tenant-1', 'entry-1');

      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('sendPayslipEmailsForRun', () => {
    it('sends a payslip email for every entry in the run', async () => {
      await service.sendPayslipEmailsForRun('tenant-1', 'run-1');

      expect(payslipsService.generate).toHaveBeenCalledTimes(1);
      expect(mailService.sendMail).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the run does not exist', async () => {
      prisma.payrollRun.findUnique.mockResolvedValueOnce(null);

      await service.sendPayslipEmailsForRun('tenant-1', 'missing-run');

      expect(payslipsService.generate).not.toHaveBeenCalled();
    });
  });

  describe('enqueueForRun', () => {
    it('adds a job to the payslip-emails queue instead of sending inline', async () => {
      await service.enqueueForRun('tenant-1', 'run-1');

      expect(payslipEmailsQueue.add).toHaveBeenCalledWith(
        PAYSLIP_EMAILS_DELIVER_JOB,
        { tenantId: 'tenant-1', payrollRunId: 'run-1' },
      );
      expect(payslipsService.generate).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });
});
