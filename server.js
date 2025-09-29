const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://cornerstones-pd-website.vercel.app',
  'https://cornerstones-pd-website-*.vercel.app'
];

// CORS middleware with proper headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.some(allowed => origin && origin.startsWith(allowed.replace('*', '')))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  }
  next();
});

// Enable CORS for all routes
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed.replace('*', '')))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Middleware
app.use(express.json());
// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

// Test Supabase connection
async function testSupabase() {
  console.log('Testing Supabase connection...');
  const { data, error } = await supabase
    .from('survey_responses')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('❌ Supabase connection error:', error);
  } else {
    console.log('✅ Successfully connected to Supabase');
  }
}

testSupabase();

// API Route to get all submissions
app.get('/api/submissions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('survey_responses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return res.status(200).json(data || []);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch submissions',
      details: error.message 
    });
  }
});

// API Route for form submission
app.post('/api/submit', async (req, res) => {
  console.log('\n=== New Form Submission ===');
  
  try {
    const { consentParticipate, ...rest } = req.body;
    
    const newItem = {
      consent_participate: consentParticipate === 'Yes',
      responses: {
        ...req.body,
        created_at: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };

    console.log('Data to insert:', JSON.stringify(newItem, null, 2));
    
    const { data, error } = await supabase
      .from('survey_responses')
      .insert([newItem])
      .select();

    if (error) {
      console.error('❌ Supabase insert error:', error);
      return res.status(400).json({ 
        success: false,
        error: error.message,
        details: error.details || 'No additional details'
      });
    }
    
    console.log('✅ Insert successful:', data);
    return res.status(201).json({ 
      success: true, 
      id: data?.[0]?.id,
      data: data[0]
    });

  } catch (err) {
    console.error('❌ Server error:', {
      message: err.message,
      stack: err.stack
    });
    return res.status(500).json({ 
      success: false,
      error: 'Failed to save submission',
      details: err.message
    });
  }
});

// API Route to clear all submissions
app.delete('/api/submissions', async (req, res) => {
  try {
    const { error } = await supabase
      .from('survey_responses')
      .delete()
      .neq('id', 0); // Delete all records (workaround for RLS if enabled)

    if (error) throw error;
    
    return res.status(200).json({ success: true, message: 'All submissions cleared' });
  } catch (error) {
    console.error('Error clearing submissions:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to clear submissions',
      details: error.message 
    });
  }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all route for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// For Vercel
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}