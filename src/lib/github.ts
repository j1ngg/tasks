import { RepositoryConflictError, type ContentRepository, type RepositoryFile } from "./repository";

interface GitHubRepositoryConfig {
  owner: string;
  repo: string;
  branch?: string;
  token: string;
  fetchImpl?: typeof fetch;
}

interface GitHubContentResponse {
  type: "file" | "dir";
  path: string;
  sha: string;
  content?: string;
  encoding?: "base64";
}

export class GitHubContentRepository implements ContentRepository {
  private readonly owner: string;
  private readonly repo: string;
  private readonly branch: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: GitHubRepositoryConfig) {
    this.owner = config.owner;
    this.repo = config.repo;
    this.branch = config.branch ?? "main";
    this.token = config.token;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async readFile(path: string): Promise<RepositoryFile | null> {
    const response = await this.request(path, { method: "GET" });
    if (response.status === 404) return null;
    if (!response.ok) await throwGitHubError(response);

    const payload = (await response.json()) as GitHubContentResponse;
    if (payload.type !== "file" || !payload.content) return null;

    return {
      path: payload.path,
      content: decodeBase64(payload.content),
      sha: payload.sha
    };
  }

  async listFiles(prefix: string): Promise<RepositoryFile[]> {
    return this.listFilesRecursive(prefix.replace(/\/+$/g, ""));
  }

  async writeFile(input: { path: string; content: string; message: string; sha?: string }): Promise<RepositoryFile> {
    const response = await this.request(input.path, {
      method: "PUT",
      body: JSON.stringify({
        message: input.message,
        content: encodeBase64(input.content),
        branch: this.branch,
        sha: input.sha
      })
    });

    if (response.status === 409) throw new RepositoryConflictError();
    if (!response.ok) await throwGitHubError(response);

    const payload = (await response.json()) as { content: { path: string; sha: string } };
    return { path: payload.content.path, content: input.content, sha: payload.content.sha };
  }

  async deleteFile(input: { path: string; message: string; sha?: string }) {
    const existing = input.sha ? { sha: input.sha } : await this.readFile(input.path);
    if (!existing?.sha) return;

    const response = await this.request(input.path, {
      method: "DELETE",
      body: JSON.stringify({
        message: input.message,
        branch: this.branch,
        sha: existing.sha
      })
    });

    if (response.status === 409) throw new RepositoryConflictError();
    if (response.status === 404) return;
    if (!response.ok) await throwGitHubError(response);
  }

  private async listFilesRecursive(prefix: string): Promise<RepositoryFile[]> {
    const response = await this.request(prefix, { method: "GET" });
    if (response.status === 404) return [];
    if (!response.ok) await throwGitHubError(response);

    const payload = (await response.json()) as GitHubContentResponse | GitHubContentResponse[];
    if (!Array.isArray(payload)) {
      if (payload.type !== "file" || !payload.content) return [];
      return [{ path: payload.path, content: decodeBase64(payload.content), sha: payload.sha }];
    }

    const files: RepositoryFile[] = [];
    for (const item of payload) {
      if (item.type === "dir") {
        files.push(...(await this.listFilesRecursive(item.path)));
      } else if (item.type === "file" && item.path.endsWith(".md")) {
        const file = await this.readFile(item.path);
        if (file) files.push(file);
      }
    }
    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  private request(path: string, init: RequestInit) {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const url = new URL(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${encodedPath}`);
    url.searchParams.set("ref", this.branch);

    return this.fetchImpl(url, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...init.headers
      }
    });
  }
}

export function encodeBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

export function decodeBase64(value: string) {
  return Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8");
}

async function throwGitHubError(response: Response): Promise<never> {
  let message = `GitHub request failed with ${response.status}.`;
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    // Keep the generic message.
  }
  throw new Error(message);
}
