const sharp = require('sharp');
const mockPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function test() {
  try {
    console.log('Testing sharp with mockPngBuffer...');
    const result = await sharp(mockPngBuffer)
      .resize(600, 600, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();
    console.log('✅ Sharp works perfectly! Result buffer length:', result.length);
  } catch (err) {
    console.error('❌ Sharp failed:', err);
  }
}

test();
