const mongoose = require('mongoose');
const config = require('./src/utils/config');
const User = require('./src/models/user');
const Machine = require('./src/models/machine');
const fastify = require('./src/server');

async function runVerifier() {
  console.log("==================================================");
  console.log("      SMART VENDING MACHINE EDIT ROUTE VERIFIER   ");
  console.log("==================================================");

  // Initialize DB connection
  console.log(`Connecting to MongoDB at: ${config.MONGO_URI}...`);
  await mongoose.connect(config.MONGO_URI);
  console.log("MongoDB Connected successfully!");

  // Clean up any stale records
  await Machine.deleteMany({ machine_id: { $in: ['V990', 'V991', 'V992'] } });
  await User.deleteMany({ email: 'test_superadmin_edit_machine@vending.com' });

  try {
    // Wait for Fastify to fully load
    await fastify.ready();

    // Seed test data
    console.log("Seeding test data...");
    const superAdmin = await User.create({
      tenant_id: 'TEN_PLATFORM_ROOT',
      email: 'test_superadmin_edit_machine@vending.com',
      password: 'SuperAdminPassword123',
      role: 'SUPER_ADMIN'
    });

    const m1 = await Machine.create({
      machine_id: 'V990',
      tenant_id: 'TEN_PLATFORM_ROOT',
      device_api_key: 'testkey1',
      grid_config: { rows: 6, columns: 8, max_depth: 7 },
      slots: [],
      assignment_status: 'UNASSIGNED',
      location: 'Initial Lobby'
    });

    const m2 = await Machine.create({
      machine_id: 'V991',
      tenant_id: 'TEN_PLATFORM_ROOT',
      device_api_key: 'testkey2',
      grid_config: { rows: 6, columns: 8, max_depth: 7 },
      slots: [],
      assignment_status: 'UNASSIGNED',
      location: 'Second Lobby'
    });

    console.log("Logging in as Super Admin to acquire token...");
    const loginResSuper = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'test_superadmin_edit_machine@vending.com', password: 'SuperAdminPassword123' }
    });
    const superAdminToken = JSON.parse(loginResSuper.body).token;
    console.log("Super Admin authenticated successfully!");

    // Step 1: Edit machine location, layout sizes
    console.log("\nStep 1: Editing machine location and dimensions...");
    const editRes1 = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/machine/edit',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        id: m1._id.toString(),
        location: "updated main lounge lobby",
        rows: 10,
        columns: 12,
        max_depth: 15
      }
    });

    console.log("Response Status:", editRes1.statusCode);
    console.log("Response Body:", editRes1.body);
    const updatedM1 = JSON.parse(editRes1.body).machine;
    console.log("Updated Location:", updatedM1.location);
    console.log("Updated Layout:", `${updatedM1.grid_config.rows}x${updatedM1.grid_config.columns}x${updatedM1.grid_config.max_depth}`);

    if (updatedM1.location !== "Updated Main Lounge Lobby" ||
        updatedM1.grid_config.rows !== 10 ||
        updatedM1.grid_config.columns !== 12 ||
        updatedM1.grid_config.max_depth !== 15) {
      throw new Error("Machine properties did not update or format correctly!");
    }
    console.log("✓ Location and layout edits verified successfully!");

    // Step 2: Edit machine ID
    console.log("\nStep 2: Editing machine ID (V990 -> V992)...");
    const editRes2 = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/machine/edit',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        id: m1._id.toString(),
        machine_id: "V992"
      }
    });

    console.log("Response Status:", editRes2.statusCode);
    const updatedIdM1 = JSON.parse(editRes2.body).machine;
    console.log("New Machine ID:", updatedIdM1.machine_id);

    if (updatedIdM1.machine_id !== "V992") {
      throw new Error("Machine ID did not update to V992!");
    }
    console.log("✓ Machine ID edit verified successfully!");

    // Step 3: Enforce format mask validation check
    console.log("\nStep 3: Verifying invalid format mask rejection (e.g. 'invalidid' or 'vabc')...");
    const editRes3 = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/machine/edit',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        id: m1._id.toString(),
        machine_id: "invalidid"
      }
    });

    console.log("Response Status:", editRes3.statusCode);
    console.log("Response Body:", editRes3.body);
    if (editRes3.statusCode !== 400) {
      throw new Error(`Expected 400 Bad Request but got ${editRes3.statusCode}`);
    }
    console.log("✓ Invalid format mask successfully rejected!");

    // Step 4: Enforce duplicate ID conflict check
    console.log("\nStep 4: Verifying duplicate ID collision check (changing V992 to V991)...");
    const editRes4 = await fastify.inject({
      method: 'POST',
      url: '/api/v1/admin/machine/edit',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        id: m1._id.toString(),
        machine_id: "V991"
      }
    });

    console.log("Response Status:", editRes4.statusCode);
    console.log("Response Body:", editRes4.body);
    if (editRes4.statusCode !== 409) {
      throw new Error(`Expected 409 Conflict but got ${editRes4.statusCode}`);
    }
    console.log("✓ Duplicate ID successfully rejected!");

    console.log("\n==================================================");
    console.log("  ALL MACHINE EDIT ROUTE TESTS PASSED SUCCESSFULLY!  ");
    console.log("==================================================");

  } finally {
    // Clean up
    console.log("Cleaning up verification records...");
    await Machine.deleteMany({ machine_id: { $in: ['V990', 'V991', 'V992'] } });
    await User.deleteMany({ email: 'test_superadmin_edit_machine@vending.com' });

    console.log("Closing Fastify and DB connection...");
    await fastify.close();
    await mongoose.connection.close();
    console.log("Mongoose connections closed cleanly.");
  }
}

runVerifier().catch(err => {
  console.error("\n❌ VERIFICATION TEST FAILURE:");
  console.error(err);
  fastify.close();
  mongoose.connection.close();
  process.exit(1);
});
