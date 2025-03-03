
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const http = require('http');

// Store keepalive stats
const keepaliveStats = {
    lastPing: new Date(),
    pingCount: 0,
    status: 'Active',
    interval: 5, // minutes
    shellPings: 0
};

// Function to ping the server and write to shell
function pingServer() {
    try {
        const port = process.env.PORT || 3000;
        // HTTP ping to webview
        http.get(`http://0.0.0.0:${port}/ping`, (res) => {
            keepaliveStats.pingCount++;
            keepaliveStats.lastPing = new Date();
            keepaliveStats.status = 'Active';
            console.log(`[KeepAlive] HTTP Ping successful. Status: ${res.statusCode}`);
        }).on('error', (err) => {
            console.error('[KeepAlive] HTTP Ping failed:', err.message);
            // Continue even if HTTP ping fails
            keepaliveStats.status = 'Partial (Shell only)';
        });
        
        // Shell ping - execute a simple command to keep shell active
        exec('echo "[$(date)] KeepAlive shell ping" >> .keepalive.log', (error, stdout, stderr) => {
            if (error) {
                console.error(`[KeepAlive] Shell exec error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`[KeepAlive] Shell stderr: ${stderr}`);
                return;
            }
            keepaliveStats.shellPings++;
            console.log('[KeepAlive] Shell ping successful');
        });
    } catch (error) {
        console.error('[KeepAlive] Error in ping function:', error);
    }
}

// Set up the interval timer
let keepaliveInterval;

// Start the keepalive system
function startKeepAlive(minutes = 5) {
    // Clear existing interval if any
    if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
    }
    
    keepaliveStats.interval = minutes;
    keepaliveStats.status = 'Active';
    
    // Convert minutes to milliseconds
    const intervalMs = minutes * 60 * 1000;
    
    // Set the new interval
    keepaliveInterval = setInterval(pingServer, intervalMs);
    
    // Initial ping
    pingServer();
    
    console.log(`[KeepAlive] System activated. Pinging every ${minutes} minutes.`);
    return true;
}

// Stop the keepalive system
function stopKeepAlive() {
    if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
        keepaliveInterval = null;
        keepaliveStats.status = 'Inactive';
        console.log('[KeepAlive] System deactivated.');
        return true;
    }
    return false;
}

// Initialize keepalive on module load
startKeepAlive();

// Command to check and control the keepalive status
adams({ nomCom: "keepalive", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre } = commandeOptions;
    const arg = commandeOptions.arg || '';
    
    try {
        // Parse arguments
        const args = arg.trim().split(' ');
        const command = args[0] ? args[0].toLowerCase() : '';
        const param = args[1] ? parseInt(args[1]) : null;
        
        // Handle different commands
        if (command === 'start' || command === 'on') {
            startKeepAlive(param || 5);
            return repondre(`✅ KeepAlive system activated. Pinging every ${keepaliveStats.interval} minutes.`);
        } 
        else if (command === 'stop' || command === 'off') {
            const result = stopKeepAlive();
            return repondre(result 
                ? '✅ KeepAlive system deactivated.' 
                : '❌ KeepAlive system was not running.');
        }
        else if (command === 'interval' && param) {
            if (param < 1 || param > 60) {
                return repondre('⚠️ Interval must be between 1 and 60 minutes.');
            }
            startKeepAlive(param);
            return repondre(`✅ KeepAlive interval updated to ${param} minutes.`);
        }
        
        // Default: show status
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        const statusMessage = `🔄 *KeepAlive Status*\n\n` +
                             `• Status: *${keepaliveStats.status}*\n` +
                             `• Webview: *Running*\n` +
                             `• Bot Uptime: *${days}d ${hours}h ${minutes}m*\n` +
                             `• Ping Interval: *Every ${keepaliveStats.interval} minutes*\n` +
                             `• Last Ping: *${keepaliveStats.lastPing.toLocaleString()}*\n` +
                             `• HTTP Pings: *${keepaliveStats.pingCount}*\n` +
                             `• Shell Pings: *${keepaliveStats.shellPings}*\n\n` +
                             `*Commands:*\n` +
                             `• .keepalive start [minutes] - Start with optional interval\n` +
                             `• .keepalive stop - Stop the keepalive system\n` +
                             `• .keepalive interval [minutes] - Change ping interval\n\n` +
                             `The keepalive system prevents the bot from sleeping by pinging both HTTP and shell.`;
        
        return repondre(statusMessage);
    } catch (error) {
        console.error('Error with keepalive command:', error);
        repondre('❌ Error in keepalive system. Please try again later.');
    }
});

// Export functions for use in other modules
module.exports = {
    startKeepAlive,
    stopKeepAlive,
    keepaliveStats
};
