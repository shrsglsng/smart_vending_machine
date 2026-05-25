const mongoose = require('mongoose');
const Tenant = require('../models/tenant');
const User = require('../models/user');
const Machine = require('../models/machine');
const RestockJob = require('../models/restockJob');
const requireTenant = require('../middlewares/requireTenant');
const requireSuperAdmin = require('../middlewares/requireSuperAdmin');

async function adminRoutes(fastify, options) {
  // 1. Create Tenant (Super Admin Only)
  // POST /api/v1/admin/tenant/create
  fastify.post('/admin/tenant/create', {
    preHandler: [requireTenant, requireSuperAdmin]
  }, async (request, reply) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        business_name,
        contact_email,
        mobile_number,
        password,
        is_custom_gateway_active,
        payment_config,
        assigned_machine_id,
        is_internal
      } = request.body || {};

      // Inputs validation
      const isInternalTenant = !!is_internal;
      if (isInternalTenant) {
        if (!business_name || !contact_email) {
          reply.status(400).send({
            error: 'BadRequest',
            message: 'Missing required fields: business_name and contact_email are required.'
          });
          await session.abortTransaction();
          session.endSession();
          return;
        }
      } else {
        if (!business_name || !contact_email || !mobile_number || !password) {
          reply.status(400).send({
            error: 'BadRequest',
            message: 'Missing required fields: business_name, contact_email, mobile_number, and password are required.'
          });
          await session.abortTransaction();
          session.endSession();
          return;
        }
      }

      const tenant_id = isInternalTenant ? 'Super_admin' : `TEN_${Date.now()}`;

      // Prevent duplicate internal tenant
      if (isInternalTenant) {
        const existingInternal = await Tenant.findOne({ tenant_id: 'Super_admin' }).session(session);
        if (existingInternal) {
          reply.status(409).send({
            error: 'Conflict',
            message: 'Internal Operations tenant (Super_admin) already exists.'
          });
          await session.abortTransaction();
          session.endSession();
          return;
        }
      }

      // Enforce duplicate check before creating (only if mobile_number is provided)
      if (mobile_number) {
        const existingUser = await User.findOne({ mobile_number }).session(session);
        if (existingUser) {
          reply.status(409).send({
            error: 'Conflict',
            message: 'A user with this mobile number already exists.'
          });
          await session.abortTransaction();
          session.endSession();
          return;
        }
      }

      // Auto-generate strong secure password behind the scenes if internal
      const final_password = isInternalTenant 
        ? require('crypto').randomBytes(16).toString('hex') 
        : password;

      // Create Tenant document
      const [tenant] = await Tenant.create([{
        tenant_id,
        business_name,
        contact_email,
        password: final_password,
        is_custom_gateway_active: !!is_custom_gateway_active,
        payment_config: payment_config || null
      }], { session });

      // Create Tenant Admin User document (hashed via pre-save hooks automatically)
      const userPayload = {
        tenant_id,
        password: final_password,
        role: 'TENANT_ADMIN'
      };
      if (mobile_number) {
        userPayload.mobile_number = mobile_number;
      }
      const [tenantAdmin] = await User.create([userPayload], { session });

      // Handle optional machine assignment if provided
      if (assigned_machine_id && assigned_machine_id.trim() !== '') {
        const machine = await Machine.findOne({ machine_id: assigned_machine_id.trim() }).session(session);
        if (machine) {
          machine.tenant_id = tenant_id;
          machine.assignment_status = 'ACTIVE';
          await machine.save({ session });
        }
      }

      await session.commitTransaction();
      session.endSession();

      reply.status(201).send({
        message: 'Tenant and Tenant Admin successfully created.',
        tenant: {
          id: tenant._id,
          tenant_id: tenant.tenant_id,
          business_name: tenant.business_name,
          contact_email: tenant.contact_email
        },
        user: {
          id: tenantAdmin._id,
          mobile_number: tenantAdmin.mobile_number,
          role: tenantAdmin.role,
          tenant_id: tenantAdmin.tenant_id
        }
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: error.message || 'Failed to create Tenant and Tenant Admin atomically.'
      });
    }
  });

  // 2. Create Operator (Tenant Admin Only)
  // POST /api/v1/admin/operator/create
  fastify.post('/admin/operator/create', {
    preHandler: [requireTenant]
  }, async (request, reply) => {
    try {
      const { mobile_number, password } = request.body || {};

      // Verify that the user attempting to create the operator is a Tenant Admin
      if (request.user.role !== 'TENANT_ADMIN') {
        reply.status(403).send({
          error: 'Forbidden',
          message: 'Access denied: Only Tenant Admins can create Operator accounts.'
        });
        return;
      }

      if (!mobile_number || !password) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Missing required mobile_number or password fields.'
        });
        return;
      }

      // Enforce duplicate check
      const existingUser = await User.findOne({ mobile_number });
      if (existingUser) {
        reply.status(409).send({
          error: 'Conflict',
          message: 'A user with this mobile number already exists.'
        });
        return;
      }

      // Create Operator (linked to Tenant Admin's tenant_id)
      const operator = await User.create({
        tenant_id: request.user.tenant_id, // Hardcoded to inherit the Tenant Admin's tenant_id
        mobile_number,
        password,
        role: 'OPERATOR'
      });

      reply.status(201).send({
        message: 'Operator account successfully created.',
        operator: {
          id: operator._id,
          mobile_number: operator.mobile_number,
          role: operator.role,
          tenant_id: operator.tenant_id
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to create Operator account.'
      });
    }
  });

  // 3. Unassign Machine (Super Admin Only)
  // POST /api/v1/admin/machine/unassign
  fastify.post('/admin/machine/unassign', {
    preHandler: [requireTenant, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const { machine_id } = request.body || {};
      if (!machine_id) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Missing required field: machine_id is required.'
        });
        return;
      }

      const machine = await Machine.findOne({ machine_id });
      if (!machine) {
        reply.status(404).send({
          error: 'NotFound',
          message: `Machine with ID ${machine_id} not found.`
        });
        return;
      }

      machine.tenant_id = 'TEN_PLATFORM_ROOT';
      machine.assignment_status = 'UNASSIGNED';
      await machine.save();

      reply.status(200).send({
        message: 'Machine successfully unassigned.',
        machine
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to unassign machine.'
      });
    }
  });

  // 3.5. Delete Machine (Super Admin Only)
  // POST /api/v1/admin/machine/delete
  fastify.post('/admin/machine/delete', {
    preHandler: [requireTenant, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const { machine_id } = request.body || {};
      if (!machine_id) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Missing required field: machine_id is required.'
        });
        return;
      }

      const machine = await Machine.findOne({ machine_id });
      if (!machine) {
        reply.status(404).send({
          error: 'NotFound',
          message: `Machine with ID ${machine_id} not found.`
        });
        return;
      }

      // Safety Guard: Only unassigned machines can be deleted
      if (machine.assignment_status !== 'UNASSIGNED' || machine.tenant_id !== 'TEN_PLATFORM_ROOT') {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Safety Restriction: Only unassigned machines currently sitting in the warehouse fleet can be deleted. Please unassign the machine first.'
        });
        return;
      }

      await Machine.deleteOne({ machine_id });

      reply.status(200).send({
        message: `Machine ${machine_id} successfully deleted from the database fleet.`
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to delete machine.'
      });
    }
  });

  // 4. Get Tenants (Super Admin Only)
  // GET /api/v1/admin/tenants
  fastify.get('/admin/tenants', {
    preHandler: [requireTenant, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const tenantsList = await Tenant.find({}).sort({ createdAt: -1 });
      
      const enrichedTenants = await Promise.all(
        tenantsList.map(async (tenant) => {
          const adminUser = await User.findOne({ tenant_id: tenant.tenant_id, role: 'TENANT_ADMIN' });
          const machines = await Machine.find({ tenant_id: tenant.tenant_id });
          
          return {
            id: tenant._id,
            tenant_id: tenant.tenant_id,
            business_name: tenant.business_name,
            contact_email: tenant.contact_email,
            mobile_number: adminUser ? adminUser.mobile_number : 'N/A',
            assigned_machine: machines.length > 0 ? machines.map(m => m.machine_id).join(', ') : 'N/A',
            status: tenant.status || 'ACTIVE',
            password: tenant.password || 'N/A'
          };
        })
      );
      
      reply.status(200).send(enrichedTenants);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to retrieve tenants list.'
      });
    }
  });

  // 5. Disable Tenant (Super Admin Only)
  // POST /api/v1/admin/tenant/disable
  fastify.post('/admin/tenant/disable', {
    preHandler: [requireTenant, requireSuperAdmin]
  }, async (request, reply) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { tenant_id } = request.body || {};
      if (!tenant_id) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Missing required field: tenant_id is required.'
        });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      if (tenant_id === 'Super_admin') {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Built-in Super Admin internal operations tenant cannot be disabled.'
        });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      const tenant = await Tenant.findOne({ tenant_id }).session(session);
      if (!tenant) {
        reply.status(404).send({
          error: 'NotFound',
          message: `Tenant with ID ${tenant_id} not found.`
        });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      tenant.status = 'DISABLED';
      await tenant.save({ session });

      // Cascading Action: Update all associated machines
      await Machine.updateMany(
        { tenant_id },
        { assignment_status: 'UNASSIGNED', tenant_id: 'TEN_PLATFORM_ROOT' },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      reply.status(200).send({
        message: 'Tenant successfully disabled and associated machines unassigned.',
        tenant: {
          id: tenant._id,
          tenant_id: tenant.tenant_id,
          business_name: tenant.business_name,
          contact_email: tenant.contact_email,
          status: tenant.status
        }
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: error.message || 'Failed to disable tenant.'
      });
    }
  });

  // 5b. Edit Tenant (Super Admin Only)
  // POST /api/v1/admin/tenant/edit
  fastify.post('/admin/tenant/edit', {
    preHandler: [requireTenant, requireSuperAdmin]
  }, async (request, reply) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        tenant_id,
        business_name,
        contact_email,
        mobile_number,
        password,
        assigned_machine_id,
        assigned_machines
      } = request.body || {};

      if (tenant_id === 'Super_admin') {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Built-in Super Admin internal operations tenant cannot be modified.'
        });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      if (!tenant_id || !business_name || !contact_email || !mobile_number) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Missing required fields: tenant_id, business_name, contact_email, and mobile_number are required.'
        });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      // Enforce duplicate check for mobile number (excluding this tenant's admin user)
      const existingUser = await User.findOne({ 
        mobile_number, 
        tenant_id: { $ne: tenant_id } 
      }).session(session);
      
      if (existingUser) {
        reply.status(409).send({
          error: 'Conflict',
          message: 'A user with this mobile number already exists.'
        });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      const tenant = await Tenant.findOne({ tenant_id }).session(session);
      if (!tenant) {
        reply.status(404).send({
          error: 'NotFound',
          message: `Tenant with ID ${tenant_id} not found.`
        });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      // Update Tenant
      tenant.business_name = business_name;
      tenant.contact_email = contact_email;
      if (password) {
        tenant.password = password;
      }
      await tenant.save({ session });

      // Update Tenant Admin User
      const adminUser = await User.findOne({ tenant_id, role: 'TENANT_ADMIN' }).session(session);
      if (adminUser) {
        adminUser.mobile_number = mobile_number;
        if (password) {
          adminUser.password = password;
        }
        await adminUser.save({ session });
      }

      // Sync machine assignments if assigned_machines list is provided in request
      if (assigned_machines && Array.isArray(assigned_machines)) {
        const targetMachineIds = assigned_machines.map(id => id.trim().toUpperCase()).filter(Boolean);
        const currentlyAssigned = await Machine.find({ tenant_id }).session(session);
        const currentMachineIds = currentlyAssigned.map(m => m.machine_id);

        // Unassign machines that are omitted from the target list
        for (const machine of currentlyAssigned) {
          if (!targetMachineIds.includes(machine.machine_id)) {
            machine.tenant_id = 'TEN_PLATFORM_ROOT';
            machine.assignment_status = 'UNASSIGNED';
            await machine.save({ session });
          }
        }

        // Assign new machines included in the target list
        for (const mId of targetMachineIds) {
          if (!currentMachineIds.includes(mId)) {
            const machine = await Machine.findOne({ machine_id: mId }).session(session);
            if (machine) {
              machine.tenant_id = tenant_id;
              machine.assignment_status = 'ACTIVE';
              await machine.save({ session });
            }
          }
        }
      } else if (assigned_machine_id && assigned_machine_id.trim() !== '') {
        // Fallback for single machine assignment
        const machine = await Machine.findOne({ machine_id: assigned_machine_id.trim() }).session(session);
        if (machine) {
          machine.tenant_id = tenant_id;
          machine.assignment_status = 'ACTIVE';
          await machine.save({ session });
        }
      }

      await session.commitTransaction();
      session.endSession();

      reply.status(200).send({
        message: 'Tenant successfully updated.',
        tenant: {
          id: tenant._id,
          tenant_id: tenant.tenant_id,
          business_name: tenant.business_name,
          contact_email: tenant.contact_email
        }
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: error.message || 'Failed to update Tenant.'
      });
    }
  });

  // 5c. Enable Tenant (Super Admin Only)
  // POST /api/v1/admin/tenant/enable
  fastify.post('/admin/tenant/enable', {
    preHandler: [requireTenant, requireSuperAdmin]
  }, async (request, reply) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { tenant_id } = request.body || {};
      if (!tenant_id) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Missing required field: tenant_id is required.'
        });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      const tenant = await Tenant.findOne({ tenant_id }).session(session);
      if (!tenant) {
        reply.status(404).send({
          error: 'NotFound',
          message: `Tenant with ID ${tenant_id} not found.`
        });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      tenant.status = 'ACTIVE';
      await tenant.save({ session });

      await session.commitTransaction();
      session.endSession();

      reply.status(200).send({
        message: 'Tenant successfully enabled.',
        tenant: {
          id: tenant._id,
          tenant_id: tenant.tenant_id,
          business_name: tenant.business_name,
          contact_email: tenant.contact_email,
          status: tenant.status
        }
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: error.message || 'Failed to enable tenant.'
      });
    }
  });

  // 6. Get Available Machines (Super Admin Only)
  // GET /api/v1/admin/machines/available
  fastify.get('/admin/machines/available', {
    preHandler: [requireTenant, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const machines = await Machine.find({ assignment_status: 'UNASSIGNED' }, 'machine_id');
      const machineIds = machines.map(m => m.machine_id);
      reply.status(200).send(machineIds);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to retrieve available machines.'
      });
    }
  });

  // 7. Get All Machines (Super Admin Only)
  // GET /api/v1/admin/machines
  fastify.get('/admin/machines', {
    preHandler: [requireTenant, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const machinesList = await Machine.find({}).sort({ createdAt: -1 });
      
      const enrichedMachines = await Promise.all(
        machinesList.map(async (machine) => {
          let tenantName = 'Platform Root';
          if (machine.tenant_id && machine.tenant_id !== 'TEN_PLATFORM_ROOT') {
            const tenant = await Tenant.findOne({ tenant_id: machine.tenant_id });
            if (tenant) {
              tenantName = tenant.business_name;
            }
          }
          return {
            id: machine._id,
            machine_id: machine.machine_id,
            tenant_id: machine.tenant_id,
            tenant_name: tenantName,
            device_api_key: machine.device_api_key,
            grid_config: machine.grid_config,
            slots: machine.slots,
            location: machine.location || 'N/A',
            assignment_status: machine.assignment_status,
            createdAt: machine.createdAt
          };
        })
      );
      
      reply.status(200).send(enrichedMachines);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to retrieve machines list.'
      });
    }
  });

  // 8. Create Machine (Super Admin Only)
  // POST /api/v1/admin/machine/create
  fastify.post('/admin/machine/create', {
    preHandler: [requireTenant, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      let { machine_id, tenant_id, location, rows, columns, max_depth } = request.body || {};
      
      if (!machine_id) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Missing required field: machine_id is required.'
        });
        return;
      }
      
      machine_id = machine_id.trim().toUpperCase();
      
      // Validation: Machine ID must start with "V" followed strictly by digits
      if (!/^V\d+$/.test(machine_id)) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Machine ID must start with "V" followed strictly by numbers (e.g., V05).'
        });
        return;
      }
      
      // Enforce duplicate check
      const existingMachine = await Machine.findOne({ machine_id });
      if (existingMachine) {
        reply.status(409).send({
          error: 'Conflict',
          message: `A machine with ID ${machine_id} already exists.`
        });
        return;
      }
      
      // Verify tenant if assigned
      let finalTenantId = 'TEN_PLATFORM_ROOT';
      let assignmentStatus = 'UNASSIGNED';
      
      if (tenant_id && tenant_id.trim() !== '' && tenant_id !== 'TEN_PLATFORM_ROOT') {
        const tenant = await Tenant.findOne({ tenant_id: tenant_id.trim() });
        if (!tenant) {
          reply.status(404).send({
            error: 'NotFound',
            message: `Tenant with ID ${tenant_id} not found.`
          });
          return;
        }
        if (tenant.status === 'DISABLED') {
          reply.status(400).send({
            error: 'BadRequest',
            message: `Cannot assign machine to a disabled tenant.`
          });
          return;
        }
        finalTenantId = tenant.tenant_id;
        assignmentStatus = 'ACTIVE';
      }
      
      // Auto-capitalize location
      let formattedLocation = '';
      if (location && typeof location === 'string') {
        formattedLocation = location
            .trim()
            .split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
      }
      
      // Validate grid dimensions if provided
      let parsedRows = 6;
      let parsedColumns = 8;
      let parsedMaxDepth = 7;
      
      if (rows !== undefined && rows !== '') {
        const val = Number(rows);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          reply.status(400).send({
            error: 'BadRequest',
            message: 'Rows must be a positive integer.'
          });
          return;
        }
        parsedRows = val;
      }
      
      if (columns !== undefined && columns !== '') {
        const val = Number(columns);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          reply.status(400).send({
            error: 'BadRequest',
            message: 'Columns must be a positive integer.'
          });
          return;
        }
        parsedColumns = val;
      }
      
      if (max_depth !== undefined && max_depth !== '') {
        const val = Number(max_depth);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          reply.status(400).send({
            error: 'BadRequest',
            message: 'Max depth must be a positive integer.'
          });
          return;
        }
        parsedMaxDepth = val;
      }
      
      const crypto = require('crypto');
      const device_api_key = crypto.randomBytes(16).toString('hex');
      
      const machine = await Machine.create({
        machine_id,
        tenant_id: finalTenantId,
        device_api_key,
        grid_config: { rows: parsedRows, columns: parsedColumns, max_depth: parsedMaxDepth },
        slots: [],
        assignment_status: assignmentStatus,
        location: formattedLocation
      });
      
      reply.status(201).send({
        message: 'Machine successfully created.',
        machine
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to create machine.'
      });
    }
  });

  // 9. Edit Machine (Super Admin Only)
  // POST /api/v1/admin/machine/edit
  fastify.post('/admin/machine/edit', {
    preHandler: [requireTenant, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const { id, machine_id, location, rows, columns, max_depth, tenant_id } = request.body || {};
      
      if (!id) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Missing required field: id (machine primary key) is required.'
        });
        return;
      }
      
      const machine = await Machine.findById(id);
      if (!machine) {
        reply.status(404).send({
          error: 'NotFound',
          message: `Machine not found.`
        });
        return;
      }
      
      if (machine_id) {
        const cleanedId = machine_id.trim().toUpperCase();
        // Validation: Machine ID must start with "V" followed strictly by digits
        if (!/^V\d+$/.test(cleanedId)) {
          reply.status(400).send({
            error: 'BadRequest',
            message: 'Machine ID must start with "V" followed strictly by numbers (e.g., V05).'
          });
          return;
        }
        
        // Enforce duplicate check if machine_id is changing
        if (cleanedId !== machine.machine_id) {
          const existingMachine = await Machine.findOne({ machine_id: cleanedId });
          if (existingMachine) {
            reply.status(409).send({
              error: 'Conflict',
              message: `A machine with ID ${cleanedId} already exists.`
            });
            return;
          }
          machine.machine_id = cleanedId;
        }
      }
      
      if (location !== undefined) {
        let formattedLocation = '';
        if (location && typeof location === 'string') {
          formattedLocation = location
              .trim()
              .split(/\s+/)
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
        }
        machine.location = formattedLocation;
      }
      
      // Update grid layout config if rows/columns/max_depth are provided
      let parsedRows = machine.grid_config?.rows || 6;
      let parsedColumns = machine.grid_config?.columns || 8;
      let parsedMaxDepth = machine.grid_config?.max_depth || 7;
      
      if (rows !== undefined && rows !== '') {
        const val = Number(rows);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          reply.status(400).send({
            error: 'BadRequest',
            message: 'Rows must be a positive integer.'
          });
          return;
        }
        parsedRows = val;
      }
      
      if (columns !== undefined && columns !== '') {
        const val = Number(columns);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          reply.status(400).send({
            error: 'BadRequest',
            message: 'Columns must be a positive integer.'
          });
          return;
        }
        parsedColumns = val;
      }
      
      if (max_depth !== undefined && max_depth !== '') {
        const val = Number(max_depth);
        if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
          reply.status(400).send({
            error: 'BadRequest',
            message: 'Max depth must be a positive integer.'
          });
          return;
        }
        parsedMaxDepth = val;
      }
      
      if (tenant_id !== undefined && tenant_id !== '') {
        const tenant = await Tenant.findOne({ tenant_id });
        if (!tenant) {
          reply.status(404).send({
            error: 'NotFound',
            message: `Tenant with ID ${tenant_id} not found.`
          });
          return;
        }
        if (tenant.status === 'DISABLED') {
          reply.status(400).send({
            error: 'BadRequest',
            message: `Cannot assign machine to a disabled tenant.`
          });
          return;
        }
        machine.tenant_id = tenant.tenant_id;
        machine.assignment_status = 'ACTIVE';
      }

      machine.grid_config = {
        rows: parsedRows,
        columns: parsedColumns,
        max_depth: parsedMaxDepth
      };
      
      await machine.save();
      
      reply.status(200).send({
        message: 'Machine successfully updated.',
        machine
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: error.message || 'Failed to update machine.'
      });
    }
  });

  // 10. Get Operators (Tenant Admin Only)
  // GET /api/v1/admin/operators
  fastify.get('/admin/operators', {
    preHandler: [requireTenant]
  }, async (request, reply) => {
    try {
      let tenant_id = request.user.tenant_id;
      if (request.user.role === 'SUPER_ADMIN' && request.query.tenant_id) {
        tenant_id = request.query.tenant_id;
      }
      const operators = await User.find({ tenant_id, role: 'OPERATOR' }, 'mobile_number role createdAt');
      reply.status(200).send(operators);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to retrieve operator accounts.'
      });
    }
  });

  // 11. Get Machine Slot Configuration
  // GET /api/v1/admin/machine/slots/:machineId
  fastify.get('/admin/machine/slots/:machineId', {
    preHandler: [requireTenant]
  }, async (request, reply) => {
    try {
      const { machineId } = request.params;
      const tenant_id = request.user.tenant_id;

      const machine = await Machine.findOne({ machine_id: machineId });
      if (!machine) {
        reply.status(404).send({
          error: 'NotFound',
          message: `Machine ${machineId} not found.`
        });
        return;
      }

      if (request.user.role !== 'SUPER_ADMIN' && machine.tenant_id !== tenant_id) {
        reply.status(403).send({
          error: 'Forbidden',
          message: 'Access denied: Machine is assigned to another tenant context.'
        });
        return;
      }

      reply.status(200).send({
        machine_id: machine.machine_id,
        tenant_id: machine.tenant_id,
        grid_config: machine.grid_config,
        slots: machine.slots || []
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to retrieve machine slot configurations.'
      });
    }
  });

  // 12. Create Restock Job
  // POST /api/v1/admin/machine/restock-job
  fastify.post('/admin/machine/restock-job', {
    preHandler: [requireTenant]
  }, async (request, reply) => {
    try {
      const { machine_id, operator_id, shift_type, clearout_required, slot_assignments } = request.body || {};
      const tenant_id = request.user.tenant_id;

      if (!machine_id || !operator_id || !shift_type || !slot_assignments || !Array.isArray(slot_assignments)) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Missing required fields: machine_id, operator_id, shift_type, and slot_assignments (array) are required.'
        });
        return;
      }

      // 1. Verify Machine
      const machine = await Machine.findOne({ machine_id });
      if (!machine) {
        reply.status(404).send({
          error: 'NotFound',
          message: `Machine ${machine_id} not found.`
        });
        return;
      }

      if (request.user.role !== 'SUPER_ADMIN' && machine.tenant_id !== tenant_id) {
        reply.status(403).send({
          error: 'Forbidden',
          message: 'Access denied: Machine is assigned to another tenant context.'
        });
        return;
      }

      // 2. Verify Operator
      const operator = await User.findOne({ _id: operator_id, role: 'OPERATOR' });
      if (!operator) {
        reply.status(404).send({
          error: 'NotFound',
          message: 'Operator account not found or invalid role.'
        });
        return;
      }

      if (request.user.role !== 'SUPER_ADMIN' && operator.tenant_id !== tenant_id) {
        reply.status(403).send({
          error: 'Forbidden',
          message: 'Access denied: Operator is linked to another tenant.'
        });
        return;
      }

      // 3. Formulate clearout list
      const clearout_list = [];
      if (clearout_required !== false) {
        for (const slot of machine.slots) {
          if (slot.item_id && slot.quantity > 0) {
            clearout_list.push({
              slot_id: slot.slot_id,
              item_id: slot.item_id,
              expected_quantity: slot.quantity,
              actual_removed_quantity: null
            });
          }
        }
      }

      // 4. Formulate packing list
      const MasterCatalog = require('../models/masterCatalog');
      const packingMap = {};

      for (const assign of slot_assignments) {
        const { slot_id, item_id, target_quantity } = assign;
        if (!slot_id || !item_id || target_quantity === undefined) {
          reply.status(400).send({
            error: 'BadRequest',
            message: 'Invalid slot assignment details. Ensure slot_id, item_id, and target_quantity are set.'
          });
          return;
        }

        if (target_quantity > machine.grid_config.max_depth) {
          reply.status(400).send({
            error: 'BadRequest',
            message: `Target quantity for slot ${slot_id} (${target_quantity}) exceeds machine max depth capacity (${machine.grid_config.max_depth}).`
          });
          return;
        }

        if (target_quantity > 0) {
          if (!packingMap[item_id]) {
            packingMap[item_id] = 0;
          }
          packingMap[item_id] += Number(target_quantity);
        }
      }

      const packing_list = [];
      for (const itemId of Object.keys(packingMap)) {
        const catalogItem = await MasterCatalog.findOne({ item_id: itemId });
        packing_list.push({
          item_id: itemId,
          item_name: catalogItem ? catalogItem.item_name : 'Unknown Dish',
          total_quantity_needed: packingMap[itemId]
        });
      }

      const job_id = `JOB_${Date.now()}`;

      const job = await RestockJob.create({
        tenant_id: machine.tenant_id,
        job_id,
        machine_id,
        operator_id: operator._id,
        status: 'PENDING',
        shift_type,
        clearout_required: clearout_required !== false,
        clearout_list,
        packing_list,
        slot_assignments: slot_assignments.map(a => ({
          slot_id: a.slot_id,
          item_id: a.item_id,
          target_quantity: Number(a.target_quantity),
          actual_quantity_loaded: null
        }))
      });

      reply.status(201).send({
        message: 'Restock job successfully created and dispatched.',
        job
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: error.message || 'Failed to dispatch restock job.'
      });
    }
  });
}

module.exports = adminRoutes;
