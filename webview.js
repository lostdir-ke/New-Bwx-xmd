const express = require('express');
const path = require('path');
const http = require('http');
const config = require('./config');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'webview/public')));

// Set view engine
app.set('views', path.join(__dirname, 'webview/views'));
app.set('view engine', 'ejs');

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Main route
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'BWM XMD Dashboard',
    botName: config.BOT || 'BMW_MD',
    ownerName: config.OWNER_NAME || 'Ibrahim Adams',
    uptime: getUptime(),
    startTime: new Date().toLocaleString()
  });
});

// Ping endpoint for keepalive
app.get('/ping', (req, res) => {
  res.sendFile(path.join(__dirname, 'webview/public/ping.html'));
});


// Status API route
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    botName: config.BOT || 'BMW_MD',
    ownerName: config.OWNER_NAME || 'Ibrahim Adams',
    uptime: process.uptime()
  });
});

// Function to calculate uptime
function getUptime() {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Webview running on port ${PORT}`);
});

// Setup keepalive status endpoint
app.get('/keepalive-status', (req, res) => {
  try {
    // Import the keepalive stats
    const { keepaliveStats } = require('./scs/keepalive');
    
    // Add uptime info
    const uptime = getUptime();
    const stats = {
      ...keepaliveStats,
      uptime: uptime
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error serving keepalive status:', error);
    res.status(500).json({ error: 'Failed to retrieve keepalive status' });
  }
});

// Setup keepalive system
function setupKeepAlive() {
  // Self-ping every 5 minutes to keep the repl alive
  setInterval(() => {
    // HTTP ping
    http.get(`http://0.0.0.0:${PORT}/ping`, (res) => {
      console.log(`[KeepAlive] Pinged server. Status: ${res.statusCode}`);
      
      // Update ping.html stats via API
      try {
        const stats = require('./scs/keepalive').keepaliveStats;
        global.keepaliveData = {
          pingCount: stats.pingCount,
          lastPing: stats.lastPing,
          shellPings: stats.shellPings,
          status: stats.status,
          interval: stats.interval
        };
      } catch (err) {
        console.error('[KeepAlive] Error updating stats:', err.message);
      }
    }).on('error', (err) => {
      console.error('[KeepAlive] Ping failed:', err.message);
    });
  }, 5 * 60 * 1000); // 5 minutes

  // Create a status endpoint for the keepalive system
  app.get('/keepalive-status', (req, res) => {
    res.json(global.keepaliveData || {
      status: 'Active',
      pingCount: 0,
      lastPing: new Date(),
      shellPings: 0,
      interval: 5
    });
  });

  console.log('[KeepAlive] Webview system activated. Pinging every 5 minutes.');
}

// Activate keepalive system
setupKeepAlive();

module.exports = { server };