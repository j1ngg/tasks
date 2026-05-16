import { createImportId, slugifyIdentifier } from "../ids";
import type { ImportSuggestion, NotionSourceConfig, TaskStatus } from "../types";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionQueryResponse {
  results: NotionPage[];
  has_more?: boolean;
  next_cursor?: string;
}

interface NotionPage {
  id: string;
  url?: string;
  properties: Record<string, NotionProperty>;
  last_edited_time?: string;
}

type NotionProperty =
  | { type: "title"; title: Array<{ plain_text?: string }> }
  | { type: "rich_text"; rich_text: Array<{ plain_text?: string }> }
  | { type: "status"; status?: { name?: string } }
  | { type: "select"; select?: { name?: string } }
  | { type: "date"; date?: { start?: string } }
  | { type: "people"; people?: Array<{ name?: string; person?: { email?: string } }> }
  | { type: string; [key: string]: unknown };

interface PlainText {
  plain_text?: string;
}

interface NotionPerson {
  name?: string;
  person?: { email?: string };
}

export interface NotionScanOptions {
  apiToken: string;
  sources: NotionSourceConfig[];
  fetchImpl?: typeof fetch;
}

export async function scanNotionSources(options: NotionScanOptions): Promise<ImportSuggestion[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const imports: ImportSuggestion[] = [];

  for (const source of options.sources) {
    const pages = await queryNotionDatabase(options.apiToken, source.databaseId, fetchImpl);
    imports.push(...pages.map((page) => notionPageToImport(page, source)));
  }

  return imports;
}

export function notionPageToImport(page: NotionPage, source: NotionSourceConfig): ImportSuggestion {
  const title = readPropertyText(page.properties[source.titleProperty ?? "Name"]) || "Untitled Notion task";
  const status = mapNotionStatus(readPropertyText(page.properties[source.statusProperty ?? "Status"]));
  const dueDate = readDate(page.properties[source.dueDateProperty ?? "Due Date"]);
  const assignee = readPeople(page.properties[source.assigneeProperty ?? "Assignee"]);
  const now = new Date().toISOString();
  const sourceId = `${source.id}-${page.id}`;
  const sourceLink = {
    source: "notion" as const,
    id: sourceId,
    title,
    url: page.url
  };

  return {
    id: createImportId("notion", sourceId),
    source: "notion",
    sourceId,
    title,
    body: `Imported from Notion source ${source.name}.`,
    status: "pending",
    suggestedTask: {
      title,
      space: source.space,
      project: source.project,
      status,
      delegatedStatus: status === "delegated" ? "in_progress" : undefined,
      delegatee: assignee,
      dueDate,
      contextLinks: page.url ? [{ type: "notion", label: `${source.name}: ${title}`, url: page.url }] : [],
      sourceLinks: [sourceLink],
      body: `Notion source: ${source.name}\nPage ID: ${page.id}`
    },
    sourceLinks: [sourceLink],
    createdAt: now,
    updatedAt: page.last_edited_time ?? now
  };
}

export function mapNotionStatus(input?: string): TaskStatus {
  const normalized = slugifyIdentifier(input ?? "idea").replaceAll("-", "_");
  if (["in_progress", "doing", "active", "started"].includes(normalized)) return "in_progress";
  if (["in_review", "review", "blocked_on_review"].includes(normalized)) return "in_review";
  if (["delegated", "waiting", "waiting_on_someone"].includes(normalized)) return "delegated";
  if (["done", "complete", "completed", "shipped"].includes(normalized)) return "done";
  return "idea";
}

async function queryNotionDatabase(apiToken: string, databaseId: string, fetchImpl: typeof fetch) {
  const pages: NotionPage[] = [];
  let startCursor: string | undefined;

  do {
    const response = await fetchImpl(`${NOTION_API}/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION
      },
      body: JSON.stringify(startCursor ? { start_cursor: startCursor } : {})
    });

    if (!response.ok) throw new Error(`Notion database ${databaseId} request failed with ${response.status}.`);
    const payload = (await response.json()) as NotionQueryResponse;
    pages.push(...payload.results);
    startCursor = payload.has_more ? payload.next_cursor : undefined;
  } while (startCursor);

  return pages;
}

function readPropertyText(property: NotionProperty | undefined) {
  if (!property) return undefined;
  const record = property as Record<string, unknown>;
  if (record.type === "title" && Array.isArray(record.title)) {
    return (record.title as PlainText[]).map((text) => text.plain_text ?? "").join("").trim();
  }
  if (record.type === "rich_text" && Array.isArray(record.rich_text)) {
    return (record.rich_text as PlainText[]).map((text) => text.plain_text ?? "").join("").trim();
  }
  if (record.type === "status" && isRecord(record.status)) return typeof record.status.name === "string" ? record.status.name : undefined;
  if (record.type === "select" && isRecord(record.select)) return typeof record.select.name === "string" ? record.select.name : undefined;
  return undefined;
}

function readDate(property: NotionProperty | undefined) {
  if (!property || property.type !== "date") return undefined;
  const record = property as Record<string, unknown>;
  if (!isRecord(record.date) || typeof record.date.start !== "string") return undefined;
  return record.date.start.slice(0, 10);
}

function readPeople(property: NotionProperty | undefined) {
  if (!property || property.type !== "people") return undefined;
  const record = property as Record<string, unknown>;
  if (!Array.isArray(record.people)) return undefined;
  return (record.people as NotionPerson[]).map((person) => person.name ?? person.person?.email).filter(Boolean).join(", ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
