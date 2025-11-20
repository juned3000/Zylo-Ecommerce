function buildOtpEmail({ brandName, code, expiresMinutes }) {
  const subject = `${brandName} Login Code`;
  const text = `Your OTP code is ${code}. It expires in ${expiresMinutes} minutes.`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding:20px; max-width:500px; margin:auto; border:1px solid #eee;">
      <h2 style="color:#333;">${brandName}</h2>
      <p>Use the code below to login:</p>
      <h1 style="letter-spacing:8px; color:#007bff;">${code}</h1>
      <p>This code will expire in <b>${expiresMinutes} minutes</b>. If you didn’t request it, ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
}

module.exports = { buildOtpEmail };
