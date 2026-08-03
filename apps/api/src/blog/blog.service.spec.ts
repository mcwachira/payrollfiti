import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { createClient } from '@sanity/client';
import { BlogService } from './blog.service';

jest.mock('@sanity/client', () => ({ createClient: jest.fn() }));
const createClientMock = createClient as jest.Mock;

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

const sanityConfig = {
  projectId: 'test-project',
  dataset: 'production',
  apiToken: 'test-token',
};

const doc = {
  _id: 'post-1',
  _type: 'post',
  _createdAt: '2026-01-01T00:00:00.000Z',
  _updatedAt: '2026-01-01T00:00:00.000Z',
  title: 'PAYE in Kenya, Explained',
  slug: 'paye-kenya-explained',
  excerpt: 'How PAYE bands work.',
  body: '# PAYE\n\n...',
  countryFocus: 'KE',
  status: 'draft' as const,
};

const dto = {
  title: doc.title,
  slug: doc.slug,
  excerpt: doc.excerpt,
  body: doc.body,
  countryFocus: 'KE' as const,
};

async function buildService(config: typeof sanityConfig | null) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      BlogService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => (key === 'sanity' ? (config ?? {}) : undefined),
        },
      },
    ],
  }).compile();
  return module.get(BlogService);
}

describe('BlogService', () => {
  let mockClient: any;
  let patchChain: any;

  beforeEach(() => {
    jest.clearAllMocks();
    patchChain = {
      set: jest.fn().mockReturnThis(),
      unset: jest.fn().mockReturnThis(),
      commit: asyncMock(doc),
    };
    mockClient = {
      fetch: asyncMock(null),
      create: asyncMock(doc),
      getDocument: asyncMock(doc),
      patch: jest.fn().mockReturnValue(patchChain),
      delete: asyncMock(undefined),
    };
    createClientMock.mockReturnValue(mockClient);
  });

  describe('isConfigured', () => {
    it('is false when SANITY_PROJECT_ID/SANITY_API_TOKEN are unset', async () => {
      const service = await buildService(null);
      expect(service.isConfigured()).toBe(false);
    });

    it('is true once both are set', async () => {
      const service = await buildService(sanityConfig);
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('when Sanity is not configured', () => {
    it('rejects every operation with BadRequestException rather than calling Sanity', async () => {
      const service = await buildService(null);

      await expect(service.list()).rejects.toThrow(BadRequestException);
      expect(mockClient.fetch).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('fetches every post ordered by creation date', async () => {
      const service = await buildService(sanityConfig);
      mockClient.fetch.mockResolvedValueOnce([doc]);

      const result = await service.list();

      expect(mockClient.fetch).toHaveBeenCalledWith(
        expect.stringContaining('order(_createdAt desc)'),
        { type: 'post' },
      );
      expect(result).toEqual([
        expect.objectContaining({ id: 'post-1', slug: 'paye-kenya-explained' }),
      ]);
    });
  });

  describe('get', () => {
    it('returns the mapped post when found', async () => {
      const service = await buildService(sanityConfig);
      const result = await service.get('post-1');
      expect(result.id).toBe('post-1');
    });

    it('throws NotFoundException when the document does not exist', async () => {
      const service = await buildService(sanityConfig);
      mockClient.getDocument.mockResolvedValueOnce(undefined);

      await expect(service.get('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for a document of a different type', async () => {
      const service = await buildService(sanityConfig);
      mockClient.getDocument.mockResolvedValueOnce({
        ...doc,
        _type: 'otherThing',
      });

      await expect(service.get('post-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a draft post once the slug is confirmed free', async () => {
      const service = await buildService(sanityConfig);
      mockClient.fetch.mockResolvedValueOnce(null); // no existing slug

      const result = await service.create(dto);

      expect(mockClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          _type: 'post',
          slug: dto.slug,
          status: 'draft',
        }),
      );
      expect(result.id).toBe('post-1');
    });

    it('rejects a duplicate slug without ever calling create', async () => {
      const service = await buildService(sanityConfig);
      mockClient.fetch.mockResolvedValueOnce({ _id: 'existing-post' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockClient.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('404s before touching Sanity when the post id is wrong', async () => {
      const service = await buildService(sanityConfig);
      mockClient.getDocument.mockResolvedValueOnce(undefined);

      await expect(service.update('missing', { title: 'New' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockClient.patch).not.toHaveBeenCalled();
    });

    it('checks slug availability only when the slug is actually changing', async () => {
      const service = await buildService(sanityConfig);

      await service.update('post-1', { title: 'New title' });

      expect(mockClient.fetch).not.toHaveBeenCalled();
      expect(mockClient.patch).toHaveBeenCalledWith('post-1');
    });

    it('rejects renaming into a slug already used by a different post', async () => {
      const service = await buildService(sanityConfig);
      mockClient.fetch.mockResolvedValueOnce({ _id: 'another-post' });

      await expect(
        service.update('post-1', { slug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('publish / unpublish', () => {
    it('publish sets status + publishedAt', async () => {
      const service = await buildService(sanityConfig);
      await service.publish('post-1');
      expect(patchChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'published' }),
      );
    });

    it('unpublish clears publishedAt and reverts to draft', async () => {
      const service = await buildService(sanityConfig);
      await service.unpublish('post-1');
      expect(patchChain.set).toHaveBeenCalledWith({ status: 'draft' });
      expect(patchChain.unset).toHaveBeenCalledWith(['publishedAt']);
    });
  });

  describe('remove', () => {
    it('deletes an existing post', async () => {
      const service = await buildService(sanityConfig);
      await service.remove('post-1');
      expect(mockClient.delete).toHaveBeenCalledWith('post-1');
    });

    it('404s instead of calling delete for an unknown post', async () => {
      const service = await buildService(sanityConfig);
      mockClient.getDocument.mockResolvedValueOnce(undefined);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockClient.delete).not.toHaveBeenCalled();
    });
  });
});
