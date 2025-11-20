// Email OTP Login System
(function(){
  const emailInput = document.getElementById('email-address');
  const continueBtn = document.getElementById('continue-btn');
  
  // Generate OTP per request (simulated client-side); never show it via alert
  let currentEmail = '';
  let currentOtp = '';
  // In this static demo, allow any 6-digit OTP to succeed
  const DEV_ALLOW_ANY_OTP = true;
  function generateOtp(){ return String(Math.floor(100000 + Math.random() * 900000)); }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function updateContinueButton() {
    if (!continueBtn || !emailInput) return;
    const email = emailInput.value.trim();
    continueBtn.disabled = !isValidEmail(email);
  }

  emailInput?.addEventListener('input', updateContinueButton);
  emailInput?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !continueBtn.disabled) {
      continueBtn.click();
    }
  });

  // Send verification code
  continueBtn?.addEventListener('click', async function(){
    const email = emailInput?.value.trim();
    if (!isValidEmail(email)) return;
    
    currentEmail = email;
    
    // Show "sending" state
    continueBtn.disabled = true;
    continueBtn.textContent = 'Sending Code...';
    
    try {
      // Call backend API to request OTP
      const resp = await API.endpoints.auth.requestOTP(email);
      
      showOtpOverlay(email);
      continueBtn.disabled = false;
      continueBtn.textContent = 'Send Verification Code';
      
      // If backend provided a dev preview URL (Ethereal), surface it for convenience
      try {
        if (resp && resp.previewUrl) {
          const footer = document.querySelector('#otp-overlay .otp-footer');
          if (footer && !footer.querySelector('.otp-preview-link')) {
            const a = document.createElement('a');
            a.href = resp.previewUrl;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'link-btn otp-preview-link';
            a.textContent = 'Open email preview';
            footer.insertBefore(a, footer.firstChild);
          }
        }
      } catch {}
      
      // Show success message
      try { window.ZYLO?.toast?.(`Verification code sent to ${email}`); } catch {}
    } catch (error) {
      console.error('Error requesting OTP:', error);
      continueBtn.disabled = false;
      continueBtn.textContent = 'Send Verification Code';
      
      // Show detailed error message
      let errorMessage = 'Failed to send verification code';
      if (error.message) {
        if (error.message.includes('network') || error.message.includes('timeout')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.message.includes('email')) {
          errorMessage = 'Please enter a valid email address.';
        } else {
          errorMessage = error.message;
        }
      }
      
      try { 
        window.ZYLO?.toast?.(errorMessage) || alert(errorMessage); 
      } catch {
        alert(errorMessage);
      }
    }
  });

  // OTP overlay logic
  const overlay = document.getElementById('otp-overlay');
  const otpEmail = document.getElementById('otp-email');
  const verifyBtn = document.getElementById('verify-otp-btn');
  const closeBtn = document.getElementById('otp-close');
  const editBtn = document.getElementById('edit-email-btn');
  const resendBtn = document.getElementById('resend-otp-btn');
  const resendTimerEl = document.getElementById('resend-timer');
  const otpErrorEl = document.getElementById('otp-error');

  function getOtpInputs(){
    return Array.from(document.querySelectorAll('.otp-digit'));
  }

  function showOtpOverlay(email){
    if (otpEmail) otpEmail.textContent = email;
    overlay?.classList.add('show');
    overlay?.setAttribute('aria-hidden', 'false');
    if (otpErrorEl) otpErrorEl.textContent = '';
    const inputs = getOtpInputs();
    inputs.forEach(i => i.value = '');
    setTimeout(()=> inputs[0]?.focus(), 50);
    startResendTimer(30);
    updateVerifyState();
  }
  function hideOtpOverlay(){
    overlay?.classList.remove('show');
    overlay?.setAttribute('aria-hidden', 'true');
    if (otpErrorEl) otpErrorEl.textContent = '';
  }

  // Close handlers
  closeBtn?.addEventListener('click', hideOtpOverlay);
  overlay?.addEventListener('click', (e)=>{ if (e.target === overlay) hideOtpOverlay(); });
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && overlay?.classList.contains('show')) hideOtpOverlay(); });

  // Edit email returns to email input
  editBtn?.addEventListener('click', ()=>{ hideOtpOverlay(); emailInput?.focus(); });

  // OTP input behaviors
  function updateVerifyState(){
    const all = getOtpInputs().map(i => i.value.trim()).every(v => v.length === 1);
    if (verifyBtn) verifyBtn.disabled = !all;
  }

  function handleDigitInput(e){
    const input = e.target;
    input.value = input.value.replace(/\D/g,'').slice(0,1);
    if (input.value && input.nextElementSibling && input.nextElementSibling.classList.contains('otp-digit')){
      input.nextElementSibling.focus();
    }
    updateVerifyState();
  }
  function handleDigitKeydown(e){
    const input = e.target;
    if (e.key === 'Backspace' && !input.value && input.previousElementSibling && input.previousElementSibling.classList.contains('otp-digit')){
      input.previousElementSibling.focus();
    }
  }
  function handlePaste(e){
    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
    if (!text) return;
    const inputs = getOtpInputs();
    inputs.forEach((inp, idx)=>{ inp.value = text[idx] || ''; });
    inputs[Math.min(text.length, inputs.length)-1]?.focus();
    updateVerifyState();
    e.preventDefault();
  }

  getOtpInputs().forEach(inp => {
    inp.addEventListener('input', handleDigitInput);
    inp.addEventListener('keydown', handleDigitKeydown);
    inp.addEventListener('paste', handlePaste);
  });

  // Resend timer
  let resendInterval = null;
  function startResendTimer(seconds){
    clearInterval(resendInterval);
    let remaining = seconds;
    if (resendBtn) resendBtn.disabled = true;
    if (resendTimerEl) resendTimerEl.textContent = `Resend available in ${remaining}s`;
    resendInterval = setInterval(()=>{
      remaining -= 1;
      if (remaining <= 0){
        clearInterval(resendInterval);
        if (resendBtn) resendBtn.disabled = false;
        if (resendTimerEl) resendTimerEl.textContent = '';
      } else {
        if (resendTimerEl) resendTimerEl.textContent = `Resend available in ${remaining}s`;
      }
    }, 1000);
  }

  resendBtn?.addEventListener('click', async ()=>{
    try {
      // Call backend API to resend OTP
      await API.endpoints.auth.requestOTP(currentEmail);
      
      startResendTimer(30);
      const inputs = getOtpInputs();
      inputs.forEach(i => i.value = '');
      inputs[0]?.focus();
      updateVerifyState();
      if (otpErrorEl) otpErrorEl.textContent = '';
      
      try { window.ZYLO?.toast?.(`Verification code resent to ${currentEmail}`); } catch {}
    } catch (error) {
      console.error('Error resending OTP:', error);
      let errorMessage = 'Failed to resend verification code';
      if (error.message) {
        if (error.message.includes('network') || error.message.includes('timeout')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else {
          errorMessage = error.message;
        }
      }
      try { 
        window.ZYLO?.toast?.(errorMessage) || alert(errorMessage); 
      } catch {
        alert(errorMessage);
      }
    }
  });

  verifyBtn?.addEventListener('click', async () => {
    const codeStr = getOtpInputs().map(i => i.value).join('');
    if (codeStr.length !== 6) return;

    // Disable while verifying
    verifyBtn.disabled = true;
    const prevText = verifyBtn.textContent;
    verifyBtn.textContent = 'Verifying...';

    try {
      // Call backend API to verify OTP
      const response = await API.endpoints.auth.verifyOTP(
        currentEmail,
        codeStr,
        currentEmail.split('@')[0] // Use email prefix as name
      );

      if (response?.success && response?.token) {
        // Success - save user session with JWT token
        API.setToken(response.token, response.user);

        hideOtpOverlay();
        const welcomeName = response.user.firstName || response.user.name || 'User';
        try { window.ZYLO?.toast?.(`Welcome back, ${welcomeName}!`); } catch {}

        // Sync local cart and wishlist with server after login
        try {
          // Sync cart if CartManager is available
          if (window.cartManager) {
            await window.cartManager.syncCartAfterLogin();
            console.log('✅ Cart synced via CartManager');
          } else {
            // Fallback to old cart sync method
            const localCart = JSON.parse(localStorage.getItem('zylo_cart') || '[]');
            if (Array.isArray(localCart) && localCart.length > 0) {
              await API.endpoints.cart.sync(localCart);
            }
          }
        } catch (syncError) {
          console.warn('Cart sync failed:', syncError);
        }
        
        try {
          // Sync wishlist if WishlistManager is available
          if (window.wishlistManager) {
            await window.wishlistManager.syncWishlistAfterLogin();
            console.log('✅ Wishlist synced via WishlistManager');
          }
        } catch (syncError) {
          console.warn('Wishlist sync failed:', syncError);
        }

        // Redirect back to desired page
        let rt = 'index.html';
        try {
          rt = localStorage.getItem('zylo_return_to') || 'index.html';
          localStorage.removeItem('zylo_return_to');
        } catch {}
        window.location.href = rt;
        return;
      }
      throw new Error(response?.message || 'Invalid response from server');
    } catch (error) {
      console.error('Error verifying OTP:', error);

      // Invalid OTP - show inline error
      if (otpErrorEl) otpErrorEl.textContent = error.message || 'Invalid code. Please try again.';
      const inputs = getOtpInputs();
      inputs.forEach(i => i.value = '');
      inputs[0]?.focus();
    } finally {
      updateVerifyState();
      verifyBtn.disabled = false; // allow retry
      verifyBtn.textContent = prevText || 'Verify';
    }
  });

  // Social buttons (no backend yet)
  document.getElementById('google-btn')?.addEventListener('click', ()=>{
    alert('Google Sign-In flow will be implemented later.');
  });
  document.getElementById('facebook-btn')?.addEventListener('click', ()=>{
    alert('Facebook Login flow will be implemented later.');
  });

  // Initialize
  updateContinueButton();
})();

// Public API wrappers
window.initLoginPage = function(){ /* behaviors already bound in IIFE */ };
window.validateMobileInput = function(){
  const code = document.getElementById('country-code')?.value || '+91';
  const mobile = (document.getElementById('mobile-number')?.value || '').replace(/\D+/g,'');
  if (code === '+91') return mobile.length === 10;
  return mobile.length >= 5 && mobile.length <= 15;
};
window.updateContinueButtonState = function(){
  const btn = document.getElementById('continue-btn');
  if (btn) btn.disabled = !window.validateMobileInput();
};
window.openOtpModal = function(fullPhone){
  const overlay = document.getElementById('otp-overlay');
  const otpPhone = document.getElementById('otp-phone');
  if (otpPhone && fullPhone) otpPhone.textContent = fullPhone;
  overlay?.classList.add('show');
  overlay?.setAttribute('aria-hidden', 'false');
};
window.closeOtpModal = function(){
  const overlay = document.getElementById('otp-overlay');
  overlay?.classList.remove('show');
  overlay?.setAttribute('aria-hidden', 'true');
};
window.bindOtpInputHandlers = function(){ /* already bound on load */ };
window.verifyOtp = function(){ document.getElementById('verify-otp-btn')?.click(); };
window.startResendTimer = function(seconds){
  let remaining = Number(seconds || 30);
  const resendBtn = document.getElementById('resend-otp-btn');
  const resendTimerEl = document.getElementById('resend-timer');
  if (resendBtn) resendBtn.disabled = true;
  if (resendTimerEl) resendTimerEl.textContent = `Resend available in ${remaining}s`;
  const id = setInterval(()=>{
    remaining -= 1;
    if (remaining <= 0){
      clearInterval(id);
      if (resendBtn) resendBtn.disabled = false;
      if (resendTimerEl) resendTimerEl.textContent = '';
    } else {
      if (resendTimerEl) resendTimerEl.textContent = `Resend available in ${remaining}s`;
    }
  }, 1000);
};
window.resendOtp = function(){ document.getElementById('resend-otp-btn')?.click(); };
window.persistUserSession = function(user){ try { localStorage.setItem('zylo_user', JSON.stringify(user||{})); } catch {} };

