export type Space = "personal" | "work";

export type TaskStatus = "idea" | "in_progress" | "in_review" | "delegated" | "done";

export type DelegatedStatus = "in_progress" | "in_review" | "done";

export type LinkType = "obsidian" | "notion" | "github" | "granola" | "url";

export type ImportSource = "granola" | "notion" | "github" | "manual";

export type ImportStatus = "pending" | "accepted" | "discarded";

export interface ContextLink {
  type: LinkType;
  label: string;
  url: string;
}

export interface SourceLink {
  source: ImportSource;
  id: string;
  title?: string;
  url?: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  space: Space;
  project: string;
  status: TaskStatus;
  delegatedStatus?: DelegatedStatus;
  delegatee?: string;
  dueDate?: string;
  followUpDate?: string;
  priority?: "low" | "medium" | "high";
  contextLinks: ContextLink[];
  sourceLinks: SourceLink[];
  createdAt: string;
  updatedAt: string;
  body: string;
}

export interface ProjectRecord {
  slug: string;
  name: string;
  space: Space;
  description?: string;
  createdAt: string;
  updatedAt: string;
  body: string;
}

export interface ImportSuggestion {
  id: string;
  source: ImportSource;
  sourceId: string;
  title: string;
  body: string;
  status: ImportStatus;
  suggestedTask: Partial<TaskRecord> & Pick<TaskRecord, "title" | "space" | "project">;
  sourceLinks: SourceLink[];
  createdAt: string;
  updatedAt: string;
  acceptedTaskId?: string;
}

export interface DashboardData {
  tasks: TaskRecord[];
  projects: ProjectRecord[];
  imports: ImportSuggestion[];
  setupWarnings: string[];
}

export interface TaskFilters {
  q?: string;
  space?: Space;
  project?: string;
  status?: TaskStatus;
  includeDone?: boolean;
}

export interface NotionSourceConfig {
  id: string;
  name: string;
  databaseId: string;
  url?: string;
  space: Space;
  project: string;
  titleProperty?: string;
  statusProperty?: string;
  dueDateProperty?: string;
  assigneeProperty?: string;
}

export interface AppSourceConfig {
  obsidianVault?: string;
  notionDatabases: NotionSourceConfig[];
}
