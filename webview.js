
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs-extra');

// Create the webview directory if it doesn't exist
const webviewDir = path.join(__dirname, 'webview');
if (!fs.existsSync(webviewDir)) {
  fs.mkdirSync(webviewDir);
}

// Create a basic index.html if it doesn't exist
const indexPath = path.join(webviewDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  const defaultHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BMW_MD Webview</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #f5f7fa, #c3cfe2);
      min-height: 100vh;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background-color: white;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    }
    h1 {
      color: #333;
      text-align: center;
    }
    .logo {
      display: block;
      width: 120px;
      margin: 0 auto 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>BMW_MD Webview</h1>
    <p>This is the default webview page for BMW_MD bot. You can customize this page or create additional pages as needed.</p>
    <div id="content"></div>
  </div>
  <script>
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const pageId = urlParams.get('page');
    const userId = urlParams.get('user');
    
    if (pageId) {
      document.getElementById('content').innerHTML = `<p>Loading content for page: ${pageId}</p>`;
      // Here you can load dynamic content based on pageId
    }
  </script>
</body>
</html>`;
  fs.writeFileSync(indexPath, defaultHtml);
}

function startWebviewServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Serve static files from the webview directory
  app.use(express.static(webviewDir));
  
  // Add API routes for dynamic content
  app.get('/api/data', (req, res) => {
    res.json({
      success: true,
      message: 'API is working!',
      botName: process.env.BOT_NAME || 'BMW_MD'
    });
  });
  
  // Fallback route to serve index.html for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(webviewDir, 'index.html'));
  });

  // Start the server
  const server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Webview server running on port ${PORT}`);
  });
  
  return server;
}

module.exports = { startWebviewServer };
