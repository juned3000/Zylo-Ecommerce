const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('JWT decoded payload:', decoded);
    req.user = decoded;
    console.log('req.user set to:', req.user);
    next();
  } catch (err) {
    console.log('JWT verification error:', err.message);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
