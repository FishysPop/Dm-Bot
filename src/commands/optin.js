const { SlashCommandBuilder } = require('discord.js');
const { hasOptedIn, optIn, isOptInEnabled } = require('../utils/optinStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('optin')
        .setDescription('Opt in to receive direct messages'),

    run: async ({ interaction }) => {
        if (!isOptInEnabled()) {
            return interaction.reply({
                content: 'The opt-in/opt-out system is currently disabled.',
                ephemeral: true,
            });
        }

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
