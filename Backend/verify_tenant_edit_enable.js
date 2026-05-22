const mongoose = require('mongoose');

const config = require('./src/utils/config');
const User = require('./src/models/user');
const Tenant = require('./src/models/tenant');
const Machine = require('./src/models/machine');
const fastify = require('./src/server');

async function runVerification() {
  console.log('==================================================');
  console.log('      SMART VENDING TENANT EDIT/ENABLE VERIFIER  ');
  console.log('==================================================');

  // 1. Establish MongoDB Connection
  console.log(`Connecting to MongoDB at: ${config.MONGO_URI}...`);
  await mongoose.connect(config.MONGO_URI);
  console.log('MongoDB Connected successfully!');

  // Clear previous test records to ensure clean environment
  await User.deleteMany({ email: /^test_superadmin_edit@/ });
  await User.deleteMany({ mobile_number: { $in: ['+919999999888', '+919999999777', '+919999999666'] } });
  await Tenant.deleteMany({ tenant_id: { $in: ['TEST_TEN_EDIT_01', 'TEST_TEN_EDIT_02'] } });
  await Machine.deleteMany({ machine_id: /^TEST_M_EDIT_/ });

  try {
    // Wait for Fastify to fully load plugins and establish connections
    await fastify.ready();

    // Seeding Super Admin and Unassigned Machine
    console.log('\nSeeding base test data...');
    const superAdmin = await User.create({
      tenant_id: 'TEN_PLATFORM_ROOT',
      email: 'test_superadmin_edit@vending.com',
      password: 'SuperAdminPassword123',
      role: 'SUPER_ADMIN'
    });

    const unassignedMachine = await Machine.create({
      tenant_id: 'TEN_PLATFORM_ROOT',
      machine_id: 'TEST_M_EDIT_01',
      device_api_key: 'test_device_key_edit_1',
      grid_config: { rows: 2, columns: 3, max_depth: 7 },
      slots: [],
      assignment_status: 'UNASSIGNED'
    });

    const unassignedMachine2 = await Machine.create({
      tenant_id: 'TEN_PLATFORM_ROOT',
      machine_id: 'TEST_M_EDIT_02',
      device_api_key: 'test_device_key_edit_2',
      grid_config: { rows: 2, columns: 3, max_depth: 7 },
      slots: [],
      assignment_status: 'UNASSIGNED'
    });

    console.log('Seeding completed. Logging in as Super Admin...');

    // Login as Super Admin
    const loginResSuper = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'test_superadmin_edit@vending.com', password: 'SuperAdminPassword123' }
    });
    const superAdminToken = JSON.parse(loginResSuper.body).token;
    console.log('Logged in successfully, token acquired.');

    // 2. Create Tenant with Machine Assignment
    console.log('\nStep 1: Creating a tenant with optional machine assignment...');
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/create',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        business_name: 'Test Edit Tenant',
        contact_email: 'test_edit@vending.com',
        mobile_number: '+919999999888',
        password: 'Password123',
        assigned_machine_id: 'TEST_M_EDIT_01'
      }
    });

    console.log(`Response Status: ${createRes.statusCode}`);
    console.log(`Response Body: ${createRes.body}`);
    const createdBody = JSON.parse(createRes.body);
    const createdTenantId = createdBody.tenant.tenant_id;

    // Verify machine assignment
    const machineAfterCreate = await Machine.findOne({ machine_id: 'TEST_M_EDIT_01' });
    console.log(`Assigned Machine status: ${machineAfterCreate.assignment_status}, tenant_id: ${machineAfterCreate.tenant_id}`);
    if (machineAfterCreate.assignment_status !== 'ACTIVE' || machineAfterCreate.tenant_id !== createdTenantId) {
      throw new Error('Machine 1 was not assigned during tenant creation!');
    }
    console.log('✓ Machine successfully assigned during tenant creation!');

    // 3. Edit Tenant properties (Name, Email, Mobile, Password, and new Machines)
    console.log('\nStep 2: Editing tenant properties and syncing machine assignments...');
    const editRes = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/edit',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        tenant_id: createdTenantId,
        business_name: 'Updated Edit Tenant',
        contact_email: 'updated_edit@vending.com',
        mobile_number: '+919999999777',
        password: 'NewPassword123',
        assigned_machines: ['TEST_M_EDIT_02'] // Omit TEST_M_EDIT_01, add TEST_M_EDIT_02
      }
    });

    console.log(`Response Status: ${editRes.statusCode}`);
    console.log(`Response Body: ${editRes.body}`);

    // Verify Tenant updates in DB
    const tenantInDb = await Tenant.findOne({ tenant_id: createdTenantId });
    console.log(`Updated Tenant Business Name: ${tenantInDb.business_name}`);
    console.log(`Updated Tenant Email: ${tenantInDb.contact_email}`);
    console.log(`Updated Tenant Password: ${tenantInDb.password}`);
    if (tenantInDb.business_name !== 'Updated Edit Tenant' || tenantInDb.contact_email !== 'updated_edit@vending.com' || tenantInDb.password !== 'NewPassword123') {
      throw new Error('Tenant properties were not updated correctly in database!');
    }

    // Verify Tenant Admin User updates in DB
    const userInDb = await User.findOne({ tenant_id: createdTenantId, role: 'TENANT_ADMIN' });
    console.log(`Updated User Mobile Number: ${userInDb.mobile_number}`);
    if (userInDb.mobile_number !== '+919999999777') {
      throw new Error('Tenant Admin user mobile number was not updated correctly in database!');
    }

    const correctPassword = await userInDb.comparePassword('NewPassword123');
    console.log(`Updated User Password Verification: ${correctPassword}`);
    if (!correctPassword) {
      throw new Error('Tenant Admin user password was not updated/hashed correctly!');
    }

    // Verify Machine 1 has been unassigned cascadingly
    const machine1AfterEdit = await Machine.findOne({ machine_id: 'TEST_M_EDIT_01' });
    console.log(`Machine 1 after edit status: ${machine1AfterEdit.assignment_status}, tenant_id: ${machine1AfterEdit.tenant_id}`);
    if (machine1AfterEdit.assignment_status !== 'UNASSIGNED' || machine1AfterEdit.tenant_id !== 'TEN_PLATFORM_ROOT') {
      throw new Error('Machine 1 was not successfully unassigned during edit sync!');
    }
    console.log('✓ Machine 1 successfully unassigned during edit sync!');

    // Verify Machine 2 assignment
    const machine2AfterEdit = await Machine.findOne({ machine_id: 'TEST_M_EDIT_02' });
    console.log(`Assigned Machine 2 status: ${machine2AfterEdit.assignment_status}, tenant_id: ${machine2AfterEdit.tenant_id}`);
    if (machine2AfterEdit.assignment_status !== 'ACTIVE' || machine2AfterEdit.tenant_id !== createdTenantId) {
      throw new Error('Machine 2 was not assigned during tenant editing!');
    }
    console.log('✓ Tenant details, unassignment of old machine, and assignment of new machine succeeded during edit!');

    // 4. Test Mobile Number Duplicate Conflict Check
    console.log('\nStep 3: Creating a second tenant to test mobile duplicate check during edit...');
    const createRes2 = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/create',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        business_name: 'Test Tenant 2',
        contact_email: 't2@vending.com',
        mobile_number: '+919999999666',
        password: 'Password123'
      }
    });
    const createdTenantId2 = JSON.parse(createRes2.body).tenant.tenant_id;

    console.log('Trying to edit Tenant 2 to use Tenant 1\'s mobile number (+919999999777)...');
    const conflictRes = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/edit',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        tenant_id: createdTenantId2,
        business_name: 'Test Tenant 2',
        contact_email: 't2@vending.com',
        mobile_number: '+919999999777',
        password: 'Password123'
      }
    });
    console.log(`Response Status: ${conflictRes.statusCode}`);
    console.log(`Response Body: ${conflictRes.body}`);
    if (conflictRes.statusCode !== 409) {
      throw new Error('Expected 409 Conflict status when assigning duplicate mobile number!');
    }
    console.log('✓ Duplicate mobile number check rejected edit correctly!');

    // 5. Test Disable Tenant
    console.log('\nStep 4: Disabling tenant...');
    const disableRes = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/disable',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { tenant_id: createdTenantId }
    });
    console.log(`Response Status: ${disableRes.statusCode}`);
    
    const disabledTenant = await Tenant.findOne({ tenant_id: createdTenantId });
    console.log(`Disabled Tenant Status: ${disabledTenant.status}`);
    if (disabledTenant.status !== 'DISABLED') {
      throw new Error('Tenant was not disabled successfully!');
    }
    console.log('✓ Tenant successfully disabled!');

    // 6. Test Enable Tenant
    console.log('\nStep 5: Enabling tenant again using new /admin/tenant/enable route...');
    const enableRes = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/enable',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { tenant_id: createdTenantId }
    });
    console.log(`Response Status: ${enableRes.statusCode}`);
    console.log(`Response Body: ${enableRes.body}`);

    const enabledTenant = await Tenant.findOne({ tenant_id: createdTenantId });
    console.log(`Enabled Tenant Status: ${enabledTenant.status}`);
    if (enabledTenant.status !== 'ACTIVE') {
      throw new Error('Tenant was not enabled successfully!');
    }
    console.log('✓ Tenant successfully enabled!');

    console.log('\n==================================================');
    console.log('  ALL INTEGRATION VERIFICATION TESTS PASSED SUCCESSFULLY! ');
    console.log('==================================================');

  } catch (error) {
    console.error('\nVerification failed with error:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\nCleaning up verification records...');
    await User.deleteMany({ email: /^test_superadmin_edit@/ });
    await User.deleteMany({ mobile_number: { $in: ['+919999999888', '+919999999777', '+919999999666'] } });
    await Tenant.deleteMany({ tenant_id: { $in: ['TEST_TEN_EDIT_01', 'TEST_TEN_EDIT_02'] } });
    await Machine.deleteMany({ machine_id: /^TEST_M_EDIT_/ });
    
    await mongoose.disconnect();
    fastify.close();
    console.log('Connections closed. Verification script complete.');
  }
}

runVerification();
