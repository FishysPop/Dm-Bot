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
const { clearDraft, getDraft } = require('../src/utils/scheduleDrafts');
const handleModals = require('../src/events/interactionCreate/handleModals');
const handleButtons = require('../src/events/interactionCreate/handleButtons');
const handleSelectMenus = require('../src/events/interactionCreate/handleSelectMenus');
const scheduleCmd = require('../src/commands/schedule');

const testDir = path.join(__dirname, 'temp_data_cmd');
const testFile = path.join(testDir, 'test_cmd_schedules.json');

describe('schedule interactive workflow', () => {
    beforeEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        initScheduleStorage(testFile);
        clearDraft('guild123', 'owner123');
        process.env.OWNER = 'owner123';
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        clearDraft('guild123', 'owner123');
    });

    it('launches interactive draft panel on /schedule create', async () => {
        let replyData = null;
        const mockInteraction = {
            user: { id: 'owner123' },
            memberPermissions: { has: () => true },
            guild: {
                id: 'guild123',
                members: {
                    fetch: async () => new Map([
                        ['u1', { user: { id: 'u1', bot: false } }]
                    ])
                }
            },
            options: {
                getSubcommand: () => 'create',
                getRole: () => null,
                getString: () => null,
            },
            reply: async (data) => { replyData = data; }
        };

        await scheduleCmd.run({ interaction: mockInteraction });

        assert.ok(replyData);
        assert.equal(replyData.ephemeral, true);
        assert.ok(replyData.embeds && replyData.embeds.length > 0);
        assert.ok(replyData.components && replyData.components.length === 5);
    });

    it('pre-populates draft from slash command options', async () => {
        let replyData = null;
        const mockInteraction = {
            user: { id: 'owner123' },
            memberPermissions: { has: () => true },
            guild: {
                id: 'guild123',
                members: { fetch: async () => new Map() }
            },
            options: {
                getSubcommand: () => 'create',
                getRole: () => ({ id: 'role_vip', name: 'VIP' }),
                getString: (name) => {
                    if (name === 'repeat') return 'weekly';
                    if (name === 'time') return 'in 2 hours';
                    if (name === 'message') return 'Hello VIPs';
                    return null;
                },
            },
            reply: async (data) => { replyData = data; }
        };

        await scheduleCmd.run({ interaction: mockInteraction });

        const draft = getDraft('guild123', 'owner123');
        assert.equal(draft.targetType, 'role');
        assert.equal(draft.targetRoleId, 'role_vip');
        assert.equal(draft.repeat, 'weekly');
        assert.equal(draft.message, 'Hello VIPs');
        assert.ok(draft.timestamp > Date.now());
    });

    it('updates draft time via select menu', async () => {
        let updateData = null;
        const mockInteraction = {
            isStringSelectMenu: () => true,
            isRoleSelectMenu: () => false,
            customId: 'sched_select_time',
            values: ['in_1h'],
            user: { id: 'owner123' },
            memberPermissions: { has: () => true },
            guild: { id: 'guild123', members: { fetch: async () => new Map() } },
            update: async (data) => { updateData = data; }
        };

        await handleSelectMenus(mockInteraction);

        assert.ok(updateData);
        const draft = getDraft('guild123', 'owner123');
        assert.equal(draft.preset, 'in_1h');
        assert.ok(draft.timestamp > Date.now());
    });

    it('updates draft repeat via select menu', async () => {
        let updateData = null;
        const mockInteraction = {
            isStringSelectMenu: () => true,
            isRoleSelectMenu: () => false,
            customId: 'sched_select_repeat',
            values: ['monthly'],
            user: { id: 'owner123' },
            memberPermissions: { has: () => true },
            guild: { id: 'guild123', members: { fetch: async () => new Map() } },
            update: async (data) => { updateData = data; }
        };

        await handleSelectMenus(mockInteraction);

        assert.ok(updateData);
        const draft = getDraft('guild123', 'owner123');
        assert.equal(draft.repeat, 'monthly');
    });

    it('updates draft role via role select menu', async () => {
        let updateData = null;
        const mockInteraction = {
            isStringSelectMenu: () => false,
            isRoleSelectMenu: () => true,
            customId: 'sched_select_role',
            values: ['role_mod'],
            user: { id: 'owner123' },
            memberPermissions: { has: () => true },
            guild: {
                id: 'guild123',
                roles: { cache: new Map([['role_mod', { id: 'role_mod', name: 'Moderator' }]]) },
                members: { fetch: async () => new Map() }
            },
            update: async (data) => { updateData = data; }
        };

        await handleSelectMenus(mockInteraction);

        assert.ok(updateData);
        const draft = getDraft('guild123', 'owner123');
        assert.equal(draft.targetType, 'role');
        assert.equal(draft.targetRoleId, 'role_mod');
    });

    it('opens message modal on Set Message button click', async () => {
        let shownModal = null;
        const mockInteraction = {
            isButton: () => true,
            customId: 'sched_btn_message',
            user: { id: 'owner123' },
            memberPermissions: { has: () => true },
            guild: { id: 'guild123' },
            showModal: async (m) => { shownModal = m; }
        };

        await handleButtons(mockInteraction);

        assert.ok(shownModal);
        assert.equal(shownModal.data.custom_id, 'sched_modal_message');
    });

    it('updates draft message from modal submission', async () => {
        let updateData = null;
        const mockInteraction = {
            isModalSubmit: () => true,
            customId: 'sched_modal_message',
            user: { id: 'owner123' },
            guild: { id: 'guild123', members: { fetch: async () => new Map() } },
            fields: {
                getTextInputValue: (name) => name === 'message_text' ? 'New Announcement' : ''
            },
            update: async (data) => { updateData = data; }
        };

        await handleModals(mockInteraction);

        assert.ok(updateData);
        const draft = getDraft('guild123', 'owner123');
        assert.equal(draft.message, 'New Announcement');
    });

    it('confirms and creates schedule when valid', async () => {
        const draft = getDraft('guild123', 'owner123');
        draft.message = 'Final broadcast text';
        draft.timestamp = Date.now() + 100000;
        draft.repeat = 'daily';

        let updateData = null;
        const mockInteraction = {
            isButton: () => true,
            customId: 'sched_btn_confirm',
            user: { id: 'owner123' },
            memberPermissions: { has: () => true },
            guild: { id: 'guild123', members: { fetch: async () => new Map() } },
            update: async (data) => { updateData = data; }
        };

        await handleButtons(mockInteraction);

        assert.ok(updateData);
        const active = getActiveSchedules('guild123');
        assert.equal(active.length, 1);
        assert.equal(active[0].message, 'Final broadcast text');
        assert.equal(active[0].repeat, 'daily');
    });

    it('cancels draft creation via cancel button', async () => {
        let updateData = null;
        const mockInteraction = {
            isButton: () => true,
            customId: 'sched_btn_cancel',
            user: { id: 'owner123' },
            memberPermissions: { has: () => true },
            guild: { id: 'guild123' },
            update: async (data) => { updateData = data; }
        };

        await handleButtons(mockInteraction);

        assert.ok(updateData);
        assert.match(updateData.content, /cancelled/i);
    });

    it('lists and cancels created schedules', async () => {
        const sched = createSchedule({
            guildId: 'guild123',
            targetType: 'everyone',
            message: 'Active item',
            repeat: 'weekly',
            nextRun: Date.now() + 50000,
            createdBy: 'owner123'
        });

        let replyList = null;
        await scheduleCmd.run({
            interaction: {
                user: { id: 'owner123' },
                memberPermissions: { has: () => true },
                guild: { id: 'guild123' },
                options: { getSubcommand: () => 'list' },
                reply: async (data) => { replyList = data; }
            }
        });

        assert.ok(replyList);
        assert.ok(replyList.embeds && replyList.embeds.length > 0);

        let cancelReply = null;
        await scheduleCmd.run({
            interaction: {
                user: { id: 'owner123' },
                memberPermissions: { has: () => true },
                guild: { id: 'guild123' },
                options: {
                    getSubcommand: () => 'cancel',
                    getString: (n) => n === 'id' ? sched.id : null
                },
                reply: async (data) => { cancelReply = data; }
            }
        });

        assert.ok(cancelReply);
        assert.match(cancelReply.content, /cancelled/i);
        assert.equal(getScheduleById(sched.id).status, 'cancelled');
    });
});
