/**
 * Fastify preHandler middleware enforcing strict B2B multi-tenancy context isolation.
 * Extracts the JWT, verifies it using @fastify/jwt, and binds user parameters to request.user.
 */
async function requireTenant(request, reply) {
  try {
    // Extract JWT from Authorization: Bearer <token> and verify
    // On success, this automatically decodes the payload into request.user
    await request.jwtVerify();

    if (!request.user) {
      reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication failed: Unable to parse identity token payload.'
      });
      return;
    }

    const { tenant_id, role } = request.user;

    // Validate role is set on token
    if (!role) {
      reply.status(403).send({
        error: 'Forbidden',
        message: 'Access denied: Identity token lacks role specification.'
      });
      return;
    }

    // Super Admin Bypass Logic
    if (role === 'SUPER_ADMIN') {
      // Super Admins bypass standard customer scoping and defaults to the root platform tenant
      request.user.tenant_id = tenant_id || 'TEN_PLATFORM_ROOT';
    } else {
      // Tenants & Operators must be assigned to an active tenant profile
      if (!tenant_id || tenant_id === 'TEN_PLATFORM_ROOT') {
        reply.status(403).send({
          error: 'Forbidden',
          message: 'Access denied: User is not linked to a valid corporate tenant profile.'
        });
        return;
      }
    }
  } catch (error) {
    // Catch-all for token verification/signature failures
    reply.status(401).send({
      error: 'Unauthorized',
      message: error.message || 'Authentication failed: Missing, malformed, or expired security token.'
    });
  }
}

module.exports = requireTenant;
