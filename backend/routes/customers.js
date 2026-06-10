const express = require("express");
const Customer = require("../models/Customer");
const { authCustomer } = require("../middleware/auth");

const router = express.Router();

// GET /api/customers — all customers with service requests (admin)
router.get("/", async (_req, res) => {
  try {
    const customers = await Customer.find({ emailVerified: true })
      .select("-password")
      .lean();
    res.json({ customers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load customers." });
  }
});

// GET /api/customers/orders — flattened orders for admin dashboard
router.get("/orders", async (_req, res) => {
  try {
    const customers = await Customer.find({ emailVerified: true }).lean();
    const orders = [];
    for (const c of customers) {
      for (const s of c.services || []) {
        orders.push({
          id: s.requestId,
          service: s.service,
          status: s.status,
          date: s.date,
          name: s.name || c.name,
          phone: s.phone,
          address: s.address,
          payment: s.payment,
          customerEmail: c.email,
          providerEmail: s.providerEmail || ""
        });
      }
    }
    res.json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load orders." });
  }
});

// GET /api/customers/me/bookings
router.get("/me/bookings", authCustomer, async (req, res) => {
  try {
    const customer = await Customer.findOne({ email: req.customer.email })
      .select("-password")
      .lean();
    if (!customer) return res.status(404).json({ error: "Customer not found." });
    res.json({ services: customer.services || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load bookings." });
  }
});

// POST /api/customers/me/bookings
router.post("/me/bookings", authCustomer, async (req, res) => {
  try {
    const { service, phone, address, payment, requestId, providerEmail, name, date, status } =
      req.body;

    if (!service || !phone || !address || !payment) {
      return res.status(400).json({ error: "Service, phone, address and payment are required." });
    }

    const customer = await Customer.findOne({ email: req.customer.email });
    if (!customer) return res.status(404).json({ error: "Customer not found." });

    const booking = {
      requestId: requestId || `#REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      service,
      phone,
      address,
      payment,
      status: status || "Awaiting Action",
      date: date || new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }),
      providerEmail: providerEmail || "",
      name: name || customer.name
    };

    customer.services.unshift(booking);
    await customer.save();

    res.status(201).json({
      booking,
      order: {
        id: booking.requestId,
        service: booking.service,
        status: booking.status,
        date: booking.date,
        name: booking.name,
        phone: booking.phone,
        address: booking.address,
        payment: booking.payment,
        customerEmail: customer.email,
        providerEmail: booking.providerEmail
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save booking." });
  }
});

module.exports = router;
