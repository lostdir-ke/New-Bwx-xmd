
# BMW_MD Bot Webview

This is a simple web dashboard for the BMW_MD WhatsApp bot. The webview provides a status page showing information about the bot's current state.

## Features

- Real-time bot status monitoring
- Uptime tracking
- Overview of bot features
- Responsive design for mobile and desktop

## How to Access

The webview is accessible at port 3000 when the bot is running.

## Structure

- `webview.js` - Express server that handles the webview
- `webview/views/` - EJS templates for the UI
- `webview/public/` - Static assets (CSS, JavaScript, images)

## Note

This webview runs in parallel with the WhatsApp bot and doesn't interfere with its normal operation.
