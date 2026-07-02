const fs = require('fs');
const path = require('path');
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const { logErrorLocal } = require('./utils/errorLogger');
const config = require('./utils/config');
const dbConnector = require('./services/db');

// Ensure public uploads directories exist on boot
const uploadsRootDir = path.join(__dirname, '../public/uploads');
const catalogDir = path.join(uploadsRootDir, 'catalog');
const operatorsDir = path.join(uploadsRootDir, 'operators');
[catalogDir, operatorsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Sentry tracking removed. Local file-based logging is initialized automatically on require.

// 2. Initialize Fastify Instance with custom logging levels
const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  },
});

// 3. Register Local Global Error Handler
fastify.setErrorHandler((error, request, reply) => {
  // Always log the error locally using Fastify's native logger
  fastify.log.error(error);

  // Record error details and HTTP context to local error.log with masking
  logErrorLocal(error, request);

  // Consistent API error envelope structure
  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({
    error: error.name || 'InternalServerError',
    message: error.message || 'An unexpected error occurred during execution.',
    statusCode,
  });
});

// 4. Configure & Register CORS limits
fastify.register(cors, {
  origin: config.NODE_ENV === 'production' ? false : true, // Lock origins down in production
});

// 5. Configure & Register JSON Web Token service
fastify.register(jwt, {
  secret: config.JWT_SECRET,
});

// 5.5. Configure & Register Multipart and Static serving plugins
fastify.register(require('@fastify/multipart'), {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

fastify.register(require('@fastify/static'), {
  root: uploadsRootDir,
  prefix: '/uploads/',
});

// 6. Register Mongoose Connector Plugin
fastify.register(dbConnector);

// 6.5. Register Business & Administrative Routes
fastify.register(require('./routes/auth.routes'), { prefix: '/api/v1/auth' });
fastify.register(require('./routes/admin.routes'), { prefix: '/api/v1' });
fastify.register(require('./routes/catalog.routes'), { prefix: '/api/v1' });
fastify.register(require('./routes/analytics.routes'), { prefix: '/api/v1' });

// 6.7. Initialize MQTT client connection
const { initMQTT } = require('./services/mqttService');
initMQTT();

// 7. Base Health Check Route
fastify.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: config.NODE_ENV,
  };
});

// 8. Start Web Server Listener
const start = async () => {
  try {
    await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`Smart Vending B2B Backend successfully listening on: http://localhost:${config.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}
module.exports = fastify; // Export for testing
