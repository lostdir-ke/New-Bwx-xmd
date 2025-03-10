const fs = require('fs-extra');
const { Sequelize } = require('sequelize');
if (fs.existsSync('config.env'))
    require('dotenv').config({ path: __dirname + '/config.env' });
const path = require("path");
const databasePath = path.join(__dirname, './database.db');
const DATABASE_URL = process.env.DATABASE_URL === undefined
    ? databasePath
    : process.env.DATABASE_URL;
module.exports = { session: process.env.SESSION_ID || 'BWM-XMD;BWM-XMD;;;H4sIAAAAAAAAA5VU2ZKqSBT8lYl61TvKKhjREcMiIm4gqI0T96GEAopdKETs8N8n6CW6H+be6eGpoqrIk5WZ57yAvMA1WqIOTF9AWeErJKhfkq5EYArkJghQBYbAhwSCKRAMZ0Wk1HMzZ6vveIuz7PAkMJEVisKYPouem4drXhihxH0CjyEom3OKvd8AarrNc3cxZBpndBcZU1nB7UnLNytpczftOhK2IhPVHatqsyfw6BEhrnAezsoIZaiC6RJ1JsTV9+hny9g6zU5srTSjbF9k/M1teEtngpRr2vnh4Ppda09WnDzef4/+WSlpL6CJfkwbywz8RF65ecupNqzCfXiRVd2v9QU34DT3jX6Nwxz5Cx/lBJPu27q30jZSOQbHvnyi4nm4iUvtVNVxzI4O2lZS9tGoM2Vj1unS94if5jIVbRbl7s7GzEo7DrY3h96L5crKeNW0SrjzKJuYNzRjvxI3q4+sJP9L96180UbyOFbTjl8o7TM0LrVwjrirONBTJ6wilm8bzsjy4nv0J+nO8B23nosx4c+nwWyH7mZjn6/rJOSeOWWVUYxRsXlDC5/0IWmq37FkIt61Z/RC2cuhQRVuItXqWjW0QW6y1OFISpuz28TZuM7RDXDQrlbj5KKXx3tFre6pbh3F3Wx3qal1Eu+3aebLlBdj6en1RQnqFj6YUo8hqFCIa1JBgou83+OGAPpXG3kVIq/iAqMwXC8xL+vrQImx3rHHucWo+uzeOWXVxWfuGXWpkwnRQngCQ1BWhYfqGvk6rklRdWtU1zBENZj+/XMIcnQjb7b1xRhqCAJc1WSfN2VaQP/D049D6HlFkxO7yz2lX6AKTMef24gQnId1r2KTw8qL8BUpESQ1mAYwrdFjCHx0xR7q8YBzjm5CxbqWiLMDnKjpRKY7q6ccFfnbFeHM+743pn+IDEv9YGna+yFATvgh+p4fTM4s5wkiGAL83jH9P7808BbpzXy2M1rbSjiXmnmsv58szGLWJq8mvCmPKuSDKakaNARn6CVN6RQJyn+Dm2TNZiJ5+iY+hsRkOmZyRTfZhCd1/AX3zVEwffmcUkrh93hLc36wZNsGQ5C9BhD3L6c5djJmBXEi0NyUnfxV/9n2QsKy/DNHBAxBDvvbYIO9qEj/cFCdwr7auxU9jo8IxGkNpkBZLI+56amzlZIlZ3Y+l2ahpIQS+LTuowPeMnZGJn1dU+JgJw/ahMNrheLkndegfMnw3p45HBqZduBVeF48/QsImAJ+4NxVo1tul/tmA4keBXy7sG7L1cqO3P3F4+KzjnXtdtWfDWpQXcVnJm7FdpyGfFB30k1YCrRRbaObwyCdueHq6DNy+NRXe4vQ12L5RcWaUSnMdVFd91o6SphNfEqKsRtymlUegkbdqocZuy4NtLM7KqkDWo03cOFfRSfwmdOdES0Ju9plVHolzwsmPsbtW2++zob0fSbj1755eQ9cgNHriHu34j8t+8z++DH8gvE+NH+RL/nIxGJ13wRBYgW1sXVjiSBr/7zKy44Mcm1DHc6hn9DVSOvA4/FzCMoUkqCoMjAFdXaGYAhSWBPps3cdnKGawKwEU2rCjkVK5Cl2CLJOKkubQPLR8kDqP317B49/AI/2cTkMCAAA',
    PREFIXE: process.env.PREFIX || ".",
    OWNER_NAME: process.env.OWNER_NAME || "NICHOLAS ↪️TREKKER2",
    NUMERO_OWNER : process.env.NUMERO_OWNER || "254704897825",              
    AUTO_READ_STATUS: process.env.AUTO_READ_STATUS || "yes",
    AUTO_DOWNLOAD_STATUS: process.env.AUTO_DOWNLOAD_STATUS || 'no',
    BOT : process.env.BOT_NAME || 'TREKKER2',
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
    ANTICALL : process.env.ANTICALL || 'NO',
                  AUTO_REACT : process.env.AUTO_REACT || 'yes',
                  AUTO_REACT_STATUS : process.env.AUTO_REACT_STATUS || 'yes',
                  AUTO_REPLY : process.env.AUTO_REPLY || 'no',
                  AUTO_READ : process.env.AUTO_READ || 'yes',
                  AUTO_SAVE_CONTACTS : process.env.AUTO_SAVE_CONTACTS || 'yes',
                  AUTO_REJECT_CALL : process.env.AUTO_REJECT_CALL || 'no',
                  AUTO_BIO : process.env.AUTO_BIO || 'NO',
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

