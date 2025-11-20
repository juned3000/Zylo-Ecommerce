const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
  console.log('🧪 Testing email configuration...');
  console.log('Email settings:');
  console.log('- Host:', process.env.EMAIL_HOST);
  console.log('- Port:', process.env.EMAIL_PORT);
  console.log('- User:', process.env.EMAIL_USER);
  console.log('- Password length:', process.env.EMAIL_PASS?.length, 'characters');
  
  try {
    // Create transporter with the same settings as the main app
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');

    console.log('📧 Sending test email...');
    const testOtp = '123456';
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@zylo.com',
      to: process.env.EMAIL_USER, // Send to yourself
      subject: 'Test OTP - Zylo Ecommerce',
      html: `
        <div style="font-family: Arial, sans-serif; padding:20px; max-width:500px; margin:auto; border:1px solid #eee;">
          <h2 style="color:#333;">Zylo Ecommerce - Test</h2>
          <p>This is a test email. Your test OTP code is:</p>
          <h1 style="letter-spacing:8px; color:#007bff;">${testOtp}</h1>
          <p>If you received this email, your OTP system is working correctly!</p>
        </div>
      `,
      text: `Your test OTP code is ${testOtp}. If you received this email, your OTP system is working correctly!`
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('📨 Check your inbox at:', process.env.EMAIL_USER);

  } catch (error) {
    console.error('❌ Email test failed:');
    console.error('Error:', error.message);
    
    if (error.code === 'EAUTH') {
      console.error('\n🔐 Authentication failed. Please check:');
      console.error('1. Gmail 2-factor authentication is enabled');
      console.error('2. You are using an App Password (not your regular Gmail password)');
      console.error('3. The App Password is correct in your .env file');
    } else if (error.code === 'ECONNECTION') {
      console.error('\n🌐 Connection failed. Please check:');
      console.error('1. Your internet connection');
      console.error('2. Gmail SMTP settings are correct');
    }
  }
}

testEmail();
