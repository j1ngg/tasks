export interface RepositoryFile {
  path: string;
  content: string;
  sha?: string;
}

export interface ContentRepository {
  readFile(path: string): Promise<RepositoryFile | null>;
  listFiles(prefix: string): Promise<RepositoryFile[]>;
  writeFile(input: {
    path: string;
    content: string;
    message: string;
    sha?: string;
  }): Promise<RepositoryFile>;
  deleteFile(input: { path: string; message: string; sha?: string }): Promise<void>;
}

export class RepositoryConflictError extends Error {
  constructor(message = "The repository changed while writing. Please retry.") {
    super(message);
    this.name = "RepositoryConflictError";
  }
}

export class MemoryContentRepository implements ContentRepository {
  private files = new Map<string, RepositoryFile>();
  private revision = 0;

  constructor(seed: RepositoryFile[] = []) {
    for (const file of seed) {
      this.files.set(file.path, { ...file, sha: file.sha ?? this.nextSha() });
    }
  }

  async readFile(path: string) {
    const file = this.files.get(path);
    return file ? { ...file } : null;
  }

  async listFiles(prefix: string) {
    const normalized = prefix.replace(/\/+$/g, "");
    return Array.from(this.files.values())
      .filter((file) => file.path === normalized || file.path.startsWith(`${normalized}/`))
      .map((file) => ({ ...file }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async writeFile(input: { path: string; content: string; message: string; sha?: string }) {
    const existing = this.files.get(input.path);
    if (existing && input.sha && existing.sha !== input.sha) {
      throw new RepositoryConflictError();
    }

    const file = { path: input.path, content: input.content, sha: this.nextSha() };
    this.files.set(input.path, file);
    return { ...file };
  }

  async deleteFile(input: { path: string; message: string; sha?: string }) {
    const existing = this.files.get(input.path);
    if (!existing) return;
    if (input.sha && existing.sha !== input.sha) {
      throw new RepositoryConflictError();
    }
    this.files.delete(input.path);
  }

  snapshot() {
    return Array.from(this.files.values()).map((file) => ({ ...file }));
  }

  private nextSha() {
    this.revision += 1;
    return `memory-${this.revision}`;
  }
}
