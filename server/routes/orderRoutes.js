const Machine = require('../models/Machine');
const Order = require('../models/Order');
const config = require('../config');

async function orderRoutes(fastify, options) {

    // POST /api/order/create
    fastify.post('/create', async (request, reply) => {
        const { machine_id, rack_number } = request.body;

        try {
            // 1. Atomically check inventory and deduct 1 in a single database operation
            const updatedMachine = await Machine.findOneAndUpdate(
                {
                    machine_id: machine_id,
                    "racks": {
                        $elemMatch: {
                            rack_number: rack_number,
                            status: "ACTIVE",
                            quantity: { $gt: 0 } // Must have at least 1 item
                        }
                    }
                },
                {
                    $inc: { "racks.$.quantity": -1 } // Deduct 1 from this specific rack
                },
                { new: true } // Return the updated document
            );

            // If updatedMachine is null, it means the rack was empty, jammed, or didn't exist
            if (!updatedMachine) {
                return reply.code(400).send({
                    success: false,
                    error: "Item Unavailable",
                    message: "The requested item is out of stock or currently unavailable."
                });
            }

            // 2. Create the Order Document (TTL index will auto-delete this if unpaid)
            const order_id = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

            const newOrder = await Order.create({
                order_id: order_id,
                machine_id: machine_id,
                rack_number: rack_number,
                amount: config.default_item_price, // Driven by config.js -> .env
                status: 'PENDING_PAYMENT'
            });

            // 3. Return the Order ID to the frontend
            return reply.code(200).send({
                success: true,
                message: "Order created successfully. Inventory locked.",
                order_id: newOrder.order_id
            });

        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Internal Server Error" });
        }
    });
}

module.exports = orderRoutes;