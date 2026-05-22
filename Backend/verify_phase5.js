const mongoose = require('mongoose');

const config = require('./src/utils/config');
const User = require('./src/models/user');
const Tenant = require('./src/models/tenant');
const Machine = require('./src/models/machine');
const Report = require('./src/models/report');
const Order = require('./src/models/order');
const InventoryAudit = require('./src/models/inventoryAudit');
const fastify = require('./src/server');

async function runVerification() {
  console.log('==================================================');
  console.log('      SMART VENDING PHASE 5 INTEGRATION VERIFIER  ');
  console.log('==================================================');

  // 1. Establish MongoDB Connection
  console.log(`Connecting to MongoDB at: ${config.MONGO_URI}...`);
  await mongoose.connect(config.MONGO_URI);
  console.log('MongoDB Connected successfully!');

  // Clear previous test records to ensure clean environment
  await User.deleteMany({ email: /^test_superadmin_p5@/ });
  await User.deleteMany({ mobile_number: { $in: ['+919999999999', '+917777777777', '+918888888888'] } });
  await Tenant.deleteMany({ tenant_id: { $in: ['TEST_TEN_001', 'TEST_TEN_002'] } });
  await Machine.deleteMany({ machine_id: /^TEST_M_/ });
  await Report.deleteMany({ report_id: /^TEST_REP_/ });
  await Order.deleteMany({ order_id: /^TEST_ORD_/ });
  await InventoryAudit.deleteMany({ machine_id: /^TEST_M_/ });

  try {
    // Wait for Fastify to fully load plugins and establish connections
    await fastify.ready();

    // --------------------------------------------------
    // Seed Test Data
    // --------------------------------------------------
    console.log('\nSeeding B2B tenants, users, and machines...');

    // Tenants
    await Tenant.create([
      { tenant_id: 'TEST_TEN_001', business_name: 'Alpha Foods', contact_email: 'alpha@foods.com' },
      { tenant_id: 'TEST_TEN_002', business_name: 'Beta Beverages', contact_email: 'beta@bev.com' }
    ]);

    // Users
    const superAdmin = await User.create({
      tenant_id: 'TEN_PLATFORM_ROOT',
      email: 'test_superadmin_p5@vending.com',
      password: 'SuperAdminPassword123',
      role: 'SUPER_ADMIN'
    });

    const tenantAdmin1 = await User.create({
      tenant_id: 'TEST_TEN_001',
      mobile_number: '+919999999999',
      password: 'TenantAdminPassword123',
      role: 'TENANT_ADMIN'
    });

    const tenantAdmin2 = await User.create({
      tenant_id: 'TEST_TEN_002',
      mobile_number: '+917777777777',
      password: 'TenantAdminPassword123',
      role: 'TENANT_ADMIN'
    });

    const operator = await User.create({
      tenant_id: 'TEST_TEN_001',
      mobile_number: '+918888888888',
      password: 'OperatorPassword123',
      role: 'OPERATOR'
    });

    // Machines
    const machine = await Machine.create({
      tenant_id: 'TEST_TEN_001',
      machine_id: 'TEST_M_01',
      device_api_key: 'test_device_key_hashed',
      grid_config: { rows: 2, columns: 3, max_depth: 7 },
      slots: [],
      assignment_status: 'ACTIVE'
    });

    console.log('Test credentials and base entities seeded successfully.');

    // Obtain JWT Tokens
    const loginResSuper = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'test_superadmin_p5@vending.com', password: 'SuperAdminPassword123' }
    });
    const superAdminToken = JSON.parse(loginResSuper.body).token;

    const loginResTenant1 = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: '+919999999999', password: 'TenantAdminPassword123' }
    });
    const tenantAdmin1Token = JSON.parse(loginResTenant1.body).token;

    const loginResOperator = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: '+918888888888', password: 'OperatorPassword123' }
    });
    const operatorToken = JSON.parse(loginResOperator.body).token;

    // --------------------------------------------------
    // TEST 1: Machine Unassignment
    // --------------------------------------------------
    console.log('\n--- Test 1: Machine Unassignment endpoint protection & execution ---');

    // Case 1A: Attempting unassign using a Tenant Admin (should be rejected)
    const res1A = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/machine/unassign',
      headers: { authorization: `Bearer ${tenantAdmin1Token}` },
      payload: { machine_id: 'TEST_M_01' }
    });
    console.log(`Case 1A (Tenant Admin attempt): Code = ${res1A.statusCode} (Expected 403)`);
    if (res1A.statusCode !== 403) {
      throw new Error(`FAIL: Tenant Admin should not be allowed to unassign machines.`);
    }
    console.log('✅ SUCCESS: Non-Super Admin was blocked successfully.');

    // Case 1B: Attempting unassign using Super Admin (should succeed)
    const res1B = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/machine/unassign',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { machine_id: 'TEST_M_01' }
    });
    console.log(`Case 1B (Super Admin attempt): Code = ${res1B.statusCode} (Expected 200)`);
    if (res1B.statusCode !== 200) {
      throw new Error(`FAIL: Super Admin failed to unassign machine. Response: ${res1B.body}`);
    }
    
    const unassignedMachine = JSON.parse(res1B.body).machine;
    console.log('Unassigned Machine Document:', unassignedMachine);
    if (unassignedMachine.tenant_id === 'TEN_PLATFORM_ROOT' && unassignedMachine.assignment_status === 'UNASSIGNED') {
      console.log('✅ SUCCESS: Machine tenant_id reset to platform root and status marked UNASSIGNED.');
    } else {
      throw new Error('FAIL: Machine attributes were not successfully updated on unassign.');
    }

    // --------------------------------------------------
    // TEST 2: Report Schema Fields Check
    // --------------------------------------------------
    console.log('\n--- Test 2: Report Schema Verification (WhatsApp Pivot) ---');

    const reportKeys = Object.keys(Report.schema.paths);
    console.log('Report schema fields:', reportKeys);

    if (reportKeys.includes('imageUrl')) {
      throw new Error('FAIL: Report schema still contains the imageUrl field.');
    }
    console.log('✅ SUCCESS: Report schema correctly lacks the imageUrl field.');

    if (!reportKeys.includes('undispensed_items')) {
      throw new Error('FAIL: Report schema lacks undispensed_items audit array.');
    }
    console.log('✅ SUCCESS: Report schema correctly supports undispensed_items for financial tracking.');

    // Direct Mongoose write check
    const mockReport = await Report.create({
      tenant_id: 'TEST_TEN_001',
      report_id: 'TEST_REP_1001',
      order_id: 'TEST_ORD_99',
      machine_id: 'TEST_M_01',
      issueType: 'JAM',
      description: 'Idli stuck in rack 2',
      undispensed_items: [
        { rack_number: 2, item_name: 'Idli', quantity: 1, price_paise: 4000 }
      ]
    });
    console.log('Created Mock Report successfully:', mockReport.report_id);
    console.log('✅ SUCCESS: Report schema validation passes.');

    // --------------------------------------------------
    // TEST 3: Time-Scoped B2B Analytics
    // --------------------------------------------------
    console.log('\n--- Test 3: Seeding Analytics Data (Orders & Clearouts) ---');

    const now = new Date();

    // Mock Orders
    // Fit Daily & Weekly: Order A (12 hours ago)
    await Order.create({
      tenant_id: 'TEST_TEN_001',
      order_id: 'TEST_ORD_A',
      machine_id: 'TEST_M_01',
      items: [{ rack_number: 1, item_id: 'i1', item_name: 'Idli', quantity: 2, price_paise: 3000 }],
      total_amount: 6000,
      total_items: 2,
      status: 'COMPLETED',
      createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000)
    });

    // Fit Weekly but NOT Daily: Order B (3 days ago)
    await Order.create({
      tenant_id: 'TEST_TEN_001',
      order_id: 'TEST_ORD_B',
      machine_id: 'TEST_M_01',
      items: [{ rack_number: 2, item_id: 'i2', item_name: 'Vada', quantity: 1, price_paise: 4000 }],
      total_amount: 4000,
      total_items: 1,
      status: 'COMPLETED',
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    });

    // Other Tenant: Order C (2 hours ago, Beta Beverages)
    await Order.create({
      tenant_id: 'TEST_TEN_002',
      order_id: 'TEST_ORD_C',
      machine_id: 'TEST_M_02',
      items: [{ rack_number: 1, item_id: 'i3', item_name: 'Lemon Juice', quantity: 3, price_paise: 5000 }],
      total_amount: 15000,
      total_items: 3,
      status: 'COMPLETED',
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000)
    });

    // Non-eligible Status (unpaid PENDING_PAYMENT, should be excluded from revenue)
    await Order.create({
      tenant_id: 'TEST_TEN_001',
      order_id: 'TEST_ORD_D',
      machine_id: 'TEST_M_01',
      items: [{ rack_number: 1, item_id: 'i1', item_name: 'Idli', quantity: 2, price_paise: 3000 }],
      total_amount: 6000,
      total_items: 2,
      status: 'PENDING_PAYMENT',
      createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000)
    });

    // Mock Inventory Audits
    // Audit A: Daily & Weekly (Tenant 1, -5 qty clearout)
    await InventoryAudit.create({
      tenant_id: 'TEST_TEN_001',
      operator_id: operator._id,
      machine_id: 'TEST_M_01',
      slot_id: 'R1-C1',
      item_id: 'i1',
      action_type: 'SHIFT_CLEAROUT_DONATION',
      quantity_changed: -5,
      previous_quantity: 5,
      new_quantity: 0,
      createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000)
    });

    // Audit B: Weekly but NOT Daily (Tenant 1, -3 qty clearout)
    await InventoryAudit.create({
      tenant_id: 'TEST_TEN_001',
      operator_id: operator._id,
      machine_id: 'TEST_M_01',
      slot_id: 'R1-C2',
      item_id: 'i2',
      action_type: 'SHIFT_CLEAROUT_DONATION',
      quantity_changed: -3,
      previous_quantity: 3,
      new_quantity: 0,
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    });

    // Audit C: Daily & Weekly (Tenant 2, -10 qty clearout)
    await InventoryAudit.create({
      tenant_id: 'TEST_TEN_002',
      operator_id: operator._id,
      machine_id: 'TEST_M_02',
      slot_id: 'R2-C1',
      item_id: 'i3',
      action_type: 'SHIFT_CLEAROUT_DONATION',
      quantity_changed: -10,
      previous_quantity: 10,
      new_quantity: 0,
      createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000)
    });

    // Audit D: Non-eligible action_type (RESTOCK, should not be included in donation counts)
    await InventoryAudit.create({
      tenant_id: 'TEST_TEN_001',
      operator_id: operator._id,
      machine_id: 'TEST_M_01',
      slot_id: 'R1-C1',
      item_id: 'i1',
      action_type: 'RESTOCK',
      quantity_changed: 7,
      previous_quantity: 0,
      new_quantity: 7,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000)
    });

    console.log('Seeded 4 mock Orders and 4 mock Inventory Audits.');

    // --------------------------------------------------
    // TEST 4: Querying Analytics & Asserting Aggregations
    // --------------------------------------------------
    console.log('\n--- Test 4: Time-Scoped B2B Isolated Analytics ---');

    // Case 4A: Operator attempt (should return 403 Forbidden)
    const res4A = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics?range=weekly',
      headers: { authorization: `Bearer ${operatorToken}` }
    });
    console.log(`Case 4A (Operator access): Code = ${res4A.statusCode} (Expected 403)`);
    if (res4A.statusCode !== 403) {
      throw new Error('FAIL: Operators should not be authorized to view analytics.');
    }

    // Case 4B: Invalid Range Validation
    const res4B = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics?range=yearly',
      headers: { authorization: `Bearer ${tenantAdmin1Token}` }
    });
    console.log(`Case 4B (Invalid Range): Code = ${res4B.statusCode} (Expected 400)`);
    if (res4B.statusCode !== 400) {
      throw new Error('FAIL: Expected 400 Bad Request for invalid yearly range.');
    }

    // Case 4C: Tenant Admin 1 - Daily Scope
    const res4C = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics?range=daily',
      headers: { authorization: `Bearer ${tenantAdmin1Token}` }
    });
    console.log(`Case 4C (Tenant Admin 1 Daily): Code = ${res4C.statusCode} (Expected 200)`);
    const metrics4C = JSON.parse(res4C.body);
    console.log('Daily Metrics:', metrics4C);
    // Expectations: Only ORD_A (total_amount = 6000, count = 1), Audit A (quantity_changed = -5)
    if (
      metrics4C.totalRevenue === 6000 &&
      metrics4C.totalOrders === 1 &&
      metrics4C.totalDonatedItems === 5
    ) {
      console.log('✅ SUCCESS: Daily B2B Isolated calculations are perfectly accurate.');
    } else {
      throw new Error('FAIL: Daily analytics aggregate mismatch.');
    }

    // Case 4D: Tenant Admin 1 - Weekly Scope
    const res4D = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics?range=weekly',
      headers: { authorization: `Bearer ${tenantAdmin1Token}` }
    });
    console.log(`Case 4D (Tenant Admin 1 Weekly): Code = ${res4D.statusCode} (Expected 200)`);
    const metrics4D = JSON.parse(res4D.body);
    console.log('Weekly Metrics:', metrics4D);
    // Expectations: ORD_A (6000) + ORD_B (4000) = 10000, orders count = 2, Audit A (5) + Audit B (3) = 8 donated items
    if (
      metrics4D.totalRevenue === 10000 &&
      metrics4D.totalOrders === 2 &&
      metrics4D.totalDonatedItems === 8
    ) {
      console.log('✅ SUCCESS: Weekly B2B Isolated calculations are perfectly accurate.');
    } else {
      throw new Error('FAIL: Weekly analytics aggregate mismatch.');
    }

    // Case 4E: Super Admin - Global Weekly Scope
    const res4E = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics?range=weekly',
      headers: { authorization: `Bearer ${superAdminToken}` }
    });
    console.log(`Case 4E (Super Admin Weekly Global): Code = ${res4E.statusCode} (Expected 200)`);
    const metrics4E = JSON.parse(res4E.body);
    console.log('Global Weekly Metrics:', metrics4E);
    // Expectations: ORD_A (6000) + ORD_B (4000) + ORD_C (15000) = 25000, orders count = 3, donations = 5 + 3 + 10 = 18 items
    if (
      metrics4E.totalRevenue === 25000 &&
      metrics4E.totalOrders === 3 &&
      metrics4E.totalDonatedItems === 18
    ) {
      console.log('✅ SUCCESS: Super Admin global cross-tenant aggregation is perfectly accurate.');
    } else {
      throw new Error('FAIL: Super Admin global analytics aggregate mismatch.');
    }

    // Case 4F: Super Admin - Weekly Tenant Impersonation/God Mode Filter
    const res4F = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics?range=weekly&tenant_id=TEST_TEN_002',
      headers: { authorization: `Bearer ${superAdminToken}` }
    });
    console.log(`Case 4F (Super Admin Weekly Impersonation): Code = ${res4F.statusCode} (Expected 200)`);
    const metrics4F = JSON.parse(res4F.body);
    console.log('Impersonated Weekly Metrics (TEST_TEN_002):', metrics4F);
    // Expectations: strictly Tenant 2: ORD_C (15000, count = 1), Audit C (10 donations)
    if (
      metrics4F.totalRevenue === 15000 &&
      metrics4F.totalOrders === 1 &&
      metrics4F.totalDonatedItems === 10
    ) {
      console.log('✅ SUCCESS: Super Admin Tenant Impersonation metrics filtering is perfectly accurate.');
    } else {
      throw new Error('FAIL: Super Admin tenant impersonation analytics mismatch.');
    }

    console.log('\n==================================================');
    console.log('     ALL PHASE 5 INTEGRATION TESTS PASSED!        ');
    console.log('==================================================');

  } finally {
    // Cleanup seeded records
    console.log('\nCleaning up verification records...');
    await User.deleteMany({ email: /^test_superadmin_p5@/ });
    await User.deleteMany({ mobile_number: { $in: ['+919999999999', '+917777777777', '+918888888888'] } });
    await Tenant.deleteMany({ tenant_id: { $in: ['TEST_TEN_001', 'TEST_TEN_002'] } });
    await Machine.deleteMany({ machine_id: /^TEST_M_/ });
    await Report.deleteMany({ report_id: /^TEST_REP_/ });
    await Order.deleteMany({ order_id: /^TEST_ORD_/ });
    await InventoryAudit.deleteMany({ machine_id: /^TEST_M_/ });

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
