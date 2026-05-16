import { describe, expect, it } from "vitest";
import { MemoryContentRepository, RepositoryConflictError } from "../repository";
import { TaskStore } from "../task-store";

describe("TaskStore", () => {
  it("creates projects automatically when creating tasks", async () => {
    const repository = new MemoryContentRepository();
    const store = new TaskStore(repository);

    const task = await store.createTask({
      title: "Draft project memo",
      space: "work",
      project: "planning"
    });

    expect(task.status).toBe("idea");
    expect(await store.listProjects()).toMatchObject([{ slug: "planning", space: "work" }]);
    expect((await store.listTasks({ includeDone: true }))[0].title).toBe("Draft project memo");
  });

  it("merges import context into an existing task", async () => {
    const repository = new MemoryContentRepository();
    const store = new TaskStore(repository);
    const task = await store.createTask({ title: "Send recap", space: "work", project: "meetings" });
    const importSuggestion = await store.upsertImport({
      source: "granola",
      sourceId: "meeting-1",
      title: "Send recap",
      body: "Meeting context",
      suggestedTask: {
        title: "Send recap",
        space: "work",
        project: "meetings",
        body: "Imported action",
        sourceLinks: [{ source: "granola", id: "meeting-1" }],
        contextLinks: [{ type: "granola", label: "Meeting", url: "https://granola.ai/demo" }]
      },
      sourceLinks: [{ source: "granola", id: "meeting-1" }]
    });

    await store.mergeImport(importSuggestion.id, task.id);
    const updated = await store.getTask(task.id);

    expect(updated?.sourceLinks).toEqual([{ source: "granola", id: "meeting-1" }]);
    expect(updated?.contextLinks).toEqual([{ type: "granola", label: "Meeting", url: "https://granola.ai/demo" }]);
    expect((await store.listImports())[0].status).toBe("accepted");
  });

  it("throws on stale memory repository writes", async () => {
    const repository = new MemoryContentRepository();
    const written = await repository.writeFile({ path: "tasks/work/a.md", content: "a", message: "write" });
    await repository.writeFile({ path: "tasks/work/a.md", content: "b", message: "write", sha: written.sha });

    await expect(
      repository.writeFile({ path: "tasks/work/a.md", content: "c", message: "write", sha: written.sha })
    ).rejects.toBeInstanceOf(RepositoryConflictError);
  });
});
