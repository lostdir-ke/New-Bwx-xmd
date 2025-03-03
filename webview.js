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
    startTime: new Date().toLocaleString(),
    botStatus: 'Online' // Add the missing botStatus variable
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

// Track keepalive statistics
const keepaliveStats = {
  status: 'Active',
  pingCount: 0,
  lastPing: null,
  startTime: new Date()
};

// Setup keepalive system
function setupKeepAlive() {
  // Self-ping every 5 minutes to keep the repl alive
  setInterval(() => {
    http.get(`http://0.0.0.0:${PORT}/ping`, (res) => {
      keepaliveStats.pingCount++;
      keepaliveStats.lastPing = new Date();
      console.log(`[KeepAlive] Pinged server. Status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error('[KeepAlive] Ping failed:', err.message);
    });
  }, 5 * 60 * 1000); // 5 minutes

  console.log('[KeepAlive] System activated. Pinging every 5 minutes.');
}

// Activate keepalive system
setupKeepAlive();

module.exports = { server, keepaliveStats };