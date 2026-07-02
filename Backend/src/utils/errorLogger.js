const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../../logs');
const ERROR_LOG_PATH = path.join(LOGS_DIR, 'error.log');

// Bootstrap logs directory immediately on module load
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Recursively clone and mask sensitive information to protect secrets and PII.
 */
function maskSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const masked = Array.isArray(obj) ? [] : {};
  const sensitiveKeys = [
    'password', 
    'transactionpin', 
    'device_api_key', 
    'payment_config', 
    'token', 
    'authorization', 
    'secret', 
    'key'
  ];

  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sk => keyLower.includes(sk));

    if (isSensitive) {
      masked[key] = '********';
    } else if (value && typeof value === 'object') {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Write error details and masked request data to the local logs/error.log file.
 * @param {Error} error - The thrown exception object.
 * @param {Object} request - Fastify request context.
 */
function logErrorLocal(error, request) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      error: {
        name: error.name || 'Error',
        message: error.message || 'No error message provided',
        stack: error.stack || 'No stack trace available',
      },
      request: request ? {
        url: request.raw ? request.raw.url : request.url,
        method: request.raw ? request.raw.method : request.method,
        ip: request.ip,
        headers: maskSensitiveData(request.headers),
        query: maskSensitiveData(request.query),
        body: maskSensitiveData(request.body),
        tenant_id: request.tenant_id || (request.user && request.user.tenant_id),
      } : null,
    };

    // Append standard JSON string newline terminated
    fs.appendFileSync(ERROR_LOG_PATH, JSON.stringify(logEntry) + '\n', 'utf8');
  } catch (err) {
    // Fallback console log if file-append fails (e.g. permission issues)
    console.error('CRITICAL LOGGER ERROR: Failed to write to local error log:', err.message);
  }
}

module.exports = {
  logErrorLocal,
  ERROR_LOG_PATH,
};
