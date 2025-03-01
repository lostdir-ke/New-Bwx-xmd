
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const fs = require('fs');
const path = require('path');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

adams({ nomCom: "csvfile", categorie: "General", reaction: "📊" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;

    try {
        // Check if it's a reply with a document
        if (ms.quoted || ms.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            await repondre("📄 File detected in your reply! Downloading...");
            
            try {
                // Get the message containing the document
                let documentMsg;
                let buffer;
                let fileName = '';
                
                if (ms.quoted) {
                    // Direct quoted message approach
                    documentMsg = ms.quoted;
                    
                    // Check if it contains a document
                    if (documentMsg.message?.documentMessage) {
                        // Using the correct method to download quoted media
                        buffer = await zk.downloadAndSaveMediaMessage(documentMsg);
                        fileName = documentMsg.message.documentMessage.fileName || 'file_' + Date.now() + '.csv';
                    } else {
                        throw new Error("No document found in the quoted message");
                    }
                } else {
                    // Get message from context info
                    const context = ms.message.extendedTextMessage.contextInfo;
                    
                    if (context.quotedMessage?.documentMessage) {
                        // Create proper message object for downloading
                        const quotedMsg = {
                            key: {
                                remoteJid: dest,
                                id: context.stanzaId,
                                fromMe: context.participant === zk.user.id
                            },
                            message: context.quotedMessage
                        };
                        
                        // Using the correct method
                        buffer = await zk.downloadAndSaveMediaMessage(quotedMsg);
                        fileName = context.quotedMessage.documentMessage.fileName || 'file_' + Date.now() + '.csv';
                    } else {
                        throw new Error("No document found in the context");
                    }
                }
                
                if (!buffer) {
                    throw new Error("Failed to download document");
                }
                
                // Ensure file has .csv extension if not provided
                if (!fileName.toLowerCase().endsWith('.csv')) {
                    fileName += '.csv';
                }
                
                // Create folder with date to organize files
                const today = new Date();
                const dateFolder = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
                const datePath = path.join(uploadsDir, dateFolder);
                
                if (!fs.existsSync(datePath)) {
                    fs.mkdirSync(datePath, { recursive: true });
                }
                
                // Save file with timestamp to prevent overwriting
                const timestamp = Date.now();
                const finalFileName = `${timestamp}_${fileName}`;
                const filePath = path.join(datePath, finalFileName);
                
                fs.writeFileSync(filePath, buffer);
                
                // Create relative path for display
                const relativePath = path.join('uploads', dateFolder, finalFileName);
                
                await repondre(`✅ File saved successfully!\n\n*File Details:*\n• *Name:* ${fileName}\n• *Size:* ${(buffer.length / 1024).toFixed(2)} KB\n• *Path:* ${relativePath}`);
                
                // Send the file back with additional info
                await zk.sendMessage(dest, {
                    document: fs.readFileSync(filePath),
                    mimetype: 'text/csv',
                    fileName: finalFileName,
                    caption: `📊 *File saved with ID: ${timestamp}*\n\nTo use this file with CSV processor, reply to this file with .thecsv command.`
                });
                
            } catch (error) {
                console.error("Error downloading document:", error);
                await repondre(`❌ Error saving file: ${error.message}\n\nPlease upload the file directly after using the command.`);
            }
        } else {
            // No reply, wait for direct upload
            await repondre("📋 *CSV File Storage*\n\nPlease upload your CSV file now, and I'll save it for you.");
            
            // Setup listener for incoming files
            const listener = async (msg) => {
                if (!msg.message || msg.key.fromMe) return;
                
                // Check if it's a document
                const doc = msg.message.documentMessage;
                if (doc) {
                    // Remove listener
                    zk.ev.off('messages.upsert', handler);
                    clearTimeout(timeout);
                    
                    await repondre("📄 Downloading your file...");
                    
                    try {
                        // Download the file using the correct method
                        const buffer = await zk.downloadAndSaveMediaMessage(msg);
                        
                        // Get file name or create one
                        let fileName = doc.fileName || 'file_' + Date.now() + '.csv';
                        
                        // Ensure file has .csv extension if not provided
                        if (!fileName.toLowerCase().endsWith('.csv')) {
                            fileName += '.csv';
                        }
                        
                        // Create folder with date to organize files
                        const today = new Date();
                        const dateFolder = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
                        const datePath = path.join(uploadsDir, dateFolder);
                        
                        if (!fs.existsSync(datePath)) {
                            fs.mkdirSync(datePath, { recursive: true });
                        }
                        
                        // Save file with timestamp to prevent overwriting
                        const timestamp = Date.now();
                        const finalFileName = `${timestamp}_${fileName}`;
                        const filePath = path.join(datePath, finalFileName);
                        
                        fs.writeFileSync(filePath, buffer);
                        
                        // Create relative path for display
                        const relativePath = path.join('uploads', dateFolder, finalFileName);
                        
                        await repondre(`✅ File saved successfully!\n\n*File Details:*\n• *Name:* ${fileName}\n• *Size:* ${(buffer.length / 1024).toFixed(2)} KB\n• *Path:* ${relativePath}`);
                        
                        // Send the file back with additional info
                        await zk.sendMessage(dest, {
                            document: fs.readFileSync(filePath),
                            mimetype: doc.mimetype || 'text/csv',
                            fileName: finalFileName,
                            caption: `📊 *File saved with ID: ${timestamp}*\n\nTo use this file with CSV processor, reply to this file with .thecsv command.`
                        });
                        
                    } catch (error) {
                        console.error("Error processing direct upload:", error);
                        await repondre("❌ Error saving your file. Please try again.");
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
                repondre("⏱️ Time expired. Please try again with `.csvfile`.");
            }, 300000); // 5 minute timeout
        }
    } catch (error) {
        console.error("Error in file storage command:", error);
        await repondre("❌ An error occurred. To use this command:\n\n1️⃣ Type `.csvfile` first, then upload a file\n2️⃣ OR Reply to a file with `.csvfile`\n\nYour files will be saved for later use.");
    }
});
