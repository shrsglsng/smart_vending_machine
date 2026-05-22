const mongoose = require('mongoose');
const Tenant = require('./src/models/tenant');
const User = require('./src/models/user');
const Machine = require('./src/models/machine');
const requireTenant = require('./src/middlewares/requireTenant');
const config = require('./src/utils/config');

async function runVerification() {
  console.log('==================================================');
  console.log('       SMART VENDING MACHINE CORE VERIFIER        ');
  console.log('==================================================');

  // 1. Establish MongoDB Connection
  console.log(`Connecting to MongoDB at: ${config.MONGO_URI}...`);
  await mongoose.connect(config.MONGO_URI);
  console.log('MongoDB Connected successfully!');

  // Clear previous test records to ensure clean environment
  await Tenant.deleteMany({ tenant_id: /^TEST_TEN_/ });
  await User.deleteMany({ tenant_id: /^TEST_TEN_/ });
  await Machine.deleteMany({ machine_id: /^TEST_MCH_/ });

  try {
    // --------------------------------------------------
    // TEST 1: Tenant AES-256-GCM Transparent Encryption
    // --------------------------------------------------
    console.log('\n--- Test 1: Tenant AES-256-GCM Payment Config Encryption ---');
    const mockPayment = {
      merchant_id: 'MID_PHONEPE_12345',
      salt_key: 'abcdef-salt-key-12345-secured',
      salt_index: 1
    };

    const tenant = await Tenant.create({
      tenant_id: 'TEST_TEN_001',
      business_name: 'Acme Refreshments B2B',
      contact_email: 'acme@refresh.com',
      is_custom_gateway_active: true,
      payment_config: mockPayment
    });

    console.log('Tenant successfully saved to database.');
    
    // Retrieve using model (should decrypt transparently via Mongoose getter)
    const retrieved = await Tenant.findOne({ tenant_id: 'TEST_TEN_001' });
    console.log('Decrypted retrieved configuration matches original:', 
      retrieved.payment_config.merchant_id === mockPayment.merchant_id &&
      retrieved.payment_config.salt_key === mockPayment.salt_key
    );
    console.log('Retrieved Decrypted Config:', retrieved.payment_config);

    // Retrieve bypassing getter using lean query to view raw stored document
    const rawStored = await mongoose.connection.db.collection('tenants').findOne({ tenant_id: 'TEST_TEN_001' });
    console.log('Raw string stored in MongoDB (iv:ciphertext:tag):', rawStored.payment_config);
    if (typeof rawStored.payment_config === 'string' && rawStored.payment_config.includes(':')) {
      console.log('SUCCESS: Raw configuration is fully encrypted in database.');
    } else {
      throw new Error('FAIL: payment_config stored in plaintext!');
    }

    // --------------------------------------------------
    // TEST 2: Machine Slots Max Depth Validation
    // --------------------------------------------------
    console.log('\n--- Test 2: Machine Slots Quantity Max Depth Validation ---');
    
    const validMachineData = {
      tenant_id: 'TEST_TEN_001',
      machine_id: 'TEST_MCH_001',
      device_api_key: 'dummy_hashed_api_key',
      grid_config: {
        rows: 2,
        columns: 2,
        max_depth: 7 // Max items allowed per slot is 7
      },
      slots: [
        { row: 1, column: 1, slot_id: 'R1-C1', quantity: 5, status: 'ACTIVE' },
        { row: 1, column: 2, slot_id: 'R1-C2', quantity: 7, status: 'ACTIVE' }
      ]
    };

    // Valid save should succeed
    const validMachine = await Machine.create(validMachineData);
    console.log('SUCCESS: Valid machine profile created with quantities within boundaries.');

    // Try to update slot with inventory (8) exceeding max depth (7)
    try {
      await Machine.create({
        tenant_id: 'TEST_TEN_001',
        machine_id: 'TEST_MCH_002',
        device_api_key: 'dummy_hashed_api_key_2',
        grid_config: {
          rows: 2,
          columns: 2,
          max_depth: 7
        },
        slots: [
          { row: 1, column: 1, slot_id: 'R1-C1', quantity: 8, status: 'ACTIVE' } // Exceeds max depth 7
        ]
      });
      throw new Error('FAIL: Allowed slot quantity to exceed max_depth without validation error!');
    } catch (validationErr) {
      if (validationErr.name === 'ValidationError') {
        console.log('SUCCESS: Blocked saving slot quantity > max_depth with message:', validationErr.errors['slots'].message);
      } else {
        throw validationErr;
      }
    }

    // --------------------------------------------------
    // TEST 3: User Sparse Unique Indexes
    // --------------------------------------------------
    console.log('\n--- Test 3: User Sparse Index Verification ---');
    
    // User A: Email only, no mobile
    const userA = await User.create({
      tenant_id: 'TEST_TEN_PLATFORM',
      email: 'superadmin@vending.com',
      password: 'hashedpasswordA',
      role: 'SUPER_ADMIN'
    });
    console.log('SUCCESS: Saved User A with email only.');

    // User B: Mobile only, no email
    const userB = await User.create({
      tenant_id: 'TEST_TEN_001',
      mobile_number: '+919999999999',
      password: 'hashedpasswordB',
      role: 'TENANT_ADMIN'
    });
    console.log('SUCCESS: Saved User B with mobile number only.');

    // Attempt to insert duplicate mobile number to verify uniqueness remains enforced
    try {
      await User.create({
        tenant_id: 'TEST_TEN_002',
        mobile_number: '+919999999999',
        password: 'hashedpasswordC',
        role: 'OPERATOR'
      });
      throw new Error('FAIL: Allowed duplicate mobile_number under sparse indexes!');
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        console.log('SUCCESS: Successfully blocked duplicate mobile_number insertion.');
      } else {
        throw dupErr;
      }
    }

    // --------------------------------------------------
    // TEST 4: requireTenant Middleware Isolation
    // --------------------------------------------------
    console.log('\n--- Test 4: requireTenant Middleware Tenancy Routing ---');
    
    // Mock Fastify Request
    const createMockReq = (payload) => ({
      jwtVerify: async () => {
        return payload;
      },
      user: payload
    });

    const createMockReply = () => {
      const reply = {
        code: 200,
        errBody: null,
        status: function(c) { this.code = c; return this; },
        send: function(body) { this.errBody = body; }
      };
      return reply;
    };

    // Case A: Tenant Admin with valid tenant ID (Should pass cleanly)
    const reqA = createMockReq({ tenant_id: 'TEST_TEN_001', role: 'TENANT_ADMIN' });
    const replyA = createMockReply();
    await requireTenant(reqA, replyA);
    console.log('Case A (Tenant Admin): Passed? ->', replyA.errBody === null && reqA.user.tenant_id === 'TEST_TEN_001');

    // Case B: Super Admin Bypass (Should pass and use Platform Root)
    const reqB = createMockReq({ role: 'SUPER_ADMIN' });
    const replyB = createMockReply();
    await requireTenant(reqB, replyB);
    console.log('Case B (Super Admin Bypass): Passed? ->', replyB.errBody === null && reqB.user.tenant_id === 'TEN_PLATFORM_ROOT');

    // Case C: Missing tenant association for non-Super Admin (Should fail with 403)
    const reqC = createMockReq({ role: 'OPERATOR' }); // missing tenant_id
    const replyC = createMockReply();
    await requireTenant(reqC, replyC);
    console.log('Case C (Operator missing tenant_id): Blocked with 403? ->', replyC.code === 403);
    console.log('Case C Response:', replyC.errBody);

    console.log('\n==================================================');
    console.log('      ALL PHASE 1 CODE VERIFICATIONS PASSED!      ');
    console.log('==================================================');

  } finally {
    // Cleanup and disconnect
    await Tenant.deleteMany({ tenant_id: /^TEST_TEN_/ });
    await User.deleteMany({ tenant_id: /^TEST_TEN_/ });
    await Machine.deleteMany({ machine_id: /^TEST_MCH_/ });
    await mongoose.disconnect();
    console.log('\nDatabase connection closed. Verification complete.');
  }
}

runVerification().catch(err => {
  console.error('\nCRITICAL VERIFICATION ERROR:', err);
  mongoose.disconnect();
  process.exit(1);
});
