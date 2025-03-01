
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const { pipeline } = require('stream/promises');
const { createReadStream, createWriteStream } = require('fs');

adams({ nomCom: "thecsv", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, auteurMessage } = commandeOptions;
    
    // Reply that the bot is ready to receive a CSV file
    await repondre("Please send a contacts.csv file. I will process it and extract valid contacts.");
    
    // Set up a one-time message event listener for the CSV file
    const waitForCSV = async () => {
        return new Promise((resolve, reject) => {
            const listener = async (m) => {
                if (m.key.remoteJid === dest && m.key.fromMe === false) {
                    // Check if a document was sent and it's a CSV file
                    if (m.message && m.message.documentMessage) {
                        const doc = m.message.documentMessage;
                        if (doc.mimetype === 'text/csv' || doc.fileName.endsWith('.csv')) {
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
            }, 60000); // 1 minute timeout
            
            // Register the listener
            zk.ev.on('messages.upsert', async ({ messages }) => {
                for (const m of messages) {
                    await listener(m);
                }
            });
        });
    };
    
    try {
        // Wait for the CSV file
        const csvPath = await waitForCSV();
        
        // Process the contacts
        const validContacts = [];
        const corruptedContacts = [];
        
        // Create read stream and parse CSV
        const results = [];
        
        await new Promise((resolve, reject) => {
            createReadStream(csvPath)
                .pipe(csvParser())
                .on('data', (data) => results.push(data))
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });
        
        // Process each contact
        for (const row of results) {
            let phoneNumber = '';
            
            // Try to find a phone number field (common field names in CSV files)
            const possiblePhoneFields = ['phone', 'phone_number', 'mobile', 'cell', 'telephone', 'tel', 'contact', 'number', 'Phone', 'Phone Number', 'Mobile'];
            
            for (const field of possiblePhoneFields) {
                if (row[field]) {
                    phoneNumber = row[field].toString().trim();
                    break;
                }
            }
            
            // If no phone field found, try to use any field that looks like a phone number
            if (!phoneNumber) {
                for (const key in row) {
                    const value = row[key].toString().trim();
                    // Simple check: contains mostly digits and common phone number characters
                    if (value.replace(/[0-9+\-() ]/g, '').length < value.length * 0.3) {
                        phoneNumber = value;
                        break;
                    }
                }
            }
            
            // Skip empty phone numbers
            if (!phoneNumber) {
                corruptedContacts.push(row);
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
                            ...row,
                            cleanedNumber: phoneNumber,
                            jid: result.jid
                        });
                    } else {
                        corruptedContacts.push({
                            ...row,
                            cleanedNumber: phoneNumber,
                            reason: 'Not registered on WhatsApp'
                        });
                    }
                } catch (error) {
                    console.error("Error checking WhatsApp number:", error);
                    corruptedContacts.push({
                        ...row,
                        cleanedNumber: phoneNumber,
                        reason: 'Error checking number'
                    });
                }
            } else {
                corruptedContacts.push({
                    ...row,
                    cleanedNumber: phoneNumber,
                    reason: 'Invalid number format'
                });
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
            `✅ Valid Contacts: *${validContacts.length}*\n` +
            `❌ Corrupted Contacts: *${corruptedContacts.length}*\n\n` +
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
        console.error("Error in CSV command:", error);
        await repondre("❌ An error occurred while waiting for or processing the CSV file. Please try again.");
    }
});
