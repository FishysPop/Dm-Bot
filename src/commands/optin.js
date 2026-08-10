const { SlashCommandBuilder } = require('discord.js');
const { hasOptedIn, optIn } = require('../utils/optinStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('optin')
        .setDescription('Opt in to receive direct messages'),

    run: async ({ interaction }) => {
        if (hasOptedIn(interaction.user.id)) {
            return interaction.reply({
                content: 'You are already opted in to receive direct messages.',
                ephemeral: true,
            });
        }

        optIn(interaction.user.id);
        return interaction.reply({
            content: 'You have successfully opted in to receive direct messages.',
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
