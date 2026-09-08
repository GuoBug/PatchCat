/**
 * @file    src/services/document-parser.ts
 * @version 1.0.0
 * @description
 *   Frontend client-side document parsing and text extraction engine.
 *   - Extracts plain text from .txt, .md, and .pdf files.
 *   - Uses unpdf (serverless PDF.js) for browser/Node PDF text extraction.
 *   - Performs pre-indexing purity checks to detect and block garbled characters,
 *     binary streams (%PDF), or unreadable scans.
 */

import { extractText } from 'unpdf';

export interface ParseDocumentResult {
  text: string;
  charCount: number;
  totalPages?: number;
  purityScore: number;
  isPure: boolean;
  warning?: string;
}

/**
 * Validates text purity to prevent binary noise or garbled characters from polluting the RAG index.
 */
export function checkTextPurity(text: string): { isPure: boolean; purityScore: number; error?: string } {
  if (!text || text.trim().length === 0) {
    return { isPure: false, purityScore: 0, error: '文档内容为空。' };
  }

  // Reject raw unparsed PDF binary headers
  if (text.startsWith('%PDF-') || /^[%\s]*PDF-\d\.\d/.test(text)) {
    return {
      isPure: false,
      purityScore: 0,
      error: '检测到未解析的二进制 PDF 原始数据流，禁止直接入库。',
    };
  }

  let garbledCount = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Null, Unicode replacement (\uFFFD), or unprintable control characters (excluding tab, newline, carriage return)
    if (code === 0xfffd || code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      garbledCount++;
    }
  }

  const garbledRate = garbledCount / text.length;
  const purityScore = Math.max(0, 1 - garbledRate);

  if (garbledRate > 0.15) {
    return {
      isPure: false,
      purityScore,
      error: `检测到文档存在较高比例的乱码或异常控制符（乱码率 ${(garbledRate * 100).toFixed(1)}%），请确认文件为标准文本文档而非图片扫描件。`,
    };
  }

  return { isPure: true, purityScore };
}

/**
 * Normalizes and cleans document text (aligning with backend cleaner.py).
 */
export function cleanDocumentText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Strip null and non-printable control characters (preserve tabs and newlines)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Collapse excessive blank lines to double newlines
    .replace(/\n{3,}/g, '\n\n')
    // Remove trailing spaces per line
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/**
 * Extracts clean, pure plain text from a File or ArrayBuffer.
 */
export async function parseDocumentFile(
  file: File | { name: string; buffer: ArrayBuffer; extension?: string }
): Promise<ParseDocumentResult> {
  const filename = file.name;
  const ext = (filename.split('.').pop() || '').toLowerCase();

  let rawText = '';
  let totalPages: number | undefined = undefined;

  if (ext === 'pdf') {
    try {
      let arrayBuffer: ArrayBuffer;
      if ('arrayBuffer' in file && typeof file.arrayBuffer === 'function') {
        arrayBuffer = await file.arrayBuffer();
      } else if ('buffer' in file) {
        arrayBuffer = file.buffer;
      } else {
        throw new Error('Unsupported file buffer structure');
      }

      const pdfData = new Uint8Array(arrayBuffer);
      const res = await extractText(pdfData, { mergePages: true });

      totalPages = res.totalPages;
      const textVal: unknown = res.text;
      if (typeof textVal === 'string') {
        rawText = textVal;
      } else if (Array.isArray(textVal)) {
        rawText = (textVal as string[]).join('\n\n');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`PDF 解析失败: ${errMsg}`);
    }

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('未能从该 PDF 中提取到可读文本。该文件可能是纯图片扫描件（缺少 OCR 文本层）或带有加密限制。');
    }
  } else {
    // Markdown or Plain Text
    if ('text' in file && typeof file.text === 'function') {
      rawText = await file.text();
    } else if ('buffer' in file) {
      const decoder = new TextDecoder('utf-8');
      rawText = decoder.decode(file.buffer);
    }
  }

  const purityCheck = checkTextPurity(rawText);
  if (!purityCheck.isPure) {
    throw new Error(purityCheck.error || '文档纯净度检查未通过，疑似乱码。');
  }

  const cleaned = cleanDocumentText(rawText);
  if (!cleaned) {
    throw new Error('文档清洗后无有效可读内容。');
  }

  return {
    text: cleaned,
    charCount: cleaned.length,
    totalPages,
    purityScore: purityCheck.purityScore,
    isPure: true,
  };
}
