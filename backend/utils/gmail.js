function isValidGmail(email) {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  const match = /^[^\s@]+@([a-z0-9.-]+)$/.exec(normalized);
  if (!match) return false;
  const domain = match[1];
  return domain === "gmail.com" || domain === "googlemail.com";
}

module.exports = { isValidGmail };
