import { Client } from "discord.js";

const client = new Client({
	intents: ["Guilds", "GuildMessages", "MessageContent"],
});

client.on("clientReady", () => {
	console.log(`Logged in as ${client.user?.tag}`);
});

client.on("messageCreate", async (message) => {
	console.log(`Message received: ${message.content}`);
});

client.login(process.env["DISCORD_BOT_TOKEN"]);
