const jwt = require('jsonwebtoken');

function generateToken(payload) {
  const secret = process.env.JWT_SECRET || 'supersecret';
  const expires = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn: expires });
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'supersecret';
  return jwt.verify(token, secret);
}

module.exports = { generateToken, verifyToken };
