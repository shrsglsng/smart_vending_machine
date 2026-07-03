const path = require('path');
// Load environment variables from .env file in workspace root
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
};

// Validate mandatory environment variables
const REQUIRED_VARS = [
  'MONGO_URI', 
  'JWT_SECRET', 
  'ENCRYPTION_KEY', 
  'MQTT_BROKER_URL', 
  'RESEND_API_KEY', 
  'ADMIN_EMAIL'
];
const missingVars = REQUIRED_VARS.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(`CRITICAL CONFIGURATION ERROR: Missing mandatory environment variable(s): ${missingVars.join(', ')}`);
}

// AES-256-GCM encryption key must be 32 bytes (64 hex characters)
if (config.ENCRYPTION_KEY.length !== 64 || !/^[0-9a-fA-F]+$/.test(config.ENCRYPTION_KEY)) {
  throw new Error('CRITICAL CONFIGURATION ERROR: ENCRYPTION_KEY must be a 64-character hexadecimal string representing a 32-byte key.');
}

// Validate MQTT Broker URL shape
if (!/^(mqtt|mqtts|tcp|ws|wss):\/\/.+/.test(config.MQTT_BROKER_URL)) {
  throw new Error('CRITICAL CONFIGURATION ERROR: MQTT_BROKER_URL must be a valid connection URI (e.g., mqtt://broker.emqx.io).');
}

// Validate Resend API Key shape (e.g. re_...)
if (!/^re_[a-zA-Z0-9_]+/.test(config.RESEND_API_KEY)) {
  throw new Error('CRITICAL CONFIGURATION ERROR: RESEND_API_KEY must be a valid Resend API key starting with "re_".');
}

// Validate Admin Email shape
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.ADMIN_EMAIL)) {
  throw new Error('CRITICAL CONFIGURATION ERROR: ADMIN_EMAIL must be a valid email address.');
}

module.exports = config;
