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

  it('should enforce hard chunk size cap even with huge single unbroken paragraphs', async () => {
    const adapter = new LocalKnowledgeAdapter();
    const kb = await adapter.createKnowledgeBase({ name: 'Hard Cap Test KB' });

    // Single unbroken paragraph with 3500 chars (like dense stream / OCR / unspaced text)
    const longUnbrokenText = 'A'.repeat(3500);
    const doc = await adapter.uploadDocument(
      kb.id,
      {
        name: 'dense-unbroken.txt',
        content: longUnbrokenText,
      },
      { chunkSize: 500, chunkOverlap: 50 }
    );

    const chunks = await adapter.getDocumentChunks(doc.id);
    assert.ok(chunks.length >= 7, `Expected at least 7 chunks, got ${chunks.length}`);
    for (const chunk of chunks) {
      assert.ok(
        chunk.content.length <= 500,
        `Chunk length ${chunk.content.length} exceeds chunkSize 500`
      );
    }

    await adapter.deleteKnowledgeBase(kb.id);
  });

  it('should reject raw %PDF binary streams and garbled text with descriptive error', async () => {
    const adapter = new LocalKnowledgeAdapter();
    const kb = await adapter.createKnowledgeBase({ name: 'Purity Test KB' });

    // Raw PDF container binary stream
    const rawPdfStream = '%PDF-1.7\n4 0 obj\n<< /Filter /FlateDecode /Length 29236 >>\nstream\nx\x9c...';
    await assert.rejects(
      async () => {
        await adapter.uploadDocument(kb.id, {
          name: 'fake-corrupt.pdf',
          content: rawPdfStream,
        });
      },
      /检测到未解析的二进制 PDF 原始数据流/
    );

    // Corrupted binary string with null/unprintable bytes (>15% garbled)
    const garbledText = 'Hello \x00\x01\x02\x03\x04\x05\x06\x07\x08 World \x0e\x0f\x10\x11\x12';
    await assert.rejects(
      async () => {
        await adapter.uploadDocument(kb.id, {
          name: 'garbled.txt',
          content: garbledText,
        });
      },
      /乱码或异常控制符/
    );

    await adapter.deleteKnowledgeBase(kb.id);
  });
});
