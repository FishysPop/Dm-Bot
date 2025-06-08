const { SlashCommandBuilder, PermissionFlags, Role } = require('discord.js');
require("dotenv").config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Send A Direct Message To A User Or A Role')
        .addStringOption(option => option.setName('message').setDescription('The message to send').setRequired(true))
        .addMentionableOption(option => option.setName('target').setDescription('The user or role to DM').setRequired(true)),

    run: async ({ interaction, client, handler }) => {
        if (interaction.user.id !== process.env.OWNER) return interaction.reply({ content: "Only The Owner Can Run This Command", ephemeral: true });
        const messageContent = interaction.options.getString('message');
        const target = interaction.options.getMentionable('target');
        await interaction.deferReply({ ephemeral: true });

        if (target.user) { 
            try {
                await target.user.send(messageContent);
                await interaction.editReply({ content: `Successfully sent a DM to ${target.user}`, ephemeral: true });
            } catch (error) {
                console.error(`Failed to send DM to ${target.user.tag}:`, error);
                if (error.code === 50007) {
                    return interaction.editReply({ content: `Could not DM ${target.user}. They likely have DMs disabled.`, ephemeral: true });
                }
                return interaction.editReply({ content: 'Failed to send DM. An unknown error occurred.', ephemeral: true });
            }
        } else if (target instanceof Role) { 
            const members = await target.guild.members.fetch();
            const roleMembers = members.filter(member => member.roles.cache.has(target.id)); 
            let successfulDMs = 0;
            let failedDMs = 0;

            const dmPromises = roleMembers.map(async (member) => {
                try {
                    await member.send(messageContent);
                    successfulDMs++;
                } catch (error) {
                    console.error(`Failed to send DM to ${member.user.tag}:`, error);
                    failedDMs++;
                }
            });

            await Promise.all(dmPromises);

            await interaction.editReply({ content: `Successfully sent DMs to ${successfulDMs} members. Failed to send DMs to ${failedDMs} members.`, ephemeral: true });
        }
    },
    options: {
        devOnly: false,
        userPermissions: ['Administrator'],
        botPermissions: ['SendMessages'],
        deleted: false,
    },
};