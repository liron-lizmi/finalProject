/**
 * db.js - MongoDB Database Connection
 *
 * Establishes connection to MongoDB using Mongoose.
 * Connection string is read from MONGO_URI environment variable.
 *
 * Usage:
 * - connectDB(): Async function that connects to MongoDB
 * - Returns mongoose connection on success
 * - Exits process with code 1 on connection failure
 *
 * Configuration:
 * - useNewUrlParser: true - uses new MongoDB connection string parser
 * - useUnifiedTopology: true - uses new server discovery and monitoring engine
 */

const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    return conn;
  } catch (error) {
    process.exit(1);
  }
};

module.exports = connectDB;