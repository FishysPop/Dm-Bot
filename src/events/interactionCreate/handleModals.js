const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { parseDateTime } = require('../../utils/dateParser');
const { createSchedule } = require('../../utils/scheduleStorage');
const { hasOptedIn, isOptInEnabled } = require('../../utils/optinStorage');
const {
    getDraft,
    setDraft,
    buildDraftPanel,
    countEligibleRecipients,
} = require('../../utils/scheduleDrafts');

module.exports = async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (!interaction.customId.startsWith('sched_modal_')) return;

    const guildId = interaction.guild?.id || 'unknown';
    const userId = interaction.user.id;
    const draft = getDraft(guildId, userId);

    if (interaction.customId === 'sched_modal_message') {
        const messageText = interaction.fields.getTextInputValue('message_text');
        setDraft(guildId, userId, { message: messageText });

        const count = await countEligibleRecipients(interaction.guild, draft.targetType, draft.targetRoleId);
        const panel = buildDraftPanel(draft, count);
        return interaction.update(panel);
    }

    if (interaction.customId === 'sched_modal_time') {
        const timeText = interaction.fields.getTextInputValue('custom_time');
        const parsed = parseDateTime(timeText);
        if (!parsed.success) {
            return interaction.reply({
                content: parsed.error,
                ephemeral: true,
            });
        }

        setDraft(guildId, userId, { timestamp: parsed.timestamp, preset: 'custom' });
        const count = await countEligibleRecipients(interaction.guild, draft.targetType, draft.targetRoleId);
        const panel = buildDraftPanel(draft, count);
        return interaction.update(panel);
    }

    const parts = interaction.customId.split('_');
    const targetId = parts[2];
    const repeat = parts[3] || 'none';

    const datetimeInput = interaction.fields.getTextInputValue('datetime');
    const messageInput = interaction.fields.getTextInputValue('message');

    const parsed = parseDateTime(datetimeInput);
    if (!parsed.success) {
        return interaction.reply({
            content: parsed.error,
            ephemeral: true,
        });
    }

    const isRole = targetId !== 'everyone';
    const targetType = isRole ? 'role' : 'everyone';
    const targetRoleId = isRole ? targetId : null;

    let targetRoleName = '@everyone';
    if (isRole && interaction.guild) {
        const role = interaction.guild.roles?.cache?.get(targetRoleId);
        targetRoleName = role ? role.name : 'Role';
    }

    let eligibleCount = 0;
    if (interaction.guild?.members) {
        try {
            const members = await interaction.guild.members.fetch();
            const optInActive = isOptInEnabled();
            for (const [, member] of members) {
                if (member.user.bot) continue;
                if (isRole && !member.roles?.cache?.has(targetRoleId)) continue;
                if (optInActive && !hasOptedIn(member.user.id)) continue;
                eligibleCount++;
            }
        } catch {
            eligibleCount = 0;
        }
    }

    const schedule = createSchedule({
        guildId: interaction.guild?.id || 'unknown',
        targetType,
        targetRoleId,
        targetRoleName,
        message: messageInput,
        repeat,
        nextRun: parsed.timestamp,
        createdBy: interaction.user.id,
    });

    const timestampSec = Math.floor(parsed.timestamp / 1000);
    const repeatLabel = repeat.charAt(0).toUpperCase() + repeat.slice(1);

    const embed = new EmbedBuilder()
        .setTitle('Scheduled Direct Message')
        .setColor(0x2b2d31)
        .addFields(
            { name: 'Schedule ID', value: `\`${schedule.id}\``, inline: true },
            { name: 'Target', value: isRole ? `<@&${targetRoleId}>` : '@everyone', inline: true },
            { name: 'Repeat', value: repeatLabel, inline: true },
            { name: 'First Run', value: `<t:${timestampSec}:F> (<t:${timestampSec}:R>)`, inline: false },
            { name: 'Eligible Recipients', value: `${eligibleCount} member(s)`, inline: false },
            {
                name: 'Message Content',
                value: messageInput.length > 1000 ? `${messageInput.substring(0, 1000)}...` : messageInput,
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

    return interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
    });
};
