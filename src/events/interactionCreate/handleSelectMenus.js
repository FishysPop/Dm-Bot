const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');
const {
    getDraft,
    setDraft,
    presetToTimestamp,
    buildDraftPanel,
    countEligibleRecipients,
} = require('../../utils/scheduleDrafts');
require('dotenv').config();

module.exports = async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isRoleSelectMenu()) return;

    if (!interaction.customId.startsWith('sched_select_')) return;

    const isOwner = interaction.user.id === process.env.OWNER;
    const isAdmin = interaction.memberPermissions?.has?.('Administrator');
    if (!isOwner && !isAdmin) {
        return interaction.reply({
            content: 'Only administrators can configure scheduled broadcasts.',
            ephemeral: true,
        });
    }

    const guildId = interaction.guild?.id || 'unknown';
    const userId = interaction.user.id;
    const draft = getDraft(guildId, userId);

    if (interaction.customId === 'sched_select_time') {
        const selected = interaction.values[0];
        if (selected === 'custom') {
            const modal = new ModalBuilder()
                .setCustomId('sched_modal_time')
                .setTitle('Custom Schedule Date & Time');

            const timeInput = new TextInputBuilder()
                .setCustomId('custom_time')
                .setLabel('Date & Time (UTC or relative)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 2026-10-15 18:30 UTC or "in 4 hours"')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(timeInput));
            return interaction.showModal(modal);
        }

        const calculated = presetToTimestamp(selected);
        if (calculated) {
            setDraft(guildId, userId, { timestamp: calculated, preset: selected });
        }

        const count = await countEligibleRecipients(interaction.guild, draft.targetType, draft.targetRoleId);
        const panel = buildDraftPanel(draft, count);
        return interaction.update(panel);
    }

    if (interaction.customId === 'sched_select_repeat') {
        const selected = interaction.values[0];
        setDraft(guildId, userId, { repeat: selected });

        const count = await countEligibleRecipients(interaction.guild, draft.targetType, draft.targetRoleId);
        const panel = buildDraftPanel(draft, count);
        return interaction.update(panel);
    }

    if (interaction.customId === 'sched_select_role') {
        const roleId = interaction.values[0];
        const role = interaction.guild?.roles?.cache?.get(roleId);
        const roleName = role ? role.name : 'Role';

        setDraft(guildId, userId, {
            targetType: 'role',
            targetRoleId: roleId,
            targetRoleName: roleName,
        });

        const count = await countEligibleRecipients(interaction.guild, 'role', roleId);
        const panel = buildDraftPanel(draft, count);
        return interaction.update(panel);
    }
};
