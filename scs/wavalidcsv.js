
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const csvParser = require('csv-parser');
const { Readable } = require('stream');

// Path to store WhatsApp contacts
const contactsStoragePath = path.join(__dirname, '../xmd/saved_whatsapp_contacts.json');

// Command to validate CSV file from URL and add contacts directly without WhatsApp validation
adams({ nomCom: "wavalidcsv", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;
    
    if (!arg || arg.length === 0) {
        return repondre("Please provide a URL to a CSV file containing contacts.\n\nExample: *.wavalidcsv https://example.com/contacts.csv*\n\nThe CSV file should have columns for name and phone number.");
    }
    
    const url = arg[0];
    
    // Send processing notification
    repondre(`📥 Downloading contacts from CSV URL:\n${url}\n\nThis will add all contacts directly without WhatsApp validation.`);
    
    try {
        // Download the CSV file content
        const response = await axios.get(url, {
            timeout: 30000,
            responseType: 'text',
            headers: {
                'Accept-Encoding': 'gzip, deflate, br',
                'User-Agent': 'WhatsApp-Contact-Processor/1.0'
            },
            maxContentLength: 10 * 1024 * 1024 // 10MB max
        });
        
        if (!response.data || response.data.trim() === '') {
            return repondre("❌ The downloaded file is empty or invalid.");
        }
        
        // Parse CSV data
        const contacts = [];
        const errors = [];
        let rowCount = 0;
        
        // Create a readable stream from the response data
        const stream = Readable.from([response.data]);
        
        // Process the CSV
        await new Promise((resolve, reject) => {
            stream
                .pipe(csvParser())
                .on('data', (row) => {
                    rowCount++;
                    
                    // Try to extract name and phone number from various common column names
                    let name = row.name || row.Name || row.NAME || row.contact || row.Contact || 
                               row.full_name || row.FullName || row.contactName || 
                               row['Contact Name'] || row['Full Name'] || `Contact ${rowCount}`;
                    
                    let phoneNumber = row.phone || row.Phone || row.PHONE || row.number || row.Number || 
                                      row.PhoneNumber || row.phone_number || row['Phone Number'] || 
                                      row.mobile || row.Mobile || row.cell || row.Cell || '';
                    
                    // Clean up the phone number
                    phoneNumber = phoneNumber.toString().replace(/[\s\+\-]/g, '');
                    
                    // Add country code if needed
                    if (!/^[1-9]\d{9,14}$/.test(phoneNumber)) {
                        if (phoneNumber.startsWith('0')) {
                            phoneNumber = '254' + phoneNumber.substring(1);
                        } else {
                            phoneNumber = '254' + phoneNumber;
                        }
                    }
                    
                    // Add to contacts array if valid number
                    if (phoneNumber && /^[1-9]\d{9,14}$/.test(phoneNumber)) {
                        contacts.push({ name, phoneNumber });
                    } else {
                        errors.push({ name, phoneNumber: phoneNumber || 'Missing' });
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });
        
        if (contacts.length === 0) {
            return repondre("❌ No valid contacts found in the CSV file. Please check the file format.");
        }
        
        // Save all contacts directly as WhatsApp users without validation
        const savedStats = saveContactsDirectly(contacts);
        
        // Generate report
        let report = [`📊 *CSV Contact Processing Report*\n\n`];
        report.push(`📁 *File:* ${url.split('/').pop() || 'CSV file'}\n`);
        report.push(`👥 *Total rows processed:* ${rowCount}\n`);
        report.push(`✅ *Valid contacts saved:* ${contacts.length}\n`);
        report.push(`❌ *Invalid contacts skipped:* ${errors.length}\n\n`);
        
        // Add sample of saved contacts
        report.push(`*Sample of saved contacts:*\n`);
        const sampleSize = Math.min(contacts.length, 10);
        for (let i = 0; i < sampleSize; i++) {
            report.push(`${i + 1}. ${contacts[i].name}: +${contacts[i].phoneNumber}`);
        }
        
        if (contacts.length > sampleSize) {
            report.push(`... and ${contacts.length - sampleSize} more contacts`);
        }
        
        // Add error samples if any
        if (errors.length > 0) {
            report.push(`\n*Sample of skipped contacts:*\n`);
            const errorSampleSize = Math.min(errors.length, 5);
            for (let i = 0; i < errorSampleSize; i++) {
                report.push(`${i + 1}. ${errors[i].name}: ${errors[i].phoneNumber} (Invalid format)`);
            }
            
            if (errors.length > errorSampleSize) {
                report.push(`... and ${errors.length - errorSampleSize} more invalid contacts`);
            }
        }
        
        // Join report parts
        const finalReport = report.join('\n');
        
        // Send report
        repondre(finalReport + "\n\n_All valid contacts have been saved for broadcast messages._");
        
    } catch (error) {
        console.error('Error processing CSV:', error);
        repondre(`❌ Error processing the CSV file: ${error.message || 'Unknown error'}\n\nPlease make sure the URL is valid and the file is in CSV format.`);
    }
});

// Function to save contacts directly without WhatsApp validation
function saveContactsDirectly(contacts) {
    try {
        // Load existing contacts or create new structure
        let existingData = { whatsappUsers: [], nonWhatsappUsers: [], messageSentTo: [], lastUpdated: '' };
        
        if (fs.existsSync(contactsStoragePath)) {
            const fileContent = fs.readFileSync(contactsStoragePath, 'utf8');
            try {
                existingData = JSON.parse(fileContent);
            } catch (e) {
                console.error('Error parsing contacts storage file:', e);
            }
        }
        
        // Extract existing WhatsApp users
        const existingWhatsappUsers = existingData.whatsappUsers || [];
        const existingMessageSentTo = existingData.messageSentTo || [];
        
        // Add new contacts
        let added = 0;
        let skipped = 0;
        
        contacts.forEach(contact => {
            // Check if contact already exists
            const exists = existingWhatsappUsers.some(u => u.phoneNumber === contact.phoneNumber);
            
            if (!exists) {
                existingWhatsappUsers.push(contact);
                added++;
            } else {
                skipped++;
            }
        });
        
        // Save updated data
        fs.writeFileSync(contactsStoragePath, JSON.stringify({
            whatsappUsers: existingWhatsappUsers,
            nonWhatsappUsers: existingData.nonWhatsappUsers || [],
            messageSentTo: existingMessageSentTo,
            lastUpdated: new Date().toISOString()
        }, null, 2));
        
        console.log(`Added ${added} new contacts, skipped ${skipped} duplicates`);
        
        return {
            added,
            skipped,
            total: existingWhatsappUsers.length
        };
    } catch (error) {
        console.error('Error saving contacts:', error);
        return null;
    }
}
