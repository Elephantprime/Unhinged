
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, name, email, company, amount, message, timestamp } = req.body;

    // Log submission (you can replace with database storage)
    console.log('Investor submission:', {
      type,
      name,
      email,
      company,
      amount,
      message,
      timestamp
    });

    // Here you would typically:
    // 1. Save to database
    // 2. Send notification emails
    // 3. Add to CRM system

    res.status(200).json({ 
      success: true, 
      message: 'Investor submission received successfully' 
    });
  } catch (error) {
    console.error('Investor submission error:', error);
    res.status(500).json({ error: 'Failed to process submission' });
  }
}
