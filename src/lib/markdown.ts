import YAML from "yaml";
import type {
  ContextLink,
  DelegatedStatus,
  ImportStatus,
  ImportSuggestion,
  ProjectRecord,
  SourceLink,
  Space,
  TaskRecord,
  TaskStatus
} from "./types";

const TASK_STATUSES = new Set<TaskStatus>(["idea", "in_progress", "in_review", "delegated", "done"]);
const DELEGATED_STATUSES = new Set<DelegatedStatus>(["in_progress", "in_review", "done"]);
const SPACES = new Set<Space>(["personal", "work"]);

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

export function parseMarkdownDocument(markdown: string): ParsedFrontmatter {
  if (!markdown.startsWith("---\n")) {
    return { data: {}, body: markdown.trimStart() };
  }

  const close = markdown.indexOf("\n---", 4);
  if (close === -1) {
    throw new Error("Markdown frontmatter is missing a closing delimiter.");
  }

  const raw = markdown.slice(4, close);
  const rest = markdown.slice(close + 4).replace(/^\n/, "").trimEnd();
  const parsed = YAML.parse(raw) ?? {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Markdown frontmatter must be a key/value object.");
  }

  return { data: parsed as Record<string, unknown>, body: rest };
}

export function serializeMarkdownDocument(data: Record<string, unknown>, body = "") {
  const frontmatter = YAML.stringify(data, {
    sortMapEntries: false,
    lineWidth: 0
  }).trimEnd();

  return `---\n${frontmatter}\n---\n${body.trim() ? `${body.trim()}\n` : ""}`;
}

export function parseTaskMarkdown(markdown: string): TaskRecord {
  const { data, body } = parseMarkdownDocument(markdown);
  return validateTask({ ...data, body });
}

export function serializeTaskMarkdown(task: TaskRecord) {
  const { body, ...frontmatter } = validateTask(task);
  return serializeMarkdownDocument(cleanObject(frontmatter), body);
}

export function parseProjectMarkdown(markdown: string): ProjectRecord {
  const { data, body } = parseMarkdownDocument(markdown);
  return validateProject({ ...data, body });
}

export function serializeProjectMarkdown(project: ProjectRecord) {
  const { body, ...frontmatter } = validateProject(project);
  return serializeMarkdownDocument(cleanObject(frontmatter), body);
}

export function parseImportMarkdown(markdown: string): ImportSuggestion {
  const { data, body } = parseMarkdownDocument(markdown);
  return validateImport({ ...data, body });
}

export function serializeImportMarkdown(importSuggestion: ImportSuggestion) {
  const { body, ...frontmatter } = validateImport(importSuggestion);
  return serializeMarkdownDocument(cleanObject(frontmatter), body);
}

export function validateTask(value: unknown): TaskRecord {
  const record = objectValue(value, "task");
  const id = stringValue(record.id, "id");
  const title = stringValue(record.title, "title");
  const space = enumValue(record.space, SPACES, "space");
  const project = stringValue(record.project, "project");
  const status = enumValue(record.status, TASK_STATUSES, "status");
  const delegatedStatus = optionalEnumValue(record.delegatedStatus, DELEGATED_STATUSES, "delegatedStatus");
  const delegatee = optionalStringValue(record.delegatee, "delegatee");

  if (status !== "delegated" && delegatedStatus) {
    throw new Error("delegatedStatus is only valid when status is delegated.");
  }

  if (status === "delegated" && !delegatedStatus) {
    throw new Error("Delegated tasks must include delegatedStatus.");
  }

  return {
    id,
    title,
    space,
    project,
    status,
    delegatedStatus,
    delegatee,
    dueDate: optionalDateString(record.dueDate, "dueDate"),
    followUpDate: optionalDateString(record.followUpDate, "followUpDate"),
    priority: optionalPriority(record.priority),
    contextLinks: dedupeContextLinks(arrayValue(record.contextLinks).map(validateContextLink)),
    sourceLinks: dedupeSourceLinks(arrayValue(record.sourceLinks).map(validateSourceLink)),
    createdAt: isoDateTime(record.createdAt, "createdAt"),
    updatedAt: isoDateTime(record.updatedAt, "updatedAt"),
    body: typeof record.body === "string" ? record.body : ""
  };
}

export function validateProject(value: unknown): ProjectRecord {
  const record = objectValue(value, "project");
  return {
    slug: stringValue(record.slug, "slug"),
    name: stringValue(record.name, "name"),
    space: enumValue(record.space, SPACES, "space"),
    description: optionalStringValue(record.description, "description"),
    createdAt: isoDateTime(record.createdAt, "createdAt"),
    updatedAt: isoDateTime(record.updatedAt, "updatedAt"),
    body: typeof record.body === "string" ? record.body : ""
  };
}

export function validateImport(value: unknown): ImportSuggestion {
  const record = objectValue(value, "import");
  const suggestedTask = objectValue(record.suggestedTask, "suggestedTask") as Record<string, unknown>;
  const status = enumValue(record.status, new Set<ImportStatus>(["pending", "accepted", "discarded"]), "status");

  return {
    id: stringValue(record.id, "id"),
    source: enumValue(record.source, new Set(["granola", "notion", "github", "manual"]), "source"),
    sourceId: stringValue(record.sourceId, "sourceId"),
    title: stringValue(record.title, "title"),
    body: typeof record.body === "string" ? record.body : "",
    status,
    suggestedTask: {
      title: stringValue(suggestedTask.title, "suggestedTask.title"),
      space: enumValue(suggestedTask.space, SPACES, "suggestedTask.space"),
      project: stringValue(suggestedTask.project, "suggestedTask.project"),
      status: suggestedTask.status ? enumValue(suggestedTask.status, TASK_STATUSES, "suggestedTask.status") : "idea",
      delegatedStatus: suggestedTask.delegatedStatus
        ? enumValue(suggestedTask.delegatedStatus, DELEGATED_STATUSES, "suggestedTask.delegatedStatus")
        : undefined,
      delegatee: optionalStringValue(suggestedTask.delegatee, "suggestedTask.delegatee"),
      dueDate: optionalDateString(suggestedTask.dueDate, "suggestedTask.dueDate"),
      followUpDate: optionalDateString(suggestedTask.followUpDate, "suggestedTask.followUpDate"),
      priority: optionalPriority(suggestedTask.priority),
      contextLinks: arrayValue(suggestedTask.contextLinks).map(validateContextLink),
      sourceLinks: arrayValue(suggestedTask.sourceLinks).map(validateSourceLink),
      body: typeof suggestedTask.body === "string" ? suggestedTask.body : ""
    },
    sourceLinks: dedupeSourceLinks(arrayValue(record.sourceLinks).map(validateSourceLink)),
    createdAt: isoDateTime(record.createdAt, "createdAt"),
    updatedAt: isoDateTime(record.updatedAt, "updatedAt"),
    acceptedTaskId: optionalStringValue(record.acceptedTaskId, "acceptedTaskId")
  };
}

export function dedupeSourceLinks(links: SourceLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.source}:${link.id}:${link.url ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function dedupeContextLinks(links: ContextLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.type}:${link.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateContextLink(value: unknown): ContextLink {
  const record = objectValue(value, "contextLink");
  return {
    type: enumValue(record.type, new Set(["obsidian", "notion", "github", "granola", "url"]), "contextLink.type"),
    label: stringValue(record.label, "contextLink.label"),
    url: stringValue(record.url, "contextLink.url")
  };
}

function validateSourceLink(value: unknown): SourceLink {
  const record = objectValue(value, "sourceLink");
  return cleanObject({
    source: enumValue(record.source, new Set(["granola", "notion", "github", "manual"]), "sourceLink.source"),
    id: stringValue(record.id, "sourceLink.id"),
    title: optionalStringValue(record.title, "sourceLink.title"),
    url: optionalStringValue(record.url, "sourceLink.url")
  }) as unknown as SourceLink;
}

function cleanObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "")) as T;
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalStringValue(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return undefined;
  return stringValue(value, label);
}

function arrayValue(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Expected an array value.");
  return value;
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, label: string): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`${label} must be one of: ${Array.from(allowed).join(", ")}.`);
  }
  return value as T;
}

function optionalEnumValue<T extends string>(value: unknown, allowed: Set<T>, label: string): T | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return enumValue(value, allowed, label);
}

function optionalPriority(value: unknown): "low" | "medium" | "high" | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return enumValue(value, new Set<"low" | "medium" | "high">(["low", "medium", "high"]), "priority");
}

function optionalDateString(value: unknown, label: string) {
  const string = optionalStringValue(value, label);
  if (!string) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(string)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }
  return string;
}

function isoDateTime(value: unknown, label: string) {
  const string = stringValue(value, label);
  if (Number.isNaN(Date.parse(string))) {
    throw new Error(`${label} must be an ISO date/time string.`);
  }
  return string;
}
