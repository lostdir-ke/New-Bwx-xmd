
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");

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

// Command to get the web dashboard URL
adams({ nomCom: "weburl", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre } = commandeOptions;
    
    try {
        const dashboardUrl = getServerUrl();
        
        const message = `🌐 *Web Dashboard URL*\n\n` +
                       `${dashboardUrl}\n\n` +
                       `Visit this URL to access the BWM XMD Dashboard.`;
        
        repondre(message);
    } catch (error) {
        console.error('Error getting web URL:', error);
        repondre('❌ Error generating web URL. Please try again later.');
    }
});
