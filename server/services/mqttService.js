const mqtt = require('mqtt');
const config = require('../config');

let client = null;

const initMQTT = () => {
  if (client) return client;

  const brokerUrl = config.mqtt_broker_url;
  console.log(`Connecting to MQTT Broker: ${brokerUrl}`);

  const options = {
    keepalive: 60,
    clientId: `vending_server_${Math.random().toString(16).slice(3)}`,
    clean: true,
    reconnectPeriod: 5000, // Wait 5s between reconnects
    connectTimeout: 30 * 1000, // 30s timeout
    rejectUnauthorized: false
  };

  client = mqtt.connect(brokerUrl, options);

  client.on('connect', () => {
    console.log('✅ Connected to MQTT broker successfully');
  });

  client.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT broker...');
  });

  client.on('offline', () => {
    console.log('⚠️ MQTT client is offline');
  });

  client.on('error', (err) => {
    console.error('❌ MQTT connection error:', err.message);
  });

  return client;
};

const publishMessage = (topic, payload) => {
  if (!client || !client.connected) {
    console.warn(`Cannot publish to ${topic}: MQTT client not connected`);
    if (!client) initMQTT();
    return;
  }

  const message = JSON.stringify(payload);
  client.publish(topic, message, { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Failed to publish to ${topic}:`, err);
    } else {
      console.log(`📤 Published to ${topic}: ${message}`);
    }
  });
};

module.exports = {
  initMQTT,
  publishMessage
};

