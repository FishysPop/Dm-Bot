require('dotenv').config();
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const filePath = path.join(dataDir, 'optin.json');

function isOptInEnabled() {
    const envVal = process.env.ENABLE_OPT_IN_OUT ?? process.env.REQUIRE_OPT_IN ?? process.env.ENABLE_OPT_IN;
    if (envVal === undefined) return true;
    return envVal.toLowerCase() === 'true';
}

function ensureDataFile() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([]), 'utf-8');
    }
}

function getOptedInUsers() {
    ensureDataFile();
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function hasOptedIn(userId) {
    if (!isOptInEnabled()) {
        return true;
    }
    const users = getOptedInUsers();
    return users.includes(userId);
}

function optIn(userId) {
    const users = getOptedInUsers();
    if (!users.includes(userId)) {
        users.push(userId);
        ensureDataFile();
        fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf-8');
    }
    return true;
}

function optOut(userId) {
    let users = getOptedInUsers();
    if (users.includes(userId)) {
        users = users.filter(id => id !== userId);
        ensureDataFile();
        fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf-8');
    }
    return true;
}

module.exports = {
    getOptedInUsers,
    hasOptedIn,
    optIn,
    optOut,
    isOptInEnabled,
};
