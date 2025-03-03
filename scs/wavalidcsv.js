
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Path for storing saved WhatsApp contacts
const contactsStoragePath = path.join(__dirname, '../xmd/saved_whatsapp_contacts.json');

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
            nonWhatsappCount: mergedNonWhatsappUsers.length,
            whatsappAdded,
            nonWhatsappAdded
        };
    } catch (error) {
        console.error('Error saving contacts:', error);
        return null;
    }
}

// Function to format phone number with proper country code
function formatPhoneNumber(phoneNumber) {
    // Remove any spaces, plus signs, or hyphens
    phoneNumber = phoneNumber.replace(/[\s\+\-]/g, '');
    
    // If number starts with 0, add 254 (Kenya) country code
    if (phoneNumber.startsWith('0')) {
        phoneNumber = '254' + phoneNumber.substring(1);
    } 
    // If number doesn't have country code (less than 10 digits), add 254
    else if (phoneNumber.length < 10 || !/^[1-9]\d{1,3}/.test(phoneNumber)) {
        phoneNumber = '254' + phoneNumber;
    }
    
    return phoneNumber;
}

// Main command for validating CSV from URL
adams({ nomCom: "wavalidcsv", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre, arg } = commandeOptions;
    
    // Check if URL is provided
    if (!arg || arg.length === 0) {
        return repondre("Please provide a URL to a CSV file containing phone numbers.\n\nExample: *.wavalidcsv https://example.com/contacts.csv*\n\nThe CSV should have a column with phone numbers.");
    }
    
    const url = arg[0];
    
    // Send processing notification
    repondre(`🔍 Downloading CSV from URL:\n${url}\n\nThis process will validate all numbers automatically and save WhatsApp users.`);
    
    try {
        // Download the CSV file content
        const response = await axios.get(url, {
            timeout: 30000, // 30 seconds timeout
            responseType: 'text',
            headers: {
                'Accept-Encoding': 'gzip, deflate, br',
                'User-Agent': 'WhatsApp-CSV-Validator/1.0'
            },
            maxContentLength: 10 * 1024 * 1024 // 10MB max
        });
        
        if (!response.data || response.data.trim() === '') {
            return repondre("❌ The downloaded CSV file is empty or invalid. Please check the URL and try again.");
        }
        
        // Send progress update
        repondre(`✅ CSV file downloaded successfully! Processing numbers...`);
        
        // Process CSV content
        const csvData = response.data;
        const numbers = [];
        
        // Create a readable stream from the CSV string
        const readableStream = Readable.from([csvData]);
        
        // Parse CSV to extract phone numbers
        await new Promise((resolve, reject) => {
            readableStream
                .pipe(csv())
                .on('data', (row) => {
                    // Get all values from the row
                    const values = Object.values(row);
                    
                    // Check each value for a potential phone number
                    values.forEach(value => {
                        if (value) {
                            // Simple number detection regex - find sequences that look like phone numbers
                            const possibleNumbers = value.match(/\+?\d{7,15}/g);
                            if (possibleNumbers) {
                                numbers.push(...possibleNumbers);
                            }
                        }
                    });
                })
                .on('end', resolve)
                .on('error', reject);
        });
        
        // If no numbers found
        if (numbers.length === 0) {
            return repondre("❌ No valid phone numbers found in the CSV file. Make sure the file contains phone numbers.");
        }
        
        // Send progress update
        repondre(`🔢 Found ${numbers.length} phone numbers in the CSV. Starting WhatsApp validation...`);
        
        // Arrays to store results
        const whatsappUsers = [];
        const nonWhatsappUsers = [];
        let processedCount = 0;
        let failedChecks = 0;
        
        // Process numbers in batches to avoid rate limiting
        const BATCH_SIZE = 50;
        const TOTAL_BATCHES = Math.ceil(numbers.length / BATCH_SIZE);
        
        for (let batchIndex = 0; batchIndex < TOTAL_BATCHES; batchIndex++) {
            const start = batchIndex * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, numbers.length);
            const batch = numbers.slice(start, end);
            
            // Send batch progress update every few batches
            if (batchIndex % 5 === 0 || batchIndex === TOTAL_BATCHES - 1) {
                const progress = Math.floor((processedCount / numbers.length) * 100);
                repondre(`⏳ Progress: ${progress}% (Validated ${processedCount}/${numbers.length} numbers)`);
            }
            
            // Process each number in the batch
            for (const number of batch) {
                try {
                    // Format the phone number
                    const formattedNumber = formatPhoneNumber(number);
                    
                    // Check if number exists on WhatsApp
                    const [result] = await zk.onWhatsApp(formattedNumber + '@s.whatsapp.net');
                    
                    if (result && result.exists) {
                        // Add to WhatsApp users
                        const name = `CSV Import (${new Date().toLocaleDateString()})`;
                        whatsappUsers.push({ name, phoneNumber: formattedNumber });
                    } else {
                        // Add to non-WhatsApp users
                        const name = `CSV Import (${new Date().toLocaleDateString()})`;
                        nonWhatsappUsers.push({ name, phoneNumber: formattedNumber });
                    }
                    
                    // Increment processed count
                    processedCount++;
                    
                    // Small delay to avoid hitting rate limits
                    if (processedCount % 10 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (error) {
                    console.error(`Error checking number ${number}:`, error);
                    failedChecks++;
                }
            }
            
            // Delay between batches to avoid rate limiting
            if (batchIndex < TOTAL_BATCHES - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Save the validated contacts
        const saveResult = saveContacts(whatsappUsers, nonWhatsappUsers);
        
        // Generate the final report
        let report = [`📊 *CSV Validation Report*\n\n`];
        report.push(`📁 Source: ${url}\n`);
        report.push(`✅ *WhatsApp Users:* ${whatsappUsers.length}\n`);
        report.push(`❌ *Non-WhatsApp Users:* ${nonWhatsappUsers.length}\n`);
        
        if (failedChecks > 0) {
            report.push(`⚠️ *Failed Checks:* ${failedChecks}\n`);
        }
        
        // Add database stats if available
        if (saveResult) {
            report.push(`\n📋 *Database Stats:*\n`);
            report.push(`• Total WhatsApp users saved: ${saveResult.whatsappCount}\n`);
            report.push(`• Total non-WhatsApp users saved: ${saveResult.nonWhatsappCount}\n`);
            report.push(`• New WhatsApp users added: ${saveResult.whatsappAdded}\n`);
            report.push(`• New non-WhatsApp users added: ${saveResult.nonWhatsappAdded}\n`);
        }
        
        report.push(`\n💾 All valid WhatsApp numbers have been saved to your database.`);
        report.push(`\n📝 Use *.walist* to view all saved WhatsApp contacts.`);
        
        // Send the final report
        repondre(report.join(''));
        
    } catch (error) {
        console.error("Error processing CSV:", error);
        
        // Detailed error reporting
        let errorMessage = "❌ Failed to process the CSV file.";
        
        if (error.code === 'ECONNABORTED') {
            errorMessage += "\n\nThe request timed out. The file might be too large or the server is slow.";
        } else if (error.response) {
            errorMessage += `\n\nServer responded with status: ${error.response.status}`;
        } else if (error.request) {
            errorMessage += "\n\nNo response received from the server. Check if the URL is correct.";
        } else {
            errorMessage += `\n\nError: ${error.message || "Unknown error"}`;
        }
        
        return repondre(errorMessage + "\n\nPlease verify the URL is correct and accessible.");
    }
});
