import YAML from "yaml";
import type { ContentRepository } from "./repository";
import type { AppSourceConfig, NotionSourceConfig } from "./types";

export async function readSourceConfig(repository: ContentRepository): Promise<AppSourceConfig> {
  const file = await repository.readFile("config/sources.yml");
  if (!file) return { notionDatabases: [] };

  const parsed = YAML.parse(file.content) as Partial<AppSourceConfig> | null;
  return {
    obsidianVault: typeof parsed?.obsidianVault === "string" ? parsed.obsidianVault : undefined,
    notionDatabases: Array.isArray(parsed?.notionDatabases)
      ? parsed.notionDatabases.map(normalizeNotionSource).filter((source): source is NotionSourceConfig => Boolean(source))
      : []
  };
}

function normalizeNotionSource(value: unknown): NotionSourceConfig | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.databaseId !== "string" ||
    (record.space !== "personal" && record.space !== "work") ||
    typeof record.project !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    databaseId: record.databaseId,
    url: stringOrUndefined(record.url),
    space: record.space,
    project: record.project,
    titleProperty: stringOrUndefined(record.titleProperty),
    statusProperty: stringOrUndefined(record.statusProperty),
    dueDateProperty: stringOrUndefined(record.dueDateProperty),
    assigneeProperty: stringOrUndefined(record.assigneeProperty)
  };
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
