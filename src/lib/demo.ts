import { MemoryContentRepository } from "./repository";
import { serializeImportMarkdown, serializeProjectMarkdown, serializeTaskMarkdown } from "./markdown";
import { importPath, projectPath, taskPath } from "./paths";
import type { ImportSuggestion, ProjectRecord, TaskRecord } from "./types";

export function createDemoRepository() {
  const now = new Date("2026-05-16T12:00:00.000Z").toISOString();
  const tasks: TaskRecord[] = [
    {
      id: "demo-quick-capture",
      title: "Capture every loose personal/work task in one place",
      space: "personal",
      project: "life-admin",
      status: "in_progress",
      dueDate: "2026-05-17",
      priority: "high",
      contextLinks: [
        {
          type: "obsidian",
          label: "Life Admin note",
          url: "obsidian://open?vault=Main&file=Life%20Admin"
        }
      ],
      sourceLinks: [],
      createdAt: now,
      updatedAt: now,
      body: "Demo task shown until the private GitHub task repo is configured."
    },
    {
      id: "demo-delegated-followup",
      title: "Confirm team project handoff is moving",
      space: "work",
      project: "team-ops",
      status: "delegated",
      delegatedStatus: "in_review",
      delegatee: "Alex",
      followUpDate: "2026-05-18",
      contextLinks: [],
      sourceLinks: [
        {
          source: "notion",
          id: "demo-notion-project",
          title: "Team Ops project"
        }
      ],
      createdAt: now,
      updatedAt: now,
      body: ""
    }
  ];

  const projects: ProjectRecord[] = [
    {
      slug: "life-admin",
      name: "life-admin",
      space: "personal",
      createdAt: now,
      updatedAt: now,
      body: ""
    },
    {
      slug: "team-ops",
      name: "team-ops",
      space: "work",
      createdAt: now,
      updatedAt: now,
      body: ""
    }
  ];

  const imports: ImportSuggestion[] = [
    {
      id: "granola-demo-followup",
      source: "granola",
      sourceId: "demo-followup",
      title: "Follow up from Product/Design sync",
      body: "Granola detected a follow-up: send the launch-risk checklist before the next review.",
      status: "pending",
      suggestedTask: {
        title: "Send launch-risk checklist",
        space: "work",
        project: "team-ops",
        status: "idea",
        sourceLinks: [
          {
            source: "granola",
            id: "demo-followup",
            title: "Product/Design sync"
          }
        ],
        contextLinks: [],
        body: "From the demo Granola import inbox."
      },
      sourceLinks: [
        {
          source: "granola",
          id: "demo-followup",
          title: "Product/Design sync"
        }
      ],
      createdAt: now,
      updatedAt: now
    }
  ];

  return new MemoryContentRepository([
    ...tasks.map((task) => ({ path: taskPath(task), content: serializeTaskMarkdown(task) })),
    ...projects.map((project) => ({ path: projectPath(project), content: serializeProjectMarkdown(project) })),
    ...imports.map((item) => ({ path: importPath(item.source, item.sourceId), content: serializeImportMarkdown(item) }))
  ]);
}
