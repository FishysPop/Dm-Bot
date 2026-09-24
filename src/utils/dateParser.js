function parseDateTime(input, referenceDate = new Date()) {
    if (!input || typeof input !== 'string') {
        return { success: false, error: 'Please provide a valid date string.' };
    }

    const trimmed = input.trim();
    const now = referenceDate.getTime();

    const relativeMatch = trimmed.match(/^in\s+(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks)$/i);
    if (relativeMatch) {
        const amount = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2].toLowerCase();

        let msToAdd = 0;
        if (unit.startsWith('m')) {
            msToAdd = amount * 60 * 1000;
        } else if (unit.startsWith('h')) {
            msToAdd = amount * 60 * 60 * 1000;
        } else if (unit.startsWith('d')) {
            msToAdd = amount * 24 * 60 * 60 * 1000;
        } else if (unit.startsWith('w')) {
            msToAdd = amount * 7 * 24 * 60 * 60 * 1000;
        }

        const targetDate = new Date(now + msToAdd);
        return { success: true, date: targetDate, timestamp: targetDate.getTime() };
    }

    const discordMatch = trimmed.match(/^<t:(\d+)(?::[a-zA-Z])?>$/);
    if (discordMatch) {
        const timestamp = parseInt(discordMatch[1], 10) * 1000;
        const targetDate = new Date(timestamp);
        if (targetDate.getTime() <= now) {
            return { success: false, error: 'Scheduled time must be in the future.' };
        }
        return { success: true, date: targetDate, timestamp: targetDate.getTime() };
    }

    let parsedDate;
    const isoLikeMatch = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[\sT](\d{2}):(\d{2})(?::(\d{2}))?(?:\s*(UTC|Z))?$/i);
    if (isoLikeMatch) {
        const [, year, month, day, hour, minute, second] = isoLikeMatch;
        const sec = second || '00';
        parsedDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${sec}.000Z`);
    } else {
        parsedDate = new Date(trimmed);
    }

    if (isNaN(parsedDate.getTime())) {
        return {
            success: false,
            error: 'Invalid or unrecognized date format. Use YYYY-MM-DD HH:mm UTC or relative syntax such as "in 2 hours".'
        };
    }

    if (parsedDate.getTime() <= now) {
        return { success: false, error: 'Scheduled time must be in the future.' };
    }

    return { success: true, date: parsedDate, timestamp: parsedDate.getTime() };
}

function calculateNextRun(fromRunDate, repeatInterval, referenceDate = new Date()) {
    if (!repeatInterval || repeatInterval.toLowerCase() === 'none') {
        return null;
    }

    const interval = repeatInterval.toLowerCase();
    const next = new Date(fromRunDate);
    const threshold = referenceDate.getTime();

    do {
        if (interval === 'daily') {
            next.setUTCDate(next.getUTCDate() + 1);
        } else if (interval === 'weekly') {
            next.setUTCDate(next.getUTCDate() + 7);
        } else if (interval === 'monthly') {
            next.setUTCMonth(next.getUTCMonth() + 1);
        } else {
            return null;
        }
    } while (next.getTime() <= threshold);

    return next;
}

module.exports = {
    parseDateTime,
    calculateNextRun,
};
