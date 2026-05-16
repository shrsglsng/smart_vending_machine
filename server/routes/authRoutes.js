const User = require('../models/User');
const bcrypt = require('bcrypt');

async function authRoutes(fastify, options) {
  fastify.post('/login', async (request, reply) => {
    if (!request.body) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Request body is missing' });
    }

    const { email, password } = request.body;

    if (!email || !password) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Email and password are required' });
    }

    try {
      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid email or password' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid email or password' });
      }

      // Sign JWT
      const token = fastify.jwt.sign({ 
        userId: user._id, 
        role: user.role 
      });

      return { 
        token, 
        user: { 
          id: user._id, 
          email: user.email, 
          role: user.role 
        } 
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}

module.exports = authRoutes;
