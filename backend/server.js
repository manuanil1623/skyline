require('dotenv').config();
const express = require('express');
const cors = require('cors');

const servicesRoutes = require('./routes/services');
const transactionsRoutes = require('./routes/transactions');
const dashboardRoutes = require('./routes/dashboard');
const staffRoutes = require('./routes/staff');

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------------------------------------------------
// API ROUTE STRUCTURE
// -----------------------------------------------------------------------
// /api/services          GET (all staff) · POST/PATCH/DELETE (admin)
// /api/transactions       POST (create bill) · GET /today (handler ledger)
// /api/transactions       GET (admin audit log, filterable)
// /api/transactions/:id   PATCH (admin edit) · POST /:id/confirm (handler)
// /api/transactions/:id/void   POST (admin void with reason)
// /api/transactions/webhooks/upi-confirm  POST (payment gateway webhook)
// /api/dashboard/summary  GET (admin: today/week/month totals)
// /api/dashboard/revenue  GET (admin: daily/weekly/monthly series)
// /api/dashboard/payment-breakdown  GET (admin: cash vs card vs QR)
// /api/staff              GET/POST (admin) · PATCH/DELETE /:id (admin)
// -----------------------------------------------------------------------
app.use('/api/services', servicesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/staff', staffRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Beauty Parlor API running on :${PORT}`));
