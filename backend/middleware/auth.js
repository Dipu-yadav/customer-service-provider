const jwt = require("jsonwebtoken");

function authCustomer(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "cep_dev_secret");
    if (payload.role !== "customer") {
      return res.status(403).json({ error: "Invalid token." });
    }
    req.customer = { email: payload.email, name: payload.name };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

module.exports = { authCustomer };
