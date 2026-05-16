const fastify = require('fastify')({ logger: true });
const mongoose = require('mongoose');
const config = require('./config');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const authRoutes = require('./routes/authRoutes');
const machineRoutes = require('./routes/machineRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const mqttService = require('./services/mqttService');

// Register CORS
fastify.register(cors, {
  origin: config.allowed_origins.split(','), // Support comma-separated origins
});

// Register JWT
fastify.register(jwt, {
  secret: config.jwt_secret
});

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(config.mongodb_uri);
    fastify.log.info('Connected to MongoDB');
  } catch (err) {
    fastify.log.error('Could not connect to MongoDB', err);
    process.exit(1);
  }
};

// Basic Route
fastify.get('/health', async (request, reply) => {
  return { status: 'OK', environment: process.env.NODE_ENV || 'development' };
});

// Register Routes (v1 Prefix)
fastify.register(authRoutes, { prefix: '/api/v1/auth' });
fastify.register(machineRoutes, { prefix: '/api/v1/machine' });
fastify.register(reportRoutes, { prefix: '/api/v1/reports' });
fastify.register(adminRoutes, { prefix: '/api/v1/admin' });
fastify.register(orderRoutes, { prefix: '/api/v1/order' });
fastify.register(paymentRoutes, { prefix: '/api/v1/payment' });

// Start Server
const start = async () => {
  try {
    await connectDB();
    mqttService.initMQTT(); // Initialize MQTT connection
    
    // Use dynamic port from config
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 Server is running on port ${config.port}`);
    console.log(`✅ Zero-Hardcoding Policy: Active`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
