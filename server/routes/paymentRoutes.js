const axios = require('axios');
const config = require('../config');
const Order = require('../models/Order');
const paymentUtils = require('../utils/payment');

async function paymentRoutes(fastify, options) {

    // POST /api/v1/payment/initiate
    fastify.post('/initiate', async (request, reply) => {
        const { order_id } = request.body;

        if (!order_id) {
            return reply.code(400).send({ success: false, error: "Missing order_id" });
        }

        try {
            // 1. Verify the order exists and hasn't expired (TTL)
            const order = await Order.findOne({ order_id: order_id, status: 'PENDING_PAYMENT' });

            if (!order) {
                return reply.code(404).send({
                    success: false,
                    error: "Order not found or expired. Please try again."
                });
            }

            // 2. Construct PhonePe Payload (Dynamic URLs from config)
            const endpoint = "/pg/v1/pay";
            const payload = {
                merchantId: config.phonepe.merchantId,
                merchantTransactionId: order_id,
                merchantUserId: "USER_GUEST",
                amount: order.amount, // Using actual amount from Order model
                redirectUrl: `${config.app_base_url}/api/v1/payment/callback`, 
                redirectMode: "POST",
                callbackUrl: `${config.app_base_url}/api/v1/payment/webhook`, 
                paymentInstrument: {
                    type: "PAY_PAGE"
                }
            };

            // 3. Generate Cryptographic Signature via Utility
            const { base64Payload, checksum } = paymentUtils.generateChecksum(
                payload, 
                endpoint, 
                config.phonepe.saltKey, 
                config.phonepe.saltIndex
            );

            // 4. Send request to PhonePe
            const response = await axios.post(
                `${config.phonepe.baseUrl}${endpoint}`,
                { request: base64Payload },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-VERIFY': checksum,
                        'accept': 'application/json'
                    }
                }
            );

            // 5. Return the redirect URL to the frontend
            if (response.data.success) {
                return reply.code(200).send({
                    success: true,
                    redirectUrl: response.data.data.instrumentResponse.redirectInfo.url
                });
            } else {
                return reply.code(400).send({
                    success: false,
                    error: "PhonePe initiation failed",
                    details: response.data
                });
            }

        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                error: "Payment API Error",
                message: error.response?.data || error.message
            });
        }
    });

    // Webhook and Callback routes should be implemented here or in a separate file
    // They must also follow the Zero-Hardcoding policy.
}

module.exports = paymentRoutes;