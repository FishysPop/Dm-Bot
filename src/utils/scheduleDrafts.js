const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const drafts = new Map();

function getDraftKey(guildId, userId) {
    return `${guildId}_${userId}`;
}

function getDraft(guildId, userId) {
    const key = getDraftKey(guildId, userId);
    if (!drafts.has(key)) {
        drafts.set(key, {
            guildId,
            userId,
            targetType: 'everyone',
            targetRoleId: null,
            targetRoleName: '@everyone',
            repeat: 'none',
            timestamp: null,
            preset: null,
            message: null,
            lastUpdated: Date.now()
        });
    }
    return drafts.get(key);
}

function setDraft(guildId, userId, updates) {
    const draft = getDraft(guildId, userId);
    Object.assign(draft, updates);
    draft.lastUpdated = Date.now();
    return draft;
}

function clearDraft(guildId, userId) {
    drafts.delete(getDraftKey(guildId, userId));
}

function presetToTimestamp(preset, referenceTime = Date.now()) {
    const map = {
        in_15m: 15 * 60 * 1000,
        in_30m: 30 * 60 * 1000,
        in_1h: 60 * 60 * 1000,
        in_3h: 3 * 3600 * 1000,
        in_6h: 6 * 3600 * 1000,
        in_12h: 12 * 3600 * 1000,
        in_24h: 24 * 3600 * 1000,
        in_3d: 3 * 24 * 3600 * 1000,
        in_7d: 7 * 24 * 3600 * 1000,
    };
    const diff = map[preset];
    return typeof diff === 'number' ? referenceTime + diff : null;
}

function buildDraftPanel(draft, eligibleCount = 0) {
    const targetLabel = draft.targetType === 'role' && draft.targetRoleId
        ? `<@&${draft.targetRoleId}>`
        : '@everyone (All members)';

    const repeatMap = {
        none: 'Do not repeat (One-time)',
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
    };
    const repeatLabel = repeatMap[draft.repeat] || 'Do not repeat (One-time)';

    let timeLabel = 'Not set (choose a time below)';
    if (draft.timestamp) {
        const sec = Math.floor(draft.timestamp / 1000);
        timeLabel = `<t:${sec}:F> (<t:${sec}:R>)`;
    }

    let messageLabel = 'Not set (click Set Message below)';
    if (draft.message) {
        messageLabel = draft.message.length > 500
            ? `${draft.message.substring(0, 500)}...`
            : draft.message;
    }

    const embed = new EmbedBuilder()
        .setTitle('Schedule Direct Message')
        .setDescription('Configure your broadcast details using the controls below.')
        .setColor(0x2b2d31)
        .addFields(
            { name: 'Target', value: targetLabel, inline: true },
            { name: 'Repeat', value: repeatLabel, inline: true },
            { name: 'Eligible Recipients', value: `${eligibleCount} member(s)`, inline: true },
            { name: 'Schedule Time', value: timeLabel, inline: false },
            { name: 'Message Content', value: messageLabel, inline: false }
        )
        .setFooter({ text: 'Direct message broadcast scheduler' });

    const timeRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('sched_select_time')
            .setPlaceholder('Choose scheduled time...')
            .addOptions(
                { label: 'In 15 minutes', value: 'in_15m', description: 'Broadcast in 15 minutes' },
                { label: 'In 30 minutes', value: 'in_30m', description: 'Broadcast in 30 minutes' },
                { label: 'In 1 hour', value: 'in_1h', description: 'Broadcast in 1 hour' },
                { label: 'In 3 hours', value: 'in_3h', description: 'Broadcast in 3 hours' },
                { label: 'In 6 hours', value: 'in_6h', description: 'Broadcast in 6 hours' },
                { label: 'In 12 hours', value: 'in_12h', description: 'Broadcast in 12 hours' },
                { label: 'Tomorrow (in 24 hours)', value: 'in_24h', description: 'Broadcast in 24 hours' },
                { label: 'In 3 days', value: 'in_3d', description: 'Broadcast in 3 days' },
                { label: 'In 1 week', value: 'in_7d', description: 'Broadcast in 7 days' },
                { label: 'Custom Date & Time...', value: 'custom', description: 'Enter an exact future date' }
            )
    );

    const repeatRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('sched_select_repeat')
            .setPlaceholder('Choose repeat frequency...')
            .addOptions(
                { label: 'Do not repeat (One-time)', value: 'none', description: 'Send once at scheduled time' },
                { label: 'Daily', value: 'daily', description: 'Repeat every day at this time' },
                { label: 'Weekly', value: 'weekly', description: 'Repeat every week at this time' },
                { label: 'Monthly', value: 'monthly', description: 'Repeat every month at this time' }
            )
    );

    const roleRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('sched_select_role')
            .setPlaceholder('Target a specific role (or click Target @everyone below)...')
            .setMinValues(1)
            .setMaxValues(1)
    );

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sched_btn_message')
            .setLabel(draft.message ? 'Edit Message' : 'Set Message')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('sched_btn_everyone')
            .setLabel('Target @everyone')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('sched_btn_test')
            .setLabel('Send Test DM')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!draft.message)
    );

    const canConfirm = Boolean(draft.timestamp && draft.message);
    const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sched_btn_confirm')
            .setLabel('Confirm & Schedule')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!canConfirm),
        new ButtonBuilder()
            .setCustomId('sched_btn_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
    );

    return {
        embeds: [embed],
        components: [timeRow, repeatRow, roleRow, actionRow, confirmRow],
        ephemeral: true,
    };
}

async function countEligibleRecipients(guild, targetType, targetRoleId, checkOptIn = null, optInEnabled = null) {
    if (!guild?.members) return 0;
    try {
        const { hasOptedIn, isOptInEnabled } = require('./optinStorage');
        const check = checkOptIn || hasOptedIn;
        const enabled = optInEnabled !== null ? optInEnabled : isOptInEnabled();
        const members = await guild.members.fetch();
        let count = 0;
        for (const [, member] of members) {
            if (member.user.bot) continue;
            if (targetType === 'role' && targetRoleId) {
                if (!member.roles?.cache?.has(targetRoleId)) continue;
            }
            if (enabled && !check(member.user.id)) continue;
            count++;
        }
        return count;
    } catch {
        return 0;
    }
}

module.exports = {
    getDraft,
    setDraft,
    clearDraft,
    presetToTimestamp,
    buildDraftPanel,
    countEligibleRecipients,
};
