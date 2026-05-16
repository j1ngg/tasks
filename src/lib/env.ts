import { GitHubContentRepository } from "./github";
import { MemoryContentRepository } from "./repository";
import { TaskStore } from "./task-store";
import { createDemoRepository } from "./demo";

export interface AppEnv {
  appUrl: string;
  githubClientId?: string;
  githubClientSecret?: string;
  githubAllowedOwner?: string;
  taskRepoOwner?: string;
  taskRepoName?: string;
  taskRepoBranch: string;
  taskRepoToken?: string;
  taskAgentToken?: string;
  sessionSecret?: string;
  granolaApiKey?: string;
  notionApiToken?: string;
}

export function getEnv(): AppEnv {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    githubClientId: process.env.GITHUB_CLIENT_ID,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    githubAllowedOwner: process.env.GITHUB_ALLOWED_OWNER,
    taskRepoOwner: process.env.TASK_REPO_OWNER,
    taskRepoName: process.env.TASK_REPO_NAME,
    taskRepoBranch: process.env.TASK_REPO_BRANCH ?? "main",
    taskRepoToken: process.env.TASK_REPO_TOKEN,
    taskAgentToken: process.env.TASK_AGENT_TOKEN,
    sessionSecret: process.env.SESSION_SECRET,
    granolaApiKey: process.env.GRANOLA_API_KEY,
    notionApiToken: process.env.NOTION_API_TOKEN
  };
}

export function getSetupWarnings(env = getEnv()) {
  const warnings: string[] = [];

  if (!isRepoConfigured(env)) {
    warnings.push("Configure TASK_REPO_OWNER, TASK_REPO_NAME, and TASK_REPO_TOKEN to write canonical Markdown tasks.");
  }

  if (!isAuthConfigured(env)) {
    warnings.push("Configure GitHub OAuth and SESSION_SECRET to enable owner-only browser login.");
  }

  if (!env.taskAgentToken) {
    warnings.push("Configure TASK_AGENT_TOKEN before exposing task APIs to Codex, Claude, or taskctl.");
  }

  return warnings;
}

export function isRepoConfigured(env = getEnv()) {
  return Boolean(env.taskRepoOwner && env.taskRepoName && env.taskRepoToken);
}

export function isAuthConfigured(env = getEnv()) {
  return Boolean(env.githubClientId && env.githubClientSecret && env.githubAllowedOwner && env.sessionSecret);
}

export function getTaskStore(env = getEnv()) {
  return new TaskStore(getContentRepository(env));
}

export function getContentRepository(env = getEnv()) {
  if (!isRepoConfigured(env)) {
    return createDemoRepository();
  }

  return new GitHubContentRepository({
    owner: env.taskRepoOwner!,
    repo: env.taskRepoName!,
    branch: env.taskRepoBranch,
    token: env.taskRepoToken!
  });
}

export function getWritableTaskStore(env = getEnv()) {
  if (!isRepoConfigured(env)) {
    throw new Error("Task repository is not configured.");
  }
  return getTaskStore(env);
}

export function getWritableContentRepository(env = getEnv()) {
  if (!isRepoConfigured(env)) {
    throw new Error("Task repository is not configured.");
  }
  return getContentRepository(env);
}

export function getEmptyTaskStore() {
  return new TaskStore(new MemoryContentRepository());
}
