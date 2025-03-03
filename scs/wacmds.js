'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const path = require('path');

// Command to list all WhatsApp-related commands
adams({ nomCom: "wacmds", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre } = commandeOptions;

    // Define WhatsApp commands with their descriptions
    const waCommands = {
        "wacheck": "Check if phone numbers are registered on WhatsApp (single or bulk)",
        "wacheckurl": "Download and check contacts from a URL text file",
        "waresume": "Resume an interrupted WhatsApp number checking process",
        "walist": "List all saved WhatsApp contacts",
        "wabroadcast": "Send messages to all saved WhatsApp contacts",
        "wabroadcastresume": "Resume an interrupted broadcasting process",
        "wastop": "Stop an ongoing broadcast process",
        "wabroadcastinfo": "Show statistics and estimated time for broadcast",
        "keepalive": "Check the status of the bot's keepalive system",
        "keepaliveurl": "Get the URL for external monitoring services to ping",
        "weburl": "Get the URL of the bot's web dashboard",
        "wacmds": "Show this list of WhatsApp-related commands",
        "wavalidcsv": "Validate numbers from a CSV file URL and save WhatsApp users for broadcasting",
        "castedcsv": "Process contact cards, check WhatsApp registration status, send messages, and save contact information to a CSV file",
        "castbroadcast": "Send messages to contacts saved in the casted.csv file who haven't been messaged yet",
        "castclear": "Delete all contacts in the casted.csv database and start fresh",
        "castexport": "Export the casted.csv contacts database as a file"
    };

    // Build the formatted response
    let response = `📱 *WhatsApp Commands List*\n\n`;

    // Add command descriptions
    for (const [command, description] of Object.entries(waCommands)) {
        response += `• *.${command}* - ${description}\n\n`;
    }

    // Add footer with usage information
    response += `ℹ️ *Usage Examples:*\n`;
    response += `• *.wacheck 254712345678* - Check a single number\n`;
    response += `• *.wacheck* paste list of contacts - Check multiple numbers\n`;
    response += `• *.wacheckurl https://example.com/contacts.txt* - Check numbers from URL\n`;
    response += `• *.wabroadcast* - Send messages to saved contacts\n`;
    response += `• *.wavalidcsv https://example.com/contacts.csv* - Validate and save numbers from CSV URL\n`;


    // Send the response
    repondre(response);
});