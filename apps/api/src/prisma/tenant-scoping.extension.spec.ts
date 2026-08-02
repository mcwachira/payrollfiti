import { ForbiddenException } from '@nestjs/common';
import { scopeQueryArgs } from './tenant-scoping.extension';

describe('scopeQueryArgs', () => {
  const tenantId = 'tenant-1';

  it('injects tenantId into the where clause for reads', () => {
    const result = scopeQueryArgs(
      'findMany',
      { where: { status: 'ACTIVE' } },
      tenantId,
    );
    expect(result.where).toEqual({ status: 'ACTIVE', tenantId });
  });

  it('injects tenantId into the where clause when none was given', () => {
    const result = scopeQueryArgs('findFirst', {}, tenantId);
    expect(result.where).toEqual({ tenantId });
  });

  it('does not let a caller override tenantId already present in where', () => {
    const result = scopeQueryArgs(
      'findMany',
      { where: { tenantId: 'someone-elses-tenant' } },
      tenantId,
    );
    expect(result.where).toEqual({ tenantId });
  });

  it('auto-fills tenantId on create when not provided', () => {
    const result = scopeQueryArgs(
      'create',
      { data: { name: 'Acme' } },
      tenantId,
    );
    expect(result.data).toEqual({ name: 'Acme', tenantId });
  });

  it('rejects a create payload that spoofs a different tenantId', () => {
    expect(() =>
      scopeQueryArgs(
        'create',
        { data: { name: 'Acme', tenantId: 'other-tenant' } },
        tenantId,
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows a create payload whose tenantId matches the context', () => {
    const result = scopeQueryArgs(
      'create',
      { data: { name: 'Acme', tenantId } },
      tenantId,
    );
    expect(result.data).toEqual({ name: 'Acme', tenantId });
  });

  it('stamps tenantId onto every row of a createMany batch and rejects mismatches', () => {
    const result = scopeQueryArgs(
      'createMany',
      { data: [{ name: 'A' }, { name: 'B' }] },
      tenantId,
    );
    expect(result.data).toEqual([
      { name: 'A', tenantId },
      { name: 'B', tenantId },
    ]);

    expect(() =>
      scopeQueryArgs(
        'createMany',
        { data: [{ name: 'A', tenantId: 'other-tenant' }] },
        tenantId,
      ),
    ).toThrow(ForbiddenException);
  });

  it('scopes update/delete where clauses so a cross-tenant id cannot be targeted', () => {
    const updateArgs = scopeQueryArgs(
      'update',
      { where: { id: 'row-1' }, data: { name: 'New name' } },
      tenantId,
    );
    expect(updateArgs.where).toEqual({ id: 'row-1', tenantId });

    const deleteArgs = scopeQueryArgs(
      'delete',
      { where: { id: 'row-1' } },
      tenantId,
    );
    expect(deleteArgs.where).toEqual({ id: 'row-1', tenantId });
  });

  it('rejects an update payload attempting to reassign tenantId', () => {
    expect(() =>
      scopeQueryArgs(
        'update',
        { where: { id: 'row-1' }, data: { tenantId: 'other-tenant' } },
        tenantId,
      ),
    ).toThrow(ForbiddenException);
  });

  it('scopes upsert where/create and rejects a spoofed create branch', () => {
    const result = scopeQueryArgs(
      'upsert',
      {
        where: { id: 'row-1' },
        create: { name: 'A' },
        update: { name: 'B' },
      },
      tenantId,
    );
    expect(result.where).toEqual({ id: 'row-1', tenantId });
    expect(result.create).toEqual({ name: 'A', tenantId });

    expect(() =>
      scopeQueryArgs(
        'upsert',
        {
          where: { id: 'row-1' },
          create: { name: 'A', tenantId: 'other-tenant' },
          update: { name: 'B' },
        },
        tenantId,
      ),
    ).toThrow(ForbiddenException);
  });
});
