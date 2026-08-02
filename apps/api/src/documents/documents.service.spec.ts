import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesService } from '../employees/employees.service';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
}));

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;
  let employeesService: any;

  const company = { id: 'company-1', tenantId: 'tenant-1', name: 'Acme' };
  const employee = { id: 'emp-1', companyId: 'company-1', company };
  const adminActor = {
    id: 'user-1',
    email: 'admin@acme.co.ke',
    role: Role.ADMIN,
    tenantId: 'tenant-1',
    employeeId: null,
    sessionId: 'session-1',
  };
  const selfEmployeeActor = {
    id: 'user-2',
    email: 'jane@acme.co.ke',
    role: Role.EMPLOYEE,
    tenantId: 'tenant-1',
    employeeId: 'emp-1',
    sessionId: 'session-2',
  };
  const otherEmployeeActor = {
    id: 'user-3',
    email: 'other@acme.co.ke',
    role: Role.EMPLOYEE,
    tenantId: 'tenant-1',
    employeeId: 'emp-2',
    sessionId: 'session-3',
  };

  const document = {
    id: 'doc-1',
    employeeId: 'emp-1',
    type: 'CONTRACT',
    fileName: 'contract.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 4,
    url: 'emp-1/uuid-contract.pdf',
    uploadedById: 'user-1',
    employee,
  };

  const file: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'contract.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 4,
    buffer: Buffer.from('data'),
    destination: '',
    filename: '',
    path: '',
    stream: undefined as any,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      document: {
        create: asyncMock(document),
        findMany: asyncMock([document]),
        findUnique: asyncMock(document),
        delete: asyncMock(document),
      },
    };
    employeesService = { findOne: asyncMock(employee) };

    (mkdir as jest.Mock).mockResolvedValue(undefined as never);
    (writeFile as jest.Mock).mockResolvedValue(undefined as never);
    (readFile as jest.Mock).mockResolvedValue(Buffer.from('data') as never);
    (unlink as jest.Mock).mockResolvedValue(undefined as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmployeesService, useValue: employeesService },
      ],
    }).compile();

    service = module.get(DocumentsService);
  });

  describe('upload', () => {
    it('writes the file to disk and creates the document row', async () => {
      const result = await service.upload(
        'tenant-1',
        'emp-1',
        adminActor,
        file,
        'CONTRACT',
      );

      expect(employeesService.findOne).toHaveBeenCalledWith(
        'tenant-1',
        'emp-1',
      );
      expect(mkdir).toHaveBeenCalledTimes(1);
      expect(writeFile).toHaveBeenCalledTimes(1);
      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp-1',
            type: 'CONTRACT',
            fileName: 'contract.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 4,
            uploadedById: 'user-1',
          }),
        }),
      );
      expect(result).toBe(document);
    });

    it('throws NotFoundException for a cross-tenant employee', async () => {
      employeesService.findOne.mockRejectedValueOnce(
        new NotFoundException('Employee not found'),
      );

      await expect(
        service.upload('tenant-1', 'emp-1', adminActor, file, 'CONTRACT'),
      ).rejects.toThrow(NotFoundException);
      expect(writeFile).not.toHaveBeenCalled();
    });

    it("throws ForbiddenException when an EMPLOYEE role user targets someone else's employeeId", async () => {
      await expect(
        service.upload(
          'tenant-1',
          'emp-1',
          otherEmployeeActor,
          file,
          'CONTRACT',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('allows an EMPLOYEE role user to upload their own document', async () => {
      await expect(
        service.upload(
          'tenant-1',
          'emp-1',
          selfEmployeeActor,
          file,
          'CONTRACT',
        ),
      ).resolves.toBe(document);
    });
  });

  describe('remove', () => {
    it('deletes the row and unlinks the file', async () => {
      await service.remove('tenant-1', 'doc-1', adminActor);

      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });
      expect(unlink).toHaveBeenCalledTimes(1);
    });

    it('still succeeds (logs, does not throw) when unlink rejects with ENOENT', async () => {
      const enoent = Object.assign(new Error('no such file'), {
        code: 'ENOENT',
      });
      (unlink as jest.Mock).mockRejectedValueOnce(enoent as never);

      await expect(
        service.remove('tenant-1', 'doc-1', adminActor),
      ).resolves.toBeUndefined();
      expect(prisma.document.delete).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException for a cross-tenant document before attempting the delete', async () => {
      prisma.document.findUnique.mockResolvedValueOnce({
        ...document,
        employee: { ...employee, company: { ...company, tenantId: 'other' } },
      });

      await expect(
        service.remove('tenant-1', 'doc-1', adminActor),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAllForEmployee', () => {
    it('lists documents ordered by uploadedAt desc', async () => {
      const result = await service.findAllForEmployee(
        'tenant-1',
        'emp-1',
        adminActor,
      );

      expect(prisma.document.findMany).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1' },
        orderBy: { uploadedAt: 'desc' },
      });
      expect(result).toEqual([document]);
    });
  });

  describe('download', () => {
    it('returns the file buffer alongside the document row', async () => {
      const result = await service.download('tenant-1', 'doc-1', adminActor);

      expect(readFile).toHaveBeenCalledTimes(1);
      expect(result.document).toBe(document);
      expect(result.buffer).toEqual(Buffer.from('data'));
    });
  });
});
