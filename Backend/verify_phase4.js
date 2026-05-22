const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const config = require('./src/utils/config');
const User = require('./src/models/user');
const Tenant = require('./src/models/tenant');
const MasterCatalog = require('./src/models/masterCatalog');
const fastify = require('./src/server');

async function runVerification() {
  console.log('==================================================');
  console.log('      SMART VENDING CATALOG & IMAGE VERIFIER      ');
  console.log('==================================================');

  // 1. Establish MongoDB Connection
  console.log(`Connecting to MongoDB at: ${config.MONGO_URI}...`);
  await mongoose.connect(config.MONGO_URI);
  console.log('MongoDB Connected successfully!');

  // Clear previous test records to ensure clean environment
  await MasterCatalog.deleteMany({ item_id: /^TEST_ITEM_/ });
  await User.deleteMany({ email: /^test_superadmin@/ });
  await User.deleteMany({ mobile_number: /^\+91888888/ });
  await Tenant.deleteMany({ tenant_id: /^TEST_TEN_/ });

  // Ensure catalog uploads directory exists
  const catalogDir = path.join(__dirname, 'public/uploads/catalog');
  console.log(`Checking catalog upload directory: ${catalogDir}...`);
  const dirExists = fs.existsSync(catalogDir);
  console.log(`- Catalog upload directory exists: ${dirExists}`);

  if (!dirExists) {
    throw new Error('FAIL: Catalog upload directory was not initialized.');
  }
  console.log('✅ SUCCESS: Catalog uploads directory bootstrapped on startup.');

  try {
    // Wait for Fastify to fully load plugins and establish connections
    await fastify.ready();

    // Seed testing credentials
    console.log('\nSeeding test users for JWT validation...');
    await User.create({
      tenant_id: 'TEN_PLATFORM_ROOT',
      email: 'test_superadmin@vending.com',
      password: 'SuperAdminPassword123',
      role: 'SUPER_ADMIN'
    });

    await User.create({
      tenant_id: 'TEST_TEN_001',
      mobile_number: '+918888888888',
      password: 'TenantAdminPassword123',
      role: 'TENANT_ADMIN'
    });

    // Obtain authentic Super Admin JWT via login
    const loginResSuper = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: 'test_superadmin@vending.com',
        password: 'SuperAdminPassword123'
      }
    });
    const superAdminToken = JSON.parse(loginResSuper.body).token;

    // Obtain authentic Tenant Admin JWT via login
    const loginResTenant = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: '+918888888888',
        password: 'TenantAdminPassword123'
      }
    });
    const tenantAdminToken = JSON.parse(loginResTenant.body).token;

    // Build raw multipart form buffer
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const contentDisposition = (name) => `Content-Disposition: form-data; name="${name}"`;
    const fileDisposition = (name, filename, type) => `Content-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${type}`;

    // 1x1 transparent PNG file buffer
    const mockPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const makeMultipartPayload = (itemId) => Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`${contentDisposition('item_id')}\r\n\r\n${itemId}\r\n`),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`${contentDisposition('item_name')}\r\n\r\nDeluxe Hazelnut Latte\r\n`),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`${contentDisposition('default_price_paise')}\r\n\r\n6500\r\n`),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`${fileDisposition('image', 'latte.png', 'image/png')}\r\n\r\n`),
      mockPngBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    // --------------------------------------------------
    // TEST 1: Role-Based Authorization Restrictions
    // --------------------------------------------------
    console.log('\n--- Test 1: Access Controls & Super Admin Restrictions ---');
    
    // Case 1A: Non-Super Admin role attempt (should return 403)
    const res1A = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'authorization': `Bearer ${tenantAdminToken}`
      },
      payload: makeMultipartPayload('TEST_ITEM_FORBIDDEN')
    });
    console.log(`Case 1A (Tenant Admin attempt): Code = ${res1A.statusCode} (Expected 403)`);
    if (res1A.statusCode === 403) {
      console.log('✅ SUCCESS: Safely rejected non-Super Admin catalog creation request.');
    } else {
      throw new Error(`FAIL: Non-Super Admin returned code ${res1A.statusCode} instead of 403.`);
    }

    // --------------------------------------------------
    // TEST 2: Successful Super Admin Upload & Sharp Processing
    // --------------------------------------------------
    console.log('\n--- Test 2: Super Admin Multipart Upload & Sharp Optimization ---');
    
    const testItemId = 'TEST_ITEM_LATTE';
    const res2 = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'authorization': `Bearer ${superAdminToken}`
      },
      payload: makeMultipartPayload(testItemId)
    });

    console.log(`Upload Response Status: ${res2.statusCode} (Expected 201)`);
    
    if (res2.statusCode !== 201) {
      throw new Error(`FAIL: Upload failed with status ${res2.statusCode}. Body: ${res2.body}`);
    }

    const createdRecord = JSON.parse(res2.body);
    console.log('Created Record from Server:', createdRecord);

    // Verify fields saved in DB matches inputs
    if (
      createdRecord.item_id === testItemId &&
      createdRecord.item_name === 'Deluxe Hazelnut Latte' &&
      createdRecord.default_price_paise === 6500 &&
      createdRecord.image_path.startsWith('/uploads/catalog/') &&
      createdRecord.image_path.endsWith('.webp')
    ) {
      console.log('✅ SUCCESS: Document saved accurately in the database catalog.');
    } else {
      throw new Error('FAIL: Created document fields are incorrect or missing WebP suffix.');
    }

    // Verify that file exists on disk
    const savedPathOnDisk = path.join(__dirname, 'public', createdRecord.image_path);
    console.log(`Checking file existence on disk: ${savedPathOnDisk}`);
    const fileExists = fs.existsSync(savedPathOnDisk);
    console.log(`- WebP file exists on filesystem: ${fileExists}`);
    if (!fileExists) {
      throw new Error('FAIL: Sharp did not write optimized file to disk.');
    }
    console.log('✅ SUCCESS: Sharp successfully resized, compressed, and wrote optimized WebP image.');

    // --------------------------------------------------
    // TEST 3: Static Serving Resolution
    // --------------------------------------------------
    console.log('\n--- Test 3: Static Serving Verification ---');
    console.log(`Requesting static file via HTTP: ${createdRecord.image_path}`);
    const res3 = await fastify.inject({
      method: 'GET',
      url: createdRecord.image_path
    });

    console.log(`Static Serv code: ${res3.statusCode} (Expected 200)`);
    if (res3.statusCode === 200) {
      console.log('✅ SUCCESS: Statically serving optimized WebP images cleanly via /uploads/catalog/.');
    } else {
      throw new Error(`FAIL: Static serving returned status code ${res3.statusCode}`);
    }

    // --------------------------------------------------
    // TEST 4: Duplicate Catalog Item Prevention
    // --------------------------------------------------
    console.log('\n--- Test 4: Duplicate Catalog ID Protection ---');
    const res4 = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'authorization': `Bearer ${superAdminToken}`
      },
      payload: makeMultipartPayload(testItemId) // duplicate ID
    });

    console.log(`Duplicate insertion status: ${res4.statusCode} (Expected 409)`);
    if (res4.statusCode === 409) {
      console.log('✅ SUCCESS: Duplicate item_id prevention active.');
    } else {
      throw new Error(`FAIL: Duplicate code returned ${res4.statusCode} instead of 409.`);
    }

    console.log('\n==================================================');
    console.log('     ALL CATALOG VERIFICATIONS PASSED!             ');
    console.log('==================================================');

  } finally {
    // Cleanup Mongoose records and delete test images on disk
    const mockRecord = await MasterCatalog.findOne({ item_id: 'TEST_ITEM_LATTE' });
    if (mockRecord && mockRecord.image_path) {
      const diskPath = path.join(__dirname, 'public', mockRecord.image_path);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
        console.log(`Cleaned up test WebP file: ${diskPath}`);
      }
    }

    await MasterCatalog.deleteMany({ item_id: /^TEST_ITEM_/ });
    await User.deleteMany({ email: /^test_superadmin@/ });
    await User.deleteMany({ mobile_number: /^\+91888888/ });
    await Tenant.deleteMany({ tenant_id: /^TEST_TEN_/ });
    
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
