require('dotenv').config();

const config = {
  development: {
    mongodb_uri: process.env.DEV_MONGO_URI?.trim(),
    phonepe: {
      merchantId: process.env.DEV_PHONEPE_MERCHANT_ID?.trim(),
      saltKey: process.env.DEV_PHONEPE_SALT_KEY?.trim(),
      saltIndex: process.env.DEV_PHONEPE_SALT_INDEX?.trim(),
      baseUrl: process.env.PHONEPE_BASE_URL?.trim()
    },
    resend_api_key: process.env.RESEND_API_KEY?.trim(),
    admin_email: process.env.ADMIN_EMAIL?.trim(),
    jwt_secret: process.env.JWT_SECRET?.trim(),
    mqtt_broker_url: process.env.MQTT_BROKER_URL?.trim(),
    allowed_origins: process.env.ALLOWED_ORIGINS?.trim(),
    app_base_url: process.env.APP_BASE_URL?.trim(),
    default_item_price: parseInt(process.env.DEFAULT_ITEM_PRICE_PAISE?.trim() || "0"),
    admin: {
      email: process.env.ADMIN_DEFAULT_EMAIL?.trim(),
      password: process.env.ADMIN_DEFAULT_PASSWORD?.trim(),
      pin: process.env.ADMIN_DEFAULT_PIN?.trim()
    },
    port: process.env.PORT?.trim()
  },
  production: {
    mongodb_uri: process.env.PROD_MONGODB_URI?.trim(),
    phonepe: {
      merchantId: process.env.PROD_PHONEPE_MERCHANT_ID?.trim(),
      saltKey: process.env.PROD_PHONEPE_SALT_KEY?.trim(),
      saltIndex: process.env.PROD_PHONEPE_SALT_INDEX?.trim(),
      baseUrl: process.env.PHONEPE_BASE_URL?.trim()
    },
    resend_api_key: process.env.RESEND_API_KEY?.trim(),
    admin_email: process.env.ADMIN_EMAIL?.trim(),
    jwt_secret: process.env.JWT_SECRET?.trim(),
    mqtt_broker_url: process.env.MQTT_BROKER_URL?.trim(),
    allowed_origins: process.env.ALLOWED_ORIGINS?.trim(),
    app_base_url: process.env.APP_BASE_URL?.trim(),
    default_item_price: parseInt(process.env.DEFAULT_ITEM_PRICE_PAISE?.trim() || "0"),
    admin: {
      email: process.env.ADMIN_DEFAULT_EMAIL?.trim(),
      password: process.env.ADMIN_DEFAULT_PASSWORD?.trim(),
      pin: process.env.ADMIN_DEFAULT_PIN?.trim()
    },
    port: process.env.PORT?.trim()
  }
};

const env = process.env.NODE_ENV || 'development';
const currentConfig = config[env];

// Industry Standard: Validate all critical secrets before startup
const requiredSecrets = [
  { key: 'mongodb_uri', label: 'MongoDB URI' },
  { key: 'jwt_secret', label: 'JWT Secret' },
  { key: 'port', label: 'Server Port (PORT)' },
  { key: 'allowed_origins', label: 'Allowed CORS Origins (ALLOWED_ORIGINS)' },
  { key: 'app_base_url', label: 'App Base URL (APP_BASE_URL)' },
  { key: 'default_item_price', label: 'Default Item Price (DEFAULT_ITEM_PRICE_PAISE)' },
  { key: 'mqtt_broker_url', label: 'MQTT Broker URL (MQTT_BROKER_URL)' },
  { key: 'phonepe.merchantId', label: 'PhonePe Merchant ID' },
  { key: 'phonepe.saltKey', label: 'PhonePe Salt Key' },
  { key: 'phonepe.saltIndex', label: 'PhonePe Salt Index' },
  { key: 'phonepe.baseUrl', label: 'PhonePe Base URL (PHONEPE_BASE_URL)' },
  { key: 'admin.email', label: 'Default Admin Email (ADMIN_DEFAULT_EMAIL)' },
  { key: 'admin.password', label: 'Default Admin Password (ADMIN_DEFAULT_PASSWORD)' },
  { key: 'admin.pin', label: 'Default Admin PIN (ADMIN_DEFAULT_PIN)' }
];

const missing = [];
requiredSecrets.forEach(secret => {
  const value = secret.key.split('.').reduce((obj, key) => obj && obj[key], currentConfig);
  if (!value) missing.push(secret.label);
});

if (missing.length > 0) {
  console.error('\x1b[31m%s\x1b[0m', 'FATAL: Missing required environment variables:');
  missing.forEach(m => console.error('\x1b[31m%s\x1b[0m', ` - ${m}`));
  process.exit(1);
}

console.log('✅ Configuration Loaded: 100% Zero-Hardcoding Compliance');

module.exports = currentConfig;
