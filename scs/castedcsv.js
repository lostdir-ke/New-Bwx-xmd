
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const fs = require('fs');
const path = require('path');

// Path for storing saved contacts
const castedContactsPath = path.join(__dirname, '../xmd/casted.csv');

// Initialize contacts CSV if it doesn't exist
if (!fs.existsSync(castedContactsPath)) {
    fs.writeFileSync(castedContactsPath, 'Name,Phone Number,WhatsApp Status,Message Sent\n');
}

// Function to add contact to the CSV
function addContactToCSV(name, phoneNumber, whatsappStatus, messageSent = false) {
    try {
        const newContact = `"${name.replace(/"/g, '""')}",${phoneNumber},${whatsappStatus ? 'Registered' : 'Not Registered'},${messageSent ? 'Yes' : 'No'}\n`;
        fs.appendFileSync(castedContactsPath, newContact);
        return true;
    } catch (error) {
        console.error('Error adding contact to CSV:', error);
        return false;
    }
}

// Function to get contact count from CSV
function getContactCount() {
    try {
        if (!fs.existsSync(castedContactsPath)) {
            return 0;
        }
        
        const data = fs.readFileSync(castedContactsPath, 'utf8');
        // Count lines and subtract 1 for header
        const lines = data.split('\n').filter(line => line.trim() !== '');
        return Math.max(0, lines.length - 1); // Ensure non-negative
    } catch (error) {
        console.error('Error counting contacts:', error);
        return 0;
    }
}

// Function to extract phone number from JID
function extractPhoneNumber(jid) {
    if (typeof jid !== 'string') return '';
    return jid.split('@')[0];
}

// Function to mark a number as messaged in the CSV
function markNumberAsMessaged(phoneNumber) {
    try {
        const data = fs.readFileSync(castedContactsPath, 'utf8');
        const lines = data.split('\n');
        let modified = false;
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            
            const columns = lines[i].split(',');
            if (columns.length >= 2 && columns[1] === phoneNumber) {
                const parts = lines[i].split(',');
                parts[3] = 'Yes';
                lines[i] = parts.join(',');
                modified = true;
            }
        }
        
        if (modified) {
            fs.writeFileSync(castedContactsPath, lines.join('\n'));
        }
        
        return modified;
    } catch (error) {
        console.error('Error marking number as messaged:', error);
        return false;
    }
}

// Command to process vCard/contact messages
adams({ nomCom: "castedcsv", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg, superUser } = commandeOptions;
    
    // Check if this is a command to view stats or process a contact
    if (!ms.message || !ms.message.contactMessage) {
        // Display stats about saved contacts
        const contactCount = getContactCount();
        
        if (contactCount === 0) {
            return repondre("📊 *Contact Casting Status*\n\nNo contacts have been saved yet.\n\nTo use this feature, send a contact card with this command or forward a contact to the bot.");
        }
        
        return repondre(`📊 *Contact Casting Status*\n\n• Total contacts saved: ${contactCount}\n\nTo add more contacts, send a contact card with this command or forward a contact to the bot.`);
    }
    
    // Extract contact information
    try {
        const vcard = ms.message.contactMessage.vcard;
        
        // Parse vCard to extract name and number
        let name = "Unknown Contact";
        let phoneNumber = "";
        
        // Extract display name
        const fnMatch = vcard.match(/FN:(.*)/i);
        if (fnMatch && fnMatch[1]) {
            name = fnMatch[1].trim();
        }
        
        // Extract phone number
        const telMatch = vcard.match(/TEL;.*:(.+)/i);
        if (telMatch && telMatch[1]) {
            phoneNumber = telMatch[1].replace(/\D/g, '');
        }
        
        // If we couldn't extract a phone number, try from the contact message directly
        if (!phoneNumber && ms.message.contactMessage.displayName) {
            const displayName = ms.message.contactMessage.displayName;
            const numberMatch = displayName.match(/\d+/);
            if (numberMatch) {
                phoneNumber = numberMatch[0];
            }
        }
        
        // If still no phone number, inform the user
        if (!phoneNumber) {
            return repondre("❌ Could not extract a valid phone number from this contact.");
        }
        
        // Clean up phone number format
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
        
        // Send initial processing message
        repondre(`🔍 Processing contact: *${name}* with number *${phoneNumber}*...`);
        
        // Check if phone number exists on WhatsApp
        try {
            const [result] = await zk.onWhatsApp(phoneNumber + '@s.whatsapp.net');
            
            if (result && result.exists) {
                // Save as WhatsApp user
                addContactToCSV(name, phoneNumber, true);
                
                // Send message to the contact
                const message = "I'm NICHOLAS, another status viewer. Can we be friends? Please save my number. Your contact is already saved in my phone.";
                
                await zk.sendMessage(`${phoneNumber}@s.whatsapp.net`, { 
                    text: `Hello ${name}, ${message}` 
                });
                
                // Mark as messaged
                markNumberAsMessaged(phoneNumber);
                
                return repondre(`✅ *Contact Processed*\n\n• Name: *${name}*\n• Number: *${phoneNumber}*\n• WhatsApp Status: *Registered*\n• Message: *Sent*\n\nContact saved to CSV database!`);
            } else {
                // Save as non-WhatsApp user
                addContactToCSV(name, phoneNumber, false);
                
                return repondre(`⚠️ *Contact Processed*\n\n• Name: *${name}*\n• Number: *${phoneNumber}*\n• WhatsApp Status: *Not Registered*\n• Message: *Not Sent*\n\nContact saved to CSV database!`);
            }
        } catch (error) {
            console.error("Error checking WhatsApp status:", error);
            
            // Save without WhatsApp status
            addContactToCSV(name, phoneNumber, false);
            
            return repondre(`⚠️ *Contact Partially Processed*\n\n• Name: *${name}*\n• Number: *${phoneNumber}*\n• WhatsApp Status: *Error Checking*\n• Message: *Not Sent*\n\nContact saved to CSV database with limited information. Error: ${error.message}`);
        }
    } catch (error) {
        console.error("Error processing contact:", error);
        return repondre(`❌ Error processing contact: ${error.message}`);
    }
});

// Command to send messages to all contacts in CSV who haven't been messaged yet
adams({ nomCom: "castbroadcast", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre, superUser } = commandeOptions;
    
    // Only allow the bot owner to use this command
    if (!superUser) {
        return repondre("❌ Only the bot owner can use this command.");
    }
    
    try {
        // Read the CSV file
        if (!fs.existsSync(castedContactsPath)) {
            return repondre("❌ No contacts found in the database. Use .castedcsv with a contact to add one first.");
        }
        
        const data = fs.readFileSync(castedContactsPath, 'utf8');
        const lines = data.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length <= 1) { // Only header exists
            return repondre("❌ No contacts found in the database. Use .castedcsv with a contact to add one first.");
        }
        
        // Process each contact (skip header)
        let pendingCount = 0;
        let sentCount = 0;
        let skipCount = 0;
        
        repondre(`🔄 Starting to broadcast messages to contacts in CSV...`);
        
        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split(',');
            
            // Check if we have enough columns and the contact is on WhatsApp
            if (columns.length >= 4) {
                const name = columns[0].replace(/^"|"$/g, '').replace(/""/g, '"');
                const phoneNumber = columns[1];
                const isWhatsApp = columns[2] === 'Registered';
                const isMessaged = columns[3] === 'Yes';
                
                // Only process WhatsApp contacts that haven't been messaged
                if (isWhatsApp && !isMessaged) {
                    pendingCount++;
                    
                    try {
                        // Send message
                        const message = "I'm NICHOLAS, another status viewer. Can we be friends? Please save my number. Your contact is already saved in my phone.";
                        
                        await zk.sendMessage(`${phoneNumber}@s.whatsapp.net`, { 
                            text: `Hello ${name}, ${message}` 
                        });
                        
                        // Mark as messaged
                        markNumberAsMessaged(phoneNumber);
                        sentCount++;
                        
                        // Send progress update every 5 messages
                        if (sentCount % 5 === 0) {
                            await zk.sendMessage(dest, { 
                                text: `📤 Progress: Sent messages to ${sentCount}/${pendingCount} pending contacts.` 
                            });
                        }
                        
                        // Add delay to avoid rate limiting (30-60 seconds)
                        const delay = Math.floor(Math.random() * 30000) + 30000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    } catch (error) {
                        console.error(`Error sending message to ${phoneNumber}:`, error);
                    }
                } else if (isMessaged) {
                    skipCount++;
                }
            }
        }
        
        // Send final report
        const report = `📊 *Cast Broadcast Report*\n\n` +
                       `✅ Successfully sent: ${sentCount}\n` +
                       `⏭️ Skipped (already sent): ${skipCount}\n` +
                       `❌ Not on WhatsApp: ${lines.length - 1 - sentCount - skipCount}\n\n` +
                       `Total contacts in database: ${lines.length - 1}`;
        
        repondre(report);
    } catch (error) {
        console.error("Error in cast broadcast:", error);
        repondre(`❌ Error during broadcast: ${error.message}`);
    }
});

// Command to delete the casted.csv file and start fresh
adams({ nomCom: "castclear", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre, superUser } = commandeOptions;
    
    // Only allow the bot owner to use this command
    if (!superUser) {
        return repondre("❌ Only the bot owner can use this command.");
    }
    
    try {
        if (fs.existsSync(castedContactsPath)) {
            // Re-initialize with just the header
            fs.writeFileSync(castedContactsPath, 'Name,Phone Number,WhatsApp Status,Message Sent\n');
            return repondre("✅ The casted contacts database has been cleared.");
        } else {
            return repondre("⚠️ No casted contacts database found.");
        }
    } catch (error) {
        console.error("Error clearing database:", error);
        return repondre(`❌ Error clearing database: ${error.message}`);
    }
});

// Command to export the casted.csv file
adams({ nomCom: "castexport", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre, superUser } = commandeOptions;
    
    // Only allow the bot owner to use this command
    if (!superUser) {
        return repondre("❌ Only the bot owner can use this command.");
    }
    
    try {
        if (!fs.existsSync(castedContactsPath)) {
            return repondre("⚠️ No casted contacts database found.");
        }
        
        const contactCount = getContactCount();
        
        if (contactCount === 0) {
            return repondre("⚠️ No contacts in the database.");
        }
        
        // Send the CSV file
        await zk.sendMessage(dest, {
            document: fs.readFileSync(castedContactsPath),
            mimetype: 'text/csv',
            fileName: 'casted_contacts.csv',
            caption: `📊 Exported Casted Contacts\n\nTotal contacts: ${contactCount}`
        });
    } catch (error) {
        console.error("Error exporting database:", error);
        return repondre(`❌ Error exporting database: ${error.message}`);
    }
});
