const express = require('express');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'surveyApp';
const COLLECTION_NAME = 'submissions';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

// MongoDB connection
let db;
let client;

async function connectToMongo() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// Initialize connection when the server starts
connectToMongo();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
  process.exit(0);
});

// Get all submissions
app.get('/api/submissions', async (req, res) => {
  try {
    const collection = db.collection(COLLECTION_NAME);
    const items = await collection.find({}).toArray();
    res.json(items);
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Submit new survey
app.post('/api/submit', async (req, res) => {
  try {
    const newItem = {
      ...req.body,
      submittedAt: new Date().toISOString()
    };
    const collection = db.collection(COLLECTION_NAME);
    const result = await collection.insertOne(newItem);
    res.status(201).json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error('Error saving submission:', err);
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

// Delete all submissions (for testing/cleanup)
app.delete('/api/submissions', async (req, res) => {
  try {
    const collection = db.collection(COLLECTION_NAME);
    await collection.deleteMany({});
    res.json({ success: true, message: 'All submissions cleared' });
  } catch (err) {
    console.error('Error clearing submissions:', err);
    res.status(500).json({ error: 'Failed to clear submissions' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Survey server listening on http://localhost:${PORT}`);
});
