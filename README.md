# Kitale Festival Website

Responsive full-stack website for Kitale Festival with:

- Home, About, Sponsors, Ticket Booking, Participant Registration, Updates, and Contact sections
- Dynamic sponsors loaded from SQLite database, with add/update API for daily updates
- Ticket booking with multiple ticket types and Stripe payment integration (or simulated fallback)
- Participant registration and contact form submissions stored in SQLite database

## Run

```bash
npm install
npm start
```

Open http://localhost:3000

## Environment variables

- `PORT` (optional)
- `STRIPE_SECRET_KEY` (optional, enables live PaymentIntent creation)
