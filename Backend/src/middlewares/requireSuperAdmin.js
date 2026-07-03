/**
 * Fastify preHandler middleware enforcing Super Admin authority constraints.
 * Rejects requests if request.user is not present or request.user.role is not SUPER_ADMIN.
 */
async function requireSuperAdmin(request, reply) {
  if (!request.user) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication context missing.'
    });
    return;
  }

  if (request.user.role !== 'SUPER_ADMIN') {
    reply.status(403).send({
      error: 'Forbidden',
      message: 'Access denied: Scoped strictly to Super Admin role.'
    });
    return;
  }
}

module.exports = requireSuperAdmin;
