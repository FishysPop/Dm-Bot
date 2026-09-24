const {
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ActionRowBuilder,
    PermissionFlagsBits,
} = require('discord.js');
const { getActiveSchedules, getScheduleById, cancelSchedule } = require('../utils/scheduleStorage');
const { parseDateTime } = require('../utils/dateParser');
const {
    getDraft,
    setDraft,
    buildDraftPanel,
    countEligibleRecipients,
} = require('../utils/scheduleDrafts');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Manage scheduled direct message broadcasts')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Configure a scheduled direct message broadcast using an interactive panel')
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
                .addStringOption(option =>
                    option
                        .setName('time')
                        .setDescription('Scheduled time (e.g. in 2 hours, tomorrow, or YYYY-MM-DD HH:mm UTC)')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('message')
                        .setDescription('The announcement or message to broadcast')
                        .setRequired(false)
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
            const guildId = interaction.guild?.id || 'unknown';
            const userId = interaction.user.id;
            const draft = getDraft(guildId, userId);

            const targetRole = interaction.options.getRole('target');
            if (targetRole) {
                const isEveryone = targetRole.id === interaction.guild.id;
                draft.targetType = isEveryone ? 'everyone' : 'role';
                draft.targetRoleId = isEveryone ? null : targetRole.id;
                draft.targetRoleName = isEveryone ? '@everyone' : targetRole.name;
            }

            const repeat = interaction.options.getString('repeat');
            if (repeat) {
                draft.repeat = repeat;
            }

            const timeInput = interaction.options.getString('time');
            if (timeInput) {
                const parsed = parseDateTime(timeInput);
                if (parsed.success) {
                    draft.timestamp = parsed.timestamp;
                    draft.preset = 'custom';
                }
            }

            const messageInput = interaction.options.getString('message');
            if (messageInput) {
                draft.message = messageInput;
            }

            setDraft(guildId, userId, draft);

            const count = await countEligibleRecipients(interaction.guild, draft.targetType, draft.targetRoleId);
            const panel = buildDraftPanel(draft, count);
            return interaction.reply(panel);
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
