const { Resend } = require('resend');
const config = require('../utils/config');
const Tenant = require('../models/tenant');

let resend = null;
if (config.RESEND_API_KEY) {
  resend = new Resend(config.RESEND_API_KEY);
}

/**
 * Sends a B2B issue alert simultaneously to the global administrator and the corporate tenant contact email.
 * @param {Object} reportDetails Details of the issue (reportId, machineId, orderId, issueType, imageUrl)
 * @param {String} tenantId Scoped B2B tenant_id
 */
const sendIssueAlert = async (reportDetails, tenantId) => {
  if (!resend) {
    console.warn('⚠️ Resend is not initialized. Skipping email alert.');
    return;
  }

  const { reportId, machineId, orderId, issueType, imageUrl } = reportDetails;

  try {
    const recipients = [config.ADMIN_EMAIL];

    // Scoping Enhancement: Dynamically query for active B2B Tenant using tenant_id
    if (tenantId) {
      const tenant = await Tenant.findOne({ tenant_id: tenantId }).exec();
      if (tenant && tenant.contact_email) {
        // Avoid duplicates if tenant admin is same as global admin
        if (tenant.contact_email.toLowerCase() !== config.ADMIN_EMAIL.toLowerCase()) {
          recipients.push(tenant.contact_email);
        }
      } else {
        console.warn(`⚠️ Tenant with ID "${tenantId}" not found or lacks a contact_email. Alerting global admin only.`);
      }
    }

    const emailOptions = {
      from: 'SmartVending <alerts@resend.dev>', // Dev sandbox default
      to: recipients,
      subject: `[Tenant Alert] New Vending Issue: Machine ${machineId || 'Unknown'}`,
      html: `
        <h1>New Issue Reported</h1>
        <p><strong>Tenant ID:</strong> ${tenantId || 'GLOBAL / NONE'}</p>
        <p><strong>Report ID:</strong> ${reportId}</p>
        <p><strong>Machine ID:</strong> ${machineId}</p>
        <p><strong>Order ID:</strong> ${orderId || 'N/A'}</p>
        <p><strong>Issue Type:</strong> ${issueType}</p>
        ${imageUrl ? `<p><a href="${imageUrl}">View Image Link</a></p>` : ''}
        ${imageUrl ? `<p><img src="${imageUrl}" alt="Issue attachment" style="max-width: 400px; height: auto;" /></p>` : ''}
      `
    };

    console.log(`Sending email alert for report ${reportId} to: ${recipients.join(', ')}`);
    const response = await resend.emails.send(emailOptions);
    console.log(`✅ Email alert successfully triggered via Resend:`, response);
    return response;
  } catch (error) {
    console.error(`❌ Failed to send issue alert email:`, error);
    throw error;
  }
};

module.exports = {
  sendIssueAlert
};
