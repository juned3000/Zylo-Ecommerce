const express = require('express');
const { body, validate } = require('../middleware/validate');
const { generateOtp, setOtp, verifyOtp } = require('../utils/otp');
const { sendEmail } = require('../utils/mailer');
const { buildOtpEmail } = require('../utils/emailTemplates');
const { generateToken } = require('../utils/jwt');
const User = require('../models/User');

const router = express.Router();

// Request login OTP
router.post('/request-otp',
  validate([
    body('email').isEmail().withMessage('Valid email is required')
  ]),
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const code = generateOtp(6);

      const brandName = process.env.APP_BRAND_NAME || 'Zylo Ecommerce';
      const expires = Number(process.env.OTP_EXPIRES_IN || 10);
      const { subject, html, text } = buildOtpEmail({ brandName, code, expiresMinutes: expires });

      try {
        const { previewUrl } = await sendEmail({
          to: email,
          subject,
          html,
          text
        });

        setOtp(email, code);

        res.json({
          success: true,
          message: 'OTP sent',
          previewUrl: previewUrl // only works with Ethereal/test mode
        });
      } catch (e) {
        console.warn('Email sending failed:', e.message);
        return res.status(500).json({ success: false, message: 'Failed to send verification code' });
      }
    } catch (err) { next(err); }
  }
);

// Verify OTP
router.post('/verify-otp',
  validate([
    body('email').isEmail(),
    body('code').isLength({ min: 6, max: 6 }).withMessage('6-digit code required')
  ]),
  async (req, res, next) => {
    try {
      const { email, code, name } = req.body;
      const ok = verifyOtp(email, code);
      if (!ok) return res.status(400).json({ success: false, message: 'Invalid or expired code' });

      let user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        // For new users, use the name parameter to create firstName
        const nameValue = name || email.split('@')[0];
        user = await User.create({
          email: email.toLowerCase(),
          firstName: nameValue,
          wishlist: [],
          addresses: []
        });
      }

      const token = generateToken({ id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName });

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
          wishlist: user.wishlist,
          addresses: user.addresses,
          isAdmin: user.isAdmin || false
        }
      });
    } catch (err) { next(err); }
  }
);

// Traditional email/password login (for admin users)
router.post('/login',
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 1 }).withMessage('Password is required')
  ]),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      
      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid email or password' 
        });
      }
      
      // Check if user has a password hash (admin users should have this)
      if (!user.passwordHash) {
        return res.status(401).json({ 
          success: false, 
          message: 'This account uses OTP login. Please use the OTP verification process.' 
        });
      }
      
      // Verify password
      const bcrypt = require('bcryptjs');
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValidPassword) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid email or password' 
        });
      }
      
      // Generate token
      const token = generateToken({ 
        id: user._id, 
        email: user.email, 
        name: user.name || user.firstName, 
        isAdmin: user.isAdmin 
      });
      
      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name || user.firstName || 'User',
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
          isAdmin: user.isAdmin || false,
          wishlist: user.wishlist || [],
          addresses: user.addresses || []
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
