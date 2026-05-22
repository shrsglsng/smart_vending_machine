const path = require('path');
const sharp = require('sharp');
const MasterCatalog = require('../models/masterCatalog');
const requireTenant = require('../middlewares/requireTenant');
const requireSuperAdmin = require('../middlewares/requireSuperAdmin');

async function catalogRoutes(fastify, options) {
  // POST /api/v1/admin/catalog/upload
  // Protected by Super Admin authority constraints
  fastify.post('/admin/catalog/upload', {
    preHandler: [requireTenant, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      if (!request.isMultipart()) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Multipart request required for uploading catalog items.'
        });
        return;
      }

      const parts = request.parts();
      let fileBuffer = null;
      let fileName = '';
      let item_id = '';
      let item_name = '';
      let default_price_paise = null;

      for await (const part of parts) {
        if (part.file) {
          fileBuffer = await part.toBuffer();
          fileName = part.filename;
        } else {
          if (part.fieldname === 'item_id') item_id = part.value;
          if (part.fieldname === 'item_name') item_name = part.value;
          if (part.fieldname === 'default_price_paise') {
            default_price_paise = parseInt(part.value, 10);
          }
        }
      }

      // Input parameters validation
      if (!item_id || !item_name || default_price_paise === null || isNaN(default_price_paise)) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Missing or invalid fields: item_id, item_name, and default_price_paise are required.'
        });
        return;
      }

      if (default_price_paise < 0) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'default_price_paise cannot be negative.'
        });
        return;
      }

      if (!fileBuffer) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Missing mandatory image file upload.'
        });
        return;
      }

      // Enforce duplicate catalog ID checks
      const existingItem = await MasterCatalog.findOne({ item_id });
      if (existingItem) {
        reply.status(409).send({
          error: 'Conflict',
          message: `A catalog item with ID "${item_id}" already exists.`
        });
        return;
      }

      // Sharp Image Processing Pipeline
      // Resizes to 600x600 pixels and converts to .webp with 80% compression quality
      const cleanId = item_id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const outputFilename = `${cleanId}_${Date.now()}.webp`;
      const outputDir = path.join(__dirname, '../../public/uploads/catalog');
      const localFilePath = path.join(outputDir, outputFilename);

      try {
        await sharp(fileBuffer)
          .resize(600, 600, { fit: 'cover' })
          .webp({ quality: 80 })
          .toFile(localFilePath);
      } catch (sharpError) {
        fastify.log.error('Sharp optimization pipeline failed:', sharpError);
        reply.status(500).send({
          error: 'ImageProcessingError',
          message: `Failed to process, resize, or optimize the uploaded image: ${sharpError.message}`
        });
        return;
      }

      const relativePath = `/uploads/catalog/${outputFilename}`;

      // Save optimized master catalog entry to database
      const catalogRecord = await MasterCatalog.create({
        item_id,
        item_name,
        image_path: relativePath,
        default_price_paise
      });

      reply.status(201).send(catalogRecord);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: error.message || 'An unexpected error occurred during catalog upload.'
      });
    }
  });
}

module.exports = catalogRoutes;
