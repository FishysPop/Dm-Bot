const Discord = require('discord.js');

module.exports = (c, client, handler) => {
    console.log(`${c.user.username} is ready!`);
    client.application.fetch().then(app => { 
        const inviteLink = client.generateInvite({  
          scopes: [
            Discord.OAuth2Scopes.Bot, 
            Discord.OAuth2Scopes.ApplicationsCommands
          ],
          permissions: [
            Discord.PermissionsBitField.Flags.SendMessages,
            
          ]
        });
        console.log(`Invite link: ${inviteLink}`);
    }).catch(err => { 
        console.error("Error fetching application:", err);
    });
};