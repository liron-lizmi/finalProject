// server/sever.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');

const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: 'he',
    supportedLngs: ['he', 'en'],
    backend: {
      loadPath: path.join(__dirname, './locales/{{lng}}/translations.json'),
    },
    detection: {
      order: ['header', 'cookie', 'querystring'],
      lookupHeader: 'accept-language',
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      caches: ['cookie']
    },
    ns: ['translations'],
    defaultNS: 'translations',
  });

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes'); 
const taskRoutes = require('./routes/taskRoutes');
const rsvpRoutes = require('./routes/rsvpRoutes'); 
const budgetRoutes = require('./routes/budgetRoutes');
const ridesRoutes = require('./routes/ridesRoutes');
const venueRoutes = require('./routes/venueRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const seatingRouter = require('./routes/seatingRoutes');

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

if (!MONGO_URI) {
    console.error('MONGO_URI is not defined in environment variables. Check your .env file.');
    process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(middleware.handle(i18next));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/rsvp', rsvpRoutes); 
app.use('/api/events/:eventId/budget', budgetRoutes);
app.use('/api/rides', ridesRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/events/:eventId/vendors', vendorRoutes);
app.use('/api/events/:eventId/seating', seatingRouter);

app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/', (req, res) => {
    res.send('API is running...');
});

app.use('*', (req, res) => {
  res.status(404).json({ message: req.t('errors.routeNotFound') });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    message: req.t('errors.serverError'),
    error: process.env.NODE_ENV === 'development' ? err.message : req.t('errors.generalError')
  });
});

mongoose.connect(MONGO_URI)
.then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
})
.catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
});

module.exports = app;

