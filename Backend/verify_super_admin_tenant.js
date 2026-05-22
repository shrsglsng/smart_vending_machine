const mongoose = require('mongoose');
const path = require('path');

const config = require('./src/utils/config');
const User = require('./src/models/user');
const Tenant = require('./src/models/tenant');
const Machine = require('./src/models/machine');
const fastify = require('./src/server');

async function runSuperAdminTests() {
  console.log('==================================================');
  console.log('    SUPER_ADMIN INTERNAL TENANT VERIFIER SUITE    ');
  console.log('==================================================');

  // Establish MongoDB connection
  console.log(`Connecting to MongoDB at: ${config.MONGO_URI}...`);
  await mongoose.connect(config.MONGO_URI);
  console.log('MongoDB Connected successfully!');

  // Clean existing test records
  console.log('Cleaning up previous test databases...');
  await Tenant.deleteMany({ tenant_id: 'Super_admin' });
  await User.deleteMany({ tenant_id: 'Super_admin' });
  await User.deleteMany({ email: 'test_superadmin_internal@vending.com' });

  try {
    await fastify.ready();

    // 1. Seed base Super Admin credentials
    console.log('\nSeeding base credentials...');
    const superAdmin = await User.create({
      tenant_id: 'TEN_PLATFORM_ROOT',
      email: 'test_superadmin_internal@vending.com',
      password: 'SuperAdminPassword123',
      role: 'SUPER_ADMIN'
    });

    // Login as Super Admin
    const loginRes = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'test_superadmin_internal@vending.com', password: 'SuperAdminPassword123' }
    });
    const superAdminToken = JSON.parse(loginRes.body).token;
    console.log('✓ Token acquired successfully.');

    // 2. Test creation of the internal operations tenant 'Super_admin'
    console.log('\n[TEST 1]: Registering Internal Operations Tenant (Super_admin) via API...');
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/create',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        business_name: 'AibotINK',
        contact_email: 'aibotink.web@gmail.com',
        is_internal: true
      }
    });

    console.log(`Response Status: ${createRes.statusCode}`);
    console.log(`Response Body: ${createRes.body}`);

    if (createRes.statusCode !== 201) {
      throw new Error(`Failed to create internal tenant. Expected status 201, got ${createRes.statusCode}`);
    }

    const createdTenant = await Tenant.findOne({ tenant_id: 'Super_admin' });
    const createdUser = await User.findOne({ tenant_id: 'Super_admin', role: 'TENANT_ADMIN' });

    if (!createdTenant) {
      throw new Error('Tenant record with tenant_id "Super_admin" was not created in Mongoose.');
    }
    if (!createdUser) {
      throw new Error('Tenant Admin user for "Super_admin" was not created in Mongoose.');
    }

    console.log('✓ Internal Operations Tenant and User correctly verified in MongoDB.');

    // 3. Test uniqueness constraint
    console.log('\n[TEST 2]: Attempting to create duplicate internal operations tenant...');
    const duplicateRes = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/create',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        business_name: 'AibotINK Duplicate',
        contact_email: 'aibotink.web@gmail.com',
        is_internal: true
      }
    });

    console.log(`Response Status: ${duplicateRes.statusCode}`);
    console.log(`Response Body: ${duplicateRes.body}`);

    if (duplicateRes.statusCode !== 409) {
      throw new Error(`Expected conflict status 409 for duplicate registration, got ${duplicateRes.statusCode}`);
    }
    console.log('✓ Duplicate creation successfully blocked with 409 Conflict!');

    // 4. Test mutation safeguards
    console.log('\n[TEST 3]: Attempting to disable Super_admin built-in tenant...');
    const disableRes = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/disable',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        tenant_id: 'Super_admin'
      }
    });

    console.log(`Response Status: ${disableRes.statusCode}`);
    console.log(`Response Body: ${disableRes.body}`);

    if (disableRes.statusCode !== 400) {
      throw new Error(`Expected BadRequest 400 when disabling Super_admin, got ${disableRes.statusCode}`);
    }
    console.log('✓ Disable operation successfully blocked with 400 BadRequest!');

    // 5. Test mutation safeguards
    console.log('\n[TEST 4]: Attempting to edit Super_admin built-in tenant...');
    const editRes = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/edit',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        tenant_id: 'Super_admin',
        business_name: 'Mutated AibotINK',
        contact_email: 'mutated@aibotink.com',
        mobile_number: '+9999999999'
      }
    });

    console.log(`Response Status: ${editRes.statusCode}`);
    console.log(`Response Body: ${editRes.body}`);

    if (editRes.statusCode !== 400) {
      throw new Error(`Expected BadRequest 400 when editing Super_admin, got ${editRes.statusCode}`);
    }
    console.log('✓ Edit operation successfully blocked with 400 BadRequest!');

    console.log('\n==================================================');
    console.log('     ALL SUPER_ADMIN SAFEGUARDS PASSED PERFECTLY  ');
    console.log('==================================================');

  } catch (error) {
    console.error('\n❌ Test execution failed with error:', error);
    process.exit(1);
  } finally {
    // Cleanup temporary test admin
    await User.deleteMany({ email: 'test_superadmin_internal@vending.com' });
    await mongoose.connection.close();
    console.log('\nDatabase connection cleanly closed.');
    process.exit(0);
  }
}

runSuperAdminTests();
