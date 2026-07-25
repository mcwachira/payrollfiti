import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesService } from '../employees/employees.service';
import { AuthenticatedRequestUser } from '../auth/types';

const STORAGE_DIR =
  process.env.DOCUMENT_STORAGE_DIR ??
  join(process.cwd(), 'storage', 'documents');

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly employeesService: EmployeesService,
  ) {}

  private async assertAccess(
    tenantId: string,
    employeeId: string,
    actor: AuthenticatedRequestUser,
  ) {
    // Throws NotFoundException on cross-tenant/unknown employee.
    await this.employeesService.findOne(tenantId, employeeId);
    if (actor.role === Role.EMPLOYEE && actor.employeeId !== employeeId) {
      throw new ForbiddenException('You may only access your own documents');
    }
  }

  async upload(
    tenantId: string,
    employeeId: string,
    actor: AuthenticatedRequestUser,
    file: Express.Multer.File,
    type: string,
  ) {
    await this.assertAccess(tenantId, employeeId, actor);

    const employeeDir = join(STORAGE_DIR, employeeId);
    await mkdir(employeeDir, { recursive: true });
    const fileName = `${randomUUID()}-${file.originalname}`;
    const absolutePath = join(employeeDir, fileName);
    await writeFile(absolutePath, file.buffer);
    const relativePath = join(employeeId, fileName);

    return this.prisma.document.create({
      data: {
        employeeId,
        type,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url: relativePath,
        uploadedById: actor.id,
      },
    });
  }

  async findAllForEmployee(
    tenantId: string,
    employeeId: string,
    actor: AuthenticatedRequestUser,
  ) {
    await this.assertAccess(tenantId, employeeId, actor);
    return this.prisma.document.findMany({
      where: { employeeId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    documentId: string,
    actor: AuthenticatedRequestUser,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { employee: { include: { company: true } } },
    });
    if (!document || document.employee.company.tenantId !== tenantId) {
      throw new NotFoundException('Document not found');
    }
    if (
      actor.role === Role.EMPLOYEE &&
      actor.employeeId !== document.employeeId
    ) {
      throw new ForbiddenException('You may only access your own documents');
    }
    return document;
  }

  async download(
    tenantId: string,
    documentId: string,
    actor: AuthenticatedRequestUser,
  ) {
    const document = await this.findOne(tenantId, documentId, actor);
    const buffer = await readFile(join(STORAGE_DIR, document.url));
    return { buffer, document };
  }

  async remove(
    tenantId: string,
    documentId: string,
    actor: AuthenticatedRequestUser,
  ) {
    const document = await this.findOne(tenantId, documentId, actor);
    await this.prisma.document.delete({ where: { id: documentId } });
    try {
      await unlink(join(STORAGE_DIR, document.url));
    } catch (error) {
      // Best-effort: a missing file on disk must not fail the delete.
      this.logger.warn(
        `Failed to unlink document file for ${documentId}: ${(error as Error).message}`,
      );
    }
  }
}
