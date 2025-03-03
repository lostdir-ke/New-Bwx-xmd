
'use strict';

const { adams } = require(__dirname + "/../Ibrahim/adams");
const fs = require('fs');
const path = require('path');

// Command to list all available commands with descriptions
adams({ nomCom: "cmdlist", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre, ms, arg } = commandeOptions;
    
    try {
        // Load all command files from the scs directory
        const commandsDir = path.join(__dirname);
        const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js') && file !== 'cmdlist.js');
        
        // Organize commands by category
        const commandsByCategory = {};
        let totalCommands = 0;
        
        // Command descriptions organized by category
        const descriptions = {
            "General": {
                "wacheck": "Check if a phone number is registered on WhatsApp",
                "wacheckurl": "Check WhatsApp numbers from a URL text file",
                "waresume": "Resume an interrupted WhatsApp check process",
                "wabroadcast": "Send messages to all saved WhatsApp contacts",
                "wabroadcastresume": "Resume an interrupted broadcast",
                "wastop": "Stop an ongoing broadcast process",
                "wabroadcastinfo": "Show statistics about the broadcast process",
                "walist": "List saved WhatsApp contacts",
                "cmdlist": "Show this list of all available commands",
                "help": "Get help information about available commands",
                "menu": "Display the main menu with all commands",
                "ping": "Check if the bot is responsive",
                "alive": "Check if the bot is running",
                "dev": "Contact information for bot developers"
            },
            "Media": {
                "sticker": "Convert image/video to sticker",
                "toimg": "Convert sticker to image",
                "mp3": "Convert video to audio",
                "trt": "Translate text to another language",
                "tts": "Convert text to speech",
                "yta": "Download YouTube audio",
                "ytv": "Download YouTube video"
            },
            "Fun": {
                "bully": "Send bully reaction animation",
                "cuddle": "Send cuddle reaction animation",
                "hug": "Send hug reaction animation",
                "kiss": "Send kiss reaction animation",
                "slap": "Send slap reaction animation"
            },
            "Image Effects": {
                "wasted": "Apply wasted effect to image",
                "trigger": "Apply trigger effect to image",
                "blur": "Apply blur effect to image",
                "circle": "Make image circular",
                "jail": "Put image subject behind bars",
                "invert": "Invert image colors"
            },
            "Group": {
                "add": "Add a user to a group",
                "kick": "Remove a user from a group",
                "promote": "Make a user group admin",
                "demote": "Remove admin status from a user",
                "link": "Get group invite link",
                "tagall": "Tag all group members"
            }
        };
        
        // Process each command file
        for (const file of commandFiles) {
            try {
                // Load the file to extract command information
                delete require.cache[require.resolve(path.join(commandsDir, file))];
                const commandModule = require(path.join(commandsDir, file));
                
                // For files that use the adams module pattern
                if (commandModule.cm && Array.isArray(commandModule.cm)) {
                    for (const cmd of commandModule.cm) {
                        if (cmd.nomCom) {
                            const category = cmd.categorie || "Uncategorized";
                            
                            if (!commandsByCategory[category]) {
                                commandsByCategory[category] = [];
                            }
                            
                            // Check if we have a description for this command
                            let description = "No description available";
                            if (descriptions[category] && descriptions[category][cmd.nomCom]) {
                                description = descriptions[category][cmd.nomCom];
                            }
                            
                            commandsByCategory[category].push({
                                name: cmd.nomCom,
                                description: description
                            });
                            
                            totalCommands++;
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing command file ${file}:`, error);
            }
        }
        
        // Add the command definitions we have from our descriptions
        for (const category in descriptions) {
            if (!commandsByCategory[category]) {
                commandsByCategory[category] = [];
            }
            
            for (const cmdName in descriptions[category]) {
                // Check if command already exists in our list
                const exists = commandsByCategory[category].some(cmd => cmd.name === cmdName);
                
                if (!exists) {
                    commandsByCategory[category].push({
                        name: cmdName,
                        description: descriptions[category][cmdName]
                    });
                    totalCommands++;
                }
            }
        }
        
        // Generate the command list message
        let commandsList = `📋 *BWM XMD COMMAND LIST*\n\n`;
        commandsList += `*Total Commands:* ${totalCommands}\n\n`;
        
        // Get specific category if requested
        if (arg && arg.length > 0) {
            const requestedCategory = arg.join(' ');
            for (const category in commandsByCategory) {
                if (category.toLowerCase() === requestedCategory.toLowerCase()) {
                    commandsList = `📋 *${category} Commands*\n\n`;
                    
                    // Sort commands alphabetically
                    const sortedCommands = commandsByCategory[category].sort((a, b) => 
                        a.name.localeCompare(b.name));
                    
                    sortedCommands.forEach((cmd, index) => {
                        commandsList += `${index + 1}. *.${cmd.name}*\n   ↪ ${cmd.description}\n\n`;
                    });
                    
                    return repondre(commandsList);
                }
            }
            
            // If category not found
            return repondre(`❌ Category "${requestedCategory}" not found.\n\nAvailable categories: ${Object.keys(commandsByCategory).join(', ')}`);
        }
        
        // List all categories
        commandsList += `*Available Categories:*\n`;
        for (const category in commandsByCategory) {
            const count = commandsByCategory[category].length;
            commandsList += `• *${category}* (${count} commands)\n`;
        }
        
        commandsList += `\n*Usage:*\n`;
        commandsList += `• Type *.cmdlist* to see all categories\n`;
        commandsList += `• Type *.cmdlist [category]* to see commands in a specific category\n`;
        commandsList += `• Type *.help [command]* for detailed help on a specific command\n`;
        
        // Send the command list
        repondre(commandsList);
    } catch (error) {
        console.error('Error retrieving commands:', error);
        repondre('❌ Error retrieving commands. Please try again later.');
    }
});

// Help command to get detailed information about a specific command
adams({ nomCom: "help", categorie: "General" }, async (dest, zk, commandeOptions) => {
    const { repondre, arg } = commandeOptions;
    
    if (!arg || arg.length === 0) {
        return repondre("Please specify a command to get help for.\n\nExample: *.help wacheck*\n\nOr use *.cmdlist* to see all available commands.");
    }
    
    const commandName = arg[0].toLowerCase().replace(/^\./, ''); // Remove leading dot if present
    
    // Command help information
    const helpInfo = {
        "wacheck": {
            usage: "*.wacheck [phone number]*\nor for bulk checking:\n*.wacheck*\nName1,Number1\nName2,Number2\n...",
            description: "Checks if a phone number is registered on WhatsApp. Can check individual numbers or a list of contacts.",
            examples: [
                "*.wacheck 255712345678*",
                "*.wacheck*\nJohn,255712345678\nJane,255787654321"
            ]
        },
        "wacheckurl": {
            usage: "*.wacheckurl [url_to_text_file]*",
            description: "Downloads a text file from the provided URL and checks all contacts in it. The file should have contacts in Name,Number format.",
            examples: [
                "*.wacheckurl https://example.com/contacts.txt*"
            ]
        },
        "waresume": {
            usage: "*.waresume*",
            description: "Resumes a WhatsApp check process that was interrupted or stopped.",
            examples: [
                "*.waresume*"
            ]
        },
        "wabroadcast": {
            usage: "*.wabroadcast*",
            description: "Broadcasts a message to all WhatsApp contacts in your saved database. Only available to the bot owner.",
            examples: [
                "*.wabroadcast*"
            ]
        },
        "wabroadcastresume": {
            usage: "*.wabroadcastresume*",
            description: "Resumes a broadcast that was interrupted or stopped.",
            examples: [
                "*.wabroadcastresume*"
            ]
        },
        "wastop": {
            usage: "*.wastop*",
            description: "Stops an ongoing broadcast process.",
            examples: [
                "*.wastop*"
            ]
        },
        "walist": {
            usage: "*.walist [csv]*",
            description: "Lists all saved WhatsApp contacts. Add 'csv' to export as a CSV file.",
            examples: [
                "*.walist*",
                "*.walist csv*"
            ]
        },
        "cmdlist": {
            usage: "*.cmdlist [category]*",
            description: "Lists all available commands by category, or shows commands in a specific category.",
            examples: [
                "*.cmdlist*",
                "*.cmdlist General*"
            ]
        }
    };
    
    // Check if we have help info for the requested command
    if (helpInfo[commandName]) {
        const info = helpInfo[commandName];
        let helpMessage = `📖 *Help: ${commandName}*\n\n`;
        helpMessage += `*Description:*\n${info.description}\n\n`;
        helpMessage += `*Usage:*\n${info.usage}\n\n`;
        
        if (info.examples && info.examples.length > 0) {
            helpMessage += `*Examples:*\n`;
            info.examples.forEach(example => {
                helpMessage += `${example}\n\n`;
            });
        }
        
        return repondre(helpMessage);
    } else {
        return repondre(`❌ Help information for "${commandName}" is not available.\n\nUse *.cmdlist* to see all available commands.`);
    }
});
