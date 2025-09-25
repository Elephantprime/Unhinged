const { Client } = require('square');

module.exports = async function handler(req, res) {
  // Set CORS headers
  const allowed = new Set([
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:5173",
    "https://unhinged-8c6da.web.app",
    "https://unhinged-8c6da.firebaseapp.com",
    "https://unhinged.app",
    "https://uh-iota.vercel.app"
  ]);

  const origin = req.headers.origin;
  const allowOrigin = origin && allowed.has(origin) ? origin : "https://uh-iota.vercel.app";

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Initialize Square client
    const client = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: 'sandbox',
      applicationId: process.env.SQUARE_APPLICATION_ID
    });

    const checkoutApi = client.checkoutApi;

    // Create checkout request
    const request = {
      idempotencyKey: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      order: {
        locationId: process.env.SQUARE_LOCATION_ID,
        orderSource: {
          name: 'Unhinged Dating App'
        },
        lineItems: [
          {
            name: 'Donation',
            quantity: '1',
            itemType: 'ITEM',
            basePriceMoney: {
              amount: BigInt(Math.round(amount * 100)), // Convert to cents
              currency: 'USD'
            }
          }
        ]
      },
      paymentOptions: {
        autocomplete: true,
        acceptPartialAuthorization: false
      },
      redirectUrl: `${origin}/thank-you.html?success=true`
    };

    const response = await checkoutApi.createPaymentLink(request);

    if (response.result.paymentLink) {
      res.status(200).json({
        success: true,
        checkoutUrl: response.result.paymentLink.url
      });
    } else {
      throw new Error('No payment link returned');
    }

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({
      error: 'Payment processing failed: ' + error.message,
      debug: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        hasAccessToken: !!process.env.SQUARE_ACCESS_TOKEN,
        hasLocationId: !!process.env.SQUARE_LOCATION_ID,
        environment: process.env.NODE_ENV === 'production' ? 'Production' : 'Sandbox'
      },
      success: false
    });
  }
};