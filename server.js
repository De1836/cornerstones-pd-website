app.post('/api/submit', async (req, res) => {
  console.log('=== New Form Submission ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { consentParticipate, ...rest } = req.body;
    
    const newItem = {
      consent_participate: consentParticipate === 'Yes',  // Changed to match form value
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
      stack: err.stack
    });
    return res.status(500).json({ 
      error: 'Failed to save submission',
      details: err.message
    });
  }
});