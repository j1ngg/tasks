import type { ImportSource, ProjectRecord, TaskRecord } from "./types";
import { slugifyIdentifier } from "./ids";

export function taskPath(task: Pick<TaskRecord, "space" | "project" | "id">) {
  return `tasks/${task.space}/${slugifyIdentifier(task.project, "inbox")}/${task.id}.md`;
}

export function projectPath(project: Pick<ProjectRecord, "space" | "slug">) {
  return `projects/${project.space}/${slugifyIdentifier(project.slug, "project")}.md`;
}

export function importPath(source: ImportSource, sourceId: string) {
  return `imports/${source}/${slugifyIdentifier(sourceId, "source")}.md`;
}
