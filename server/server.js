const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');

// התחל את i18next לפני הטעינה של המודלים
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
      loadPath: path.join(__dirname, './locales/{{lng}}/{{ns}}.json'),
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

// רק עכשיו טען את המודלים והנתיבים
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes'); 

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
if (!MONGO_URI) {
    console.error('MONGO_URI is not defined in environment variables. Check your .env file.');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// הוסף את middleware של i18n
app.use(middleware.handle(i18next));

mongoose.connect(MONGO_URI)
.then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
})
.catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

app.get('/', (req, res) => {
    res.send('API is running...');
});