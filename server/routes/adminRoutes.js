const Machine = require('../models/Machine');
const Report = require('../models/Report');
const Order = require('../models/Order');
const User = require('../models/User');
const mqttService = require('../services/mqttService');
const paymentUtils = require('../utils/payment');
const axios = require('axios');
const bcrypt = require('bcrypt');
const config = require('../config');
const { verifyToken, requireAdmin } = require('../middleware/auth');

async function adminRoutes(fastify, options) {
  // Apply auth middleware to all routes in this plugin
  fastify.addHook('preHandler', verifyToken);
  fastify.addHook('preHandler', requireAdmin);

  // 1. Lock Rack
  fastify.post('/rack/lock', async (request, reply) => {
    const { machineId, rackNumber } = request.body;

    try {
      const machine = await Machine.findOne({ machine_id: machineId });
      if (!machine) return reply.code(404).send({ error: 'Machine not found' });

      const rack = machine.racks.find(r => r.rack_number === rackNumber);
      if (!rack) return reply.code(404).send({ error: 'Rack not found' });

      rack.status = 'INOPERATIONAL';
      await machine.save();

      const topic = `vending/machine_${machineId}/commands`;
      mqttService.publishMessage(topic, { action: 'LOCK_RACK', rack: rackNumber });

      return { status: 'SUCCESS', message: `Rack ${rackNumber} locked.` };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 2. Secure Refund (V3 Implementation)
  fastify.post('/refund', async (request, reply) => {
    const { reportId, transactionPin } = request.body;
    const adminId = request.user.userId;

    try {
      // 2.1 Verify Transaction PIN
      const admin = await User.findById(adminId);
      if (!admin || !admin.transactionPin) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Admin PIN not configured.' });
      }

      const isMatch = await bcrypt.compare(transactionPin, admin.transactionPin);
      if (!isMatch) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid PIN.' });
      }

      // 2.2 Find Report and Order
      const report = await Report.findOne({ report_id: reportId });
      if (!report) return reply.code(404).send({ error: 'Report not found' });
      if (report.status === 'RESOLVED_REFUNDED') return reply.code(400).send({ error: 'Already refunded' });

      const order = await Order.findOne({ order_id: report.order_id });
      if (!order) return reply.code(404).send({ error: 'Order not found' });

      // 2.3 Construct V3 Refund Payload
      const endpoint = "/v3/credit/backToSource";
      const refundPayload = {
        merchantId: config.phonepe.merchantId,
        merchantTransactionId: `REF_${Date.now()}`,
        merchantOrderId: order.order_id,
        originalTransactionId: order.order_id,
        amount: order.amount, // Using actual order amount
        callbackUrl: `${config.app_base_url}/api/v1/payment/webhook`,
        message: "Refund initiated via Admin Dashboard"
      };

      const { base64Payload, checksum } = paymentUtils.generateChecksum(
        refundPayload, 
        endpoint, 
        config.phonepe.saltKey, 
        config.phonepe.saltIndex
      );

      // 2.4 Trigger PhonePe V3 Refund API
      const response = await axios.post(
        `${config.phonepe.baseUrl}${endpoint}`,
        { request: base64Payload },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-CALLBACK-URL': refundPayload.callbackUrl,
            'accept': 'application/json'
          }
        }
      );

      if (response.data.success) {
        // 2.5 Update DB Statuses
        report.status = 'RESOLVED_REFUNDED';
        await report.save();

        order.status = 'REFUNDED';
        await order.save();

        return { 
          status: 'SUCCESS', 
          message: 'Refund initiated successfully.',
          data: response.data 
        };
      } else {
        return reply.code(400).send({ 
          error: 'Refund Failed', 
          message: response.data.message || 'PhonePe rejected the refund.' 
        });
      }

    } catch (err) {
      fastify.log.error('Refund Error:', err.response?.data || err.message);
      return reply.code(500).send({ 
        error: 'Internal Server Error', 
        message: err.response?.data?.message || 'Failed to communicate with PhonePe.' 
      });
    }
  });

  // 3. Check Payment/Refund Status API
  fastify.get('/transaction/:txnId/status', async (request, reply) => {
    const { txnId } = request.params;
    const mId = config.phonepe.merchantId;
    const endpoint = `/v3/transaction/${mId}/${txnId}/status`;

    try {
      const checksum = paymentUtils.generateStatusChecksum(
        endpoint,
        config.phonepe.saltKey,
        config.phonepe.saltIndex
      );

      const response = await axios.get(
        `${config.phonepe.baseUrl}${endpoint}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': mId,
            'accept': 'application/json'
          }
        }
      );

      return response.data;
    } catch (err) {
      fastify.log.error('Status Check Error:', err.response?.data || err.message);
      return reply.code(500).send({ error: 'Failed to fetch status' });
    }
  });
}

module.exports = adminRoutes;