const { SlashCommandBuilder, Role } = require('discord.js');
const { hasOptedIn, isOptInEnabled } = require('../utils/optinStorage');
const { parseDmError } = require('../utils/dmErrorHandler');
require('dotenv').config();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Send a direct message to an opted-in user or role')
        .addStringOption(option => option.setName('message').setDescription('The message to send').setRequired(true))
        .addMentionableOption(option => option.setName('target').setDescription('The user or role to DM').setRequired(true)),

    run: async ({ interaction }) => {
        if (interaction.user.id !== process.env.OWNER) {
            return interaction.reply({ content: 'Only the owner can run this command.', ephemeral: true });
        }

        const messageContent = interaction.options.getString('message');
        const target = interaction.options.getMentionable('target');
        await interaction.deferReply({ ephemeral: true });

        const finalMessage = isOptInEnabled()
            ? `${messageContent}\n\n-# Run /optout to disable dms.`
            : messageContent;

        if (target.user) {
            if (!hasOptedIn(target.user.id)) {
                return interaction.editReply({
                    content: `Could not send DM. ${target.user} has not opted in to receive direct messages.`,
                    ephemeral: true,
                });
            }

            try {
                await target.user.send(finalMessage);
                await interaction.editReply({ content: `Successfully sent DM to ${target.user}.`, ephemeral: true });
            } catch (error) {
                console.error(`Failed to send DM to ${target.user.tag}:`, error);
                const reason = parseDmError(error);
                return interaction.editReply({
                    content: `Failed to send DM to ${target.user}.\n\n> Reason: ${reason}`,
                    ephemeral: true,
                });
            }
        } else if (target instanceof Role) {
            const members = await target.guild.members.fetch();
            const roleMembers = members.filter(member => member.roles.cache.has(target.id) && !member.user.bot);

            let successfulDMs = 0;
            let failedDMs = 0;
            let skippedDMs = 0;
            const failureBreakdown = {};

            for (const [, member] of roleMembers) {
                if (!hasOptedIn(member.user.id)) {
                    skippedDMs++;
                    continue;
                }

                try {
                    await member.send(finalMessage);
                    successfulDMs++;
                } catch (error) {
                    console.error(`Failed to send DM to ${member.user.tag}:`, error);
                    failedDMs++;

                    const reason = parseDmError(error);
                    failureBreakdown[reason] = (failureBreakdown[reason] || 0) + 1;

                    if (error.code === 20026) {
                        return interaction.editReply({
                            content: `Broadcast aborted.\n\n> Reason: ${reason}\n\nProgress before interruption:\n- Successful: ${successfulDMs}\n- Failed: ${failedDMs}\n- Skipped (not opted in): ${skippedDMs}`,
                            ephemeral: true,
                        });
                    }
                }

                await sleep(250);
            }

            let summary = `Broadcast completed.\n- Successful: ${successfulDMs}\n- Skipped (not opted in): ${skippedDMs}\n- Failed: ${failedDMs}`;
            if (failedDMs > 0) {
                summary += '\n\nFailure Reasons:';
                for (const [reason, count] of Object.entries(failureBreakdown)) {
                    summary += `\n> ${count}x - ${reason}`;
                }
            }

            await interaction.editReply({
                content: summary,
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