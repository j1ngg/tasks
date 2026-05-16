# Agent Instructions

This app treats Markdown files in the private task-data GitHub repo as the source of truth. Do not add a separate database for task state.

## Preferred Mutation Path

Use the app API, `taskctl`, or the MCP wrapper for task mutations:

```bash
TASKCTL_BASE_URL=http://localhost:3000 TASK_AGENT_TOKEN=... npm run taskctl -- search "launch"
TASKCTL_BASE_URL=http://localhost:3000 TASK_AGENT_TOKEN=... npm run taskctl -- create --title "Draft launch checklist" --space work --project launch
TASKCTL_BASE_URL=http://localhost:3000 TASK_AGENT_TOKEN=... npm run taskctl -- update <taskId> --status done
```

Available operations:

- Search/create/update tasks.
- List projects.
- List, accept, discard, or merge import suggestions.
- Trigger Granola/Notion scans through authenticated API routes.

## Data Rules

- Task Markdown path: `tasks/{personal|work}/{projectSlug}/{taskId}.md`
- Project Markdown path: `projects/{personal|work}/{projectSlug}.md`
- Import Markdown path: `imports/{granola|notion}/{sourceId}.md`
- Valid task statuses: `idea`, `in_progress`, `in_review`, `delegated`, `done`
- `delegatedStatus` is valid only when `status` is `delegated`.
- Valid delegated sub-statuses: `in_progress`, `in_review`, `done`
- Preserve context links and source links when editing tasks.

## Integration Stance

- Granola and Notion imports should land in the review inbox first.
- Notion is read-only in v1.
- Obsidian integration is through `obsidian://open` links.
- GitHub issue/PR links are task context, not a separate canonical task store.
