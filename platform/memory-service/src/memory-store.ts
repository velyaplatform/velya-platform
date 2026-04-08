import { Injectable, Logger } from '@nestjs/common';

export type MemoryType =
  | 'incident'
  | 'decision'
  | 'learning'
  | 'agent-performance'
  | 'pattern'
  | 'escalation'
  | 'configuration-change';

export interface Memory {
  id: string;
  type: MemoryType;
  agentId: string;
  title: string;
  content: string;
  tags: string[];
  relevanceScore: number;
  context: MemoryContext;
  versions: MemoryVersion[];
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface MemoryContext {
  environment: 'development' | 'staging' | 'production';
  correlationId: string;
  relatedMemoryIds: string[];
  source: string;
  metadata: Record<string, string>;
}

export interface MemoryVersion {
  version: number;
  content: string;
  changedBy: string;
  changedAt: Date;
  changeReason: string;
}

export interface MemoryQuery {
  type?: MemoryType;
  types?: MemoryType[];
  agentId?: string;
  tags?: string[];
  fromTimestamp?: Date;
  toTimestamp?: Date;
  minRelevanceScore?: number;
  searchText?: string;
  environment?: 'development' | 'staging' | 'production';
  limit?: number;
  offset?: number;
  sortBy?: MemorySortField;
  sortOrder?: 'asc' | 'desc';
}

export type MemorySortField = 'createdAt' | 'updatedAt' | 'relevanceScore';

export interface MemoryStoreStats {
  totalMemories: number;
  byType: Record<MemoryType, number>;
  byAgent: Map<string, number>;
  averageRelevanceScore: number;
  oldestMemory: Date | null;
  newestMemory: Date | null;
}

export interface StoreMemoryRequest {
  type: MemoryType;
  agentId: string;
  title: string;
  content: string;
  tags: string[];
  relevanceScore: number;
  context: MemoryContext;
  expiresAt?: Date;
}

@Injectable()
export class MemoryStore {
  private readonly logger = new Logger(MemoryStore.name);
  private readonly memories = new Map<string, Memory>();
  private memoryCounter = 0;

  store(request: StoreMemoryRequest): Memory {
    const id = this.generateMemoryId();
    const now = new Date();

    const initialVersion: MemoryVersion = {
      version: 1,
      content: request.content,
      changedBy: request.agentId,
      changedAt: now,
      changeReason: 'Initial creation',
    };

    const memory: Memory = {
      id,
      type: request.type,
      agentId: request.agentId,
      title: request.title,
      content: request.content,
      tags: [...request.tags],
      relevanceScore: request.relevanceScore,
      context: {
        ...request.context,
        relatedMemoryIds: [...request.context.relatedMemoryIds],
        metadata: { ...request.context.metadata },
      },
      versions: [initialVersion],
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
      expiresAt: request.expiresAt,
    };

    this.memories.set(id, memory);

    this.logger.log(
      `Stored memory: id="${id}" type="${request.type}" agent="${request.agentId}" ` +
        `title="${request.title}"`,
    );

    return memory;
  }

  get(memoryId: string): Memory | undefined {
    const memory = this.memories.get(memoryId);
    if (memory && this.isExpired(memory)) {
      this.logger.debug(`Memory "${memoryId}" has expired`);
      return undefined;
    }
    return memory;
  }

  update(memoryId: string, content: string, changedBy: string, changeReason: string): Memory {
    const memory = this.memories.get(memoryId);
    if (!memory) {
      throw new Error(`Memory "${memoryId}" not found`);
    }

    const newVersion: MemoryVersion = {
      version: memory.currentVersion + 1,
      content,
      changedBy,
      changedAt: new Date(),
      changeReason,
    };

    memory.content = content;
    memory.versions.push(newVersion);
    memory.currentVersion = newVersion.version;
    memory.updatedAt = new Date();

    this.logger.log(
      `Updated memory: id="${memoryId}" version=${newVersion.version} ` +
        `changedBy="${changedBy}" reason="${changeReason}"`,
    );

    return memory;
  }

  query(query: MemoryQuery): Memory[] {
    let results = Array.from(this.memories.values());

    // Filter out expired memories
    results = results.filter((m) => !this.isExpired(m));

    if (query.type) {
      results = results.filter((m) => m.type === query.type);
    }

    if (query.types && query.types.length > 0) {
      results = results.filter((m) => query.types!.includes(m.type));
    }

    if (query.agentId) {
      results = results.filter((m) => m.agentId === query.agentId);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter((m) => query.tags!.some((tag) => m.tags.includes(tag)));
    }

    if (query.fromTimestamp) {
      results = results.filter((m) => m.createdAt >= query.fromTimestamp!);
    }

    if (query.toTimestamp) {
      results = results.filter((m) => m.createdAt <= query.toTimestamp!);
    }

    if (query.minRelevanceScore !== undefined) {
      results = results.filter((m) => m.relevanceScore >= query.minRelevanceScore!);
    }

    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      results = results.filter(
        (m) =>
          m.title.toLowerCase().includes(searchLower) ||
          m.content.toLowerCase().includes(searchLower),
      );
    }

    if (query.environment) {
      results = results.filter((m) => m.context.environment === query.environment);
    }

    // Sort
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    results.sort((a, b) => {
      let comparison: number;
      switch (sortBy) {
        case 'relevanceScore':
          comparison = a.relevanceScore - b.relevanceScore;
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'createdAt':
        default:
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Paginate
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    return results.slice(offset, offset + limit);
  }

  queryByRelevance(
    agentId: string,
    minScore: number,
    types?: MemoryType[],
    limit?: number,
  ): Memory[] {
    return this.query({
      agentId,
      minRelevanceScore: minScore,
      types,
      sortBy: 'relevanceScore',
      sortOrder: 'desc',
      limit: limit ?? 20,
    });
  }

  getVersionHistory(memoryId: string): MemoryVersion[] {
    const memory = this.memories.get(memoryId);
    if (!memory) {
      throw new Error(`Memory "${memoryId}" not found`);
    }
    return [...memory.versions];
  }

  getVersion(memoryId: string, version: number): MemoryVersion | undefined {
    const memory = this.memories.get(memoryId);
    if (!memory) {
      throw new Error(`Memory "${memoryId}" not found`);
    }
    return memory.versions.find((v) => v.version === version);
  }

  addRelation(memoryId: string, relatedMemoryId: string): void {
    const memory = this.memories.get(memoryId);
    if (!memory) {
      throw new Error(`Memory "${memoryId}" not found`);
    }

    if (!memory.context.relatedMemoryIds.includes(relatedMemoryId)) {
      memory.context.relatedMemoryIds.push(relatedMemoryId);
      memory.updatedAt = new Date();
    }
  }

  getRelated(memoryId: string): Memory[] {
    const memory = this.memories.get(memoryId);
    if (!memory) {
      throw new Error(`Memory "${memoryId}" not found`);
    }

    return memory.context.relatedMemoryIds
      .map((id) => this.memories.get(id))
      .filter((m): m is Memory => m !== undefined && !this.isExpired(m));
  }

  getStats(): MemoryStoreStats {
    const allMemories = Array.from(this.memories.values()).filter((m) => !this.isExpired(m));

    const byType: Record<MemoryType, number> = {
      incident: 0,
      decision: 0,
      learning: 0,
      'agent-performance': 0,
      pattern: 0,
      escalation: 0,
      'configuration-change': 0,
    };

    const byAgent = new Map<string, number>();
    let totalRelevance = 0;
    let oldest: Date | null = null;
    let newest: Date | null = null;

    for (const memory of allMemories) {
      byType[memory.type]++;

      const agentCount = byAgent.get(memory.agentId) ?? 0;
      byAgent.set(memory.agentId, agentCount + 1);

      totalRelevance += memory.relevanceScore;

      if (!oldest || memory.createdAt < oldest) {
        oldest = memory.createdAt;
      }
      if (!newest || memory.createdAt > newest) {
        newest = memory.createdAt;
      }
    }

    return {
      totalMemories: allMemories.length,
      byType,
      byAgent,
      averageRelevanceScore: allMemories.length > 0 ? totalRelevance / allMemories.length : 0,
      oldestMemory: oldest,
      newestMemory: newest,
    };
  }

  delete(memoryId: string): boolean {
    const deleted = this.memories.delete(memoryId);
    if (deleted) {
      this.logger.log(`Deleted memory: id="${memoryId}"`);
    }
    return deleted;
  }

  pruneExpired(): number {
    let pruned = 0;
    for (const [id, memory] of this.memories) {
      if (this.isExpired(memory)) {
        this.memories.delete(id);
        pruned++;
      }
    }

    if (pruned > 0) {
      this.logger.log(`Pruned ${pruned} expired memories`);
    }

    return pruned;
  }

  private isExpired(memory: Memory): boolean {
    return memory.expiresAt !== undefined && new Date() > memory.expiresAt;
  }

  private generateMemoryId(): string {
    this.memoryCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.memoryCounter.toString(36).padStart(4, '0');
    return `mem-${timestamp}-${counter}`;
  }
}
