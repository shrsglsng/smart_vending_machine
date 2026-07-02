const crypto = require('crypto');

/**
 * Generates the PhonePe Checksum for POST API requests (Pay, Refund)
 * Format: SHA256(base64Payload + apiEndpoint + saltKey) + "###" + saltIndex
 */
const generateChecksum = (payload, endpoint, saltKey, saltIndex) => {
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const stringToHash = base64Payload + endpoint + saltKey;
  
  const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
  const checksum = `${sha256}###${saltIndex}`;
  
  return {
    base64Payload,
    checksum
  };
};

/**
 * Generates the PhonePe Checksum for GET Status API requests
 * Format: SHA256("/v3/transaction/{merchantId}/{transactionId}/status" + saltKey) + "###" + saltIndex
 */
const generateStatusChecksum = (endpoint, saltKey, saltIndex) => {
  const stringToHash = endpoint + saltKey;
  const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
  return `${sha256}###${saltIndex}`;
};

module.exports = {
  generateChecksum,
  generateStatusChecksum
};
