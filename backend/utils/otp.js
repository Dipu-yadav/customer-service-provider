function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function otpExpiryMinutes(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

module.exports = { generateOTP, otpExpiryMinutes };
