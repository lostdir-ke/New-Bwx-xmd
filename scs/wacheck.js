
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const axios = require('axios');
const fs = require('fs');

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
                // Send success message with the JID information
                return repondre(`✅ *Number Check Result*\n\n• Number: *${phoneNumber}*\n• Status: *Registered on WhatsApp*\n• JID: *${result.jid}*`);
            } else {
                // Send failure message
                return repondre(`❌ *Number Check Result*\n\n• Number: *${phoneNumber}*\n• Status: *Not registered on WhatsApp*`);
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
            caption: `📊 WhatsApp Contact Verification Report\n\nTotal contacts: ${lines.length}\nWhatsApp users: ${whatsappUsers.length}\nNon-WhatsApp users: ${nonWhatsappUsers.length}`
        });
        
        // Clean up file
        fs.unlinkSync(reportFile);
    } else {
        // Send report as message
        repondre(report);
    }
}
