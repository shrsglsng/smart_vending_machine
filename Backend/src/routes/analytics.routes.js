const Order = require('../models/order');
const InventoryAudit = require('../models/inventoryAudit');
const requireTenant = require('../middlewares/requireTenant');

async function analyticsRoutes(fastify, options) {
  // GET /api/v1/admin/analytics
  fastify.get('/admin/analytics', {
    preHandler: [requireTenant]
  }, async (request, reply) => {
    try {
      const { role, tenant_id } = request.user;

      // Restrict access strictly to administrative roles
      if (role !== 'SUPER_ADMIN' && role !== 'TENANT_ADMIN') {
        reply.status(403).send({
          error: 'Forbidden',
          message: 'Access denied: Analytics are restricted to administrative accounts.'
        });
        return;
      }

      // 1. Extract and validate range
      const { range = 'daily' } = request.query;
      if (!['daily', 'weekly', 'monthly'].includes(range)) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Invalid range parameter. Must be one of: daily, weekly, monthly.'
        });
        return;
      }

      // 2. Calculate dynamic startDate
      const now = new Date();
      let startDate;
      if (range === 'daily') {
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (range === 'weekly') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (range === 'monthly') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // 3. Build base contextual match filter
      const baseMatch = {
        createdAt: { $gte: startDate }
      };

      if (role === 'TENANT_ADMIN') {
        baseMatch.tenant_id = tenant_id;
      } else if (role === 'SUPER_ADMIN') {
        const { tenant_id: queryTenantId } = request.query;
        if (queryTenantId) {
          baseMatch.tenant_id = queryTenantId;
        }
      }

      // 4. Aggregation 1: Revenue & Orders
      const orderMatch = {
        ...baseMatch,
        status: { $in: ['COMPLETED', 'PARTIALLY_DISPENSED'] }
      };

      const orderAgg = await Order.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total_amount' },
            totalOrders: { $sum: 1 }
          }
        }
      ]);

      const { totalRevenue = 0, totalOrders = 0 } = orderAgg[0] || {};

      // 5. Aggregation 2: Shift Clearout Donations
      const auditMatch = {
        ...baseMatch,
        action_type: 'SHIFT_CLEAROUT_DONATION'
      };

      const auditAgg = await InventoryAudit.aggregate([
        { $match: auditMatch },
        {
          $group: {
            _id: null,
            totalDonations: { $sum: '$quantity_changed' }
          }
        }
      ]);

      const totalDonatedItems = auditAgg[0] ? Math.abs(auditAgg[0].totalDonations) : 0;

      // 6. Return consolidated JSON response
      reply.status(200).send({
        range,
        startDate: startDate.toISOString(),
        totalRevenue,
        totalOrders,
        totalDonatedItems
      });

    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to aggregate time-scoped analytics.'
      });
    }
  });
}

module.exports = analyticsRoutes;
