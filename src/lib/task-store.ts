import { createImportId, createTaskId, slugifyIdentifier } from "./ids";
import {
  dedupeContextLinks,
  dedupeSourceLinks,
  parseImportMarkdown,
  parseProjectMarkdown,
  parseTaskMarkdown,
  serializeImportMarkdown,
  serializeProjectMarkdown,
  serializeTaskMarkdown,
  validateTask
} from "./markdown";
import { importPath, projectPath, taskPath } from "./paths";
import type { ContentRepository, RepositoryFile } from "./repository";
import type { ImportSuggestion, ImportSource, ProjectRecord, Space, TaskFilters, TaskRecord } from "./types";

type CreateTaskInput = Partial<TaskRecord> & Pick<TaskRecord, "title" | "space" | "project">;
type UpdateTaskInput = Partial<Omit<TaskRecord, "id" | "createdAt">>;

export class TaskStore {
  constructor(private readonly repository: ContentRepository) {}

  async listTasks(filters: TaskFilters = {}) {
    const files = await this.repository.listFiles("tasks");
    const tasks = files.map(readTaskFile).filter(Boolean) as LocatedTask[];
    return tasks
      .map((entry) => entry.task)
      .filter((task) => matchesTaskFilters(task, filters))
      .sort(taskSort);
  }

  async getTask(id: string) {
    const located = await this.findTask(id);
    return located?.task ?? null;
  }

  async createTask(input: CreateTaskInput) {
    const now = new Date().toISOString();
    const task = validateTask({
      id: input.id ?? createTaskId(input.title),
      title: input.title,
      space: input.space,
      project: input.project,
      status: input.status ?? "idea",
      delegatedStatus: input.status === "delegated" ? input.delegatedStatus ?? "in_progress" : input.delegatedStatus,
      delegatee: input.delegatee,
      dueDate: input.dueDate,
      followUpDate: input.followUpDate,
      priority: input.priority,
      contextLinks: dedupeContextLinks(input.contextLinks ?? []),
      sourceLinks: dedupeSourceLinks(input.sourceLinks ?? []),
      createdAt: input.createdAt ?? now,
      updatedAt: now,
      body: input.body ?? ""
    });

    await this.ensureProject(task.space, task.project);
    await this.repository.writeFile({
      path: taskPath(task),
      content: serializeTaskMarkdown(task),
      message: `Create task ${task.title}`
    });
    return task;
  }

  async updateTask(id: string, patch: UpdateTaskInput) {
    const located = await this.findTask(id);
    if (!located) throw new Error(`Task ${id} not found.`);

    const next = validateTask({
      ...located.task,
      ...patch,
      sourceLinks: dedupeSourceLinks([...(located.task.sourceLinks ?? []), ...(patch.sourceLinks ?? [])]),
      contextLinks: dedupeContextLinks([...(located.task.contextLinks ?? []), ...(patch.contextLinks ?? [])]),
      updatedAt: new Date().toISOString()
    });

    await this.ensureProject(next.space, next.project);
    const nextPath = taskPath(next);
    await this.repository.writeFile({
      path: nextPath,
      content: serializeTaskMarkdown(next),
      message: `Update task ${next.title}`,
      sha: nextPath === located.path ? located.sha : undefined
    });

    if (nextPath !== located.path) {
      await this.repository.deleteFile({
        path: located.path,
        message: `Move task ${next.title}`,
        sha: located.sha
      });
    }

    return next;
  }

  async listProjects() {
    const files = await this.repository.listFiles("projects");
    const projects = files.map(readProjectFile).filter(Boolean) as ProjectRecord[];
    return projects.sort((a, b) => `${a.space}:${a.name}`.localeCompare(`${b.space}:${b.name}`));
  }

  async ensureProject(space: Space, project: string) {
    const slug = slugifyIdentifier(project, "inbox");
    const path = projectPath({ space, slug });
    const existing = await this.repository.readFile(path);
    if (existing) return parseProjectMarkdown(existing.content);

    const now = new Date().toISOString();
    const record: ProjectRecord = {
      slug,
      name: project,
      space,
      createdAt: now,
      updatedAt: now,
      body: ""
    };

    await this.repository.writeFile({
      path,
      content: serializeProjectMarkdown(record),
      message: `Create project ${project}`
    });
    return record;
  }

  async listImports(source?: ImportSource) {
    const root = source ? `imports/${source}` : "imports";
    const files = await this.repository.listFiles(root);
    return files
      .map(readImportFile)
      .filter((item): item is ImportSuggestion => Boolean(item))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) as ImportSuggestion[];
  }

  async upsertImport(input: Omit<ImportSuggestion, "id" | "createdAt" | "updatedAt" | "status"> & Partial<ImportSuggestion>) {
    const now = new Date().toISOString();
    const id = input.id ?? createImportId(input.source, input.sourceId);
    const path = importPath(input.source, input.sourceId);
    const existingFile = await this.repository.readFile(path);
    const existing = existingFile ? parseImportMarkdown(existingFile.content) : null;

    if (existing?.status && existing.status !== "pending") return existing;

    const suggestion: ImportSuggestion = {
      id,
      source: input.source,
      sourceId: input.sourceId,
      title: input.title,
      body: input.body,
      status: input.status ?? "pending",
      suggestedTask: input.suggestedTask,
      sourceLinks: dedupeSourceLinks(input.sourceLinks),
      createdAt: existing?.createdAt ?? input.createdAt ?? now,
      updatedAt: now,
      acceptedTaskId: input.acceptedTaskId
    };

    await this.repository.writeFile({
      path,
      content: serializeImportMarkdown(suggestion),
      message: `Upsert ${input.source} import ${input.sourceId}`,
      sha: existingFile?.sha
    });
    return suggestion;
  }

  async acceptImport(id: string) {
    const located = await this.findImport(id);
    if (!located) throw new Error(`Import ${id} not found.`);
    if (located.importSuggestion.status !== "pending") return located.importSuggestion;

    const task = await this.createTask({
      ...located.importSuggestion.suggestedTask,
      sourceLinks: dedupeSourceLinks([
        ...(located.importSuggestion.suggestedTask.sourceLinks ?? []),
        ...located.importSuggestion.sourceLinks
      ])
    });

    return this.writeImportStatus(located, "accepted", task.id);
  }

  async discardImport(id: string) {
    const located = await this.findImport(id);
    if (!located) throw new Error(`Import ${id} not found.`);
    return this.writeImportStatus(located, "discarded");
  }

  async mergeImport(id: string, taskId: string) {
    const located = await this.findImport(id);
    if (!located) throw new Error(`Import ${id} not found.`);

    await this.updateTask(taskId, {
      sourceLinks: located.importSuggestion.sourceLinks,
      contextLinks: located.importSuggestion.suggestedTask.contextLinks,
      body: mergeBodies(
        (await this.getTask(taskId))?.body ?? "",
        located.importSuggestion.suggestedTask.body ?? located.importSuggestion.body
      )
    });

    return this.writeImportStatus(located, "accepted", taskId);
  }

  private async findTask(id: string) {
    const files = await this.repository.listFiles("tasks");
    for (const file of files) {
      const task = readTaskFile(file);
      if (task?.task.id === id) return task;
    }
    return null;
  }

  private async findImport(id: string) {
    const files = await this.repository.listFiles("imports");
    for (const file of files) {
      const importSuggestion = readImportFile(file);
      if (importSuggestion?.id === id) return { importSuggestion, path: file.path, sha: file.sha };
    }
    return null;
  }

  private async writeImportStatus(
    located: { importSuggestion: ImportSuggestion; path: string; sha?: string },
    status: "accepted" | "discarded",
    acceptedTaskId?: string
  ) {
    const next: ImportSuggestion = {
      ...located.importSuggestion,
      status,
      acceptedTaskId,
      updatedAt: new Date().toISOString()
    };

    await this.repository.writeFile({
      path: located.path,
      content: serializeImportMarkdown(next),
      message: `${status === "accepted" ? "Accept" : "Discard"} import ${next.title}`,
      sha: located.sha
    });
    return next;
  }
}

interface LocatedTask {
  task: TaskRecord;
  path: string;
  sha?: string;
}

function readTaskFile(file: RepositoryFile): LocatedTask | null {
  try {
    return { task: parseTaskMarkdown(file.content), path: file.path, sha: file.sha };
  } catch {
    return null;
  }
}

function readProjectFile(file: RepositoryFile): ProjectRecord | null {
  try {
    return parseProjectMarkdown(file.content);
  } catch {
    return null;
  }
}

function readImportFile(file: RepositoryFile): ImportSuggestion | null {
  try {
    return parseImportMarkdown(file.content);
  } catch {
    return null;
  }
}

function matchesTaskFilters(task: TaskRecord, filters: TaskFilters) {
  if (!filters.includeDone && task.status === "done") return false;
  if (filters.space && task.space !== filters.space) return false;
  if (filters.project && task.project !== filters.project) return false;
  if (filters.status && task.status !== filters.status) return false;
  if (filters.q) {
    const haystack = `${task.title} ${task.project} ${task.body} ${task.delegatee ?? ""}`.toLowerCase();
    if (!haystack.includes(filters.q.toLowerCase())) return false;
  }
  return true;
}

function taskSort(a: TaskRecord, b: TaskRecord) {
  const dueA = a.dueDate ?? "9999-99-99";
  const dueB = b.dueDate ?? "9999-99-99";
  if (dueA !== dueB) return dueA.localeCompare(dueB);
  return b.updatedAt.localeCompare(a.updatedAt);
}

function mergeBodies(existing: string, addition: string) {
  if (!addition.trim()) return existing;
  if (!existing.trim()) return addition;
  if (existing.includes(addition.trim())) return existing;
  return `${existing.trim()}\n\n## Imported context\n${addition.trim()}\n`;
}
