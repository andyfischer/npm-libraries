
import { compileSchema } from '../../table';
import { it, expect } from 'vitest'
import { createTenantTable } from '../TenantTable';

it("can create a tenant table and insert items", () => {
    const baseSchema = compileSchema({
        name: 'TenantTest-Original',
        funcs: [
            'get(tenantUniqueId tenantId)',
            'list(tenantId)',
            'list(searchId)',
            'listAll',
            'each',
        ]
    });

    const tenantSchema = compileSchema({
        name: 'TenantTest-Tenant',
        funcs: [
            'get(tenantUniqueId)',
            'listAll',
        ]
    });

    const baseTable = baseSchema.createTable();

    const tenant1 = createTenantTable({
        schema: tenantSchema,
        baseTable: baseTable,
        tenantAttr: 'tenantId',
        tenantAttrValue: 'tenant1',
    });

    const tenant2 = createTenantTable({
        schema: tenantSchema,
        baseTable: baseTable,
        tenantAttr: 'tenantId',
        tenantAttrValue: 'tenant2',
    });

    // Test 'insert'

    tenant1.insert({ tenantUniqueId: 'tenant1-unique1', otherData: 'first' });

    expect(baseTable.listAll()).toEqual([{
        tenantUniqueId: 'tenant1-unique1',
        otherData: 'first',
        tenantId: 'tenant1'
    }]);

    tenant2.insert({ tenantUniqueId: 'tenant2-unique1', otherData: 'second' });

    expect(baseTable.listAll()).toEqual([{
        tenantUniqueId: 'tenant1-unique1',
        otherData: 'first',
        tenantId: 'tenant1'
    }, {
        tenantUniqueId: 'tenant2-unique1',
        otherData: 'second',
        tenantId: 'tenant2'
    }]);

    // Test 'get'
    expect(tenant1.get_with_tenantUniqueId('tenant1-unique1')).toEqual({
        tenantId: 'tenant1',
        tenantUniqueId: 'tenant1-unique1',
        otherData: 'first',
    });
});

it("tenant table supports: list, has, delete", () => {
    const baseSchema = compileSchema({
        name: 'TenantTest-Original',
        funcs: [
            'listAll',
            'list(tenantId)',
            'list(searchId tenantId)',
            'has(searchId tenantId)',
            'delete(searchId tenantId)',
        ]
    });

    const tenantSchema = compileSchema({
        name: 'TenantTest-Tenant',
        funcs: [
            'list(searchId)',
            'has(searchId)',
            'delete(searchId)',
        ]
    });

    const baseTable = baseSchema.createTable();
    const tenant1 = createTenantTable({
        schema: tenantSchema,
        baseTable: baseTable,
        tenantAttr: 'tenantId',
        tenantAttrValue: 'tenant1',
    });

    baseTable.insert({ searchId: 'search1', tenantId: 'tenant1', name: 'search1-tenant1-first' });
    baseTable.insert({ searchId: 'search1', tenantId: 'tenant1', name: 'search1-tenant1-second' });
    baseTable.insert({ searchId: 'search1', tenantId: 'tenant2', name: 'search1-tenant2' });
    baseTable.insert({ searchId: 'search2', tenantId: 'tenant1', name: 'search2-tenant1' });
    baseTable.insert({ searchId: 'search3', tenantId: 'tenant2', name: 'search3-tenant2' });

    expect(tenant1.list_with_searchId('search1')).toEqual([{
        searchId: 'search1',
        tenantId: 'tenant1',
        name: 'search1-tenant1-first',
    }, {
        searchId: 'search1',
        tenantId: 'tenant1',
        name: 'search1-tenant1-second',
    }]);

    expect(tenant1.has_searchId('search1')).toEqual(true);
    expect(tenant1.has_searchId('search2')).toEqual(true);
    expect(tenant1.has_searchId('search3')).toEqual(false);

    tenant1.delete_with_searchId('search2');
    tenant1.delete_with_searchId('search3');

    expect(baseTable.listAll().map(item => item.name)).toEqual([
        'search1-tenant1-first',
        'search1-tenant1-second',
        'search1-tenant2',
        'search3-tenant2',
    ]);
});

it("tenant table supports: each and listAll (correctly filtered)", () => {
    const baseSchema = compileSchema({
        name: 'TenantTest-Original',
        funcs: [
            'list(tenantId)',
        ]
    });

    const tenantSchema = compileSchema({
        name: 'TenantTest-Tenant',
        funcs: [
            'listAll',
            'each',
        ]
    });

    const baseTable = baseSchema.createTable();
    const tenant1 = createTenantTable({
        schema: tenantSchema,
        baseTable: baseTable,
        tenantAttr: 'tenantId',
        tenantAttrValue: 'tenant1',
    });

    baseTable.insert({ searchId: 'search1', tenantId: 'tenant1', name: 'search1-tenant1-first' });
    baseTable.insert({ searchId: 'search1', tenantId: 'tenant1', name: 'search1-tenant1-second' });
    baseTable.insert({ searchId: 'search1', tenantId: 'tenant2', name: 'search1-tenant2' });
    baseTable.insert({ searchId: 'search2', tenantId: 'tenant1', name: 'search2-tenant1' });
    baseTable.insert({ searchId: 'search3', tenantId: 'tenant2', name: 'search3-tenant2' });

    const expectedTenantList = [{
        searchId: 'search1',
        name: 'search1-tenant1-first',
    }, {
        searchId: 'search1',
        name: 'search1-tenant1-second',
    }, {
        searchId: 'search2',
        name: 'search2-tenant1',
    }];

    expect(tenant1.listAll()).toEqual(expectedTenantList);
    expect(Array.from(tenant1.each())).toEqual(expectedTenantList);
});

it("supports deleteAll", () => {
    const baseSchema = compileSchema({
        name: 'TenantTest-DeleteAll',
        funcs: [
            'list(tenantId)',
            'listAll',
            'delete(tenantId)',
            'deleteAll',
        ]
    });

    const tenantSchema = compileSchema({
        name: 'TenantTest-Tenant-DeleteAll',
        funcs: [
            'deleteAll',
        ]
    });

    const baseTable = baseSchema.createTable();
    const tenant1 = createTenantTable({
        schema: tenantSchema,
        baseTable: baseTable,
        tenantAttr: 'tenantId',
        tenantAttrValue: 'tenant1',
    });

    // Insert some items into the base table
    baseTable.insert({ searchId: 'search1', tenantId: 'tenant1', name: 'search1-tenant1-first' });
    baseTable.insert({ searchId: 'search1', tenantId: 'tenant1', name: 'search1-tenant1-second' });
    baseTable.insert({ searchId: 'search1', tenantId: 'tenant2', name: 'search1-tenant2' });
    baseTable.insert({ searchId: 'search2', tenantId: 'tenant1', name: 'search2-tenant1' });
    baseTable.insert({ searchId: 'search3', tenantId: 'tenant2', name: 'search3-tenant2' });

    // Delete all items for tenant1
    tenant1.deleteAll();

    // Verify that all items for tenant1 are deleted
    expect(baseTable.listAll()).toEqual([
        { searchId: 'search1', tenantId: 'tenant2', name: 'search1-tenant2' },
        { searchId: 'search3', tenantId: 'tenant2', name: 'search3-tenant2' }
    ]);
});