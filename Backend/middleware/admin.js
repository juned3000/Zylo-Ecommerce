const User = require('../models/User');

module.exports = async function admin(req, res, next) {
  try {
    // First check if user is authenticated (assumes auth middleware ran first)
    console.log('Admin middleware - req.user:', req.user);
    if (!req.user || !req.user.id) {
      console.log('Admin middleware - authentication failed:', { user: req.user, hasId: !!req.user?.id });
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Check if user exists and is admin
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
