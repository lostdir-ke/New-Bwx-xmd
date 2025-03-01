
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Path for storing saved WhatsApp contacts
const contactsStoragePath = path.join(__dirname, '../xmd/saved_whatsapp_contacts.json');

// Initialize contacts storage if it doesn't exist
if (!fs.existsSync(contactsStoragePath)) {
    fs.writeFileSync(contactsStoragePath, JSON.stringify({
        whatsappUsers: [],
        nonWhatsappUsers: [],
        lastUpdated: null
    }, null, 2));
}

// Function to load saved contacts
function loadSavedContacts() {
    try {
        return JSON.parse(fs.readFileSync(contactsStoragePath, 'utf8'));
    } catch (error) {
        console.error('Error loading saved contacts:', error);
        return {
            whatsappUsers: [],
            nonWhatsappUsers: [],
            messageSentTo: [],
            lastUpdated: null
        };
    }
}

// Function to save contacts
function saveContacts(whatsappUsers, nonWhatsappUsers) {
    try {
        const savedData = loadSavedContacts();
        
        // Merge new data with existing data, avoiding duplicates
        const mergedWhatsappUsers = [...savedData.whatsappUsers];
        const mergedNonWhatsappUsers = [...savedData.nonWhatsappUsers];
        const messageSentTo = savedData.messageSentTo || [];
        
        // Add new WhatsApp users
        whatsappUsers.forEach(newUser => {
            const exists = mergedWhatsappUsers.some(user => user.phoneNumber === newUser.phoneNumber);
            if (!exists) {
                mergedWhatsappUsers.push(newUser);
            }
        });
        
        // Add new non-WhatsApp users
        nonWhatsappUsers.forEach(newUser => {
            const exists = mergedNonWhatsappUsers.some(user => user.phoneNumber === newUser.phoneNumber);
            if (!exists) {
                mergedNonWhatsappUsers.push(newUser);
            }
        });
        
        // Save updated data
        fs.writeFileSync(contactsStoragePath, JSON.stringify({
            whatsappUsers: mergedWhatsappUsers,
            nonWhatsappUsers: mergedNonWhatsappUsers,
            messageSentTo: messageSentTo,
            lastUpdated: new Date().toISOString()
        }, null, 2));
        
        return {
            whatsappCount: mergedWhatsappUsers.length,
            nonWhatsappCount: mergedNonWhatsappUsers.length
        };
    } catch (error) {
        console.error('Error saving contacts:', error);
        return null;
    }
}

adams({ nomCom: "wacheck", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;

    // If no argument is provided, ask for the phone number
    if (!arg || arg.length === 0) {
        return repondre("Please enter a phone number to check if it's registered on WhatsApp.\n\nExample: *.wacheck 712345678*\n\nFor bulk checking, send a list in format:\nName,Phone Number\nName2,Phone Number2\n...");
    }

    // Join all arguments to handle multiline input
    const inputText = arg.join(' ');

    // Check if it's a bulk check (contains newlines or commas)
    const isBulkCheck = inputText.includes('\n') || (inputText.split(',').length > 1 && !inputText.startsWith('+') && !/^\d/.test(inputText));
    
    if (isBulkCheck) {
        // Process bulk check
        await handleBulkCheck(inputText, zk, dest, repondre);
    } else {
        // Process single number check
        let phoneNumber = inputText.replace(/\s+/g, '');
        
        // Remove any + sign if present
        phoneNumber = phoneNumber.replace(/^\+/, '');
        
        // If number doesn't have country code (less than 10 digits or starts without country code)
        if (phoneNumber.length < 10 || !/^[1-9]\d{1,3}/.test(phoneNumber)) {
            // Add 254 (Kenya) country code if the number starts with 0
            if (phoneNumber.startsWith('0')) {
                phoneNumber = '254' + phoneNumber.substring(1);
            } 
            // Add 254 directly if it doesn't start with 0
            else {
                phoneNumber = '254' + phoneNumber;
            }
        }

        // Send a typing indicator
        await zk.sendPresenceUpdate('composing', dest);
        
        try {
            repondre(`🔍 Checking if *${phoneNumber}* is registered on WhatsApp...`);
            
            // Check if number exists on WhatsApp
            const [result] = await zk.onWhatsApp(phoneNumber + '@s.whatsapp.net');
            
            if (result && result.exists) {
                // Save the contact
                const name = `Contact (${new Date().toLocaleString()})`;
                saveContacts([{ name, phoneNumber }], []);
                
                // Send success message with the JID information
                return repondre(`✅ *Number Check Result*\n\n• Number: *${phoneNumber}*\n• Status: *Registered on WhatsApp*\n• JID: *${result.jid}*\n\n_This number has been saved for reference._`);
            } else {
                // Save the non-WhatsApp contact
                const name = `Contact (${new Date().toLocaleString()})`;
                saveContacts([], [{ name, phoneNumber }]);
                
                // Send failure message
                return repondre(`❌ *Number Check Result*\n\n• Number: *${phoneNumber}*\n• Status: *Not registered on WhatsApp*\n\n_This result has been saved for reference._`);
            }
        } catch (error) {
            console.error("Error checking number:", error);
            return repondre(`❌ Error checking the number. Please try again later.`);
        }
    }
});

// Function to handle bulk checking of contacts
async function handleBulkCheck(inputText, zk, dest, repondre) {
    // Parse the input text to extract contacts
    const lines = inputText.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
        return repondre("❌ No valid contacts found in the input.");
    }
    
    // Initial notification
    repondre(`🔍 Processing *${lines.length}* contacts for WhatsApp verification...\nThis might take some time, please wait.`);
    
    // Send a typing indicator
    await zk.sendPresenceUpdate('composing', dest);
    
    // Arrays to store results
    const whatsappUsers = [];
    const nonWhatsappUsers = [];
    let failedChecks = 0;
    
    // Process each contact
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Extract name and phone number
        // Assuming format is "Name,Phone Number" but handling variations
        let name, phoneNumber;
        
        if (line.includes(',')) {
            // Split by the last comma to handle names with commas
            const lastCommaIndex = line.lastIndexOf(',');
            name = line.substring(0, lastCommaIndex).trim();
            phoneNumber = line.substring(lastCommaIndex + 1).trim();
        } else {
            // If there's no comma, assume it's just a phone number
            name = `Contact ${i+1}`;
            phoneNumber = line.trim();
        }
        
        // Clean up the phone number
        phoneNumber = phoneNumber.replace(/\s+/g, '').replace(/^\+/, '');
        
        // Add country code if needed
        if (phoneNumber.length < 10 || !/^[1-9]\d{1,3}/.test(phoneNumber)) {
            if (phoneNumber.startsWith('0')) {
                phoneNumber = '254' + phoneNumber.substring(1);
            } else {
                phoneNumber = '254' + phoneNumber;
            }
        }
        
        try {
            // Check if number exists on WhatsApp (with slight delay to avoid rate limiting)
            if (i > 0 && i % 10 === 0) {
                // Send progress update every 10 contacts
                repondre(`⏳ Progress: Checked ${i}/${lines.length} contacts...`);
                // Small delay every 10 checks to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            const [result] = await zk.onWhatsApp(phoneNumber + '@s.whatsapp.net');
            
            if (result && result.exists) {
                whatsappUsers.push({ name, phoneNumber });
            } else {
                nonWhatsappUsers.push({ name, phoneNumber });
            }
        } catch (error) {
            console.error(`Error checking number ${phoneNumber}:`, error);
            failedChecks++;
            // Continue to the next number
        }
    }
    
    // Save contacts to storage
    const savedStats = saveContacts(whatsappUsers, nonWhatsappUsers);
    
    // Generate report
    let report = `📊 *WhatsApp Contact Verification Report*\n\n`;
    report += `✅ *Registered on WhatsApp (${whatsappUsers.length}):*\n`;
    
    if (whatsappUsers.length > 0) {
        whatsappUsers.forEach((user, index) => {
            report += `${index + 1}. ${user.name}: +${user.phoneNumber}\n`;
        });
    } else {
        report += `None of the contacts are registered on WhatsApp.\n`;
    }
    
    report += `\n❌ *Not Registered on WhatsApp (${nonWhatsappUsers.length}):*\n`;
    
    if (nonWhatsappUsers.length > 0) {
        nonWhatsappUsers.forEach((user, index) => {
            report += `${index + 1}. ${user.name}: +${user.phoneNumber}\n`;
        });
    } else {
        report += `All contacts are registered on WhatsApp.\n`;
    }
    
    if (failedChecks > 0) {
        report += `\n⚠️ Failed to check ${failedChecks} contacts due to errors.\n`;
    }
    
    report += `\n📝 *Summary:*\n`;
    report += `• Total contacts checked: ${lines.length}\n`;
    report += `• WhatsApp users: ${whatsappUsers.length}\n`;
    report += `• Non-WhatsApp users: ${nonWhatsappUsers.length}\n`;
    report += `• Failed checks: ${failedChecks}\n`;
    
    if (savedStats) {
        report += `\n💾 *Saved Contacts Database:*\n`;
        report += `• Total WhatsApp users saved: ${savedStats.whatsappCount}\n`;
        report += `• Total non-WhatsApp users saved: ${savedStats.nonWhatsappCount}\n`;
    }

    // Check if report is too long for WhatsApp (message limit is around 65536 characters)
    if (report.length > 65000) {
        // Split report and save to file
        const reportFile = './wa_check_report.txt';
        fs.writeFileSync(reportFile, report);
        
        // Send file instead
        await zk.sendMessage(dest, {
            document: fs.readFileSync(reportFile),
            mimetype: 'text/plain',
            fileName: 'WhatsApp_Contact_Report.txt',
            caption: `📊 WhatsApp Contact Verification Report\n\nTotal contacts: ${lines.length}\nWhatsApp users: ${whatsappUsers.length}\nNon-WhatsApp users: ${nonWhatsappUsers.length}\n\n_All contacts have been saved for reference._`
        });
        
        // Clean up file
        fs.unlinkSync(reportFile);
    } else {
        // Send report as message with saved notification
        repondre(report + "\n\n_All contacts have been saved for reference._");
    }
}

// Add a command to list saved contacts
adams({ nomCom: "walist", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;
    
    try {
        const savedContacts = loadSavedContacts();
        const whatsappCount = savedContacts.whatsappUsers.length;
        const nonWhatsappCount = savedContacts.nonWhatsappUsers.length;
        const lastUpdated = savedContacts.lastUpdated ? new Date(savedContacts.lastUpdated).toLocaleString() : 'Never';
        
        let report = `📋 *Saved WhatsApp Contacts Report*\n\n`;
        report += `Last updated: ${lastUpdated}\n\n`;
        report += `✅ *WhatsApp Users (${whatsappCount}):*\n`;
        
        if (whatsappCount > 0) {
            // Get the type of list requested
            const listType = arg[0]?.toLowerCase();
            if (listType === 'csv') {
                // Generate CSV format
                let csvData = 'Name,Phone Number\n';
                savedContacts.whatsappUsers.forEach(user => {
                    csvData += `"${user.name.replace(/"/g, '""')}",+${user.phoneNumber}\n`;
                });
                
                // Save to file
                const csvFile = './whatsapp_contacts.csv';
                fs.writeFileSync(csvFile, csvData);
                
                // Send CSV file
                await zk.sendMessage(dest, {
                    document: fs.readFileSync(csvFile),
                    mimetype: 'text/csv',
                    fileName: 'WhatsApp_Contacts.csv',
                    caption: `📊 Exported WhatsApp Contacts\n\nTotal WhatsApp users: ${whatsappCount}\nLast updated: ${lastUpdated}`
                });
                
                // Clean up file
                fs.unlinkSync(csvFile);
                return;
            } else {
                // List format
                savedContacts.whatsappUsers.forEach((user, index) => {
                    if (index < 100) { // Limit to first 100 to avoid message too long
                        report += `${index + 1}. ${user.name}: +${user.phoneNumber}\n`;
                    }
                });
                
                if (whatsappCount > 100) {
                    report += `... and ${whatsappCount - 100} more contacts (use .walist csv for full export)\n`;
                }
            }
        } else {
            report += `No WhatsApp users saved.\n`;
        }
        
        report += `\n📝 *Usage:*\n`;
        report += `• Type *.walist* to view saved WhatsApp contacts\n`;
        report += `• Type *.walist csv* to export as CSV file\n`;
        
        // Send report
        repondre(report);
    } catch (error) {
        console.error('Error retrieving saved contacts:', error);
        repondre('❌ Error retrieving saved contacts. Please try again later.');
    }
});


// Function to mark a number as messaged
function markNumberAsMessaged(phoneNumber) {
    try {
        const savedData = loadSavedContacts();
        if (!savedData.messageSentTo) {
            savedData.messageSentTo = [];
        }
        
        if (!savedData.messageSentTo.includes(phoneNumber)) {
            savedData.messageSentTo.push(phoneNumber);
            
            fs.writeFileSync(contactsStoragePath, JSON.stringify(savedData, null, 2));
        }
        
        return true;
    } catch (error) {
        console.error('Error marking number as messaged:', error);
        return false;
    }
}

// Function to check if message was already sent to a number
function wasMessageSent(phoneNumber) {
    try {
        const savedData = loadSavedContacts();
        return (savedData.messageSentTo || []).includes(phoneNumber);
    } catch (error) {
        console.error('Error checking if message was sent:', error);
        return false;
    }
}

// Command to broadcast message to all WhatsApp users
adams({ nomCom: "wabroadcast", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg, superUser } = commandeOptions;
    
    // Only allow the bot owner to use this command
    if (!superUser) {
        return repondre("❌ Only the bot owner can use this command.");
    }
    
    // Check if a broadcast is already running
    if (isBroadcastRunning) {
        return repondre("⚠️ A broadcast is already in progress. Use *.wastop* to stop it first.");
    }
    
    try {
        const savedContacts = loadSavedContacts();
        const whatsappUsers = savedContacts.whatsappUsers || [];
        
        if (whatsappUsers.length === 0) {
            return repondre("❌ No WhatsApp users found in the database. Use .wacheck to add contacts first.");
        }
        
        // Start broadcasting
        repondre(`🔄 Starting to send messages to ${whatsappUsers.length} WhatsApp contacts...\nUse *.wastop* to stop the broadcast at any time.`);
        
        // Set the broadcast flag to true
        isBroadcastRunning = true;
        
        let sentCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        let stoppedEarly = false;
        
        // Custom message to send
        const baseMessage = "I'm NICHOLAS, another status viewer. Can we be friends? Please save my number. Your contact is already saved in my phone.";
        
        // Process contacts one by one with random delay
        for (let i = 0; i < whatsappUsers.length; i++) {
            // Check if the broadcast should be stopped
            if (!isBroadcastRunning) {
                stoppedEarly = true;
                break;
            }
            
            const user = whatsappUsers[i];
            const phoneNumber = user.phoneNumber;
            const name = user.name || "Friend";
            
            // Skip if message was already sent to this number
            if (wasMessageSent(phoneNumber)) {
                skippedCount++;
                continue;
            }
            
            try {
                // Personalized message with contact name
                const personalizedMessage = `Hello ${name}, ${baseMessage}`;
                
                // Send message
                await zk.sendMessage(`${phoneNumber}@s.whatsapp.net`, { text: personalizedMessage });
                
                // Mark as sent
                markNumberAsMessaged(phoneNumber);
                sentCount++;
                
                // Send progress update every 10 messages
                if (sentCount % 10 === 0 && isBroadcastRunning) {
                    await zk.sendMessage(dest, { text: `📤 Progress update: Sent messages to ${sentCount} contacts so far.` });
                }
                
                // Random delay between 1-2 minutes with better randomization
                const minDelaySeconds = 60; // 1 minute minimum
                const maxDelaySeconds = 120; // 2 minutes maximum
                const delaySeconds = Math.floor(Math.random() * (maxDelaySeconds - minDelaySeconds + 1)) + minDelaySeconds;
                console.log(`Waiting ${delaySeconds} seconds before sending next message...`);
                await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
            } catch (error) {
                console.error(`Error sending message to ${phoneNumber}:`, error);
                failedCount++;
            }
        }
        
        // Reset the broadcast flag
        isBroadcastRunning = false;
        
        // Send final report
        let report = `📊 *Message Broadcast Report*\n\n` +
                     `✅ Successfully sent: ${sentCount}\n` +
                     `⏭️ Skipped (already sent): ${skippedCount}\n` +
                     `❌ Failed to send: ${failedCount}\n\n` +
                     `Total WhatsApp contacts: ${whatsappUsers.length}`;
        
        if (stoppedEarly) {
            report += `\n\n⚠️ The broadcast was stopped manually.`;
        }
                      
        repondre(report);
    } catch (error) {
        // Reset the broadcast flag in case of error
        isBroadcastRunning = false;
        
        console.error('Error broadcasting messages:', error);
        repondre('❌ Error broadcasting messages. Please try again later.');
    }
});

// Global variable to track if broadcast is running and should continue
let isBroadcastRunning = false;

// Function to estimate broadcast time
adams({ nomCom: "wabroadcastinfo", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre, superUser } = commandeOptions;
    
    if (!superUser) {
        return repondre("❌ Only the bot owner can use this command.");
    }
    
    try {
        const savedContacts = loadSavedContacts();
        const whatsappUsers = savedContacts.whatsappUsers || [];
        const messageSentTo = savedContacts.messageSentTo || [];
        
        const totalContacts = whatsappUsers.length;
        const pendingContacts = whatsappUsers.filter(user => 
            !messageSentTo.includes(user.phoneNumber)).length;
        
        // Estimate time (average 90 seconds per message)
        const estimatedMinutes = Math.ceil((pendingContacts * 90) / 60);
        const estimatedHours = Math.floor(estimatedMinutes / 60);
        const remainingMinutes = estimatedMinutes % 60;
        
        const timeEstimate = estimatedHours > 0 
            ? `${estimatedHours} hour(s) and ${remainingMinutes} minute(s)` 
            : `${estimatedMinutes} minute(s)`;
        
        const report = `📊 *Broadcast Statistics*\n\n` +
                      `📱 Total WhatsApp contacts: ${totalContacts}\n` +
                      `✅ Already messaged: ${messageSentTo.length}\n` +
                      `⏳ Pending messages: ${pendingContacts}\n\n` +
                      `⏱️ Estimated time to complete: ${timeEstimate}\n\n` +
                      `Use *.wabroadcast* command to start sending messages.\n` +
                      `Use *.wastop* command to stop an ongoing broadcast.`;
                      
        repondre(report);
    } catch (error) {
        console.error('Error getting broadcast info:', error);
        repondre('❌ Error retrieving broadcast information.');
    }
});

// Command to stop the broadcast process
adams({ nomCom: "wastop", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre, superUser } = commandeOptions;
    
    // Only allow the bot owner to use this command
    if (!superUser) {
        return repondre("❌ Only the bot owner can use this command.");
    }
    
    if (!isBroadcastRunning) {
        return repondre("⚠️ There is no active broadcast running at the moment.");
    }
    
    // Set the flag to false to stop the broadcast
    isBroadcastRunning = false;
    
    repondre("🛑 *Broadcast Stopped*\n\nThe message broadcast has been stopped. Any messages currently being sent will complete, but no new messages will be sent.\n\nUse *.wabroadcast* to start a new broadcast.");
});

// Command to check WhatsApp contacts from a URL containing a text file
adams({ nomCom: "wacheckurl", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;
    
    if (!arg || arg.length === 0) {
        return repondre("Please provide a URL to a text file containing contacts.\n\nExample: *.wacheckurl https://example.com/contacts.txt*\n\nThe file should contain contacts in the format:\nName,Phone Number\nName2,Phone Number2\n...");
    }
    
    const url = arg[0];
    
    // Send processing notification
    repondre(`🔍 Attempting to download contacts from URL:\n${url}\n\nPlease wait...`);
    
    try {
        // Download the file content
        const response = await axios.get(url, {
            timeout: 15000,
            responseType: 'text'
        });
        
        if (!response.data || response.data.trim() === '') {
            return repondre("❌ The downloaded file is empty or invalid. Please check the URL and try again.");
        }
        
        // Process the downloaded content
        repondre(`✅ File downloaded successfully! Processing contacts...`);
        
        // Process the content the same way as .wacheck bulk check
        await handleBulkCheck(response.data, zk, dest, repondre);
    } catch (error) {
        console.error("Error downloading or processing file:", error);
        return repondre(`❌ Failed to download or process the file. Error: ${error.message || "Unknown error"}\n\nPlease verify the URL is correct and accessible.`);
    }
});
