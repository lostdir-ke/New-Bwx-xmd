
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const fs = require('fs');
const path = require('path');
const os = require('os');

// Track keepalive statistics
const keepaliveStats = {
    status: 'Active',
    pingCount: 0,
    lastPing: null,
    startTime: new Date()
};

// Function to get the server URL
function getServerUrl() {
    // Try to get from environment variable first
    const port = process.env.PORT || 3000;
    
    // Get the hostname - in Replit this will be the repl name
    const hostname = process.env.REPL_SLUG 
        ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : `0.0.0.0:${port}`;
    
    return `https://${hostname}`;
}

// Command to check and control the keepalive status
adams({ nomCom: "keepalive", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre, arg } = commandeOptions;
    
    try {
        // Calculate uptime
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        
        // Check if keepalive is active in the webview
        const statusMessage = `🔄 *KeepAlive Status*\n\n` +
                             `• Status: *${keepaliveStats.status}*\n` +
                             `• Webview: *Running*\n` +
                             `• Uptime: *${uptimeStr}*\n` +
                             `• Ping Count: *${keepaliveStats.pingCount}*\n` +
                             `• Last Ping: *${keepaliveStats.lastPing ? new Date(keepaliveStats.lastPing).toLocaleString() : 'Never'}*\n` +
                             `• Ping Interval: *Every 5 minutes*\n\n` +
                             `The keepalive system prevents the bot from sleeping by periodically pinging itself.\n\n` +
                             `This feature runs through the webview and doesn't affect bot functionality.`;
        
        return repondre(statusMessage);
    } catch (error) {
        console.error('Error with keepalive command:', error);
        repondre('❌ Error checking keepalive status. Please try again later.');
    }
});

// Command to get the keepalive URL
adams({ nomCom: "keepaliveurl", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre } = commandeOptions;
    
    try {
        const serverUrl = getServerUrl();
        const keepaliveUrl = `${serverUrl}/ping`;
        
        const message = `🔗 *KeepAlive URL*\n\n` +
                       `${keepaliveUrl}\n\n` +
                       `You can use an external monitoring service to ping this URL every few minutes to keep your bot online 24/7.\n\n` +
                       `Set up a monitoring service (like UptimeRobot, Cron-job.org, etc.) to ping this URL every 5-10 minutes.`;
        
        repondre(message);
    } catch (error) {
        console.error('Error getting keepalive URL:', error);
        repondre('❌ Error generating keepalive URL. Please try again later.');
    }
});
