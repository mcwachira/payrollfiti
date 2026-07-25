import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedRequestUser } from '../auth/types';

/** Upload/list documents for a specific employee — ownership is enforced in the service, not via @Roles(), so ADMIN/HR/EMPLOYEE can all hit these */
@Controller('employees/:employeeId/documents')
export class EmployeeDocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('employeeId') employeeId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentsService.upload(
      tenantId,
      employeeId,
      user,
      file,
      dto.type,
    );
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('employeeId') employeeId: string,
  ) {
    return this.documentsService.findAllForEmployee(tenantId, employeeId, user);
  }
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get(':id')
  async download(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    const { buffer, document } = await this.documentsService.download(
      tenantId,
      id,
      user,
    );
    return new StreamableFile(buffer, {
      type: document.mimeType,
      disposition: `attachment; filename="${document.fileName}"`,
    });
  }

  @Roles(Role.ADMIN, Role.HR)
  @Delete(':id')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return this.documentsService.remove(tenantId, id, user);
  }
}
