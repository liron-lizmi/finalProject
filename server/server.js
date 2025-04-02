const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const venueRoutes = require('./routes/venueRoutes');



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

app.use('/api/venues', venueRoutes);
app.use('/api/geocode', (req, res) => {
  // שימוש בפונקציית ה-geocode מ-venueController
  require('./controllers/venueController').geocodeAddress(req, res);
});

app.get('/', (req, res) => {
    res.send('API is running...');
});

