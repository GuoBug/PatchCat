import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node.js environment
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

(globalThis as unknown as { localStorage: typeof storageMock; window: { localStorage: typeof storageMock } }).localStorage = storageMock;
(globalThis as unknown as { window: { localStorage: typeof storageMock } }).window = {
  localStorage: storageMock,
};

import {
  ShadowDraftManager,
  saveShadowDraft,
  getShadowDraft,
  clearShadowDraft,
  checkRecoveryNeeded,
  STORAGE_KEY_SHADOW_DRAFT,
} from '../src/services/storage/shadow-draft-manager.ts';

describe('Module 4: Shadow Draft Manager & Recovery Guard', () => {
  beforeEach(() => {
    storageMock.clear();
  });

  test('STORAGE_KEY_SHADOW_DRAFT matches PRD-013 specification', () => {
    assert.equal(STORAGE_KEY_SHADOW_DRAFT, 'patchcat_shadow_draft_v1');
  });

  test('saveShadowDraft writes micro-draft and merges node drafts', () => {
    saveShadowDraft('wf-101', 'prompt_1', {
      config: { template: 'Hello {{input_1.query}}' },
      label: 'Custom Prompt',
    });

    const draft = getShadowDraft();
    assert.ok(draft !== null);
    assert.equal(draft.workflowId, 'wf-101');
    assert.equal(draft.activeNodeId, 'prompt_1');
    assert.ok(draft.timestamp > 0);
    assert.deepEqual(draft.nodeDrafts['prompt_1'], {
      config: { template: 'Hello {{input_1.query}}' },
      label: 'Custom Prompt',
    });

    // Partial update to config merges cleanly
    saveShadowDraft('wf-101', 'prompt_1', {
      config: { temperature: 0.9 },
    });

    const updated = getShadowDraft();
    assert.ok(updated !== null);
    assert.deepEqual(updated.nodeDrafts['prompt_1'], {
      config: {
        template: 'Hello {{input_1.query}}',
        temperature: 0.9,
      },
      label: 'Custom Prompt',
    });

    // Adding second node draft preserves first node
    saveShadowDraft('wf-101', 'code_1', {
      config: { script: 'return inputs;' },
    });

    const multiNodeDraft = getShadowDraft();
    assert.ok(multiNodeDraft !== null);
    assert.equal(multiNodeDraft.activeNodeId, 'code_1');
    assert.ok(multiNodeDraft.nodeDrafts['prompt_1']);
    assert.ok(multiNodeDraft.nodeDrafts['code_1']);
  });

  test('switching workflow creates a fresh shadow draft', () => {
    saveShadowDraft('wf-101', 'node_1', { text: 'draft 1' });
    let draft = getShadowDraft();
    assert.equal(draft?.workflowId, 'wf-101');

    saveShadowDraft('wf-202', 'node_2', { text: 'draft 2' });
    draft = getShadowDraft();
    assert.equal(draft?.workflowId, 'wf-202');
    assert.equal(draft?.nodeDrafts['node_1'], undefined);
    assert.ok(draft?.nodeDrafts['node_2']);
  });

  test('clearShadowDraft completely removes draft', () => {
    saveShadowDraft('wf-101', 'node_1', { text: 'to delete' });
    assert.ok(getShadowDraft() !== null);

    clearShadowDraft();
    assert.equal(getShadowDraft(), null);
    assert.equal(storageMock.getItem(STORAGE_KEY_SHADOW_DRAFT), null);
  });

  test('checkRecoveryNeeded properly compares timestamp with committed workflow', () => {
    const commitTime = 1000000;

    // Case 1: No draft exists
    let result = checkRecoveryNeeded('wf-101', commitTime);
    assert.equal(result.needed, false);
    assert.equal(result.draft, null);

    // Case 2: Draft exists for another workflow
    saveShadowDraft('wf-999', 'node_1', { foo: 'bar' });
    result = checkRecoveryNeeded('wf-101', commitTime);
    assert.equal(result.needed, false);
    assert.equal(result.draft, null);

    // Case 3: Draft timestamp is OLDER than or equal to currentUpdatedAt
    const staleDraft = {
      workflowId: 'wf-101',
      timestamp: 900000, // older than commitTime (1000000)
      nodeDrafts: { node_1: { foo: 'bar' } },
    };
    storageMock.setItem(STORAGE_KEY_SHADOW_DRAFT, JSON.stringify(staleDraft));
    result = checkRecoveryNeeded('wf-101', commitTime);
    assert.equal(result.needed, false);
    assert.equal(result.draft, null);

    // Case 4: Draft timestamp is NEWER than currentUpdatedAt (crash / unsynced recovery needed)
    const freshDraft = {
      workflowId: 'wf-101',
      timestamp: 1000500, // newer than commitTime (1000000)
      nodeDrafts: { node_1: { unsavedContent: 'important prompt changes' } },
    };
    storageMock.setItem(STORAGE_KEY_SHADOW_DRAFT, JSON.stringify(freshDraft));
    result = checkRecoveryNeeded('wf-101', commitTime);
    assert.equal(result.needed, true);
    assert.ok(result.draft !== null);
    assert.equal(result.draft?.workflowId, 'wf-101');
    assert.equal(result.draft?.nodeDrafts['node_1']?.['unsavedContent'], 'important prompt changes');
  });

  test('ShadowDraftManager exposes all specified methods', () => {
    assert.equal(typeof ShadowDraftManager.saveShadowDraft, 'function');
    assert.equal(typeof ShadowDraftManager.getShadowDraft, 'function');
    assert.equal(typeof ShadowDraftManager.clearShadowDraft, 'function');
    assert.equal(typeof ShadowDraftManager.checkRecoveryNeeded, 'function');
  });
});
