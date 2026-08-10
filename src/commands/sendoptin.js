const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
} = require('discord.js');
const { isOptInEnabled } = require('../utils/optinStorage');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendoptin')
        .setDescription('Send the DM opt-in panel embed to a channel')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('The channel to send the opt-in panel to')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),

    run: async ({ interaction }) => {
        if (!isOptInEnabled()) {
            return interaction.reply({
                content: 'The opt-in/opt-out system is currently disabled.',
                ephemeral: true,
            });
        }

        if (interaction.user.id !== process.env.OWNER && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: 'Only administrators can run this command.',
                ephemeral: true,
            });
        }

        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        const embed = new EmbedBuilder()
            .setTitle('Direct Message Notifications')
            .setDescription(
                'Opt in to receive updates and announcements via direct message.\n\n' +
                '> Use the buttons below or run `/optin` and `/optout` to manage your preferences at any time.'
            )
            .setColor(0x2b2d31)
            .setFooter({ text: 'Notification Preferences' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('optin_btn')
                .setLabel('Opt In')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('optout_btn')
                .setLabel('Opt Out')
                .setStyle(ButtonStyle.Secondary)
        );

        try {
            await targetChannel.send({ embeds: [embed], components: [row] });
            return interaction.reply({
                content: `Opt-in panel sent to ${targetChannel}.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error('Failed to send opt-in panel:', error);
            return interaction.reply({
                content: 'Failed to send the opt-in panel to the target channel.',
                ephemeral: true,
            });
        }
    },

    options: {
        devOnly: false,
        userPermissions: ['Administrator'],
        botPermissions: ['SendMessages'],
        deleted: false,
    },
};
