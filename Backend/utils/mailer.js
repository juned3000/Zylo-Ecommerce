const nodemailer = require('nodemailer');

async function sendEmail({ to, subject, html, text }) {
  let transporter;
  let previewUrl = null;

  if (String(process.env.EMAIL_USE_ETHEREAL || '').toLowerCase() === 'true') {
    // Auto-generate a test account for development
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  } else {
    // Use Gmail SMTP for production
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@zylo.com',
    to,
    subject,
    text,
    html
  });

  // Generate preview URL only for Ethereal test emails
  if (String(process.env.EMAIL_USE_ETHEREAL || '').toLowerCase() === 'true') {
    previewUrl = nodemailer.getTestMessageUrl(info);
  }

  console.log(`📧 Email sent to ${to}: ${subject}`);
  if (previewUrl) {
    console.log(`📝 Preview URL: ${previewUrl}`);
  }

  return { previewUrl };
}

module.exports = { sendEmail };
