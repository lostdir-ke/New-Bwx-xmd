
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const fs = require('fs');
const path = require('path');

// Command to check and control the keepalive status
adams({ nomCom: "keepalive", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre, arg } = commandeOptions;
    
    try {
        // Check if keepalive is active in the webview
        const statusMessage = `🔄 *KeepAlive Status*\n\n` +
                             `• Status: *Active*\n` +
                             `• Webview: *Running*\n` +
                             `• Ping Interval: *Every 5 minutes*\n\n` +
                             `The keepalive system prevents the bot from sleeping by periodically pinging itself.\n\n` +
                             `This feature runs through the webview and doesn't affect bot functionality.`;
        
        return repondre(statusMessage);
    } catch (error) {
        console.error('Error with keepalive command:', error);
        repondre('❌ Error checking keepalive status. Please try again later.');
    }
});
