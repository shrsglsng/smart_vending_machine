const fp = require('fastify-plugin');
const mongoose = require('mongoose');
const config = require('../utils/config');

/**
 * Fastify plugin for managing the MongoDB database connection via Mongoose.
 * Non-encapsulated (via fastify-plugin) so decorations are globally accessible.
 */
async function dbConnector(fastify, options) {
  try {
    fastify.log.info(`Connecting to MongoDB at: ${config.MONGO_URI}`);
    
    // Connect using standard mongoose client
    const conn = await mongoose.connect(config.MONGO_URI);
    
    fastify.log.info(`Successfully connected to MongoDB Host: ${conn.connection.host}, DB: ${conn.connection.name}`);
    
    // Decorate the Fastify instance so controllers can access Mongoose if needed
    fastify.decorate('mongoose', mongoose);

    // Synchronize Mongoose schemas indexes with MongoDB Atlas collections
    // This dynamically handles rebuilds of sparse index differentials
    const Tenant = require('../models/tenant');
    const User = require('../models/user');
    const Machine = require('../models/machine');

    fastify.log.info('Synchronizing database indexes...');
    await Promise.all([
      Tenant.syncIndexes(),
      User.syncIndexes(),
      Machine.syncIndexes()
    ]);
    fastify.log.info('Database indexes synchronized successfully.');
    
    // Graceful disconnect on server termination
    fastify.addHook('onClose', async (instance) => {
      fastify.log.info('Closing Mongoose connection due to application shutdown...');
      await mongoose.connection.close();
      fastify.log.info('Mongoose connection successfully closed.');
    });
  } catch (error) {
    fastify.log.error(`MongoDB Connection initialization failed: ${error.message}`);
    throw error; // Propagate exception to halt Fastify startup
  }
}

module.exports = fp(dbConnector);
