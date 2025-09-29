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

app.use(express.json());

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

// API Routes
app.post('/api/submit', async (req, res) => {
  console.log('Received submission request');
  try {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { consentParticipate, ...rest } = req.body;
    
    const newItem = {
      consent_participate: Boolean(consentParticipate),
      responses: {
        ...req.body,
        created_at: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };

    console.log('Prepared data for insertion:', JSON.stringify(newItem, null, 2));
    
    const { data, error } = await supabase
      .from('survey_responses')
      .insert([newItem])
      .select();

    if (error) {
      console.error('Supabase error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    
    console.log('Insert successful:', data);
    return res.status(201).json({ 
      success: true, 
      id: data?.[0]?.id 
    });

  } catch (err) {
    console.error('Error in /api/submit:', {
      message: err.message,
      stack: err.stack,
      details: err
    });
    return res.status(500).json({ 
      error: 'Failed to save submission',
      details: err.message,
      type: err.name
    });
  }
});

// For Vercel
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // For local development
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}