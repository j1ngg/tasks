import { describe, expect, it } from "vitest";
import { dedupeSourceLinks, parseTaskMarkdown, serializeTaskMarkdown, validateTask } from "../markdown";
import type { TaskRecord } from "../types";

const baseTask: TaskRecord = {
  id: "task-1",
  title: "Follow up with Alex",
  space: "work",
  project: "launch",
  status: "delegated",
  delegatedStatus: "in_progress",
  delegatee: "Alex",
  dueDate: "2026-05-17",
  followUpDate: "2026-05-18",
  priority: "high",
  contextLinks: [{ type: "notion", label: "Roadmap", url: "https://notion.so/example" }],
  sourceLinks: [{ source: "granola", id: "meeting-1", title: "Launch sync" }],
  createdAt: "2026-05-16T12:00:00.000Z",
  updatedAt: "2026-05-16T12:00:00.000Z",
  body: "Make sure the delegated work is moving."
};

describe("task markdown", () => {
  it("round trips task frontmatter and body", () => {
    const markdown = serializeTaskMarkdown(baseTask);
    expect(parseTaskMarkdown(markdown)).toEqual(baseTask);
  });

  it("rejects delegated status on non-delegated tasks", () => {
    expect(() =>
      validateTask({
        ...baseTask,
        status: "in_progress",
        delegatedStatus: "in_review"
      })
    ).toThrow(/delegatedStatus is only valid/);
  });

  it("requires delegated tasks to include a delegated sub-status", () => {
    expect(() =>
      validateTask({
        ...baseTask,
        delegatedStatus: undefined
      })
    ).toThrow(/must include delegatedStatus/);
  });

  it("dedupes source links by source, id, and URL", () => {
    expect(
      dedupeSourceLinks([
        { source: "granola", id: "1", url: "https://example.com/a" },
        { source: "granola", id: "1", url: "https://example.com/a" },
        { source: "granola", id: "1", url: "https://example.com/b" }
      ])
    ).toHaveLength(2);
  });
});
