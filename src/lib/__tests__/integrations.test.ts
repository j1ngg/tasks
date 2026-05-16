import { describe, expect, it } from "vitest";
import { extractActionLines, granolaNoteToImports } from "../integrations/granola";
import { mapNotionStatus, notionPageToImport } from "../integrations/notion";

describe("Granola import parsing", () => {
  it("extracts follow-up style action lines", () => {
    expect(
      extractActionLines(`
- Action: send the onboarding recap
- FYI only
- Follow up with Sam about the pilot
`)
    ).toEqual(["send the onboarding recap", "Follow up with Sam about the pilot"]);
  });

  it("creates pending import suggestions with source links", () => {
    const imports = granolaNoteToImports(
      {
        id: "note-1",
        title: "Customer sync",
        url: "https://granola.ai/notes/note-1",
        summary: "- Action: share renewal timeline"
      },
      { space: "work", project: "accounts" }
    );

    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({
      status: "pending",
      suggestedTask: { title: "share renewal timeline", space: "work", project: "accounts" }
    });
    expect(imports[0].sourceLinks[0].source).toBe("granola");
  });
});

describe("Notion import parsing", () => {
  it("maps common Notion statuses", () => {
    expect(mapNotionStatus("Doing")).toBe("in_progress");
    expect(mapNotionStatus("Waiting")).toBe("delegated");
    expect(mapNotionStatus("Shipped")).toBe("done");
  });

  it("creates import suggestions from configured Notion properties", () => {
    const suggestion = notionPageToImport(
      {
        id: "page-1",
        url: "https://notion.so/page-1",
        last_edited_time: "2026-05-16T12:00:00.000Z",
        properties: {
          Name: { type: "title", title: [{ plain_text: "Publish roadmap" }] },
          Status: { type: "status", status: { name: "In Review" } },
          "Due Date": { type: "date", date: { start: "2026-05-20" } },
          Assignee: { type: "people", people: [{ name: "Mira" }] }
        }
      },
      {
        id: "roadmap",
        name: "Roadmap",
        databaseId: "db-1",
        space: "work",
        project: "roadmap"
      }
    );

    expect(suggestion.suggestedTask).toMatchObject({
      title: "Publish roadmap",
      status: "in_review",
      dueDate: "2026-05-20",
      delegatee: "Mira"
    });
  });
});
