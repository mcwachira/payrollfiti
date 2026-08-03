import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { BlogService } from './blog.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { PlatformOnly } from '../common/decorators/platform-only.decorator';

// @Roles(ADMIN) alone would pass for ANY customer tenant's admin, since
// ADMIN is per-tenant — @PlatformOnly() is the actual gate restricting this
// to the platform owner's own tenant (PLATFORM_TENANT_ID).
@Controller('blog-posts')
@Roles(Role.ADMIN)
@RequirePermission(Permission.BLOG_MANAGE)
@PlatformOnly()
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get('status')
  status() {
    return { configured: this.blogService.isConfigured() };
  }

  @Get()
  list() {
    return this.blogService.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.blogService.get(id);
  }

  @Post()
  create(@Body() dto: CreateBlogPostDto) {
    return this.blogService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.blogService.update(id, dto);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.blogService.publish(id);
  }

  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.blogService.unpublish(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.blogService.remove(id);
  }
}
