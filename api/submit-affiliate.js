
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, name, email, website, channel, strategy, timestamp } = req.body;

    // Log submission (you can replace with database storage)
    console.log('Affiliate submission:', {
      type,
      name,
      email,
      website,
      channel,
      strategy,
      timestamp
    });

    // Here you would typically:
    // 1. Save to database
    // 2. Send notification emails
    // 3. Generate affiliate tracking codes

    res.status(200).json({ 
      success: true, 
      message: 'Affiliate submission received successfully' 
    });
  } catch (error) {
    console.error('Affiliate submission error:', error);
    res.status(500).json({ error: 'Failed to process submission' });
  }
}
