const { SlashCommandBuilder } = require('discord.js');
const { hasOptedIn, optOut } = require('../utils/optinStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('optout')
        .setDescription('Opt out of receiving direct messages'),

    run: async ({ interaction }) => {
        if (!hasOptedIn(interaction.user.id)) {
            return interaction.reply({
                content: 'You are not currently opted in to receive direct messages.',
                ephemeral: true,
            });
        }

        optOut(interaction.user.id);
        return interaction.reply({
            content: 'You have successfully opted out of receiving direct messages.',
            ephemeral: true,
        });
    },

    options: {
        devOnly: false,
        userPermissions: [],
        botPermissions: [],
        deleted: false,
    },
};
