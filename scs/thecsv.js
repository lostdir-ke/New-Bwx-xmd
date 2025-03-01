
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { createReadStream, createWriteStream } = require('fs');

adams({ nomCom: "thecsv", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, auteurMessage } = commandeOptions;
    
    // Reply that the bot is ready to receive a CSV file
    await repondre("Please send a contacts.csv file. I will process it and extract valid contacts.");
    
    // Check if command is a reply to a document
    const quotedMsg = ms.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quotedMsg && quotedMsg.documentMessage) {
        const doc = quotedMsg.documentMessage;
        if (doc.mimetype === 'text/csv' || 
            doc.mimetype === 'application/csv' ||
            doc.mimetype === 'text/comma-separated-values' ||
            doc.mimetype === 'application/vnd.ms-excel' ||
            doc.fileName?.toLowerCase().endsWith('.csv')) {
            
            try {
                await repondre("📄 CSV file detected in your reply! Processing contacts...");
                
                // Get the message that was replied to
                const quotedM = {
                    message: {
                        documentMessage: doc
                    },
                    key: {
                        remoteJid: dest
                    }
                };
                
                // Download the document
                const buffer = await zk.downloadMediaMessage(quotedM);
                const csvPath = path.join(__dirname, '..', 'temp_contacts.csv');
                fs.writeFileSync(csvPath, buffer);
                
                // Process the CSV file directly
                return processCSVFile(csvPath);
            } catch (error) {
                console.error("Error processing CSV from reply:", error);
                await repondre("❌ Error processing the CSV file from your reply. Please try again.");
                return;
            }
        } else {
            await repondre("⚠️ The file you replied to is not a valid CSV file.");
            return;
        }
    }
    
    // Set up a one-time message event listener for the CSV file
    const waitForCSV = async () => {
        return new Promise((resolve, reject) => {
            const listener = async (m) => {
                if (m.key.remoteJid === dest && m.key.fromMe === false) {
                    // Check if a document was sent and it's a CSV file
                    if (m.message && m.message.documentMessage) {
                        const doc = m.message.documentMessage;
                        if (doc.mimetype === 'text/csv' || 
                            doc.mimetype === 'application/csv' ||
                            doc.mimetype === 'text/comma-separated-values' ||
                            doc.mimetype === 'application/vnd.ms-excel' ||
                            doc.fileName?.toLowerCase().endsWith('.csv')) {
                            // Remove the listener since we got what we wanted
                            zk.ev.off('messages.upsert', listener);
                            
                            try {
                                // Notify that we've received the file
                                await repondre("📄 CSV file received! Processing contacts...");
                                
                                // Download the document
                                const buffer = await zk.downloadMediaMessage(m);
                                const csvPath = path.join(__dirname, '..', 'temp_contacts.csv');
                                fs.writeFileSync(csvPath, buffer);
                                
                                // Process the CSV file
                                resolve(csvPath);
                            } catch (error) {
                                console.error("Error processing CSV:", error);
                                await repondre("❌ Error processing the CSV file. Please try again.");
                                reject(error);
                            }
                        } else {
                            await repondre("⚠️ Please send a valid CSV file.");
                        }
                    }
                }
            };
            
            // Set a timeout to clean up the listener if no CSV is received
            const timeout = setTimeout(() => {
                zk.ev.off('messages.upsert', listener);
                reject(new Error("Timeout waiting for CSV file"));
            }, 300000); // 5 minutes timeout
            
            // Notify user about timeout
            setTimeout(() => {
                repondre("⏳ Still waiting for CSV file... You have 4 minutes remaining.");
            }, 60000); // After 1 minute remind user
            
            // Register the listener
            zk.ev.on('messages.upsert', async ({ messages }) => {
                for (const m of messages) {
                    await listener(m);
                }
            });
        });
    };
    
    // Function to process CSV file
    const processCSVFile = async (csvPath) => {
        // Process the contacts
        const validContacts = [];
        const corruptedContacts = [];
        
        try {
        
        // Read and parse CSV manually
        const fileContent = fs.readFileSync(csvPath, 'utf8');
        const lines = fileContent.split(/\r?\n/);
        const headers = lines[0].split(',');
        
        // Find phone number column index
        let phoneColumnIndices = [];
        headers.forEach((header, index) => {
            if (header.toLowerCase().includes('phone') || 
                header.toLowerCase().includes('telephone') || 
                header.toLowerCase().includes('mobile') || 
                header.toLowerCase().includes('cell')) {
                phoneColumnIndices.push(index);
            }
        });
        
        // Process each line (skip header)
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue; // Skip empty lines
            
            // Handle commas within quotes
            let row = [];
            let insideQuotes = false;
            let currentValue = '';
            
            for (let char of lines[i]) {
                if (char === '"' && (currentValue.length === 0 || currentValue[currentValue.length - 1] !== '\\')) {
                    insideQuotes = !insideQuotes;
                } else if (char === ',' && !insideQuotes) {
                    row.push(currentValue);
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            row.push(currentValue); // Push the last value
            
            // Create an object from the row
            const contact = {};
            for (let j = 0; j < headers.length; j++) {
                if (j < row.length) {
                    contact[headers[j]] = row[j];
                } else {
                    contact[headers[j]] = '';
                }
            }
            
            // Extract phone number
            let phoneNumber = '';
            for (const index of phoneColumnIndices) {
                if (index < row.length && row[index]) {
                    phoneNumber = row[index].toString().trim();
                    // Remove quotes if present
                    phoneNumber = phoneNumber.replace(/^"|"$/g, '');
                    if (phoneNumber) break;
                }
            }
            
            // If no phone number found in designated columns, look for anything that looks like a phone number
            if (!phoneNumber) {
                for (const value of row) {
                    const cleanedValue = value.toString().trim().replace(/^"|"$/g, '');
                    // Check if value looks like a phone number
                    if (/(?:\+?\d{10,15}|\+?\d{1,3}[-\s]?\d{3,4}[-\s]?\d{4,7})/.test(cleanedValue)) {
                        phoneNumber = cleanedValue;
                        break;
                    }
                }
            }
            
            // Skip entries without phone numbers
            if (!phoneNumber) {
                corruptedContacts.push({
                    ...contact,
                    reason: 'No phone number found'
                });
                continue;
            }
            
            // Clean the phone number: remove non-digit chars except + at the beginning
            phoneNumber = phoneNumber.replace(/\s+/g, '');
            phoneNumber = phoneNumber.replace(/[^0-9+]/g, '');
            if (phoneNumber.startsWith('+')) {
                phoneNumber = phoneNumber.substring(1);
            }
            
            // If number doesn't have country code (using Kenya 254 as default)
            if (phoneNumber.length < 10 || !/^[1-9]\d{1,3}/.test(phoneNumber)) {
                if (phoneNumber.startsWith('0')) {
                    phoneNumber = '254' + phoneNumber.substring(1);
                } else {
                    phoneNumber = '254' + phoneNumber;
                }
            }
            
            // Check if the number is valid (at least 10 digits, not more than 15)
            if (phoneNumber.length >= 10 && phoneNumber.length <= 15) {
                // Check if it's a WhatsApp number
                try {
                    const [result] = await zk.onWhatsApp(phoneNumber + '@s.whatsapp.net');
                    if (result && result.exists) {
                        validContacts.push({
                            ...contact,
                            cleanedNumber: phoneNumber,
                            jid: result.jid
                        });
                    } else {
                        corruptedContacts.push({
                            ...contact,
                            cleanedNumber: phoneNumber,
                            reason: 'Not registered on WhatsApp'
                        });
                    }
                } catch (error) {
                    console.error("Error checking WhatsApp number:", error);
                    corruptedContacts.push({
                        ...contact,
                        cleanedNumber: phoneNumber,
                        reason: 'Error checking number'
                    });
                }
            } else {
                corruptedContacts.push({
                    ...contact,
                    cleanedNumber: phoneNumber,
                    reason: 'Invalid number format'
                });
            }
            
            // Show processing progress every 10 contacts
            if ((validContacts.length + corruptedContacts.length) % 10 === 0) {
                await repondre(`Processing... Checked ${validContacts.length + corruptedContacts.length} contacts so far.`);
            }
        }
        
        // Save valid contacts to a file
        const validContactsPath = path.join(__dirname, '..', 'valid_contacts.json');
        fs.writeFileSync(validContactsPath, JSON.stringify(validContacts, null, 2));
        
        // Save corrupted contacts to a file
        const corruptedContactsPath = path.join(__dirname, '..', 'corrupted_contacts.json');
        fs.writeFileSync(corruptedContactsPath, JSON.stringify(corruptedContacts, null, 2));
        
        // Clean up the temporary CSV file
            fs.unlinkSync(csvPath);
            
            // Send the results
            await repondre(`📊 *CSV Processing Complete*\n\n` +
                `✅ Valid WhatsApp Contacts: *${validContacts.length}*\n` +
                `❌ Invalid/Non-WhatsApp Contacts: *${corruptedContacts.length}*\n\n` +
                `The contacts have been processed and saved. Valid contacts are stored in valid_contacts.json and corrupted ones in corrupted_contacts.json.`);
                
            // Send the valid contacts file if there are any
            if (validContacts.length > 0) {
                await zk.sendMessage(dest, {
                    document: fs.readFileSync(validContactsPath),
                    mimetype: 'application/json',
                    fileName: 'valid_contacts.json',
                    caption: `✅ ${validContacts.length} valid WhatsApp contacts`
                });
            }
            
            // Send the corrupted contacts file if there are any
            if (corruptedContacts.length > 0) {
                await zk.sendMessage(dest, {
                    document: fs.readFileSync(corruptedContactsPath),
                    mimetype: 'application/json',
                    fileName: 'corrupted_contacts.json',
                    caption: `❌ ${corruptedContacts.length} invalid or non-WhatsApp contacts`
                });
            }
            
        } catch (error) {
            console.error("Error processing CSV:", error);
            await repondre("❌ An error occurred while processing the CSV file. Please try again.");
        }
    };
    
    try {
        // If we didn't already process a reply to a file, wait for the CSV file
        if (!(quotedMsg && quotedMsg.documentMessage)) {
            await repondre("⏱️ Waiting for your CSV file... Please send it within 5 minutes.");
            const csvPath = await waitForCSV();
            await processCSVFile(csvPath);
        }
    } catch (error) {
        console.error("Error in CSV command:", error);
        await repondre("❌ An error occurred while waiting for or processing the CSV file. Please try again.");
    }
});
