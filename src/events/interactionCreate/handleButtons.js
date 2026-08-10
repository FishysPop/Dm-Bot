const { hasOptedIn, optIn, optOut } = require('../../utils/optinStorage');

module.exports = async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'optin_btn') {
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
    }

    if (interaction.customId === 'optout_btn') {
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
    }
};
