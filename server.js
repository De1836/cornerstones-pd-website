const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Anon Key. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  process.exit(0);
});

// Get all submissions
app.get('/api/submissions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('survey_responses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Submit new survey
app.post('/api/submit', async (req, res) => {
  try {
    const { consentParticipate, ...rest } = req.body;
    
    // Create a new item with all form data in the responses JSONB column
    const newItem = {
      consentParticipate: Boolean(consentParticipate), // Store this as a top-level field if needed
      responses: {
        ...req.body,
        created_at: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('survey_responses')
      .insert([newItem])
      .select();

    if (error) throw error;
    
    res.status(201).json({ 
      success: true, 
      id: data?.[0]?.id 
    });
  } catch (err) {
    console.error('Error saving submission:', err);
    res.status(500).json({ 
      error: 'Failed to save submission',
      details: err.message 
    });
  }
});

// Delete all submissions (for testing/cleanup)
app.delete('/api/submissions', async (req, res) => {
  try {
    const { error } = await supabase
      .from('survey_responses')
      .delete()
      .neq('id', 0); // Delete all records

    if (error) throw error;
    
    res.json({ 
      success: true, 
      message: 'All submissions cleared' 
    });
  } catch (err) {
    console.error('Error clearing submissions:', err);
    res.status(500).json({ 
      error: 'Failed to clear submissions',
      details: err.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Survey server listening on http://localhost:${PORT}`);
  console.log('Using Supabase as the database');
});
