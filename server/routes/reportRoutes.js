const Report = require('../models/Report');
const { Resend } = require('resend');
const config = require('../config');

const resend = new Resend(config.resend_api_key);

async function reportRoutes(fastify, options) {
  fastify.post('/', async (request, reply) => {
    const { orderId, machineId, issueType, imageUrl } = request.body;

    try {
      // 1. Save Report to DB
      const reportId = `REP_${Date.now()}`;
      const newReport = new Report({
        report_id: reportId,
        order_id: orderId,
        machine_id: machineId,
        issueType,
        imageUrl,
        status: 'PENDING'
      });
      await newReport.save();

      // 2. Trigger Email Alert to Admin via Resend
      if (config.resend_api_key && config.admin_email) {
        try {
          await resend.emails.send({
            from: 'SmartVending <alerts@resend.dev>', // Update with verified domain in production
            to: config.admin_email,
            subject: `New Issue Reported: ${machineId}`,
            html: `
              <h1>New Issue Reported</h1>
              <p><strong>Report ID:</strong> ${reportId}</p>
              <p><strong>Machine ID:</strong> ${machineId}</p>
              <p><strong>Order ID:</strong> ${orderId}</p>
              <p><strong>Issue Type:</strong> ${issueType}</p>
              <p><a href="${imageUrl}">View Image</a></p>
            `
          });
        } catch (emailErr) {
          fastify.log.error('Failed to send email alert:', emailErr);
          // Don't fail the request if email fails, but log it
        }
      }

      return { 
        status: 'SUCCESS', 
        reportId: newReport.report_id,
        message: 'Report submitted successfully.' 
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = reportRoutes;
