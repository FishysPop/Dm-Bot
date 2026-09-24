const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} = require('discord.js');
const { hasOptedIn, optIn, optOut, isOptInEnabled } = require('../../utils/optinStorage');
const { getScheduleById, cancelSchedule, createSchedule } = require('../../utils/scheduleStorage');
const { parseDmError } = require('../../utils/dmErrorHandler');
const {
    getDraft,
    setDraft,
    clearDraft,
    buildDraftPanel,
    countEligibleRecipients,
} = require('../../utils/scheduleDrafts');
require('dotenv').config();

module.exports = async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('sched_')) {
        const isOwner = interaction.user.id === process.env.OWNER;
        const isAdmin = interaction.memberPermissions?.has?.('Administrator');
        if (!isOwner && !isAdmin) {
            return interaction.reply({
                content: 'Only administrators can manage scheduled broadcasts.',
                ephemeral: true,
            });
        }

        const guildId = interaction.guild?.id || 'unknown';
        const userId = interaction.user.id;
        const draft = getDraft(guildId, userId);

        if (interaction.customId === 'sched_btn_message') {
            const modal = new ModalBuilder()
                .setCustomId('sched_modal_message')
                .setTitle('Broadcast Message');

            const messageInput = new TextInputBuilder()
                .setCustomId('message_text')
                .setLabel('Message to Broadcast')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Type the announcement or message to broadcast...')
                .setRequired(true);

            if (draft.message) {
                messageInput.setValue(draft.message);
            }

            modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'sched_btn_everyone') {
            setDraft(guildId, userId, {
                targetType: 'everyone',
                targetRoleId: null,
                targetRoleName: '@everyone',
            });

            const count = await countEligibleRecipients(interaction.guild, 'everyone', null);
            const panel = buildDraftPanel(draft, count);
            return interaction.update(panel);
        }

        if (interaction.customId === 'sched_btn_test') {
            if (!draft.message) {
                return interaction.reply({
                    content: 'Please set a message before sending a test direct message.',
                    ephemeral: true,
                });
            }

            const finalMessage = isOptInEnabled()
                ? `${draft.message}\n\n-# Run /optout to disable dms.`
                : draft.message;

            try {
                await interaction.user.send(finalMessage);
                return interaction.reply({
                    content: 'Test direct message sent to your DMs.',
                    ephemeral: true,
                });
            } catch (err) {
                const reason = parseDmError(err);
                return interaction.reply({
                    content: `Failed to send test direct message: ${reason}`,
                    ephemeral: true,
                });
            }
        }

        if (interaction.customId === 'sched_btn_confirm') {
            if (!draft.timestamp || !draft.message) {
                return interaction.reply({
                    content: 'Please configure both a schedule time and message before confirming.',
                    ephemeral: true,
                });
            }

            const schedule = createSchedule({
                guildId,
                targetType: draft.targetType,
                targetRoleId: draft.targetRoleId,
                targetRoleName: draft.targetRoleName,
                message: draft.message,
                repeat: draft.repeat,
                nextRun: draft.timestamp,
                createdBy: userId,
            });

            const eligibleCount = await countEligibleRecipients(interaction.guild, draft.targetType, draft.targetRoleId);
            clearDraft(guildId, userId);

            const timestampSec = Math.floor(schedule.nextRun / 1000);
            const repeatLabel = schedule.repeat.charAt(0).toUpperCase() + schedule.repeat.slice(1);
            const isRole = schedule.targetType === 'role' && schedule.targetRoleId;

            const embed = new EmbedBuilder()
                .setTitle('Scheduled Direct Message Confirmed')
                .setColor(0x2b2d31)
                .addFields(
                    { name: 'Schedule ID', value: `\`${schedule.id}\``, inline: true },
                    { name: 'Target', value: isRole ? `<@&${schedule.targetRoleId}>` : '@everyone', inline: true },
                    { name: 'Repeat', value: repeatLabel, inline: true },
                    { name: 'First Run', value: `<t:${timestampSec}:F> (<t:${timestampSec}:R>)`, inline: false },
                    { name: 'Eligible Recipients', value: `${eligibleCount} member(s)`, inline: false },
                    {
                        name: 'Message Content',
                        value: schedule.message.length > 1000 ? `${schedule.message.substring(0, 1000)}...` : schedule.message,
                        inline: false
                    }
                )
                .setFooter({ text: 'Direct message broadcast scheduler' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`sched_test_${schedule.id}`)
                    .setLabel('Send Test DM')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`sched_cancel_${schedule.id}`)
                    .setLabel('Cancel Schedule')
                    .setStyle(ButtonStyle.Danger)
            );

            return interaction.update({
                embeds: [embed],
                components: [row],
            });
        }

        if (interaction.customId === 'sched_btn_cancel') {
            clearDraft(guildId, userId);
            return interaction.update({
                content: 'Schedule creation cancelled.',
                embeds: [],
                components: [],
            });
        }

        if (interaction.customId.startsWith('sched_test_')) {
            const scheduleId = interaction.customId.replace('sched_test_', '');
            const schedule = getScheduleById(scheduleId);
            if (!schedule) {
                return interaction.reply({
                    content: 'Schedule not found.',
                    ephemeral: true,
                });
            }

            const finalMessage = isOptInEnabled()
                ? `${schedule.message}\n\n-# Run /optout to disable dms.`
                : schedule.message;

            try {
                await interaction.user.send(finalMessage);
                return interaction.reply({
                    content: 'Test direct message sent to your DMs.',
                    ephemeral: true,
                });
            } catch (err) {
                const reason = parseDmError(err);
                return interaction.reply({
                    content: `Failed to send test direct message: ${reason}`,
                    ephemeral: true,
                });
            }
        }

        if (interaction.customId.startsWith('sched_cancel_')) {
            const scheduleId = interaction.customId.replace('sched_cancel_', '');
            cancelSchedule(scheduleId);

            if (typeof interaction.update === 'function') {
                return interaction.update({
                    content: `Schedule ${scheduleId} has been cancelled.`,
                    embeds: [],
                    components: [],
                });
            }

            return interaction.reply({
                content: `Schedule ${scheduleId} has been cancelled.`,
                ephemeral: true,
            });
        }

        return;
    }

    if (interaction.customId === 'optin_btn' || interaction.customId === 'optout_btn') {
        if (!isOptInEnabled()) {
            return interaction.reply({
                content: 'The opt-in/opt-out system is currently disabled.',
                ephemeral: true,
            });
        }
    }

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
