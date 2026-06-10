# Customer Engagement Platform (CEP)

## Project structure

- `frontend/` — customer portal UI (`index.html`)
- `backend/` — Node.js API, Gmail OTP, MongoDB

## Setup

### 1. MongoDB

Install and run MongoDB locally (default: `mongodb://127.0.0.1:27017/cep`).

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: MONGODB_URI, GMAIL_USER, GMAIL_APP_PASSWORD, JWT_SECRET
npm install
npm start
```

API: http://localhost:5000  
Frontend (served by API): http://localhost:5000/

### 3. Gmail OTP

1. Use a Gmail account for `GMAIL_USER`.
2. Enable 2-Step Verification on Google Account.
3. Create an [App Password](https://myaccount.google.com/apppasswords) and set `GMAIL_APP_PASSWORD` in `.env`.

If Gmail is not configured, OTP is printed in the backend console (dev fallback).

## Customer auth (Gmail only)

- **Sign up**: name + `@gmail.com` + password → OTP email → verify → account stored in MongoDB (hashed password).
- **Login**: only verified Gmail customers use the API; admin/providers use demo accounts (`admin@cep.com` / `password`, etc.).
- **Forgot password**: OTP to registered Gmail → set new password in MongoDB.

## Service bookings

When a logged-in customer books a service, details (service, phone, address, payment) are saved on their MongoDB customer document.

## Demo logins (local, not MongoDB)

| Email | Password | Role |
|-------|----------|------|
| admin@cep.com | password | Admin |
| customer@cep.com | password | Customer (demo) |
| sujit@cep.com | password | Provider |

New customers must register with a real Gmail address via Sign Up.
