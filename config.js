const fs = require('fs-extra');
const { Sequelize } = require('sequelize');
if (fs.existsSync('config.env'))
    require('dotenv').config({ path: __dirname + '/config.env' });
const path = require("path");
const databasePath = path.join(__dirname, './database.db');
const DATABASE_URL = process.env.DATABASE_URL === undefined
    ? databasePath
    : process.env.DATABASE_URL;
module.exports = { session: process.env.SESSION_ID || 'BWM-XMD;;;H4sIAAAAAAAAA5VU25KqOBT9lam8yhm5C1Z11SAgYquIgKJT5yFAuCgChoCXLv99Cu2u7oc5Z3p4SiVh7ZW11t5voCizGr2iKxi+gQpnLSSoW5JrhcAQjJo4RhhQIIIEgiE4ao7bH6i3k+ndttpOWnObBe8FvHFwJ/U8RZN5YPUWeVAekhdwp0DVBHkW/gZwPO2HOKgtsWiX1l49zNT+muvLqcUpVRWv+FFCM9ki2uj+/AXcO0SY4axI9CpFR4Rh/oquS5jh79FnlyhZ7FcX04K+d9JYtg2ILRLX5zM79dfbbWDAkMNZwvLfo4+n7WqEvcTmD8ZiJ0GyKdOeHvK3lZVwzlUa02TWF2fCoKCf9OssKVBkRqggGbl+W3drsnW89tKSsXjyLLVN97uU2fPnlOPqnW6E/kAPsWWssHH+HnF6G0xPU7Gnj5LonPQa0m7UBomCuptZEcx66u4oO0WrzZX6K/El/sjK4f/oflSmqhuPOIXG+7yOlN5OVOeeXBUs4Rq9f2Who65q3T779jd1P1pHc5xE87UX89rrxhiJvqY4yT6YlIY/3k01LXW3lRpo9id9SBr8O5ZVINS5pN0syTlMZduDSb/U5akxCoi5Mm3LN/dVy8vxLdvWbLWMd1HFby7twDsYzm62VCw3q3SJWA26+bX/2vbmC6SdXx4vOqCrGYEhc6cARklWEwxJVhaPvYFMARi1DgoxIg95QWwp09TyrTix55r8WjHO2I9tJVAu/fUFx+ciS+MBcVbOdv4CKFDhMkR1jaJJVpMSX+eormGCajD8+ycFCnQhT+O6chxDgTjDNfGKpspLGH24+nEIw7BsCuJci1DtFgiDIf25jQjJiqTudGwKiMM0a5GaQlKDYQzzGt0pEKE2C1GHBy5jwZ2tB7ZTWK+x3E6mgnuj7Y5yWhbPKwEzkCRJin6wtBD94AUG/pBiPvrB8JAVIEPzbMgCCmTvPdP980sLRYbkY9fvO+5hs54Zwvninq4HbFbl9mHDU3uEUQSGBDeIAgEMD03llgdU/Aa3ns17TTvwmGW0Whk8oWnLDnxpaTLSF9ynp2D49jmn1DLq8KYqN5ktXAFQ4PiIYNa9nBX4Ac1L8kBihSEv/lX/ee6EhFX1Z4EIoEABu9tgkYVpmf/hojqHXbV3KzqcCBGY5TUYAtU0NsUy1HST7Scz3jAUPVHURAGf1n30wDNjAVqy7ZyRe6tR73wQsrnKCKNV2KDilRNDj1uvmxHrwlbyzZd/AelelRfTRS/oB6+FHpyuTr1UXZG7ihy+sQU8lZ6+8jSV2USK0pr0dilDVxerZjtRBLlghSLn2kHWO3kTruJjUkxMe9FoyktX7Rmhr8UWjSG3F1PhkzaP5mMj2G03u402o0eniaKrcDZm9+NlE3kxTqp4l9Kn+qyt4i3arf3QKLekP/Nch9Pd5lSJm2VfE+Slojy78zEd8vepnD365u09cHGGHkPu3Yr/tOwz+/Sd+oLxPjZ/ka/RhtvL+LaI44Md11Nru1cIsj1/VlRX0ivGC2YdJNGBxf3xFdzvPylQ5ZDEJT524TwGEFAghzVRPnvXzY6oJvBYdROGp0WeZwWGAserUlUOgeSj5YHSfROrBfd/AL1JxeMOCAAA',
    PREFIXE: process.env.PREFIX || ".",
    OWNER_NAME: process.env.OWNER_NAME || "Ibrahim Adams",
    NUMERO_OWNER : process.env.NUMERO_OWNER || "254704897825",              
    AUTO_READ_STATUS: process.env.AUTO_READ_STATUS || "yes",
    AUTO_DOWNLOAD_STATUS: process.env.AUTO_DOWNLOAD_STATUS || 'no',
    BOT : process.env.BOT_NAME || 'BMW_MD',
    URL : process.env.BOT_MENU_LINKS || 'https://files.catbox.moe/h2ydge.jpg',
    MODE: process.env.PUBLIC_MODE || "yes",
    PM_PERMIT: process.env.PM_PERMIT || 'yes',
    HEROKU_APP_NAME : process.env.HEROKU_APP_NAME,
    HEROKU_APY_KEY : process.env.HEROKU_APY_KEY ,
    WARN_COUNT : process.env.WARN_COUNT || '3' ,
    ETAT : process.env.PRESENCE || '',
    CHATBOT : process.env.PM_CHATBOT || 'no',
    DP : process.env.STARTING_BOT_MESSAGE || "yes",
    ANTIDELETE1 : process.env.ANTIDELETE1 || 'yes',
    ANTIDELETE2 : process.env.ANTIDELETE2 || 'yes',
    MENUTYPE : process.env.MENUTYPE || '',
    ANTICALL : process.env.ANTICALL || 'yes',
                  AUTO_REACT : process.env.AUTO_REACT || 'yes',
                  AUTO_REACT_STATUS : process.env.AUTO_REACT_STATUS || 'yes',
                  AUTO_REPLY : process.env.AUTO_REPLY || 'no',
                  AUTO_READ : process.env.AUTO_READ || 'yes',
                  AUTO_SAVE_CONTACTS : process.env.AUTO_SAVE_CONTACTS || 'yes',
                  AUTO_REJECT_CALL : process.env.AUTO_REJECT_CALL || 'no',
                  AUTO_BIO : process.env.AUTO_BIO || 'yes',
                  AUDIO_REPLY : process.env.AUDIO_REPLY || 'no',
    DATABASE_URL,
    DATABASE: DATABASE_URL === databasePath
        ? "postgresql://postgres:bKlIqoOUWFIHOAhKxRWQtGfKfhGKgmRX@viaduct.proxy.rlwy.net:47738/railway" : "postgresql://postgres:bKlIqoOUWFIHOAhKxRWQtGfKfhGKgmRX@viaduct.proxy.rlwy.net:47738/railway",
   
};
let fichier = require.resolve(__filename);
fs.watchFile(fichier, () => {
    fs.unwatchFile(fichier);
    console.log(`mise à jour ${__filename}`);
    delete require.cache[fichier];
    require(fichier);
});

