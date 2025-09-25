import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Load CORS configuration
let corsOptions = {};
try {
  const corsConfig = JSON.parse(fs.readFileSync('./cors.json', 'utf8'));
  if (corsConfig && corsConfig.length > 0) {
    corsOptions = {
      origin: corsConfig[0].origin,
      methods: corsConfig[0].method,
      maxAge: corsConfig[0].maxAgeSeconds
    };
  }
} catch (error) {
  console.log('Using default CORS settings');
}

// CRITICAL FIX: Add request logging to verify traffic
app.use((req, res, next) => {
  console.log('HTTP', req.method, req.url);
  next();
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory with AGGRESSIVE cache busting
app.use(express.static('public', {
  setHeaders: (res, path, stat) => {
    // AGGRESSIVE cache busting for ALL files to force browser refresh
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.setHeader('ETag', Date.now().toString());
  }
}));

// CRITICAL FIX: Redirect root to profile.html for avatar contamination testing
app.get('/', (req, res) => res.redirect(302, '/profile.html'));

// Client beacon to confirm JavaScript execution
app.post('/__client-boot', (req, res) => {
  console.log('🚀 CLIENT BOOT beacon received - JavaScript is executing!');
  res.sendStatus(204);
});

// Raw body parser for webhooks
app.use('/api/square-webhook', express.raw({ type: 'application/json' }));

// API routes
app.use('/api/create-checkout', async (req, res) => {
  try {
    const checkoutRoute = await import('./api/create-checkout.cjs');
    await checkoutRoute.default(req, res);
  } catch (error) {
    console.error('Server route error:', error);
    res.status(500).json({
      error: 'Server route error: ' + error.message,
      debug: {
        serverError: true,
        message: error.message
      }
    });
  }
});

app.use('/api/health', async (req, res) => {
  try {
    const { default: handler } = await import('./api/health.js');
    handler(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/api/pay', async (req, res) => {
  try {
    const handler = await import('./api/pay.js');
    await handler.default(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/api/square-webhook', async (req, res) => {
  try {
    const handler = await import('./api/square-webhook.js');
    await handler.default(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/api/submit-investor', async (req, res) => {
  try {
    const { default: handler } = await import('./api/submit-investor.js');
    handler(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/api/submit-affiliate', async (req, res) => {
  try {
    const { default: handler } = await import('./api/submit-affiliate.js');
    handler(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/api/submit-advertising', async (req, res) => {
  try {
    const { default: handler } = await import('./api/submit-advertising.js');
    handler(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Added Permissions-Policy header
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Permissions-Policy', 'camera=*; microphone=*; clipboard-read=*; clipboard-write=*');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Catch all handler for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Enhanced server startup with Replit-allowed port fallback
const allowedPorts = [5000, 3000, 3001, 3002, 3003, 8000, 8080, 6000];

function startServer(portIndex = 0) {
  const port = allowedPorts[portIndex];
  if (!port) {
    console.error('❌ Could not find any available allowed port');
    process.exit(1);
    return;
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Matching App Server running on http://0.0.0.0:${port}`);
    console.log('✅ Server ready for testing profile modal fixes!');
    console.log(`📱 Access the matching app at: http://0.0.0.0:${port}/profile.html`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`❌ Port ${port} is in use, trying next allowed port...`);
      server.close();
      startServer(portIndex + 1);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
}

// Start server with allowed port fallback
startServer(0);
