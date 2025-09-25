// api/send-password-reset.js
// SendGrid-powered password reset email endpoint
// Reference: blueprint:javascript_sendgrid integration

const { MailService } = require('@sendgrid/mail');

if (!process.env.SENDGRID_API_KEY) {
  console.error("⚠️ SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

// Professional password reset email template
function createPasswordResetEmail(userEmail, resetLink) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Unhinged Password</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0e0e12; color: #ffffff; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 30px 0; border-bottom: 1px solid #2a2a2a; }
    .logo { font-size: 28px; font-weight: 800; color: #E11D2A; margin-bottom: 8px; }
    .tagline { font-size: 14px; color: #cfd0de; }
    .content { padding: 40px 0; }
    .title { font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #ffffff; }
    .message { font-size: 16px; line-height: 1.6; color: #cfd0de; margin-bottom: 30px; }
    .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #E11D2A, #ff4757); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; }
    .button:hover { background: linear-gradient(135deg, #c41e3a, #e11d2a); }
    .footer { padding-top: 30px; border-top: 1px solid #2a2a2a; text-align: center; }
    .footer-text { font-size: 12px; color: #888; line-height: 1.5; }
    .warning { background: #2a1f1f; border: 1px solid #4a2c2c; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .warning-text { font-size: 14px; color: #ff8e8e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Unhinged</div>
      <div class="tagline">Modern Dating Without the Games</div>
    </div>
    
    <div class="content">
      <h1 class="title">Reset Your Password</h1>
      
      <p class="message">
        We received a request to reset your password for your Unhinged account. 
        If you made this request, click the button below to create a new password.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" class="button">Reset My Password</a>
      </div>
      
      <div class="warning">
        <p class="warning-text">
          🔒 <strong>Security Notice:</strong> This link will expire in 1 hour for your security. 
          If you didn't request this reset, you can safely ignore this email.
        </p>
      </div>
      
      <p class="message">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${resetLink}" style="color: #9ecbff; word-break: break-all;">${resetLink}</a>
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">
        This email was sent by Unhinged Dating Platform<br>
        If you have questions, contact our support team<br>
        <br>
        © 2025 Unhinged. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Reset Your Unhinged Password

We received a request to reset your password for your Unhinged account.

Reset Link: ${resetLink}

This link will expire in 1 hour for your security.

If you didn't request this reset, you can safely ignore this email.

© 2025 Unhinged. All rights reserved.
`;

  return { html, text };
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { email, resetLink } = req.body;

    if (!email || !resetLink) {
      res.status(400).json({ 
        success: false, 
        error: 'Email and reset link are required' 
      });
      return;
    }

    if (!process.env.SENDGRID_API_KEY) {
      console.error('❌ SENDGRID_API_KEY not configured');
      res.status(500).json({ 
        success: false, 
        error: 'Email service not configured' 
      });
      return;
    }

    // Generate email content
    const emailContent = createPasswordResetEmail(email, resetLink);

    // Send email via SendGrid
    const msg = {
      to: email,
      from: 'noreply@unhinged.app', // Should be verified sender in SendGrid
      subject: '🔒 Reset Your Unhinged Password',
      text: emailContent.text,
      html: emailContent.html,
    };

    await mailService.send(msg);

    console.log(`✅ Password reset email sent to: ${email}`);
    
    res.status(200).json({ 
      success: true, 
      message: 'Password reset email sent successfully' 
    });

  } catch (error) {
    console.error('❌ SendGrid error:', error);
    
    // Handle common SendGrid errors
    let errorMessage = 'Failed to send password reset email';
    if (error.code === 401) {
      errorMessage = 'Email service authentication failed';
    } else if (error.code === 403) {
      errorMessage = 'Email service access denied';
    } else if (error.message?.includes('does not contain a valid address')) {
      errorMessage = 'Invalid email address';
    }

    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
};