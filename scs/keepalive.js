
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const http = require('http');

// Path for storing keepalive configuration
const keepaliveConfigPath = path.join(__dirname, '../xmd/keepalive_config.json');

// Initialize configuration if it doesn't exist
if (!fs.existsSync(keepaliveConfigPath)) {
    fs.writeFileSync(keepaliveConfigPath, JSON.stringify({
        isActive: false,
        interval: 5, // minutes
        lastPing: null,
        pingUrl: null,
        startedBy: null,
        startedAt: null
    }, null, 2));
}

// Function to load keepalive configuration
function loadKeepAliveConfig() {
    try {
        return JSON.parse(fs.readFileSync(keepaliveConfigPath, 'utf8'));
    } catch (error) {
        console.error('Error loading keepalive config:', error);
        return {
            isActive: false,
            interval: 5,
            lastPing: null,
            pingUrl: null,
            startedBy: null,
            startedAt: null
        };
    }
}

// Function to save keepalive configuration
function saveKeepAliveConfig(config) {
    try {
        fs.writeFileSync(keepaliveConfigPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving keepalive config:', error);
        return false;
    }
}

// Global variable to store the interval
let keepAliveInterval = null;

// Function to stop the keepalive process
function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        
        const config = loadKeepAliveConfig();
        config.isActive = false;
        config.lastPing = null;
        saveKeepAliveConfig(config);
        
        return true;
    }
    return false;
}

// Function to start the keepalive process
function startKeepAlive(pingUrl, intervalMinutes, startedBy) {
    // Stop any existing process
    stopKeepAlive();
    
    // Update configuration
    const config = loadKeepAliveConfig();
    config.isActive = true;
    config.interval = intervalMinutes;
    config.pingUrl = pingUrl;
    config.startedBy = startedBy;
    config.startedAt = new Date().toISOString();
    config.lastPing = null;
    saveKeepAliveConfig(config);
    
    // Start the interval
    keepAliveInterval = setInterval(async () => {
        try {
            const currentConfig = loadKeepAliveConfig();
            if (!currentConfig.isActive) {
                clearInterval(keepAliveInterval);
                keepAliveInterval = null;
                return;
            }
            
            // Make a request to the ping URL
            if (currentConfig.pingUrl) {
                const response = await axios.get(currentConfig.pingUrl);
                console.log(`Keepalive ping sent to ${currentConfig.pingUrl} with status: ${response.status}`);
            } else {
                // Self ping if no URL is provided
                http.get(`http://0.0.0.0:${process.env.PORT || 3000}/ping`, (res) => {
                    console.log(`Keepalive self-ping status: ${res.statusCode}`);
                }).on('error', (err) => {
                    console.error('Keepalive self-ping error:', err.message);
                });
            }
            
            // Update last ping time
            currentConfig.lastPing = new Date().toISOString();
            saveKeepAliveConfig(currentConfig);
        } catch (error) {
            console.error('Error in keepalive process:', error);
        }
    }, intervalMinutes * 60 * 1000);
    
    return true;
}

// Command to manage keepalive process
adams({ nomCom: "keepalive", categorie: "System" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg, superUser } = commandeOptions;
    
    // Load current configuration
    const config = loadKeepAliveConfig();
    
    // Parse command arguments
    const subCommand = arg[0]?.toLowerCase();
    
    // Display status if no subcommand is provided
    if (!subCommand) {
        if (config.isActive) {
            const startedAt = new Date(config.startedAt);
            const lastPing = config.lastPing ? new Date(config.lastPing) : null;
            const now = new Date();
            const uptime = Math.floor((now - startedAt) / (1000 * 60)); // minutes
            
            return repondre(`✅ *Keepalive Status: ACTIVE*\n\n` +
                           `• Interval: Every ${config.interval} minutes\n` +
                           `• Started by: ${config.startedBy || "Unknown"}\n` +
                           `• Started at: ${startedAt.toLocaleString()}\n` +
                           `• Running for: ${uptime} minutes\n` +
                           `• Last ping: ${lastPing ? lastPing.toLocaleString() : "None yet"}\n` +
                           `• Ping URL: ${config.pingUrl || "Self-ping"}\n\n` +
                           `Use *.keepalive stop* to stop the keepalive process.`);
        } else {
            return repondre(`❌ *Keepalive Status: INACTIVE*\n\n` +
                           `Use *.keepalive start [interval] [url]* to start.\n\n` +
                           `Example: *.keepalive start 5*\n` +
                           `This will ping every 5 minutes.`);
        }
    }
    
    // Only allow the bot owner to use administrative functions
    if (subCommand !== "status" && !superUser) {
        return repondre("❌ Only the bot owner can start or stop the keepalive process.");
    }
    
    // Handle subcommands
    switch (subCommand) {
        case "start":
            const interval = parseInt(arg[1]) || 5; // Default to 5 minutes
            const url = arg[2] || null; // Optional ping URL
            
            if (interval < 1) {
                return repondre("❌ Interval must be at least 1 minute.");
            }
            
            const senderJid = ms.sender;
            const senderName = senderJid.split('@')[0];
            
            if (startKeepAlive(url, interval, senderName)) {
                return repondre(`✅ Keepalive process started!\n\n` +
                               `• Interval: Every ${interval} minutes\n` +
                               `• Ping URL: ${url || "Self-ping"}\n\n` +
                               `Your bot will now stay awake 24/7. To check status use *.keepalive* and to stop use *.keepalive stop*.`);
            } else {
                return repondre("❌ Failed to start keepalive process. Please try again.");
            }
            break;
            
        case "stop":
            if (stopKeepAlive()) {
                return repondre("✅ Keepalive process stopped successfully.");
            } else {
                return repondre("❌ No active keepalive process found.");
            }
            break;
            
        case "status":
            if (config.isActive) {
                const startedAt = new Date(config.startedAt);
                const lastPing = config.lastPing ? new Date(config.lastPing) : null;
                const now = new Date();
                const uptime = Math.floor((now - startedAt) / (1000 * 60)); // minutes
                
                return repondre(`✅ *Keepalive Status: ACTIVE*\n\n` +
                               `• Interval: Every ${config.interval} minutes\n` +
                               `• Started by: ${config.startedBy || "Unknown"}\n` +
                               `• Started at: ${startedAt.toLocaleString()}\n` +
                               `• Running for: ${uptime} minutes\n` +
                               `• Last ping: ${lastPing ? lastPing.toLocaleString() : "None yet"}\n` +
                               `• Ping URL: ${config.pingUrl || "Self-ping"}\n\n` +
                               `Use *.keepalive stop* to stop the keepalive process.`);
            } else {
                return repondre("❌ Keepalive is currently inactive. Use *.keepalive start* to activate it.");
            }
            break;
            
        default:
            return repondre(`❓ Unknown subcommand: ${subCommand}\n\n` +
                           `Available commands:\n` +
                           `• *.keepalive* - Check status\n` +
                           `• *.keepalive start [interval] [url]* - Start keepalive\n` +
                           `• *.keepalive stop* - Stop keepalive\n` +
                           `• *.keepalive status* - Detailed status`);
    }
});

// Load previous configuration and restart keepalive if it was active
(function initializeKeepAlive() {
    const config = loadKeepAliveConfig();
    if (config.isActive) {
        console.log("Restarting keepalive process from previous configuration...");
        startKeepAlive(config.pingUrl, config.interval, config.startedBy);
    }
})();

// Export functions for use in other files if needed
module.exports = {
    startKeepAlive,
    stopKeepAlive,
    loadKeepAliveConfig
};
