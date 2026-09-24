const fs = require('fs');
const path = require('path');
const { calculateNextRun } = require('./dateParser');

const defaultDataDir = path.join(__dirname, '../../data');
const defaultFilePath = path.join(defaultDataDir, 'schedules.json');

let activeFilePath = defaultFilePath;

function initScheduleStorage(customPath) {
    if (customPath) {
        activeFilePath = customPath;
    } else {
        activeFilePath = defaultFilePath;
    }
}

function ensureStorageFile() {
    const dir = path.dirname(activeFilePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(activeFilePath)) {
        fs.writeFileSync(activeFilePath, JSON.stringify([]), 'utf-8');
    }
}

function getSchedules() {
    ensureStorageFile();
    try {
        const raw = fs.readFileSync(activeFilePath, 'utf-8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveSchedules(schedules) {
    ensureStorageFile();
    fs.writeFileSync(activeFilePath, JSON.stringify(schedules, null, 2), 'utf-8');
}

function getActiveSchedules(guildId) {
    const schedules = getSchedules();
    return schedules
        .filter(s => s.status === 'active' && (!guildId || s.guildId === guildId))
        .sort((a, b) => a.nextRun - b.nextRun);
}

function getDueSchedules(referenceTime = Date.now()) {
    const schedules = getSchedules();
    return schedules
        .filter(s => s.status === 'active' && typeof s.nextRun === 'number' && s.nextRun <= referenceTime)
        .sort((a, b) => a.nextRun - b.nextRun);
}

function getScheduleById(id) {
    const schedules = getSchedules();
    return schedules.find(s => s.id === id) || null;
}

function createSchedule(data) {
    const schedules = getSchedules();
    const id = 'sched_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    const newSchedule = {
        id,
        guildId: data.guildId,
        targetType: data.targetType || 'everyone',
        targetRoleId: data.targetRoleId || null,
        targetRoleName: data.targetRoleName || (data.targetType === 'role' ? 'Role' : '@everyone'),
        message: data.message,
        repeat: data.repeat || 'none',
        nextRun: data.nextRun,
        createdAt: new Date().toISOString(),
        createdBy: data.createdBy,
        lastRun: null,
        status: 'active'
    };

    schedules.push(newSchedule);
    saveSchedules(schedules);
    return newSchedule;
}

function cancelSchedule(id) {
    const schedules = getSchedules();
    const schedule = schedules.find(s => s.id === id);
    if (!schedule) return null;

    schedule.status = 'cancelled';
    saveSchedules(schedules);
    return schedule;
}

function advanceSchedule(id, referenceDate = new Date()) {
    const schedules = getSchedules();
    const schedule = schedules.find(s => s.id === id);
    if (!schedule) return null;

    schedule.lastRun = schedule.nextRun;

    if (schedule.repeat && schedule.repeat !== 'none') {
        const nextDate = calculateNextRun(schedule.nextRun, schedule.repeat, referenceDate);
        if (nextDate) {
            schedule.nextRun = nextDate.getTime();
            schedule.status = 'active';
        } else {
            schedule.status = 'completed';
        }
    } else {
        schedule.status = 'completed';
    }

    saveSchedules(schedules);
    return schedule;
}

function deleteSchedule(id) {
    let schedules = getSchedules();
    const initialLen = schedules.length;
    schedules = schedules.filter(s => s.id !== id);
    if (schedules.length !== initialLen) {
        saveSchedules(schedules);
        return true;
    }
    return false;
}

module.exports = {
    initScheduleStorage,
    getSchedules,
    getActiveSchedules,
    getDueSchedules,
    getScheduleById,
    createSchedule,
    cancelSchedule,
    advanceSchedule,
    deleteSchedule,
};
