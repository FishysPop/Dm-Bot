const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
    getDraft,
    setDraft,
    clearDraft,
    buildDraftPanel,
    presetToTimestamp
} = require('../src/utils/scheduleDrafts');

describe('scheduleDrafts', () => {
    beforeEach(() => {
        clearDraft('g1', 'u1');
    });

    it('creates a default draft if none exists', () => {
        const draft = getDraft('g1', 'u1');
        assert.equal(draft.guildId, 'g1');
        assert.equal(draft.userId, 'u1');
        assert.equal(draft.targetType, 'everyone');
        assert.equal(draft.repeat, 'none');
        assert.equal(draft.timestamp, null);
        assert.equal(draft.message, null);
    });

    it('updates and persists draft fields', () => {
        setDraft('g1', 'u1', {
            targetType: 'role',
            targetRoleId: 'role_test',
            targetRoleName: 'Announcements',
            repeat: 'weekly',
            message: 'Draft message'
        });

        const draft = getDraft('g1', 'u1');
        assert.equal(draft.targetType, 'role');
        assert.equal(draft.targetRoleId, 'role_test');
        assert.equal(draft.repeat, 'weekly');
        assert.equal(draft.message, 'Draft message');
    });

    it('clears draft', () => {
        setDraft('g1', 'u1', { message: 'To clear' });
        clearDraft('g1', 'u1');
        const draft = getDraft('g1', 'u1');
        assert.equal(draft.message, null);
    });

    it('resolves preset to timestamp', () => {
        const now = new Date('2026-10-01T12:00:00.000Z').getTime();
        const ts = presetToTimestamp('in_1h', now);
        assert.equal(ts, now + 3600 * 1000);

        const tsDay = presetToTimestamp('in_24h', now);
        assert.equal(tsDay, now + 24 * 3600 * 1000);
    });

    it('builds draft panel with embeds and action rows', () => {
        const draft = getDraft('g1', 'u1');
        draft.message = 'Test content';
        draft.timestamp = Date.now() + 3600000;

        const mockGuild = {
            id: 'g1',
            members: {
                fetch: async () => new Map([
                    ['u1', { user: { id: 'u1', bot: false } }]
                ])
            }
        };

        const panel = buildDraftPanel(draft, 1);
        assert.ok(panel.embeds && panel.embeds.length === 1);
        assert.ok(panel.components && panel.components.length > 0);
        assert.equal(panel.ephemeral, true);
    });
});
