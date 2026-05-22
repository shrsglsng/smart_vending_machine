const fs = require('fs');
const path = require('path');
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const Sentry = require('@sentry/node');
const config = require('./utils/config');
const dbConnector = require('./services/db');

// Ensure public uploads catalog directory exists on boot
const uploadsDir = path.join(__dirname, '../public/uploads/catalog');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 1. Initialize Sentry tracking as early as possible
if (config.SENTRY_DSN) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: 1.0,
  });
  console.log('Sentry Error Tracking initialized successfully.');
} else {
  console.log('Sentry disabled: SENTRY_DSN environment variable not configured.');
}

// 2. Initialize Fastify Instance with custom logging levels
const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  },
});

// 3. Register Sentry Global Error Handler
fastify.setErrorHandler((error, request, reply) => {
  // Always log the error locally using Fastify's native logger
  fastify.log.error(error);

  // Send tracing details to Sentry if active
  if (config.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setSDKProcessingMetadata({ request });
      scope.setExtra('url', request.raw.url);
      scope.setExtra('method', request.raw.method);
      scope.setExtra('query', request.query);
      scope.setExtra('body', request.body);
      Sentry.captureException(error);
    });
  }

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
  root: uploadsDir,
  prefix: '/uploads/catalog/',
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
