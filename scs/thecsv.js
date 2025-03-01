
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const fs = require('fs');
const path = require('path');
const { createReadStream } = require('fs');

adams({ nomCom: "thecsv", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, auteurMessage } = commandeOptions;

    try {
        // Check if we're replying to a message with a document
        if (ms.quoted || ms.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            await repondre("📄 CSV file detected in your reply! Processing contacts...");
            
            try {
                // Get the message containing the document
                let documentMsg;
                let buffer;
                
                if (ms.quoted) {
                    // Direct quoted message approach
                    documentMsg = ms.quoted;
                    
                    // Check if it contains a document
                    if (documentMsg.message?.documentMessage) {
                        buffer = await zk.downloadMediaMessage(documentMsg);
                    } else {
                        throw new Error("No document found in the quoted message");
                    }
                } else {
                    // Get message from context info
                    const context = ms.message.extendedTextMessage.contextInfo;
                    
                    if (context.quotedMessage?.documentMessage) {
                        // Download using context info
                        buffer = await zk.downloadMediaMessage({
                            key: {
                                remoteJid: dest,
                                id: context.stanzaId,
                                fromMe: context.participant === zk.user.id
                            },
                            message: {
                                documentMessage: context.quotedMessage.documentMessage
                            }
                        });
                    } else {
                        throw new Error("No document found in the context");
                    }
                }
                
                if (!buffer) {
                    throw new Error("Failed to download document");
                }
                
                // Save and process the CSV
                const csvPath = path.join(__dirname, '..', 'temp_contacts.csv');
                fs.writeFileSync(csvPath, buffer);
                
                // Process the CSV
                await processCSV(csvPath);
            } catch (error) {
                console.error("Error downloading document:", error);
                
                // Try one last approach - wait for a direct upload
                await repondre("❌ Unable to download file from your reply. Please upload the CSV file now.");
                
                // Setup listener for incoming files
                const listener = async (msg) => {
                    if (!msg.message || msg.key.fromMe) return;
                    
                    // Check if it's a document
                    const doc = msg.message.documentMessage;
                    if (doc && (doc.fileName?.toLowerCase().endsWith('.csv') || 
                              doc.mimetype === 'text/csv' ||
                              doc.mimetype === 'application/csv')) {
                        // Remove listener
                        zk.ev.off('messages.upsert', handler);
                        clearTimeout(timeout);
                        
                        await repondre("📄 Processing your CSV file...");
                        
                        try {
                            // Download the file
                            const buffer = await zk.downloadMediaMessage(msg);
                            const csvPath = path.join(__dirname, '..', 'temp_contacts.csv');
                            fs.writeFileSync(csvPath, buffer);
                            
                            // Process the CSV
                            await processCSV(csvPath);
                        } catch (error) {
                            console.error("Error processing direct upload:", error);
                            await repondre("❌ Error processing your file. Please try again.");
                        }
                    }
                };
                
                // Setup message handler
                const handler = ({ messages }) => {
                    for (const msg of messages) {
                        if (msg.key.remoteJid === dest) {
                            listener(msg).catch(console.error);
                        }
                    }
                };
                
                // Register listener
                zk.ev.on('messages.upsert', handler);
                
                // Setup timeout
                const timeout = setTimeout(() => {
                    zk.ev.off('messages.upsert', handler);
                    repondre("⏱️ Time expired. Please try again with `.thecsv`.");
                }, 300000); // 5 minute timeout
            }
        } else {
            // No reply, wait for direct upload
            await repondre("📋 *CSV Contact Processor*\n\nPlease upload your contacts.csv file now.");
            
            // Setup listener for incoming files
            const listener = async (msg) => {
                if (!msg.message || msg.key.fromMe) return;
                
                // Check if it's a document
                const doc = msg.message.documentMessage;
                if (doc && (doc.fileName?.toLowerCase().endsWith('.csv') || 
                          doc.mimetype === 'text/csv' ||
                          doc.mimetype === 'application/csv')) {
                    // Remove listener
                    zk.ev.off('messages.upsert', handler);
                    clearTimeout(timeout);
                    
                    await repondre("📄 Processing your CSV file...");
                    
                    try {
                        // Download the file
                        const buffer = await zk.downloadMediaMessage(msg);
                        const csvPath = path.join(__dirname, '..', 'temp_contacts.csv');
                        fs.writeFileSync(csvPath, buffer);
                        
                        // Process the CSV
                        await processCSV(csvPath);
                    } catch (error) {
                        console.error("Error processing direct upload:", error);
                        await repondre("❌ Error processing your file. Please try again.");
                    }
                }
            };
            
            // Setup message handler
            const handler = ({ messages }) => {
                for (const msg of messages) {
                    if (msg.key.remoteJid === dest) {
                        listener(msg).catch(console.error);
                    }
                }
            };
            
            // Register listener
            zk.ev.on('messages.upsert', handler);
            
            // Setup timeout
            const timeout = setTimeout(() => {
                zk.ev.off('messages.upsert', handler);
                repondre("⏱️ Time expired. Please try again with `.thecsv`.");
            }, 300000); // 5 minute timeout
        }
    } catch (error) {
        console.error("Error in main command handler:", error);
        await repondre("❌ An error occurred. To use this command:\n\n1️⃣ Type `.thecsv` first, then upload a CSV file\n2️⃣ OR Reply to a CSV file with `.thecsv`\n\nMake sure your CSV file contains contact numbers.");
    }
    
    // Process CSV function
    async function processCSV(csvPath) {
        try {
            const validContacts = [];
            const invalidContacts = [];
            
            // Read file
            const content = fs.readFileSync(csvPath, 'utf8');
            const lines = content.split(/\r?\n/).filter(line => line.trim());
            
            if (lines.length < 2) {
                await repondre("❌ CSV file is empty or invalid.");
                return;
            }
            
            // Parse headers
            const headers = lines[0].split(',');
            
            // Find phone column
            const phoneColumns = headers.map((header, index) => {
                if (/phone|mobile|cell|contact|tel|number/i.test(header)) {
                    return index;
                }
                return -1;
            }).filter(idx => idx !== -1);
            
            if (phoneColumns.length === 0) {
                await repondre("❌ Could not find a phone number column in your CSV.");
                return;
            }
            
            // Process rows
            await repondre(`Found ${lines.length-1} contacts in CSV. Processing...`);
            
            let processedCount = 0;
            for (let i = 1; i < lines.length; i++) {
                const row = parseCSVLine(lines[i]);
                if (!row.length) continue;
                
                // Extract phone from possible columns
                let phone = '';
                for (const colIdx of phoneColumns) {
                    if (colIdx < row.length && row[colIdx]) {
                        phone = row[colIdx].replace(/[^0-9+]/g, '');
                        if (phone) break;
                    }
                }
                
                if (!phone) {
                    invalidContacts.push({ row, reason: 'No phone number found' });
                    continue;
                }
                
                // Format phone number
                if (phone.startsWith('0')) {
                    phone = '254' + phone.substring(1);
                } else if (!phone.startsWith('+') && !(/^\d{1,3}/).test(phone)) {
                    phone = '254' + phone;
                }
                
                if (phone.startsWith('+')) {
                    phone = phone.substring(1);
                }
                
                // Check if it's a valid WhatsApp number
                try {
                    const [result] = await zk.onWhatsApp(phone + '@s.whatsapp.net');
                    if (result && result.exists) {
                        validContacts.push({
                            phone: phone,
                            jid: result.jid,
                            data: row.reduce((obj, val, idx) => {
                                if (idx < headers.length) {
                                    obj[headers[idx]] = val;
                                }
                                return obj;
                            }, {})
                        });
                    } else {
                        invalidContacts.push({ 
                            phone: phone, 
                            reason: 'Not on WhatsApp',
                            data: row.reduce((obj, val, idx) => {
                                if (idx < headers.length) {
                                    obj[headers[idx]] = val;
                                }
                                return obj;
                            }, {})
                        });
                    }
                } catch (error) {
                    invalidContacts.push({ phone: phone, reason: 'Error checking', data: row });
                }
                
                // Progress updates
                processedCount++;
                if (processedCount % 10 === 0) {
                    await repondre(`Processing: ${processedCount}/${lines.length-1} contacts checked.`);
                }
            }
            
            // Save results
            const validPath = path.join(__dirname, '..', 'valid_contacts.json');
            const invalidPath = path.join(__dirname, '..', 'invalid_contacts.json');
            
            fs.writeFileSync(validPath, JSON.stringify(validContacts, null, 2));
            fs.writeFileSync(invalidPath, JSON.stringify(invalidContacts, null, 2));
            
            // Clean up
            fs.unlinkSync(csvPath);
            
            // Report results
            await repondre(`✅ Processing complete!\n\n• Valid WhatsApp contacts: *${validContacts.length}*\n• Invalid contacts: *${invalidContacts.length}*`);
            
            // Send result files
            if (validContacts.length > 0) {
                await zk.sendMessage(dest, {
                    document: fs.readFileSync(validPath),
                    mimetype: 'application/json',
                    fileName: 'valid_contacts.json',
                    caption: `✅ ${validContacts.length} valid WhatsApp contacts`
                });
            }
            
            if (invalidContacts.length > 0) {
                await zk.sendMessage(dest, {
                    document: fs.readFileSync(invalidPath),
                    mimetype: 'application/json',
                    fileName: 'invalid_contacts.json',
                    caption: `❌ ${invalidContacts.length} invalid/non-WhatsApp contacts`
                });
            }
        } catch (error) {
            console.error("CSV processing error:", error);
            await repondre("❌ Error processing CSV: " + error.message);
        }
    }
    
    // Helper to parse CSV lines with quotes correctly
    function parseCSVLine(line) {
        const result = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(currentValue.trim().replace(/^"|"$/g, ''));
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        
        result.push(currentValue.trim().replace(/^"|"$/g, ''));
        return result;
    }
});
