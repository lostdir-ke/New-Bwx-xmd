
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
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
    botName: config.BOT || 'BMW_MD',
    ownerName: config.OWNER_NAME || 'Ibrahim Adams',
    botStatus: 'Online',
    startTime: new Date().toISOString()
  });
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

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Webview server running on port ${PORT}`);
});

module.exports = { server };
