
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, company, contact, email, adType, budget, details, timestamp } = req.body;

    // Log submission (you can replace with database storage)
    console.log('Advertising submission:', {
      type,
      company,
      contact,
      email,
      adType,
      budget,
      details,
      timestamp
    });

    // Here you would typically:
    // 1. Save to database
    // 2. Send notification emails
    // 3. Create advertising proposal

    res.status(200).json({ 
      success: true, 
      message: 'Advertising submission received successfully' 
    });
  } catch (error) {
    console.error('Advertising submission error:', error);
    res.status(500).json({ error: 'Failed to process submission' });
  }
}
