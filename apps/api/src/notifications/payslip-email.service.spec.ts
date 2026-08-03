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
    payslipEmailsQueue = { addBulk: asyncMock(undefined) };

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

    it('propagates a lookup failure so BullMQ retries just this job', async () => {
      // Unlike enqueueForRun, this is called only by PayslipEmailsProcessor
      // with one job per entry — letting the error through (rather than
      // swallowing it) is what lets BullMQ retry this one entry without
      // resending every other payslip in the run.
      prisma.payrollEntry.findUnique.mockRejectedValueOnce(
        new Error('db down'),
      );

      await expect(
        service.sendPayslipEmail('tenant-1', 'entry-1'),
      ).rejects.toThrow('db down');
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

  describe('enqueueForRun', () => {
    it('adds one job per entry to the payslip-emails queue instead of sending inline', async () => {
      prisma.payrollRun.findUnique.mockResolvedValueOnce({
        id: 'run-1',
        entries: [{ id: 'entry-1' }, { id: 'entry-2' }],
      });

      await service.enqueueForRun('tenant-1', 'run-1');

      expect(payslipEmailsQueue.addBulk).toHaveBeenCalledWith([
        {
          name: PAYSLIP_EMAILS_DELIVER_JOB,
          data: { tenantId: 'tenant-1', payrollEntryId: 'entry-1' },
        },
        {
          name: PAYSLIP_EMAILS_DELIVER_JOB,
          data: { tenantId: 'tenant-1', payrollEntryId: 'entry-2' },
        },
      ]);
      expect(payslipsService.generate).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('does nothing when the run does not exist', async () => {
      prisma.payrollRun.findUnique.mockResolvedValueOnce(null);

      await service.enqueueForRun('tenant-1', 'missing-run');

      expect(payslipEmailsQueue.addBulk).not.toHaveBeenCalled();
    });

    it('never throws — logs and swallows a failure to enqueue, since this runs inline in the payroll-run request', async () => {
      prisma.payrollRun.findUnique.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.enqueueForRun('tenant-1', 'run-1'),
      ).resolves.toBeUndefined();
    });
  });
});
