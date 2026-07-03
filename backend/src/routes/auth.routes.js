const User = require('../models/user');

async function authRoutes(fastify, options) {
  // POST /api/v1/auth/login
  fastify.post('/login', async (request, reply) => {
    try {
      const { identifier, password } = request.body || {};

      if (!identifier || !password) {
        reply.status(400).send({
          error: 'BadRequest',
          message: 'Missing identifier or password fields.'
        });
        return;
      }

      // Query User depending on the identifier shape (email vs mobile number)
      let query = {};
      if (identifier.includes('@')) {
        query.email = identifier.trim().toLowerCase();
      } else {
        query.mobile_number = identifier.trim();
      }

      const user = await User.findOne(query);

      if (!user) {
        reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid credentials: User not found.'
        });
        return;
      }

      // Verify the password using the model instance helper
      const isPasswordMatch = await user.comparePassword(password);
      if (!isPasswordMatch) {
        reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid credentials: Password does not match.'
        });
        return;
      }

      // Sign JWT with payload attributes
      const token = await reply.jwtSign({
        userId: user._id,
        role: user.role,
        tenant_id: user.tenant_id
      });

      return {
        token,
        user: {
          id: user._id,
          role: user.role,
          tenant_id: user.tenant_id,
          email: user.email,
          mobile_number: user.mobile_number
        }
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'InternalServerError',
        message: 'An error occurred during authentication.'
      });
    }
  });
}

module.exports = authRoutes;
