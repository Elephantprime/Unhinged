const { Client, Environment } = require('square');
const crypto = require('crypto');

module.exports = async function createCheckout(req, res) {
  try {
    console.log('🔷 Creating Square checkout session...');

    // Get environment variables
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    const environment = process.env.SQUARE_ENVIRONMENT === 'production' ? Environment.Production : Environment.Sandbox;

    if (!accessToken || !locationId) {
      console.error('❌ Missing Square credentials');
      return res.status(500).json({ error: 'Square configuration missing' });
    }

    // Initialize Square client
    const client = new Client({
      accessToken: accessToken,
      environment: environment
    });

    const checkoutApi = client.checkoutApi;

    // Get the base URL for redirect
    const baseUrl = req.get('host').includes('localhost') 
      ? `http://${req.get('host')}` 
      : `https://${req.get('host')}`;

    // Create checkout request
    const response = await checkoutApi.createCheckout(locationId, {
      idempotencyKey: crypto.randomUUID(),
      order: {
        order: {
          locationId: locationId,
          lineItems: [
            {
              name: 'UNHINGED Premium Access',
              quantity: '1',
              basePriceMoney: {
                amount: 500, // $5.00 USD
                currency: 'USD'
              }
            }
          ]
        }
      },
      redirectUrl: `${baseUrl}/thankyou.html`
    });

    console.log('✅ Square checkout created successfully');

    // Redirect to Square checkout page
    res.redirect(response.result.checkout.checkoutPageUrl);

  } catch (error) {
    console.error('❌ Square checkout error:', error);
    
    // Return detailed error for debugging
    res.status(500).json({
      error: 'Checkout failed',
      details: error.message,
      debug: {
        squareError: true,
        errorType: error.name || 'Unknown',
        message: error.message || 'No error message'
      }
    });
  }
};
