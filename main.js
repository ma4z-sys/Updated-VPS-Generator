// discord.js bot for deploying docker containers with tmate SSH
const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require('discord.js');
const { spawn, execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOKEN = "YOUR_TOKEN";
const SERVER_LIMIT = 5;
const AUTHORIZED_ROLE_IDS = ["000000000000000000", "000000000000000000"];
const databaseFile = path.join(__dirname, 'servers.txt');
const image = "ghcr.io/ma4z-sys/vps_gen_v4:latest";

// Create bot client
const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

// Helpers
function countUserServers(userId) {
    try {
        const lines = fs.readFileSync(databaseFile, 'utf8').split('\n').filter(Boolean);
        return lines.filter(line => line.startsWith(userId)).length;
    } catch {
        return 0;
    }
}

function addToDatabase(userId, containerName, sshCommand) {
    fs.appendFileSync(databaseFile, `${userId}|${containerName}|${sshCommand}\n`);
}

function listServersFromFile() {
    try {
        return fs.readFileSync(databaseFile, 'utf8').split('\n').filter(Boolean);
    } catch {
        return ["No servers found."];
    }
}

async function captureSSHCommand(proc) {
    return new Promise((resolve) => {
        let sshCommand = null;
        let retries = 0;
        const maxRetries = 30;

        proc.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                console.log("tmate output:", line.trim());
                if (line.includes('ssh ') && !line.includes('ro-')) {
                    sshCommand = line.trim();
                    resolve(sshCommand);
                }
            });
        });

        const interval = setInterval(() => {
            retries++;
            if (sshCommand || retries >= maxRetries) {
                clearInterval(interval);
                resolve(sshCommand);
            }
        }, 1000);
    });
}

async function deployServer(ctx, targetUser, ram, cores) {
    const userId = targetUser.id;

    if (countUserServers(userId) >= SERVER_LIMIT) {
        return ctx.reply({ embeds: [new EmbedBuilder().setDescription("```Error: Instance Limit Reached```").setColor(0xff0000)] });
    }

    let containerId;
    try {
        containerId = execSync(`docker run -itd --privileged --cap-add=ALL --memory ${ram} --cpus ${cores} ${image}`).toString().trim();
    } catch (err) {
        return ctx.reply({ embeds: [new EmbedBuilder().setDescription(`Error creating Docker container: ${err}`).setColor(0xff0000)] });
    }

    let execCmd;
    try {
        execCmd = spawn('docker', ['exec', containerId, 'tmate', '-F']);
    } catch (err) {
        execSync(`docker kill ${containerId}`);
        execSync(`docker rm ${containerId}`);
        return ctx.reply({ embeds: [new EmbedBuilder().setDescription(`Error executing tmate: ${err}`).setColor(0xff0000)] });
    }

    const sshSession = await captureSSHCommand(execCmd);
    if (sshSession) {
        try {
            await targetUser.send({ embeds: [new EmbedBuilder().setDescription(`### Successfully created Instance\nSSH Session Command: \`\`\`${sshSession}\`\`\`\nOS: Ubuntu 22.04`).setColor(0x00ff00)] });
            addToDatabase(userId, containerId, sshSession);
            ctx.reply({ embeds: [new EmbedBuilder().setDescription(`Instance created successfully. SSH details sent to ${targetUser}.`).setColor(0x00ff00)] });
        } catch {
            ctx.reply({ embeds: [new EmbedBuilder().setDescription(`Unable to DM ${targetUser}. Please enable DMs.`).setColor(0xff0000)] });
        }
    } else {
        execSync(`docker kill ${containerId}`);
        execSync(`docker rm ${containerId}`);
        ctx.reply({ embeds: [new EmbedBuilder().setDescription("Instance creation failed or timed out.").setColor(0xff0000)] });
    }
}

// Commands
bot.on('messageCreate', async (msg) => {
    if (!msg.content.startsWith('!')) return;

    const args = msg.content.trim().split(/\s+/);
    const command = args.shift().slice(1);

    if (command === 'deploy') {
        const [userid, ram, cores] = args;
        if (!AUTHORIZED_ROLE_IDS.some(roleId => msg.member.roles.cache.has(roleId))) {
            return msg.reply({ embeds: [new EmbedBuilder().setDescription("You don't have permission.").setColor(0xff0000)] });
        }
        try {
            const targetUser = await bot.users.fetch(userid);
            msg.reply({ embeds: [new EmbedBuilder().setDescription("Creating Instance...").setColor(0x00ff00)] });
            await deployServer(msg, targetUser, ram, cores);
        } catch {
            msg.reply({ embeds: [new EmbedBuilder().setDescription(`User with ID ${userid} not found.`).setColor(0xff0000)] });
        }
    }

    if (command === 'ressh') {
        const [containerId, userid] = args;
        try {
            let status = execSync(`docker inspect --format='{{.State.Running}}' ${containerId}`).toString().trim();
            if (status === "'false'") {
                execSync(`docker kill ${containerId}`);
                execSync(`docker rm ${containerId}`);
            }
            execSync(`docker start ${containerId}`);

            const execCmd = spawn('docker', ['exec', containerId, 'tmate', '-F']);
            const sshSession = await captureSSHCommand(execCmd);

            if (sshSession) {
                const targetUser = await bot.users.fetch(userid);
                await targetUser.send({ embeds: [new EmbedBuilder().setDescription(`SSH Session Command: \`\`\`${sshSession}\`\`\``).setColor(0x00ff00)] });
                msg.reply({ embeds: [new EmbedBuilder().setDescription(`SSH details sent to ${targetUser}.`).setColor(0x00ff00)] });
            } else {
                msg.reply({ embeds: [new EmbedBuilder().setDescription("Failed to capture SSH session command.").setColor(0xff0000)] });
            }
        } catch (err) {
            msg.reply({ embeds: [new EmbedBuilder().setDescription(`Error: ${err}`).setColor(0xff0000)] });
        }
    }

    if (command === 'list') {
        if (!AUTHORIZED_ROLE_IDS.some(roleId => msg.member.roles.cache.has(roleId))) {
            return msg.reply({ embeds: [new EmbedBuilder().setDescription("You do not have permission.").setColor(0xff0000)] });
        }
        const serverDetails = listServersFromFile();
        const content = serverDetails.length
            ? `\`\`\`\n${serverDetails.join('\n')}\n\`\`\``
            : "No server data available.";

        try {
            await msg.author.send({ embeds: [new EmbedBuilder().setDescription("Here are the server details:\n" + content).setColor(0x00ff00)] });
            msg.reply({ embeds: [new EmbedBuilder().setDescription("I've sent you a DM with the server details.").setColor(0x00ff00)] });
        } catch {
            msg.reply({ embeds: [new EmbedBuilder().setDescription("I can't DM you. Please enable DMs.").setColor(0xff0000)] });
        }
    }
});

// Bot ready
bot.once('ready', () => {
    bot.user.setPresence({
        status: 'dnd',
        activities: [{ name: 'with VPS v4', type: 0 }]
    });
    console.log(`Logged in as ${bot.user.tag}`);
});

bot.login(TOKEN);
