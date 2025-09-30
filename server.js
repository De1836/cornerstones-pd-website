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
  'https://cornerstones-pd-website-*.vercel.app',
  'https://cornerstones-pd-website-pcfpqqguc-de1836s-projects.vercel.app',
  'https://www.zantro.com'
];

// CORS middleware for all routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // For development, allow all origins
  if (process.env.NODE_ENV !== 'production' || 
      !origin || 
      allowedOrigins.some(allowed => origin.startsWith(allowed.replace('*', '')))) {
    
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  } else if (origin) {
    // Origin not allowed
    return res.status(403).json({ error: 'Not allowed by CORS' });
  }
  
  next();
});

// Public routes - no authentication required
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    // Don't serve admin.html as static file
    if (path.endsWith('admin.html')) {
      res.set('Cache-Control', 'no-store');
    }
  }
}));

// Serve index.html for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Public API endpoint for form submission
app.post('/api/submit', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('survey_responses')
      .insert([req.body]);

    if (error) throw error;
    
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error submitting form:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to submit form',
      details: error.message 
    });
  }
});

// Environment variables for admin credentials
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123'; // Change this in production

// Logging function for admin access
function logAdminAccess(req, success = false, message = '') {
  const timestamp = new Date().toISOString();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';
  const method = req.method;
  const url = req.originalUrl || req.url;
  const status = success ? 'SUCCESS' : 'FAILED';
  
  const logEntry = {
    timestamp,
    ip,
    userAgent,
    method,
    url,
    status,
    message
  };
  
  // Log to console
  console.log(`[${timestamp}] Admin Access - IP: ${ip}, Status: ${status}${message ? ', ' + message : ''}`);
  
  // In production, you might want to log to a file or logging service
  if (process.env.NODE_ENV === 'production') {
    // Example: Write to a log file (uncomment if needed)
    // const fs = require('fs');
    // fs.appendFileSync('admin-access.log', JSON.stringify(logEntry) + '\n');
  }
  
  return logEntry;
}

// Basic authentication middleware with logging
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  
  if (!auth) {
    logAdminAccess(req, false, 'No auth header provided');
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required');
  }

  try {
    const [username, password] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      logAdminAccess(req, true, `User ${username} authenticated successfully`);
      return next();
    }
    
    logAdminAccess(req, false, `Failed login attempt for username: ${username}`);
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication failed');
  } catch (error) {
    logAdminAccess(req, false, `Authentication error: ${error.message}`);
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication error');
  }
}

// Protected Admin Routes
app.get('/admin', requireAuth, (req, res) => {
  logAdminAccess(req, true, 'Admin page accessed successfully');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Protected API endpoints - require authentication
app.use(['/api/submissions', '/api/submissions/*'], (req, res, next) => {
  logAdminAccess(req, false, `API access attempt to ${req.path}`);
  requireAuth(req, res, next);
});

// Protect API endpoints that should be admin-only
app.get('/api/submissions', requireAuth, async (req, res) => {
  logAdminAccess(req, true, 'Accessed submissions API');
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

// Delete all submissions
app.delete('/api/submissions', requireAuth, async (req, res) => {
  logAdminAccess(req, true, 'Attempt to clear all submissions');
  try {
    const { error } = await supabase
      .from('survey_responses')
      .delete()
      .neq('id', 0);

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

// Delete a single submission
app.delete('/api/submissions/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  logAdminAccess(req, true, `Attempt to delete submission ${id}`);
  
  if (!id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Submission ID is required' 
    });
  }

  try {
    const { error } = await supabase
      .from('survey_responses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    return res.status(200).json({ 
      success: true, 
      message: 'Submission deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to delete submission',
      details: error.message 
    });
  }
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