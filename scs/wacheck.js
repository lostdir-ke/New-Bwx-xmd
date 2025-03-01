
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const axios = require('axios');

adams({ nomCom: "wacheck", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;

    // If no argument is provided, ask for the phone number
    if (!arg || arg.length === 0) {
        return repondre("Please enter a phone number to check if it's registered on WhatsApp.\n\nExample: *.wacheck 712345678*");
    }

    let phoneNumber = arg.join(' ').replace(/\s+/g, '');
    
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
});
