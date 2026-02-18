const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'festival.db');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database(DB_PATH);

const ticketCatalog = {
  standard: { name: 'Standard Pass', price: 2500 },
  vip: { name: 'VIP Pass', price: 6500 },
  student: { name: 'Student Pass', price: 1500 },
  family: { name: 'Family Pass', price: 8000 }
};

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS sponsors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tier TEXT NOT NULL,
        website TEXT,
        logo_url TEXT,
        notes TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS ticket_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        ticket_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        total_amount INTEGER NOT NULL,
        payment_status TEXT NOT NULL,
        payment_reference TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS participant_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        category TEXT NOT NULL,
        talent_description TEXT,
        county TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.get('SELECT COUNT(*) AS count FROM sponsors', (err, row) => {
      if (err) {
        console.error('Failed to check sponsor count', err);
        return;
      }

      if (row.count === 0) {
        const stmt = db.prepare('INSERT INTO sponsors (name, tier, website, logo_url, notes) VALUES (?, ?, ?, ?, ?)');
        [
          ['Kitale Agro Ventures', 'Platinum', 'https://example.com/agro', 'https://placehold.co/220x120?text=Agro+Ventures', 'Sustainable farming partner'],
          ['North Rift Bank', 'Gold', 'https://example.com/bank', 'https://placehold.co/220x120?text=North+Rift+Bank', 'Official banking partner'],
          ['Savannah Foods', 'Silver', 'https://example.com/foods', 'https://placehold.co/220x120?text=Savannah+Foods', 'Refreshments and snacks sponsor']
        ].forEach((sponsor) => stmt.run(sponsor));
        stmt.finalize();
      }
    });
  });
}

initializeDatabase();

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

app.get('/api/tickets/types', (req, res) => {
  res.json(ticketCatalog);
});

app.get('/api/sponsors', async (req, res) => {
  try {
    const rows = await allAsync('SELECT * FROM sponsors ORDER BY CASE tier WHEN "Platinum" THEN 1 WHEN "Gold" THEN 2 WHEN "Silver" THEN 3 ELSE 4 END, name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load sponsors.' });
  }
});

app.post('/api/sponsors', async (req, res) => {
  const { name, tier, website, logo_url, notes } = req.body;
  if (!name || !tier) {
    return res.status(400).json({ message: 'Name and tier are required.' });
  }

  try {
    await runAsync(
      `INSERT INTO sponsors (name, tier, website, logo_url, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [name, tier, website || '', logo_url || '', notes || '']
    );
    res.status(201).json({ message: 'Sponsor added successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add sponsor.' });
  }
});

app.put('/api/sponsors/:id', async (req, res) => {
  const { id } = req.params;
  const { name, tier, website, logo_url, notes } = req.body;

  try {
    const result = await runAsync(
      `UPDATE sponsors
       SET name = ?, tier = ?, website = ?, logo_url = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [name, tier, website || '', logo_url || '', notes || '', id]
    );

    if (!result.changes) {
      return res.status(404).json({ message: 'Sponsor not found.' });
    }

    return res.json({ message: 'Sponsor updated successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update sponsor.' });
  }
});

app.post('/api/bookings', async (req, res) => {
  const { fullName, email, phone, ticketType, quantity } = req.body;
  const normalizedType = String(ticketType || '').toLowerCase();
  const qty = Number(quantity);

  if (!fullName || !email || !ticketCatalog[normalizedType] || Number.isNaN(qty) || qty < 1) {
    return res.status(400).json({ message: 'Invalid booking details.' });
  }

  const unitPrice = ticketCatalog[normalizedType].price;
  const totalAmount = unitPrice * qty;

  let paymentStatus = 'pending';
  let paymentReference = 'simulated-payment';

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'kes',
        payment_method_types: ['card'],
        receipt_email: email,
        description: `${ticketCatalog[normalizedType].name} x${qty}`
      });
      paymentStatus = 'requires_payment';
      paymentReference = paymentIntent.id;
    } catch (error) {
      return res.status(500).json({ message: 'Payment initialization failed.' });
    }
  }

  try {
    await runAsync(
      `INSERT INTO ticket_bookings
       (full_name, email, phone, ticket_type, quantity, total_amount, payment_status, payment_reference)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [fullName, email, phone || '', normalizedType, qty, totalAmount, paymentStatus, paymentReference]
    );

    return res.status(201).json({
      message: stripeKey
        ? 'Booking saved. Complete payment with the provided reference.'
        : 'Booking saved with simulated payment reference.',
      paymentReference,
      totalAmount
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save booking.' });
  }
});

app.post('/api/registrations', async (req, res) => {
  const { fullName, email, phone, category, talentDescription, county } = req.body;

  if (!fullName || !email || !category) {
    return res.status(400).json({ message: 'Full name, email, and category are required.' });
  }

  try {
    await runAsync(
      `INSERT INTO participant_registrations
       (full_name, email, phone, category, talent_description, county)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullName, email, phone || '', category, talentDescription || '', county || '']
    );
    return res.status(201).json({ message: 'Registration submitted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Registration submission failed.' });
  }
});

app.post('/api/contact', async (req, res) => {
  const { fullName, email, subject, message } = req.body;
  if (!fullName || !email || !subject || !message) {
    return res.status(400).json({ message: 'All contact fields are required.' });
  }

  try {
    await runAsync(
      `INSERT INTO contacts (full_name, email, subject, message)
       VALUES (?, ?, ?, ?)`,
      [fullName, email, subject, message]
    );
    res.status(201).json({ message: 'Message sent successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send message.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Kitale Festival site running on http://localhost:${PORT}`);
});
