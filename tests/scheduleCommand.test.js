const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    initScheduleStorage,
    createSchedule,
    getScheduleById,
    getActiveSchedules
} = require('../src/utils/scheduleStorage');
const handleModals = require('../src/events/interactionCreate/handleModals');
const handleButtons = require('../src/events/interactionCreate/handleButtons');

const testDir = path.join(__dirname, 'temp_data_cmd');
const testFile = path.join(testDir, 'test_cmd_schedules.json');

describe('schedule interactions', () => {
    beforeEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        initScheduleStorage(testFile);
        process.env.OWNER = 'owner123';
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    it('handles valid modal submission and creates schedule', async () => {
        let replyData = null;
        const mockInteraction = {
            isModalSubmit: () => true,
            customId: 'sched_modal_everyone_weekly',
            user: { id: 'owner123', tag: 'Owner#0001' },
            guild: {
                id: 'guild123',
                roles: { cache: new Map() },
                members: {
                    fetch: async () => new Map([
                        ['u1', { user: { id: 'u1', bot: false } }],
                        ['u2', { user: { id: 'u2', bot: false } }]
                    ])
                }
            },
            fields: {
                getTextInputValue: (field) => {
                    if (field === 'datetime') return 'in 2 hours';
                    if (field === 'message') return 'Weekly announcement text';
                    return '';
                }
            },
            reply: async (data) => {
                replyData = data;
            }
        };

        await handleModals(mockInteraction);

        assert.ok(replyData);
        assert.equal(replyData.ephemeral, true);
        assert.ok(replyData.embeds && replyData.embeds.length > 0);
        assert.ok(replyData.components && replyData.components.length > 0);

        const active = getActiveSchedules('guild123');
        assert.equal(active.length, 1);
        assert.equal(active[0].message, 'Weekly announcement text');
        assert.equal(active[0].repeat, 'weekly');
        assert.equal(active[0].targetType, 'everyone');
    });

    it('rejects invalid date in modal submission with friendly error', async () => {
        let replyData = null;
        const mockInteraction = {
            isModalSubmit: () => true,
            customId: 'sched_modal_everyone_none',
            user: { id: 'owner123' },
            guild: { id: 'guild123' },
            fields: {
                getTextInputValue: (field) => {
                    if (field === 'datetime') return 'not a date';
                    if (field === 'message') return 'Hello';
                    return '';
                }
            },
            reply: async (data) => {
                replyData = data;
            }
        };

        await handleModals(mockInteraction);

        assert.ok(replyData);
        assert.equal(replyData.ephemeral, true);
        assert.match(replyData.content, /invalid or unrecognized/i);

        const active = getActiveSchedules('guild123');
        assert.equal(active.length, 0);
    });

    it('cancels schedule via button click', async () => {
        const schedule = createSchedule({
            guildId: 'guild123',
            targetType: 'everyone',
            message: 'To be cancelled',
            repeat: 'none',
            nextRun: Date.now() + 100000,
            createdBy: 'owner123'
        });

        let updateData = null;
        let replyData = null;
        const mockInteraction = {
            isButton: () => true,
            customId: `sched_cancel_${schedule.id}`,
            user: { id: 'owner123' },
            memberPermissions: { has: () => true },
            update: async (data) => { updateData = data; },
            reply: async (data) => { replyData = data; }
        };

        await handleButtons(mockInteraction);

        assert.ok(updateData);
        const updated = getScheduleById(schedule.id);
        assert.equal(updated.status, 'cancelled');
    });

    it('sends test DM via button click', async () => {
        const schedule = createSchedule({
            guildId: 'guild123',
            targetType: 'everyone',
            message: 'Test run content',
            repeat: 'daily',
            nextRun: Date.now() + 100000,
            createdBy: 'owner123'
        });

        let testDmSent = null;
        let replyData = null;
        const mockInteraction = {
            isButton: () => true,
            customId: `sched_test_${schedule.id}`,
            user: {
                id: 'owner123',
                send: async (msg) => { testDmSent = msg; }
            },
            memberPermissions: { has: () => true },
            reply: async (data) => { replyData = data; }
        };

        await handleButtons(mockInteraction);

        assert.ok(testDmSent);
        assert.match(testDmSent, /Test run content/);
        assert.ok(replyData);
        assert.match(replyData.content, /test direct message sent/i);
    });

    it('rejects schedule command for non-owner and non-admin', async () => {
        const scheduleCmd = require('../src/commands/schedule');
        let replyData = null;
        const mockInteraction = {
            user: { id: 'regular_user' },
            memberPermissions: { has: () => false },
            reply: async (data) => { replyData = data; }
        };

        await scheduleCmd.run({ interaction: mockInteraction });

        assert.ok(replyData);
        assert.match(replyData.content, /only administrators/i);
    });

    it('shows modal when running schedule create', async () => {
        const scheduleCmd = require('../src/commands/schedule');
        let shownModal = null;
        const mockInteraction = {
            user: { id: 'owner123' },
            memberPermissions: { has: () => true },
            guild: { id: 'guild123' },
            options: {
                getSubcommand: () => 'create',
                getRole: () => null,
                getString: () => 'weekly'
            },
            showModal: async (modal) => { shownModal = modal; }
        };

        await scheduleCmd.run({ interaction: mockInteraction });

        assert.ok(shownModal);
        assert.equal(shownModal.data.custom_id, 'sched_modal_everyone_weekly');
    });

    it('lists active schedules and provides cancel buttons', async () => {
        const scheduleCmd = require('../src/commands/schedule');
        const sched = createSchedule({
            guildId: 'guild123',
            targetType: 'everyone',
            message: 'Listing test',
            repeat: 'daily',
            nextRun: Date.now() + 100000,
            createdBy: 'owner123'
        });

        let replyData = null;
        const mockInteraction = {
            user: { id: 'owner123' },
            memberPermissions: { has: () => true },
            guild: { id: 'guild123' },
            options: {
                getSubcommand: () => 'list'
            },
            reply: async (data) => { replyData = data; }
        };

        await scheduleCmd.run({ interaction: mockInteraction });

        assert.ok(replyData);
        assert.equal(replyData.ephemeral, true);
        assert.ok(replyData.embeds && replyData.embeds.length > 0);
        assert.ok(replyData.components && replyData.components.length > 0);
    });

    it('cancels schedule via /schedule cancel', async () => {
        const scheduleCmd = require('../src/commands/schedule');
        const sched = createSchedule({
            guildId: 'guild123',
            targetType: 'everyone',
            message: 'To cancel via command',
            repeat: 'daily',
            nextRun: Date.now() + 100000,
            createdBy: 'owner123'
        });

        let replyData = null;
        const mockInteraction = {
            user: { id: 'owner123' },
            memberPermissions: { has: () => true },
            guild: { id: 'guild123' },
            options: {
                getSubcommand: () => 'cancel',
                getString: (name) => name === 'id' ? sched.id : null
            },
            reply: async (data) => { replyData = data; }
        };

        await scheduleCmd.run({ interaction: mockInteraction });

        assert.ok(replyData);
        assert.match(replyData.content, /has been cancelled/i);
        const fetched = getScheduleById(sched.id);
        assert.equal(fetched.status, 'cancelled');
    });
});
