const Discord = require('discord.js');
const { CommandKit } = require('commandkit');
const path = require('path');
require("dotenv").config();


const client = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMembers,] });

new CommandKit({
    client,
    commandsPath: path.join(__dirname, 'commands'),
    eventsPath: path.join(__dirname, 'events'),
    skipBuiltInValidations: false,
    bulkRegister: true,
});

client.login(process.env.TOKEN);
