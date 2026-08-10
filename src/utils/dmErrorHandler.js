function parseDmError(error) {
    if (!error) return 'Unknown error occurred.';
    const code = error.code || error.status;

    switch (code) {
        case 20026:
            return "Bot is flagged or quarantined by Discord's anti-spam system. Submit an appeal at https://dis.gd/app-quarantine";
        case 50007:
            return 'User has direct messages disabled or has blocked the bot.';
        case 50013:
            return 'Missing permissions to send direct messages to this user.';
        case 50001:
            return 'Missing access to contact this user.';
        case 40003:
        case 429:
            return 'Discord API rate limit hit. Please try again later.';
        case 10013:
            return 'User could not be found.';
        default:
            return error.message || `API Error (code ${code}).`;
    }
}

module.exports = {
    parseDmError,
};
