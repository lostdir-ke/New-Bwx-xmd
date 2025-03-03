'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config'); // Added to access config variables
const app = express();
const PORT = process.env.PORT || 3000;

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'webview/views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'webview/public')));

// Root route
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'BWM XMD WhatsApp Bot',
    botName: config.BOT || 'BWM XMD Bot', // Use config variable if available
    ownerName: config.OWNER_NAME || 'Ibrahim Adams', // Use config variable if available
    botStatus: 'Online',
    startTime: new Date().toISOString() // Added to match original code structure
  });
});

// Keepalive ping endpoint
app.get('/ping', (req, res) => {
  const pingHtmlPath = path.join(__dirname, 'webview/public/ping.html');

  // Check if the HTML file exists
  if (fs.existsSync(pingHtmlPath)) {
    res.sendFile(pingHtmlPath);
  } else {
    res.status(200).json({ 
      status: 'active', 
      timestamp: new Date().toISOString(),
      message: 'Bot is running'
    });
  }

  // Log ping access
  console.log(`Ping request received at ${new Date().toLocaleString()}`);
});

// Create data directory if it doesn't exist
const xmdDir = path.join(__dirname, 'xmd');
if (!fs.existsSync(xmdDir)) {
  fs.mkdirSync(xmdDir, { recursive: true });
}

// Status API route (from original code)
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    botName: config.BOT || 'BMW_MD',
    ownerName: config.OWNER_NAME || 'Ibrahim Adams',
    uptime: process.uptime()
  });
});


// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Webview server running on port ${PORT}`);
});

module.exports = { server }; // Maintained from original code