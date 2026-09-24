const { hasOptedIn, isOptInEnabled } = require('./optinStorage');
const { parseDmError } = require('./dmErrorHandler');
const { getDueSchedules, getScheduleById, advanceSchedule } = require('./scheduleStorage');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function executeSchedule(schedule, client, options = {}) {
    const checkOptIn = options.checkOptIn || hasOptedIn;
    const checkOptInEnabled = options.isOptInEnabled || isOptInEnabled;
    const delayMs = typeof options.delayMs === 'number' ? options.delayMs : 250;
    const parseError = options.parseError || parseDmError;

    let guild;
    try {
        guild = await client.guilds.fetch(schedule.guildId);
    } catch (err) {
        console.error(`Guild ${schedule.guildId} could not be fetched for schedule ${schedule.id}:`, err);
        advanceSchedule(schedule.id);
        return { successful: 0, failed: 0, skipped: 0, breakdown: { 'Guild not found': 1 } };
    }

    let members;
    try {
        members = await guild.members.fetch();
    } catch (err) {
        console.error(`Failed to fetch members for guild ${schedule.guildId}:`, err);
        advanceSchedule(schedule.id);
        return { successful: 0, failed: 0, skipped: 0, breakdown: { 'Member fetch error': 1 } };
    }

    const optInActive = checkOptInEnabled();
    const finalMessage = optInActive
        ? `${schedule.message}\n\n-# Run /optout to disable dms.`
        : schedule.message;

    const targetMembers = [];
    for (const [, member] of members) {
        if (member.user.bot) continue;
        if (schedule.targetType === 'role' && schedule.targetRoleId) {
            if (!member.roles?.cache?.has(schedule.targetRoleId)) continue;
        }
        targetMembers.push(member);
    }

    let successful = 0;
    let failed = 0;
    let skipped = 0;
    const breakdown = {};

    for (const member of targetMembers) {
        if (optInActive && !checkOptIn(member.user.id)) {
            skipped++;
            continue;
        }

        try {
            await member.send(finalMessage);
            successful++;
        } catch (error) {
            console.error(`Failed to send scheduled DM to ${member.user.tag || member.user.id}:`, error);
            failed++;

            const reason = parseError(error);
            breakdown[reason] = (breakdown[reason] || 0) + 1;

            if (error.code === 20026) {
                console.error('Aborting scheduled broadcast due to Discord anti-spam quarantine.');
                break;
            }
        }

        if (delayMs > 0) {
            await sleep(delayMs);
        }
    }

    advanceSchedule(schedule.id);

    return {
        successful,
        failed,
        skipped,
        breakdown,
    };
}

let schedulerTimer = null;
let isProcessing = false;

function startScheduler(client, intervalMs = 15000) {
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
    }

    schedulerTimer = setInterval(async () => {
        if (isProcessing) return;
        isProcessing = true;

        try {
            const dueList = getDueSchedules();
            for (const item of dueList) {
                const current = getScheduleById(item.id);
                if (!current || current.status !== 'active') continue;

                console.log(`Executing scheduled broadcast ${current.id} for guild ${current.guildId}...`);
                const result = await executeSchedule(current, client);
                console.log(`Completed scheduled broadcast ${current.id}: ${result.successful} sent, ${result.skipped} skipped, ${result.failed} failed.`);
            }
        } catch (err) {
            console.error('Error during scheduled task execution:', err);
        } finally {
            isProcessing = false;
        }
    }, intervalMs);

    return schedulerTimer;
}

function stopScheduler() {
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
    }
}

module.exports = {
    executeSchedule,
    startScheduler,
    stopScheduler,
};
