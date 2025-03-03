
const {adams} = require("../Ibrahim/adams");
const config = require("../config");

adams({nomCom: "webview", categorie: "General", reaction: "🌐"}, async(dest, zk, commandeOptions) => {
  const {ms, args, repondre} = commandeOptions;
  
  // Get the server URL - would need to be set in config.env
  const serverUrl = process.env.WEBVIEW_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  
  // Default page is 'index' if none specified
  const page = args.join(" ").trim() || "index";
  
  // Create a URL with the user's JID and requested page
  const webviewUrl = `${serverUrl}?page=${encodeURIComponent(page)}&user=${encodeURIComponent(dest.split('@')[0])}`;
  
  await zk.sendMessage(dest, {
    text: `*🌐 BMW_MD Webview*\n\n• *Page:* ${page}\n• *URL:* ${webviewUrl}\n\n_Click the link above to open the webview_`,
    contextInfo: {
      externalAdReply: {
        title: "BMW_MD Webview",
        body: `Open ${page} page`,
        thumbnail: fs.readFileSync('./files/profile-pic.jpg'),
        sourceUrl: webviewUrl,
        showAdAttribution: false
      }
    }
  }, {quoted: ms});
});
