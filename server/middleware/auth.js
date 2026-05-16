module.exports = {
  verifyToken: async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
    }
  },

  requireAdmin: async (request, reply) => {
    // request.user is populated by jwtVerify()
    if (!request.user || request.user.role !== 'ADMIN') {
      reply.code(403).send({ 
        error: 'Forbidden', 
        message: 'Access denied. Admin privileges required.' 
      });
    }
  }
};
