/**
 * Node.js test for Knowledge Store & LocalKnowledgeAdapter
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LocalKnowledgeAdapter } from '../src/services/storage/knowledge-adapter.ts';

describe('LocalKnowledgeAdapter & Knowledge Management', () => {
  it('should initialize with default seeded architecture knowledge base', async () => {
    const adapter = new LocalKnowledgeAdapter();
    const kbs = await adapter.getKnowledgeBases();

    assert.ok(kbs.length >= 1, 'Should have at least 1 seeded knowledge base');
    const archKb = kbs.find((k) => k.id === 'kb_patchcat_arch');
    assert.ok(archKb, 'Should contain kb_patchcat_arch');
    assert.strictEqual(archKb.name, 'PatchCat Architecture Whitepaper');

    const docs = await adapter.getDocuments(archKb.id);
    assert.ok(docs.length >= 1, 'Should contain at least 1 document');
    const chunks = await adapter.getDocumentChunks(docs[0].id);
    assert.ok(chunks.length >= 3, 'Should contain at least 3 chunks');
    assert.strictEqual(chunks[0].is_active, true);
  });

  it('should create, search, and delete a custom knowledge base', async () => {
    const adapter = new LocalKnowledgeAdapter();

    const created = await adapter.createKnowledgeBase({
      name: 'Agentic Research Lab',
      description: 'Papers and articles on autonomous workflows',
      embedding_provider: 'local',
      embedding_model: 'deterministic',
      embedding_dimension: 64,
    });

    assert.ok(created.id.startsWith('kb_'));
    assert.strictEqual(created.name, 'Agentic Research Lab');

    // Search
    const searchResults = await adapter.getKnowledgeBases('Research');
    assert.ok(searchResults.some((k) => k.id === created.id));

    // Delete
    await adapter.deleteKnowledgeBase(created.id);
    const afterDelete = await adapter.getKnowledgeBases();
    assert.ok(!afterDelete.some((k) => k.id === created.id));
  });

  it('should upload a document, chunk it with overlap, and toggle chunk active states', async () => {
    const adapter = new LocalKnowledgeAdapter();

    const kb = await adapter.createKnowledgeBase({
      name: 'Test Document Upload KB',
    });

    const doc = await adapter.uploadDocument(
      kb.id,
      {
        name: 'test-guide.md',
        content:
          '# Section 1: Overview\n\nPatchCat executes directed acyclic graph workflows.\n\n# Section 2: Details\n\nEach node processes inputs and passes outputs through Kahn topological layers.',
      },
      { chunkSize: 120, chunkOverlap: 30 }
    );

    assert.ok(doc.id.startsWith('doc_'));
    assert.strictEqual(doc.name, 'test-guide.md');
    assert.ok(doc.chunk_count >= 2);

    const chunks = await adapter.getDocumentChunks(doc.id);
    assert.strictEqual(chunks.length, doc.chunk_count);
    assert.strictEqual(chunks[0].is_active, true);

    // Toggle chunk to inactive
    const toggled = await adapter.toggleChunkActive(chunks[0].id, false);
    assert.strictEqual(toggled.is_active, false);

    const updatedChunks = await adapter.getDocumentChunks(doc.id);
    assert.strictEqual(updatedChunks[0].is_active, false);

    // Delete doc
    await adapter.deleteDocument(doc.id);
    const docsAfter = await adapter.getDocuments(kb.id);
    assert.strictEqual(docsAfter.length, 0);

    // Clean up KB
    await adapter.deleteKnowledgeBase(kb.id);
  });
});
