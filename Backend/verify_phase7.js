const mongoose = require('mongoose');

const config = require('./src/utils/config');
const User = require('./src/models/user');
const Tenant = require('./src/models/tenant');
const Machine = require('./src/models/machine');
const fastify = require('./src/server');

async function runVerification() {
  console.log('==================================================');
  console.log('      SMART VENDING PHASE 7 INTEGRATION VERIFIER  ');
  console.log('==================================================');

  // 1. Establish MongoDB Connection
  console.log(`Connecting to MongoDB at: ${config.MONGO_URI}...`);
  await mongoose.connect(config.MONGO_URI);
  console.log('MongoDB Connected successfully!');

  // Clear previous test records to ensure clean environment
  await User.deleteMany({ email: /^test_superadmin_p7@/ });
  await User.deleteMany({ mobile_number: { $in: ['+919999999977', '+919999999988'] } });
  await Tenant.deleteMany({ tenant_id: { $in: ['TEST_TEN_P7_01', 'TEST_TEN_P7_02'] } });
  await Machine.deleteMany({ machine_id: /^TEST_M_P7_/ });

  try {
    // Wait for Fastify to fully load plugins and establish connections
    await fastify.ready();

    // --------------------------------------------------
    // Seed Test Data
    // --------------------------------------------------
    console.log('\nSeeding B2B tenants, users, and machines...');

    // Tenants
    await Tenant.create([
      { tenant_id: 'TEST_TEN_P7_01', business_name: 'Phase 7 Tenant 1', contact_email: 'p7_t1@vending.com' },
      { tenant_id: 'TEST_TEN_P7_02', business_name: 'Phase 7 Tenant 2', contact_email: 'p7_t2@vending.com' }
    ]);

    // Users
    const superAdmin = await User.create({
      tenant_id: 'TEN_PLATFORM_ROOT',
      email: 'test_superadmin_p7@vending.com',
      password: 'SuperAdminPassword123',
      role: 'SUPER_ADMIN'
    });

    const tenantAdmin = await User.create({
      tenant_id: 'TEST_TEN_P7_01',
      mobile_number: '+919999999977',
      password: 'TenantAdminPassword123',
      role: 'TENANT_ADMIN'
    });

    // Machines
    // Test Machine 1: Assigned to Tenant 1, ACTIVE
    await Machine.create({
      tenant_id: 'TEST_TEN_P7_01',
      machine_id: 'TEST_M_P7_01',
      device_api_key: 'test_device_key_p7_1',
      grid_config: { rows: 2, columns: 3, max_depth: 7 },
      slots: [],
      assignment_status: 'ACTIVE'
    });

    // Test Machine 2: Assigned to Tenant 1, MAINTENANCE
    await Machine.create({
      tenant_id: 'TEST_TEN_P7_01',
      machine_id: 'TEST_M_P7_02',
      device_api_key: 'test_device_key_p7_2',
      grid_config: { rows: 2, columns: 3, max_depth: 7 },
      slots: [],
      assignment_status: 'MAINTENANCE'
    });

    // Test Machine 3: UNASSIGNED, should be available
    await Machine.create({
      tenant_id: 'TEN_PLATFORM_ROOT',
      machine_id: 'TEST_M_P7_03',
      device_api_key: 'test_device_key_p7_3',
      grid_config: { rows: 2, columns: 3, max_depth: 7 },
      slots: [],
      assignment_status: 'UNASSIGNED'
    });

    console.log('Test credentials and base entities seeded successfully.');

    // Obtain JWT Tokens
    const loginResSuper = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'test_superadmin_p7@vending.com', password: 'SuperAdminPassword123' }
    });
    const superAdminToken = JSON.parse(loginResSuper.body).token;

    const loginResTenant = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: '+919999999977', password: 'TenantAdminPassword123' }
    });
    const tenantAdminToken = JSON.parse(loginResTenant.body).token;

    // --------------------------------------------------
    // TEST 1: GET /api/v1/admin/tenants
    // --------------------------------------------------
    console.log('\n--- Test 1: Fetching tenants list and checking "status" field ---');
    
    const resTenants = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/tenants',
      headers: { authorization: `Bearer ${superAdminToken}` }
    });

    console.log(`GET /admin/tenants: Code = ${resTenants.statusCode} (Expected 200)`);
    if (resTenants.statusCode !== 200) {
      throw new Error(`FAIL: Super Admin failed to fetch tenants. Response: ${resTenants.body}`);
    }

    const tenants = JSON.parse(resTenants.body);
    const p7Tenant1 = tenants.find(t => t.tenant_id === 'TEST_TEN_P7_01');
    const p7Tenant2 = tenants.find(t => t.tenant_id === 'TEST_TEN_P7_02');

    if (!p7Tenant1 || !p7Tenant2) {
      throw new Error('FAIL: Seeded tenants not found in retrieved list.');
    }

    console.log('Tenant 1 retrieved:', p7Tenant1);
    console.log('Tenant 2 retrieved:', p7Tenant2);

    if (p7Tenant1.status === 'ACTIVE' && p7Tenant2.status === 'ACTIVE') {
      console.log('✅ SUCCESS: Seeded tenants retrieved correctly with default status ACTIVE.');
    } else {
      throw new Error(`FAIL: Unexpected tenant status values: Tenant1=${p7Tenant1.status}, Tenant2=${p7Tenant2.status}`);
    }

    // --------------------------------------------------
    // TEST 2: GET /api/v1/admin/machines/available
    // --------------------------------------------------
    console.log('\n--- Test 2: Fetching available machines ---');

    // Case 2A: Attempt as Tenant Admin (should fail with 403)
    const resAvailTenant = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/machines/available',
      headers: { authorization: `Bearer ${tenantAdminToken}` }
    });
    console.log(`Case 2A (Tenant Admin attempt): Code = ${resAvailTenant.statusCode} (Expected 403)`);
    if (resAvailTenant.statusCode !== 403) {
      throw new Error('FAIL: Tenant Admin should not be allowed to fetch available machines.');
    }
    console.log('✅ SUCCESS: Non-Super Admin was blocked successfully.');

    // Case 2B: Attempt as Super Admin (should succeed and return array of machine_ids)
    const resAvailSuper = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/machines/available',
      headers: { authorization: `Bearer ${superAdminToken}` }
    });
    console.log(`Case 2B (Super Admin attempt): Code = ${resAvailSuper.statusCode} (Expected 200)`);
    if (resAvailSuper.statusCode !== 200) {
      throw new Error(`FAIL: Super Admin failed to fetch available machines. Response: ${resAvailSuper.body}`);
    }

    const availableIds = JSON.parse(resAvailSuper.body);
    console.log('Available Machines Array:', availableIds);

    if (!Array.isArray(availableIds)) {
      throw new Error('FAIL: Response is not a JSON array.');
    }

    // Must contain TEST_M_P7_03 but NOT TEST_M_P7_01 or TEST_M_P7_02
    if (availableIds.includes('TEST_M_P7_03') && !availableIds.includes('TEST_M_P7_01') && !availableIds.includes('TEST_M_P7_02')) {
      console.log('✅ SUCCESS: Available machines correctly filtered to only UNASSIGNED hardware IDs.');
    } else {
      throw new Error('FAIL: Available machines list does not match expected criteria.');
    }

    // --------------------------------------------------
    // TEST 3: POST /api/v1/admin/tenant/disable
    // --------------------------------------------------
    console.log('\n--- Test 3: Disabling a Tenant and Cascading Machine Release ---');

    // Case 3A: Attempt as Tenant Admin (should fail with 403)
    const resDisableTenant = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/disable',
      headers: { authorization: `Bearer ${tenantAdminToken}` },
      payload: { tenant_id: 'TEST_TEN_P7_01' }
    });
    console.log(`Case 3A (Tenant Admin attempt): Code = ${resDisableTenant.statusCode} (Expected 403)`);
    if (resDisableTenant.statusCode !== 403) {
      throw new Error('FAIL: Tenant Admin should not be allowed to disable tenants.');
    }
    console.log('✅ SUCCESS: Non-Super Admin was blocked successfully from disabling a tenant.');

    // Case 3B: Missing tenant_id in body
    const resDisableMissing = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/disable',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {}
    });
    console.log(`Case 3B (Missing tenant_id): Code = ${resDisableMissing.statusCode} (Expected 400)`);
    if (resDisableMissing.statusCode !== 400) {
      throw new Error('FAIL: Expected 400 Bad Request on missing tenant_id.');
    }
    console.log('✅ SUCCESS: Missing input validation works correctly.');

    // Case 3C: Non-existent tenant_id
    const resDisableNonexistent = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/disable',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { tenant_id: 'TEN_INVALID_9999' }
    });
    console.log(`Case 3C (Non-existent tenant_id): Code = ${resDisableNonexistent.statusCode} (Expected 404)`);
    if (resDisableNonexistent.statusCode !== 404) {
      throw new Error('FAIL: Expected 404 Not Found on invalid tenant_id.');
    }
    console.log('✅ SUCCESS: Non-existent tenant check works correctly.');

    // Case 3D: Valid Disable Tenant Request (should succeed)
    const resDisableSuper = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/disable',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { tenant_id: 'TEST_TEN_P7_01' }
    });
    console.log(`Case 3D (Valid disable request): Code = ${resDisableSuper.statusCode} (Expected 200)`);
    if (resDisableSuper.statusCode !== 200) {
      throw new Error(`FAIL: Super Admin failed to disable tenant. Response: ${resDisableSuper.body}`);
    }

    const disabledRes = JSON.parse(resDisableSuper.body);
    console.log('Disable Response Tenant Details:', disabledRes.tenant);
    if (disabledRes.tenant.status === 'DISABLED') {
      console.log('✅ SUCCESS: Tenant status updated to DISABLED in response.');
    } else {
      throw new Error('FAIL: Response tenant status is not DISABLED.');
    }

    // Verify DB states for Tenant
    const tenantInDB = await Tenant.findOne({ tenant_id: 'TEST_TEN_P7_01' });
    console.log('DB Tenant Status:', tenantInDB.status);
    if (tenantInDB.status !== 'DISABLED') {
      throw new Error('FAIL: Tenant status in MongoDB is not DISABLED.');
    }
    console.log('✅ SUCCESS: Tenant is disabled in database.');

    // Verify Cascading Action on Machine 1 and Machine 2
    const m1 = await Machine.findOne({ machine_id: 'TEST_M_P7_01' });
    const m2 = await Machine.findOne({ machine_id: 'TEST_M_P7_02' });

    console.log('Machine 1 assignment state after disable:', { tenant_id: m1.tenant_id, assignment_status: m1.assignment_status });
    console.log('Machine 2 assignment state after disable:', { tenant_id: m2.tenant_id, assignment_status: m2.assignment_status });

    if (
      m1.tenant_id === 'TEN_PLATFORM_ROOT' && m1.assignment_status === 'UNASSIGNED' &&
      m2.tenant_id === 'TEN_PLATFORM_ROOT' && m2.assignment_status === 'UNASSIGNED'
    ) {
      console.log('✅ SUCCESS: Cascading release unassigned all associated tenant machines to platform root cleanly.');
    } else {
      throw new Error('FAIL: Cascading updates on Machine documents did not execute correctly.');
    }

    // Verify new available machines endpoint now lists these machines
    const resAvailAfter = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/machines/available',
      headers: { authorization: `Bearer ${superAdminToken}` }
    });
    const availableIdsAfter = JSON.parse(resAvailAfter.body);
    console.log('Available Machines Array after disabling tenant:', availableIdsAfter);

    if (
      availableIdsAfter.includes('TEST_M_P7_01') &&
      availableIdsAfter.includes('TEST_M_P7_02') &&
      availableIdsAfter.includes('TEST_M_P7_03')
    ) {
      console.log('✅ SUCCESS: Free hardware dynamically populated into the available machines pool!');
    } else {
      throw new Error('FAIL: Newly freed machines did not populate into available list.');
    }

    console.log('\n==================================================');
    console.log('     ALL PHASE 7 INTEGRATION TESTS PASSED!        ');
    console.log('==================================================');

  } finally {
    // Cleanup seeded records
    console.log('\nCleaning up verification records...');
    await User.deleteMany({ email: /^test_superadmin_p7@/ });
    await User.deleteMany({ mobile_number: { $in: ['+919999999977', '+919999999988'] } });
    await Tenant.deleteMany({ tenant_id: { $in: ['TEST_TEN_P7_01', 'TEST_TEN_P7_02'] } });
    await Machine.deleteMany({ machine_id: /^TEST_M_P7_/ });

    await mongoose.disconnect();
    await fastify.close();
    console.log('Database connections closed cleanly.');
  }
}

runVerification().catch(err => {
  console.error('\nCRITICAL VERIFICATION ERROR:', err);
  mongoose.disconnect();
  fastify.close();
  process.exit(1);
});
