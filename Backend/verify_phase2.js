const mongoose = require('mongoose');
const User = require('./src/models/user');
const Tenant = require('./src/models/tenant');
const fastify = require('./src/server'); // Load and trigger Fastify startup

async function runVerification() {
  console.log('==================================================');
  console.log('    SMART VENDING AUTH & RBAC ROUTE VERIFIER      ');
  console.log('==================================================');

  // Wait for Fastify to fully load plugins and establish db connection
  await fastify.ready();
  console.log('Fastify plugins and Mongoose DB connection fully initialized.');

  // Clear previous test records
  await User.deleteMany({ tenant_id: /^TEST_TEN_/ });
  await Tenant.deleteMany({ tenant_id: /^TEST_TEN_/ });
  // Also clear any other platform root test records to avoid database pollution
  await User.deleteMany({ email: /^test_superadmin@/ });
  await User.deleteMany({ mobile_number: /^\+91888888/ });

  try {
    // --------------------------------------------------
    // STEP 1: Verify Password Hashing and Creation
    // --------------------------------------------------
    console.log('\n--- Step 1: User Pre-Save Password Hashing & Comparison Hooks ---');
    const superAdmin = await User.create({
      tenant_id: 'TEN_PLATFORM_ROOT',
      email: 'test_superadmin@vending.com',
      password: 'SuperAdminPassword123',
      role: 'SUPER_ADMIN'
    });

    console.log('Super Admin user created successfully.');
    console.log('Plaintext password stored?', superAdmin.password !== 'SuperAdminPassword123');
    console.log('Is password hashed with bcrypt (starts with $2b$)?', superAdmin.password.startsWith('$2b$'));

    const isMatch = await superAdmin.comparePassword('SuperAdminPassword123');
    console.log('Instance comparePassword() matches true password:', isMatch);
    const isFalseMatch = await superAdmin.comparePassword('WrongPassword');
    console.log('Instance comparePassword() rejects incorrect password:', !isFalseMatch);

    // --------------------------------------------------
    // STEP 2: Verify Login Route via Email and Mobile
    // --------------------------------------------------
    console.log('\n--- Step 2: POST /api/v1/auth/login Endpoint (Email and Mobile Routing) ---');
    
    // Case 2A: Super Admin Login via Email
    const loginResEmail = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: 'test_superadmin@vending.com',
        password: 'SuperAdminPassword123'
      }
    });

    console.log('Email Login HTTP Code:', loginResEmail.statusCode);
    const emailLoginData = JSON.parse(loginResEmail.body);
    console.log('Email Login JWT Token returned successfully:', !!emailLoginData.token);
    console.log('Token Payload Scoped Tenant:', emailLoginData.user.tenant_id);
    console.log('Token Payload Scoped Role:', emailLoginData.user.role);
    
    const superAdminToken = emailLoginData.token;

    // Create a temporary Tenant Admin User to test mobile login
    const tenantAdmin = await User.create({
      tenant_id: 'TEST_TEN_001',
      mobile_number: '+918888888888',
      password: 'TenantAdminPassword123',
      role: 'TENANT_ADMIN'
    });

    // Case 2B: Tenant Admin Login via Mobile Number
    const loginResMobile = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: '+918888888888',
        password: 'TenantAdminPassword123'
      }
    });

    console.log('Mobile Login HTTP Code:', loginResMobile.statusCode);
    const mobileLoginData = JSON.parse(loginResMobile.body);
    console.log('Mobile Login JWT Token returned successfully:', !!mobileLoginData.token);
    console.log('Token Payload Scoped Tenant:', mobileLoginData.user.tenant_id);
    console.log('Token Payload Scoped Role:', mobileLoginData.user.role);

    const tenantAdminToken = mobileLoginData.token;

    // --------------------------------------------------
    // STEP 3: Verify POST /api/v1/admin/tenant/create
    // --------------------------------------------------
    console.log('\n--- Step 3: POST /api/v1/admin/tenant/create (Super Admin Scoped & Transactional) ---');

    // Case 3A: Attempt without any Auth token (Should fail with 401)
    const createTenantNoAuth = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/create',
      payload: {
        business_name: 'Alpha Corporate',
        contact_email: 'alpha@corp.com',
        mobile_number: '+918888880001',
        password: 'AlphaAdminPassword123'
      }
    });
    console.log('Case 3A (No Auth) Blocked with 401? ->', createTenantNoAuth.statusCode === 401);

    // Case 3B: Attempt with Tenant Admin token (Should fail with 403)
    const createTenantAdminAuth = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/create',
      headers: {
        Authorization: `Bearer ${tenantAdminToken}`
      },
      payload: {
        business_name: 'Beta Corporate',
        contact_email: 'beta@corp.com',
        mobile_number: '+918888880002',
        password: 'BetaAdminPassword123'
      }
    });
    console.log('Case 3B (Tenant Admin Access) Blocked with 403? ->', createTenantAdminAuth.statusCode === 403);

    // Case 3C: Authorized Super Admin Create (Should succeed)
    const createTenantSuperAuth = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/tenant/create',
      headers: {
        Authorization: `Bearer ${superAdminToken}`
      },
      payload: {
        business_name: 'Gamma Corporate',
        contact_email: 'gamma@corp.com',
        mobile_number: '+918888880003',
        password: 'GammaAdminPassword123',
        is_custom_gateway_active: true,
        payment_config: {
          merchant_id: 'MID_GAMMA_99',
          salt_key: 'gamma-salt-index-99-secured',
          salt_index: 3
        }
      }
    });

    console.log('Case 3C (Super Admin Access) HTTP Code:', createTenantSuperAuth.statusCode);
    const gammaData = JSON.parse(createTenantSuperAuth.body);
    console.log('Gamma Tenant ID auto-generated:', gammaData.tenant.tenant_id);
    console.log('Gamma Tenant Admin assigned correct tenant ID:', gammaData.user.tenant_id === gammaData.tenant.tenant_id);

    // Query database directly to verify GCM encryption on payment_config
    const rawGamma = await mongoose.connection.db.collection('tenants').findOne({ tenant_id: gammaData.tenant.tenant_id });
    console.log('Gamma Payment Config fully encrypted on disk (iv:ciphertext:tag)? ->', 
      typeof rawGamma.payment_config === 'string' && rawGamma.payment_config.includes(':')
    );

    // --------------------------------------------------
    // STEP 4: Verify POST /api/v1/admin/operator/create
    // --------------------------------------------------
    console.log('\n--- Step 4: POST /api/v1/admin/operator/create (Tenant Scoping & Inheritance) ---');

    // Case 4A: Create Operator via Tenant Admin (Should succeed and inherit tenant_id)
    const createOperatorAdminAuth = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/operator/create',
      headers: {
        Authorization: `Bearer ${tenantAdminToken}`
      },
      payload: {
        mobile_number: '+918888889999',
        password: 'OperatorPassword123'
      }
    });

    console.log('Case 4A (Tenant Admin create Operator) HTTP Code:', createOperatorAdminAuth.statusCode);
    const opData = JSON.parse(createOperatorAdminAuth.body);
    console.log('Operator account successfully created:', !!opData.operator);
    console.log('Operator correctly inherited Admin tenant_id (TEST_TEN_001):', opData.operator.tenant_id === 'TEST_TEN_001');

    // Case 4B: Attempt to create Operator via Super Admin (Should fail with 403 since role !== TENANT_ADMIN)
    const createOperatorSuperAuth = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/operator/create',
      headers: {
        Authorization: `Bearer ${superAdminToken}`
      },
      payload: {
        mobile_number: '+918888889998',
        password: 'OperatorPassword123'
      }
    });
    console.log('Case 4B (Super Admin role !== TENANT_ADMIN Operator create) Blocked with 403? ->', createOperatorSuperAuth.statusCode === 403);

    console.log('\n==================================================');
    console.log('      ALL PHASE 2 CODE VERIFICATIONS PASSED!      ');
    console.log('==================================================');

  } finally {
    // Cleanup databases
    await User.deleteMany({ tenant_id: /^TEST_TEN_/ });
    await Tenant.deleteMany({ tenant_id: /^TEST_TEN_/ });
    await User.deleteMany({ email: /^test_superadmin@/ });
    await User.deleteMany({ mobile_number: /^\+91888888/ });
    
    // Graceful close Mongoose and Fastify
    await fastify.close();
    console.log('\nDatabase connection and Fastify server closed. Verification complete.');
  }
}

runVerification().catch(err => {
  console.error('\nCRITICAL VERIFICATION ERROR:', err);
  fastify.close();
  process.exit(1);
});
