
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
        
        // Track how many numbers were actually added vs skipped
        let whatsappAdded = 0;
        let whatsappSkipped = 0;
        let nonWhatsappAdded = 0;
        let nonWhatsappSkipped = 0;
        
        // Add new WhatsApp users
        whatsappUsers.forEach(newUser => {
            const exists = mergedWhatsappUsers.some(user => user.phoneNumber === newUser.phoneNumber);
            if (!exists) {
                mergedWhatsappUsers.push(newUser);
                whatsappAdded++;
            } else {
                console.log(`Skipped saving duplicate WhatsApp number: ${newUser.phoneNumber}`);
                whatsappSkipped++;
            }
        });
        
        // Add new non-WhatsApp users
        nonWhatsappUsers.forEach(newUser => {
            const exists = mergedNonWhatsappUsers.some(user => user.phoneNumber === newUser.phoneNumber);
            if (!exists) {
                mergedNonWhatsappUsers.push(newUser);
                nonWhatsappAdded++;
            } else {
                console.log(`Skipped saving duplicate non-WhatsApp number: ${newUser.phoneNumber}`);
                nonWhatsappSkipped++;
            }
        });
        
        // Log summary of additions
        if (whatsappAdded > 0 || nonWhatsappAdded > 0) {
            console.log(`Added ${whatsappAdded} new WhatsApp numbers and ${nonWhatsappAdded} new non-WhatsApp numbers`);
        }
        if (whatsappSkipped > 0 || nonWhatsappSkipped > 0) {
            console.log(`Skipped ${whatsappSkipped} duplicate WhatsApp numbers and ${nonWhatsappSkipped} duplicate non-WhatsApp numbers`);
        }
        
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
        return repondre("Please enter a phone number to check if it's registered on WhatsApp.\n\nExample: *.wacheck 712345678*\n\nFor bulk checking, send a list in format:\nName,Phone Number\nName2,Phone Number2\n...\n\nIf the process is interrupted, use *.waresume* to continue.");
    }

    // Join all arguments to handle multiline input
    const inputText = arg.join(' ');

    // Check if it's a bulk check (contains newlines or commas)
    const isBulkCheck = inputText.includes('\n') || (inputText.split(',').length > 1 && !inputText.startsWith('+') && !/^\d/.test(inputText));
    
    if (isBulkCheck) {
        // Process bulk check with resume support
        await handleBulkCheck(inputText, zk, dest, repondre, "wacheck");
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

// Function to handle bulk checking of contacts with improved speed and resume support
async function handleBulkCheck(inputText, zk, dest, repondre, command = "wacheck", url = "") {
    // Parse the input text to extract contacts
    const lines = inputText.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
        return repondre("❌ No valid contacts found in the input.");
    }
    
    // Initial notification
    repondre(`🔍 Processing *${lines.length}* contacts for WhatsApp verification...\nOptimized for faster processing.\nUse *.waresume* if the process is interrupted.`);
    
    // Send a typing indicator
    await zk.sendPresenceUpdate('composing', dest);
    
    // Arrays to store results
    const whatsappUsers = [];
    const nonWhatsappUsers = [];
    let failedChecks = 0;
    
    // Set a batch size for bulk processing
    const BATCH_SIZE = 20; // Process more numbers before sending a progress update
    const RATE_LIMIT_DELAY = 500; // Smaller delay (in ms) to avoid rate limiting
    
    // Prepare contacts for processing and potential resume
    const processedContacts = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Extract name and phone number with optimized parsing
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
        
        // Clean up the phone number more efficiently
        phoneNumber = phoneNumber.replace(/[\s\+\-]/g, '');
        
        // Add country code if needed (optimization: single regex check)
        if (!/^[1-9]\d{9,14}$/.test(phoneNumber)) {
            if (phoneNumber.startsWith('0')) {
                phoneNumber = '254' + phoneNumber.substring(1);
            } else {
                phoneNumber = '254' + phoneNumber;
            }
        }
        
        // Add to processed contacts
        processedContacts.push({ name, phoneNumber });
    }
    
    // Setup and save progress data for potential resume
    checkProgressData = {
        isActive: true,
        contactsToCheck: processedContacts,
        currentIndex: 0,
        totalContacts: processedContacts.length,
        command: command,
        url: url,
        lastActive: new Date().toISOString()
    };
    saveCheckProgress();
    
    // Process contacts one by one
    for (let i = 0; i < processedContacts.length; i++) {
        // Update progress in case of interruption
        checkProgressData.currentIndex = i;
        checkProgressData.lastActive = new Date().toISOString();
        
        // Save progress periodically
        if (i % 10 === 0) {
            saveCheckProgress();
        }
        
        const contact = processedContacts[i];
        const name = contact.name;
        const phoneNumber = contact.phoneNumber;
        
        try {
            // Send progress updates at optimized intervals
            if (i > 0 && i % BATCH_SIZE === 0) {
                const progressPercentage = Math.floor((i / processedContacts.length) * 100);
                repondre(`⏳ Progress: ${progressPercentage}% (Checked ${i}/${processedContacts.length} contacts)`);
                
                // Small delay every batch to avoid rate limiting, but much shorter
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
            }
            
            const [result] = await zk.onWhatsApp(phoneNumber + '@s.whatsapp.net');
            
            if (result && result.exists) {
                whatsappUsers.push({ name, phoneNumber });
            } else {
                nonWhatsappUsers.push({ name, phoneNumber });
            }
            
            // Add minimal delay between each check to avoid overloading
            if (i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.error(`Error checking number ${phoneNumber}:`, error);
            failedChecks++;
            // Continue to the next number without much delay
        }
    }
    
    // Mark check as completed
    checkProgressData.isActive = false;
    saveCheckProgress();
    
    // Save contacts to storage
    const savedStats = saveContacts(whatsappUsers, nonWhatsappUsers);
    
    // Generate report with optimized string building
    let report = [`📊 *WhatsApp Contact Verification Report*\n\n`];
    report.push(`✅ *Registered on WhatsApp (${whatsappUsers.length}):*\n`);
    
    if (whatsappUsers.length > 0) {
        // Optimize by building string in chunks
        const chunks = [];
        for (let i = 0; i < whatsappUsers.length; i++) {
            if (i < 100) { // Limit to first 100 to avoid message too long
                chunks.push(`${i + 1}. ${whatsappUsers[i].name}: +${whatsappUsers[i].phoneNumber}`);
            } else {
                chunks.push(`... and ${whatsappUsers.length - 100} more contacts`);
                break;
            }
        }
        report.push(chunks.join('\n'));
    } else {
        report.push(`None of the contacts are registered on WhatsApp.`);
    }
    
    report.push(`\n❌ *Not Registered on WhatsApp (${nonWhatsappUsers.length}):*\n`);
    
    if (nonWhatsappUsers.length > 0) {
        // Optimize by building string in chunks
        const chunks = [];
        for (let i = 0; i < nonWhatsappUsers.length; i++) {
            if (i < 100) { // Limit to first 100 to avoid message too long
                chunks.push(`${i + 1}. ${nonWhatsappUsers[i].name}: +${nonWhatsappUsers[i].phoneNumber}`);
            } else {
                chunks.push(`... and ${nonWhatsappUsers.length - 100} more contacts`);
                break;
            }
        }
        report.push(chunks.join('\n'));
    } else {
        report.push(`All contacts are registered on WhatsApp.`);
    }
    
    if (failedChecks > 0) {
        report.push(`\n⚠️ Failed to check ${failedChecks} contacts due to errors.`);
    }
    
    report.push(`\n📝 *Summary:*`);
    report.push(`• Total contacts checked: ${lines.length}`);
    report.push(`• WhatsApp users: ${whatsappUsers.length}`);
    report.push(`• Non-WhatsApp users: ${nonWhatsappUsers.length}`);
    report.push(`• Failed checks: ${failedChecks}`);
    
    if (savedStats) {
        report.push(`\n💾 *Saved Contacts Database:*`);
        report.push(`• Total WhatsApp users saved: ${savedStats.whatsappCount}`);
        report.push(`• Total non-WhatsApp users saved: ${savedStats.nonWhatsappCount}`);
    }

    // Join report parts for efficiency
    const finalReport = report.join('\n');

    // Check if report is too long for WhatsApp
    if (finalReport.length > 65000) {
        // Split report and save to file
        const reportFile = './wa_check_report.txt';
        fs.writeFileSync(reportFile, finalReport);
        
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
        repondre(finalReport + "\n\n_All contacts have been saved for reference._");
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
        repondre(`🔄 Starting to send messages to ${whatsappUsers.length} WhatsApp contacts...\nUse *.wastop* to stop the broadcast at any time.\nIf process is interrupted, use *.wabroadcastresume* to continue.`);
        
        // Set the broadcast flag to true
        isBroadcastRunning = true;
        
        // Custom message to send
        const baseMessage = "I'm NICHOLAS, another status viewer. Can we be friends? Please save my number. Your contact is already saved in my phone.";
        
        // Save broadcast progress data for potential resume
        broadcastProgressData = {
            isActive: true,
            contacts: whatsappUsers,
            currentIndex: 0,
            totalContacts: whatsappUsers.length,
            message: baseMessage,
            lastActive: new Date().toISOString()
        };
        saveBroadcastProgress();
        
        // Start the broadcast with the resume function, starting from index 0
        await processBroadcast(zk, dest, repondre, 0);
    } catch (error) {
        // Reset the broadcast flag in case of error
        isBroadcastRunning = false;
        
        console.error('Error broadcasting messages:', error);
        repondre('❌ Error broadcasting messages. Please try again later.');
    }
});

// Function to process broadcast messages with resume capability
async function processBroadcast(zk, dest, repondre, startIndex = 0) {
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let stoppedEarly = false;
    
    try {
        // Get contacts from saved progress
        const contacts = broadcastProgressData.contacts;
        const baseMessage = broadcastProgressData.message;
        
        // Process contacts one by one with random delay
        for (let i = startIndex; i < contacts.length; i++) {
            // Update progress in case of interruption
            broadcastProgressData.currentIndex = i;
            broadcastProgressData.lastActive = new Date().toISOString();
            
            // Save progress periodically
            if (i % 5 === 0) {
                saveBroadcastProgress();
            }
            
            // Check if the broadcast should be stopped
            if (!isBroadcastRunning) {
                stoppedEarly = true;
                broadcastProgressData.isActive = false;
                saveBroadcastProgress();
                break;
            }
            
            const user = contacts[i];
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
                    await zk.sendMessage(dest, { text: `📤 Progress update: Sent messages to ${sentCount} contacts so far (${i+1}/${contacts.length} processed).` });
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
        
        // Mark broadcast as complete if not stopped early
        if (!stoppedEarly) {
            broadcastProgressData.isActive = false;
            saveBroadcastProgress();
        }
        
        // Reset the broadcast flag
        isBroadcastRunning = false;
        
        // Send final report
        let report = `📊 *Message Broadcast Report*\n\n` +
                     `✅ Successfully sent: ${sentCount}\n` +
                     `⏭️ Skipped (already sent): ${skippedCount}\n` +
                     `❌ Failed to send: ${failedCount}\n\n` +
                     `Total WhatsApp contacts processed: ${contacts.length - startIndex}`;
        
        if (stoppedEarly) {
            report += `\n\n⚠️ The broadcast was stopped manually.`;
        }
                      
        repondre(report);
    } catch (error) {
        // Reset the broadcast flag in case of error
        isBroadcastRunning = false;
        
        console.error('Error in processBroadcast:', error);
        repondre(`❌ Error during broadcast: ${error.message}\n\nYou can resume using *.wabroadcastresume*.`);
    }
}

// Global variables for broadcast tracking
let isBroadcastRunning = false;
let broadcastProgressData = {
    isActive: false,
    contacts: [],
    currentIndex: 0,
    totalContacts: 0,
    message: "",
    lastActive: null
};

// Function to save broadcast progress to file
function saveBroadcastProgress() {
    try {
        const progressFilePath = path.join(__dirname, '../xmd/broadcast_progress.json');
        fs.writeFileSync(progressFilePath, JSON.stringify(broadcastProgressData, null, 2));
        console.log(`Broadcast progress saved. Current index: ${broadcastProgressData.currentIndex}/${broadcastProgressData.totalContacts}`);
        return true;
    } catch (error) {
        console.error('Error saving broadcast progress:', error);
        return false;
    }
}

// Function to load broadcast progress from file
function loadBroadcastProgress() {
    try {
        const progressFilePath = path.join(__dirname, '../xmd/broadcast_progress.json');
        if (fs.existsSync(progressFilePath)) {
            const data = JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
            broadcastProgressData = data;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error loading broadcast progress:', error);
        return false;
    }
}

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

// Store check progress for resume functionality
let checkProgressData = {
    isActive: false,
    contactsToCheck: [],
    currentIndex: 0,
    totalContacts: 0,
    command: "", // "wacheck" or "wacheckurl"
    url: "", // Only used for wacheckurl
    lastActive: null
};

// Function to save check progress to file
function saveCheckProgress() {
    try {
        const progressFilePath = path.join(__dirname, '../xmd/check_progress.json');
        fs.writeFileSync(progressFilePath, JSON.stringify(checkProgressData, null, 2));
        console.log(`Check progress saved. Current index: ${checkProgressData.currentIndex}/${checkProgressData.totalContacts}`);
        return true;
    } catch (error) {
        console.error('Error saving check progress:', error);
        return false;
    }
}

// Function to load check progress from file
function loadCheckProgress() {
    try {
        const progressFilePath = path.join(__dirname, '../xmd/check_progress.json');
        if (fs.existsSync(progressFilePath)) {
            const data = JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
            checkProgressData = data;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error loading check progress:', error);
        return false;
    }
}

// Resume command to continue checks after shutdown
adams({ nomCom: "waresume", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre, superUser } = commandeOptions;
    
    // Check if there's a saved progress
    if (!loadCheckProgress()) {
        return repondre("❌ No saved check progress found. Please use *.wacheck* or *.wacheckurl* to start a new check.");
    }
    
    // Check if the saved progress is valid
    if (!checkProgressData.isActive || checkProgressData.contactsToCheck.length === 0) {
        return repondre("❌ No valid check progress found to resume. Please use *.wacheck* or *.wacheckurl* to start a new check.");
    }
    
    // Calculate how much time has passed since last activity
    const lastActive = new Date(checkProgressData.lastActive);
    const now = new Date();
    const hoursPassed = (now - lastActive) / (1000 * 60 * 60);
    
    // Display resume information
    const remainingContacts = checkProgressData.totalContacts - checkProgressData.currentIndex;
    
    repondre(`📋 *Found Saved Progress*\n\n` +
             `• Command: *${checkProgressData.command}*\n` +
             `• Last active: *${lastActive.toLocaleString()}* (${hoursPassed.toFixed(1)} hours ago)\n` +
             `• Progress: *${checkProgressData.currentIndex}/${checkProgressData.totalContacts}* contacts checked\n` +
             `• Remaining: *${remainingContacts}* contacts\n\n` +
             `Resuming check from where it was interrupted...`);
    
    // Resume the check based on command type
    if (checkProgressData.command === "wacheckurl") {
        // For URL checks, continue with the contacts already downloaded
        await resumeBulkCheck(zk, dest, repondre);
    } else {
        // For direct checks, continue with the contacts already processed
        await resumeBulkCheck(zk, dest, repondre);
    }
});

// Function to resume bulk check from where it left off
async function resumeBulkCheck(zk, dest, repondre) {
    if (!checkProgressData.isActive) {
        return repondre("❌ No active check to resume.");
    }
    
    // Arrays to store results
    const whatsappUsers = [];
    const nonWhatsappUsers = [];
    let failedChecks = 0;
    
    // Set parameters for processing
    const BATCH_SIZE = 20;
    const RATE_LIMIT_DELAY = 500;
    
    // Resume from the current index
    const startIndex = checkProgressData.currentIndex;
    const contacts = checkProgressData.contactsToCheck;
    
    repondre(`🔄 Resuming check from contact #${startIndex+1}/${contacts.length}...`);
    
    for (let i = startIndex; i < contacts.length; i++) {
        // Update current index in progress data
        checkProgressData.currentIndex = i;
        checkProgressData.lastActive = new Date().toISOString();
        
        // Save progress every 10 contacts
        if (i % 10 === 0) {
            saveCheckProgress();
        }
        
        const contact = contacts[i];
        const name = contact.name;
        const phoneNumber = contact.phoneNumber;
        
        try {
            // Send progress updates at intervals
            if ((i - startIndex) > 0 && (i - startIndex) % BATCH_SIZE === 0) {
                const progressPercentage = Math.floor(((i + 1) / contacts.length) * 100);
                repondre(`⏳ Resume Progress: ${progressPercentage}% (Checked ${i+1}/${contacts.length} contacts)`);
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
            }
            
            const [result] = await zk.onWhatsApp(phoneNumber + '@s.whatsapp.net');
            
            if (result && result.exists) {
                whatsappUsers.push({ name, phoneNumber });
            } else {
                nonWhatsappUsers.push({ name, phoneNumber });
            }
            
            // Add minimal delay between each check
            if (i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.error(`Error checking number ${phoneNumber}:`, error);
            failedChecks++;
        }
    }
    
    // Mark check as complete
    checkProgressData.isActive = false;
    saveCheckProgress();
    
    // Save contacts to storage
    const savedStats = saveContacts(whatsappUsers, nonWhatsappUsers);
    
    // Generate report
    let report = [`📊 *Resume Check Report*\n\n`];
    report.push(`✅ *Registered on WhatsApp (${whatsappUsers.length}):*\n`);
    
    if (whatsappUsers.length > 0) {
        const chunks = [];
        for (let i = 0; i < whatsappUsers.length; i++) {
            if (i < 100) {
                chunks.push(`${i + 1}. ${whatsappUsers[i].name}: +${whatsappUsers[i].phoneNumber}`);
            } else {
                chunks.push(`... and ${whatsappUsers.length - 100} more contacts`);
                break;
            }
        }
        report.push(chunks.join('\n'));
    } else {
        report.push(`None of the contacts are registered on WhatsApp.`);
    }
    
    report.push(`\n❌ *Not Registered on WhatsApp (${nonWhatsappUsers.length}):*\n`);
    
    if (nonWhatsappUsers.length > 0) {
        const chunks = [];
        for (let i = 0; i < nonWhatsappUsers.length; i++) {
            if (i < 100) {
                chunks.push(`${i + 1}. ${nonWhatsappUsers[i].name}: +${nonWhatsappUsers[i].phoneNumber}`);
            } else {
                chunks.push(`... and ${nonWhatsappUsers.length - 100} more contacts`);
                break;
            }
        }
        report.push(chunks.join('\n'));
    } else {
        report.push(`All contacts are registered on WhatsApp.`);
    }
    
    if (failedChecks > 0) {
        report.push(`\n⚠️ Failed to check ${failedChecks} contacts due to errors.`);
    }
    
    report.push(`\n📝 *Summary:*`);
    report.push(`• Total contacts processed: ${contacts.length - startIndex}`);
    report.push(`• WhatsApp users: ${whatsappUsers.length}`);
    report.push(`• Non-WhatsApp users: ${nonWhatsappUsers.length}`);
    report.push(`• Failed checks: ${failedChecks}`);
    
    if (savedStats) {
        report.push(`\n💾 *Saved Contacts Database:*`);
        report.push(`• Total WhatsApp users saved: ${savedStats.whatsappCount}`);
        report.push(`• Total non-WhatsApp users saved: ${savedStats.nonWhatsappCount}`);
    }
    
    // Send final report
    const finalReport = report.join('\n');
    
    if (finalReport.length > 65000) {
        const reportFile = './wa_check_report.txt';
        fs.writeFileSync(reportFile, finalReport);
        
        await zk.sendMessage(dest, {
            document: fs.readFileSync(reportFile),
            mimetype: 'text/plain',
            fileName: 'WhatsApp_Resume_Report.txt',
            caption: `📊 WhatsApp Check Resume Report\n\nTotal contacts: ${contacts.length - startIndex}\nWhatsApp users: ${whatsappUsers.length}\nNon-WhatsApp users: ${nonWhatsappUsers.length}\n\n_All contacts have been saved for reference._`
        });
        
        fs.unlinkSync(reportFile);
    } else {
        repondre(finalReport + "\n\n_All contacts have been saved for reference._");
    }
}

// Command to check WhatsApp contacts from a URL containing a text file (optimized)
adams({ nomCom: "wacheckurl", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;
    
    if (!arg || arg.length === 0) {
        return repondre("Please provide a URL to a text file containing contacts.\n\nExample: *.wacheckurl https://example.com/contacts.txt*\n\nThe file should contain contacts in the format:\nName,Phone Number\nName2,Phone Number2\n...");
    }
    
    const url = arg[0];
    
    // Send processing notification
    repondre(`🔍 Downloading contacts from URL:\n${url}\n\nUsing optimized processing...`);
    
    try {
        // Download the file content with optimized settings
        const response = await axios.get(url, {
            timeout: 20000, // Increased timeout for larger files
            responseType: 'text',
            headers: {
                'Accept-Encoding': 'gzip, deflate, br', // Support compressed responses
                'User-Agent': 'WhatsApp-Contact-Checker/1.0' // Custom user agent
            },
            maxContentLength: 5 * 1024 * 1024 // 5MB max to handle larger files
        });
        
        if (!response.data || response.data.trim() === '') {
            return repondre("❌ The downloaded file is empty or invalid. Please check the URL and try again.");
        }
        
        // Quick check of file size
        const contentLength = response.headers['content-length'];
        const sizeInKB = contentLength ? Math.round(parseInt(contentLength) / 1024) : 'unknown';
        
        // Process the downloaded content with size info
        repondre(`✅ File downloaded successfully! (${sizeInKB}KB)\nProcessing contacts with optimized speed...\nIf interrupted, use *.waresume* to continue.`);
        
        // Process the content with our optimized bulk check function (with resume support)
        await handleBulkCheck(response.data, zk, dest, repondre, "wacheckurl", url);
    } catch (error) {
        console.error("Error downloading or processing file:", error);
        
        // More detailed error reporting
        let errorMessage = "❌ Failed to download or process the file.";
        
        if (error.code === 'ECONNABORTED') {
            errorMessage += "\n\nThe request timed out. The file might be too large or the server is slow.";
        } else if (error.response) {
            // The server responded with a status code outside the 2xx range
            errorMessage += `\n\nServer responded with status: ${error.response.status}`;
        } else if (error.request) {
            // The request was made but no response was received
            errorMessage += "\n\nNo response received from the server. Check if the URL is correct.";
        } else {
            // Something else happened while setting up the request
            errorMessage += `\n\nError: ${error.message || "Unknown error"}`;
        }
        
        return repondre(errorMessage + "\n\nPlease verify the URL is correct and accessible.");
    }
});


// Command to resume broadcast after shutdown or interruption
adams({ nomCom: "wabroadcastresume", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre, superUser } = commandeOptions;
    
    // Only allow the bot owner to use this command
    if (!superUser) {
        return repondre("❌ Only the bot owner can use this command.");
    }
    
    // Check if a broadcast is already running
    if (isBroadcastRunning) {
        return repondre("⚠️ A broadcast is already in progress. No need to resume.");
    }
    
    // Check if there's a saved broadcast progress
    if (!loadBroadcastProgress()) {
        return repondre("❌ No saved broadcast progress found. Please use *.wabroadcast* to start a new broadcast.");
    }
    
    // Check if the saved broadcast progress is valid and active
    if (!broadcastProgressData.isActive || broadcastProgressData.contacts.length === 0) {
        return repondre("❌ No active broadcast found to resume. Please use *.wabroadcast* to start a new broadcast.");
    }
    
    // Calculate how much time has passed since last activity
    const lastActive = new Date(broadcastProgressData.lastActive);
    const now = new Date();
    const hoursPassed = (now - lastActive) / (1000 * 60 * 60);
    
    // Get the resume details
    const currentIndex = broadcastProgressData.currentIndex;
    const totalContacts = broadcastProgressData.totalContacts;
    const remainingContacts = totalContacts - currentIndex;
    
    // Calculate estimated time to complete (90 seconds per message on average)
    const estimatedMinutes = Math.ceil((remainingContacts * 90) / 60);
    
    // Display resume information
    repondre(`📋 *Found Saved Broadcast Progress*\n\n` +
             `• Last active: *${lastActive.toLocaleString()}* (${hoursPassed.toFixed(1)} hours ago)\n` +
             `• Progress: *${currentIndex}/${totalContacts}* contacts processed\n` +
             `• Remaining: *${remainingContacts}* contacts\n` +
             `• Estimated time: ~${estimatedMinutes} minutes\n\n` +
             `Resuming broadcast from where it was interrupted...`);
    
    // Set the broadcast flag to true
    isBroadcastRunning = true;
    
    // Resume the broadcast from the saved index
    await processBroadcast(zk, dest, repondre, currentIndex);
});

