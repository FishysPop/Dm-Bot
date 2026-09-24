const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionFlagsBits,
} = require('discord.js');
const { getActiveSchedules, getScheduleById, cancelSchedule } = require('../utils/scheduleStorage');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Manage scheduled direct message broadcasts')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Schedule a new direct message broadcast')
                .addRoleOption(option =>
                    option
                        .setName('target')
                        .setDescription('The role to target (leave blank to target @everyone)')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('repeat')
                        .setDescription('Repeat frequency for this broadcast')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Do not repeat (One-time)', value: 'none' },
                            { name: 'Daily', value: 'daily' },
                            { name: 'Weekly', value: 'weekly' },
                            { name: 'Monthly', value: 'monthly' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all active scheduled broadcasts for this server')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Cancel an active scheduled broadcast')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('The ID of the scheduled broadcast to cancel')
                        .setRequired(true)
                )
        ),

    run: async ({ interaction }) => {
        const isOwner = interaction.user.id === process.env.OWNER;
        const isAdmin = interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator);
        if (!isOwner && !isAdmin) {
            return interaction.reply({
                content: 'Only administrators can run this command.',
                ephemeral: true,
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'create') {
            const targetRole = interaction.options.getRole('target');
            const isEveryoneRole = targetRole && targetRole.id === interaction.guild.id;
            const targetId = (targetRole && !isEveryoneRole) ? targetRole.id : 'everyone';
            const repeat = interaction.options.getString('repeat') || 'none';

            const modal = new ModalBuilder()
                .setCustomId(`sched_modal_${targetId}_${repeat}`)
                .setTitle('Schedule DM Broadcast');

            const dateInput = new TextInputBuilder()
                .setCustomId('datetime')
                .setLabel('Date & Time (UTC or relative)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('YYYY-MM-DD HH:mm UTC or relative like in 2 hours')
                .setRequired(true);

            const messageInput = new TextInputBuilder()
                .setCustomId('message')
                .setLabel('Message to Broadcast')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Type the announcement or message to broadcast...')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(dateInput),
                new ActionRowBuilder().addComponents(messageInput)
            );

            return interaction.showModal(modal);
        }

        if (subcommand === 'list') {
            const active = getActiveSchedules(interaction.guild.id);
            if (!active || active.length === 0) {
                return interaction.reply({
                    content: 'No active scheduled broadcasts found for this server.',
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('Active Scheduled Broadcasts')
                .setColor(0x2b2d31)
                .setDescription(`Found ${active.length} active scheduled broadcast(s).`);

            const rows = [];
            let currentRow = new ActionRowBuilder();

            for (let i = 0; i < Math.min(active.length, 10); i++) {
                const s = active[i];
                const timestampSec = Math.floor(s.nextRun / 1000);
                const repeatLabel = s.repeat ? s.repeat.charAt(0).toUpperCase() + s.repeat.slice(1) : 'None';
                const targetText = s.targetType === 'role' ? `<@&${s.targetRoleId}>` : '@everyone';
                const preview = s.message.length > 80 ? `${s.message.substring(0, 80)}...` : s.message;

                embed.addFields({
                    name: `ID: ${s.id}`,
                    value: `Target: ${targetText}\nRepeat: ${repeatLabel}\nNext Run: <t:${timestampSec}:F> (<t:${timestampSec}:R>)\nPreview: ${preview}`,
                    inline: false,
                });

                if (i < 5) {
                    currentRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`sched_cancel_${s.id}`)
                            .setLabel(`Cancel ${s.id}`)
                            .setStyle(ButtonStyle.Danger)
                    );
                }
            }

            if (currentRow.components.length > 0) {
                rows.push(currentRow);
            }

            return interaction.reply({
                embeds: [embed],
                components: rows,
                ephemeral: true,
            });
        }

        if (subcommand === 'cancel') {
            const scheduleId = interaction.options.getString('id');
            const schedule = getScheduleById(scheduleId);

            if (!schedule || schedule.status !== 'active' || schedule.guildId !== interaction.guild.id) {
                return interaction.reply({
                    content: 'Active schedule not found with that ID.',
                    ephemeral: true,
                });
            }

            cancelSchedule(scheduleId);
            return interaction.reply({
                content: `Schedule ${scheduleId} has been cancelled.`,
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
