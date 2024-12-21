const {SlashCommandBuilder} = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Pings the Bot'),
 
    run: ({ interaction, client, handler }) => {
        interaction.reply(`:ping_pong: Pong! ${client.ws.ping}ms`);
    },
 
    options: {
        devOnly: false,
        userPermissions: [],
        botPermissions: ['AddReactions'],
        deleted: false,
    },
};