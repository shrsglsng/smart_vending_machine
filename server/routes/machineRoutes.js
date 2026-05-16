const Order = require('../models/Order');
const mqttService = require('../services/mqttService');

async function machineRoutes(fastify, options) {
  fastify.post('/dispense', async (request, reply) => {
    const { orderId, otp } = request.body;

    // 1. Mock OTP Validation
    if (otp !== '1234') {
      return reply.code(400).send({ error: 'Invalid OTP', message: 'The provided OTP is incorrect.' });
    }

    try {
      // 2. Find Order (Must be PAID_UNCLAIMED)
      const order = await Order.findOne({ 
        order_id: orderId, 
        status: 'PAID_UNCLAIMED' 
      });

      if (!order) {
        return reply.code(404).send({ 
          error: 'Order Not Found', 
          message: 'No unclaimed paid order found for this ID.' 
        });
      }

      // 3. Update Status to DISPENSING
      order.status = 'DISPENSING';
      await order.save();

      // 4. Construct Payload and Topic
      const topic = `vending/machine_${order.machine_id}/commands`;
      const payload = {
        action: 'DISPENSE',
        rack: order.rack_number,
        orderId: order.order_id
      };

      // 5. Publish to MQTT
      mqttService.publishMessage(topic, payload);

      return { 
        status: 'SUCCESS', 
        message: 'Dispense command sent to hardware.',
        orderId: order.order_id,
        machineId: order.machine_id,
        rack: order.rack_number
      };

    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = machineRoutes;
