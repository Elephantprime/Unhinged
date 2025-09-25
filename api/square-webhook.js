
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature
    const signature = req.headers['x-square-signature'];
    const body = JSON.stringify(req.body);
    const webhookSecret = process.env.SQUARE_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('base64');

      if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { type, data } = req.body;

    switch (type) {
      case 'payment.created':
        console.log('Payment created:', data.object.payment);
        // Here you can update your database with payment info
        break;
      
      case 'payment.updated':
        console.log('Payment updated:', data.object.payment);
        // Handle payment status changes
        break;
      
      case 'order.created':
        console.log('Order created:', data.object.order);
        break;
      
      case 'order.updated':
        console.log('Order updated:', data.object.order);
        break;
      
      default:
        console.log('Unhandled webhook type:', type);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
