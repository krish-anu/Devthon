import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { generateRouteMapMarkdown } from './chat.route-map';
import { KnowledgeChunk, RetrievedKnowledgeChunk } from './chat.types';

const KNOWLEDGE_DIR_PARTS = ['ai', 'knowledge'];
const DEFAULT_TOP_K = 5;
const MIN_CHUNK_CHARS = 24;

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'have',
  'how',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
  'you',
  'your',
]);

type IndexedKnowledgeChunk = KnowledgeChunk & {
  normalizedText: string;
  tokenCounts: Map<string, number>;
  tokenSet: Set<string>;
};

@Injectable()
export class ChatKnowledgeService implements OnModuleInit {
  private readonly logger = new Logger(ChatKnowledgeService.name);
  private indexedChunks: IndexedKnowledgeChunk[] = [];
  private loaded = false;

  async onModuleInit() {
    await this.reloadKnowledge();
  }

  async search(question: string, topK = DEFAULT_TOP_K) {
    await this.ensureLoaded();

    if (this.indexedChunks.length === 0) {
      return [] as RetrievedKnowledgeChunk[];
    }

    const normalizedQuestion = question.trim().toLowerCase();
    const queryTokens = this.tokenize(normalizedQuestion);
    const effectiveTopK = Math.min(6, Math.max(3, topK));

    if (queryTokens.length === 0) {
      return this.indexedChunks
        .slice(0, effectiveTopK)
        .map((chunk, index) =>
          this.stripIndexMetadata(chunk, effectiveTopK - index),
        );
    }

    const docFrequency = new Map<string, number>();
    for (const token of queryTokens) {
      let count = 0;
      for (const chunk of this.indexedChunks) {
        if (chunk.tokenSet.has(token)) count += 1;
      }
      docFrequency.set(token, count);
    }

    const totalChunks = this.indexedChunks.length;
    const scored: Array<{ chunk: IndexedKnowledgeChunk; score: number }> = [];

    for (const chunk of this.indexedChunks) {
      let score = 0;

      for (const token of queryTokens) {
        const tf = chunk.tokenCounts.get(token) ?? 0;
        if (tf === 0) continue;
        const df = docFrequency.get(token) ?? 0;
        const idf = Math.log((totalChunks + 1) / (df + 1)) + 1;
        score += (1 + Math.log(tf)) * idf;
      }

      if (chunk.normalizedText.includes(normalizedQuestion)) {
        score += 1.2;
      }

      if (chunk.section.toLowerCase().includes(normalizedQuestion)) {
        score += 0.9;
      }

      const hasRouteToken = queryTokens.some((token) => token.startsWith('/'));
      if (
        hasRouteToken &&
        queryTokens.some((token) => chunk.normalizedText.includes(token))
      ) {
        score += 0.75;
      }

      if (score > 0) {
        scored.push({ chunk, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const picked = scored.slice(0, effectiveTopK).map((entry) => ({
      ...this.stripIndexMetadata(entry.chunk, entry.score),
      score: entry.score,
    }));

    if (picked.length > 0) {
      return picked;
    }

    return this.indexedChunks
      .slice(0, effectiveTopK)
      .map((chunk, index) =>
        this.stripIndexMetadata(chunk, effectiveTopK - index),
      );
  }

  async reloadKnowledge() {
    const knowledgeDir = await this.resolveKnowledgeDir();
    if (!knowledgeDir) {
      this.logger.warn(
        'Knowledge directory not found. RAG context will be empty.',
      );
      this.indexedChunks = [];
      this.loaded = true;
      return;
    }

    await this.ensureRouteMapFile(knowledgeDir);
    const markdownFiles = await this.listMarkdownFiles(knowledgeDir);

    const chunks: IndexedKnowledgeChunk[] = [];
    for (const fileName of markdownFiles) {
      const filePath = path.join(knowledgeDir, fileName);
      const content = await fs.readFile(filePath, 'utf8');
      const fileChunks = this.chunkMarkdown(fileName, content);
      chunks.push(...fileChunks.map((chunk) => this.indexChunk(chunk)));
    }

    this.indexedChunks = chunks;
    this.loaded = true;
    this.logger.log(
      `Knowledge base loaded (${markdownFiles.length} files, ${chunks.length} chunks)`,
    );
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    await this.reloadKnowledge();
  }

  private async resolveKnowledgeDir() {
    const candidates = [
      path.resolve(process.cwd(), ...KNOWLEDGE_DIR_PARTS),
      path.resolve(process.cwd(), '..', ...KNOWLEDGE_DIR_PARTS),
      path.resolve(__dirname, '..', '..', '..', ...KNOWLEDGE_DIR_PARTS),
    ];

    for (const candidate of candidates) {
      try {
        const stat = await fs.stat(candidate);
        if (stat.isDirectory()) {
          return candidate;
        }
      } catch {
        // ignored on purpose
      }
    }

    return null;
  }

  private async ensureRouteMapFile(knowledgeDir: string) {
    const routeMapPath = path.join(knowledgeDir, 'route_map.md');
    const generated = generateRouteMapMarkdown();

    try {
      await fs.mkdir(knowledgeDir, { recursive: true });
      const existing = await fs
        .readFile(routeMapPath, 'utf8')
        .catch(() => null);
      if (existing !== generated) {
        await fs.writeFile(routeMapPath, generated, 'utf8');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to generate route_map.md: ${message}`);
    }
  }

  private async listMarkdownFiles(knowledgeDir: string) {
    const entries = await fs.readdir(knowledgeDir, { withFileTypes: true });
    return entries
      .filter(
        (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'),
      )
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  }

  private chunkMarkdown(fileName: string, content: string) {
    const lines = content.split(/\r?\n/);
    const chunks: KnowledgeChunk[] = [];

    let currentSection = 'Introduction';
    let buffer: string[] = [];
    let sectionIndex = 0;

    const flush = () => {
      const text = buffer.join('\n').trim();
      buffer = [];
      if (text.length < MIN_CHUNK_CHARS) return;

      const id = `${fileName}:${sectionIndex}`;
      sectionIndex += 1;
      chunks.push({
        id,
        sourceFile: fileName,
        section: currentSection,
        text,
      });
    };

    for (const line of lines) {
      const heading = /^#{1,6}\s+(.+?)\s*$/.exec(line);
      if (heading) {
        flush();
        currentSection = heading[1].trim();
        continue;
      }

      buffer.push(line);
    }
    flush();

    if (chunks.length === 0 && content.trim().length >= MIN_CHUNK_CHARS) {
      chunks.push({
        id: `${fileName}:0`,
        sourceFile: fileName,
        section: 'Document',
        text: content.trim(),
      });
    }

    return chunks;
  }

  private indexChunk(chunk: KnowledgeChunk): IndexedKnowledgeChunk {
    const normalizedText = `${chunk.section}\n${chunk.text}`.toLowerCase();
    const tokens = this.tokenize(normalizedText);
    const tokenCounts = new Map<string, number>();

    for (const token of tokens) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }

    return {
      ...chunk,
      normalizedText,
      tokenCounts,
      tokenSet: new Set(tokens),
    };
  }

  private tokenize(input: string) {
    const normalized = input
      .toLowerCase()
      .replace(/[`*_>#()[\]{}|~]/g, ' ')
      .replace(/[^\w/.-]+/g, ' ');

    return normalized
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  }

  private stripIndexMetadata(chunk: IndexedKnowledgeChunk, score: number) {
    return {
      id: chunk.id,
      sourceFile: chunk.sourceFile,
      section: chunk.section,
      text: chunk.text,
      score,
    };
  }
}
