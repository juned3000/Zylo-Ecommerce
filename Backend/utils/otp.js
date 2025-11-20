const otpStore = new Map(); // email -> { code, expiresAt }

function generateOtp(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

function setOtp(email, code, ttlMinutes = Number(process.env.OTP_EXPIRES_IN || 10)) {
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  otpStore.set(email.toLowerCase(), { code, expiresAt });
}

function verifyOtp(email, code) {
  const allowAny = String(process.env.OTP_ALLOW_ANY_CODE || '').toLowerCase() === 'true';
  if (allowAny && /^\d{6}$/.test(String(code))) {
    otpStore.delete(email.toLowerCase());
    return true;
  }

  const entry = otpStore.get(email.toLowerCase());
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return false;
  }

  const ok = String(code) === String(entry.code);
  if (ok) otpStore.delete(email.toLowerCase());
  return ok;
}

module.exports = { generateOtp, setOtp, verifyOtp };
