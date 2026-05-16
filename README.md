# Task Command Center

A Markdown-backed PWA for personal and work task management. The app gives you a fast command center while the canonical task state stays in a private GitHub repo as Markdown files.

## What It Does

- Quick capture for personal and work tasks.
- Project grouping under `personal` and `work`.
- Statuses: `idea`, `in_progress`, `in_review`, `delegated`, `done`.
- Delegated tasks track owner, follow-up date, and delegated sub-status.
- Granola and Notion scans create reviewable import suggestions.
- Tasks can carry Obsidian, Notion, Granola, GitHub, and URL context links.
- Codex/Claude can mutate tasks through authenticated APIs, `taskctl`, or MCP.

## Setup

1. Create a private GitHub repo for task Markdown.
2. Create a fine-grained GitHub token with contents read/write access to that repo.
3. Create a GitHub OAuth app with callback:

   ```text
   http://localhost:3000/api/auth/github/callback
   ```

4. Copy `.env.example` to `.env.local` and fill the values.
5. Install and run:

   ```bash
   npm install
   npm run dev
   ```

## Task Repo Layout

```text
tasks/{personal|work}/{projectSlug}/{taskId}.md
projects/{personal|work}/{projectSlug}.md
imports/{granola|notion}/{sourceId}.md
config/sources.yml
```

Example `config/sources.yml`:

```yaml
obsidianVault: Main
notionDatabases:
  - id: team-roadmap
    name: Team Roadmap
    databaseId: notion-database-id
    url: https://www.notion.so/...
    space: work
    project: team-roadmap
    titleProperty: Name
    statusProperty: Status
    dueDateProperty: Due Date
    assigneeProperty: Assignee
```

## Agent Usage

```bash
TASKCTL_BASE_URL=http://localhost:3000 TASK_AGENT_TOKEN=... npm run taskctl -- search "follow up"
TASKCTL_BASE_URL=http://localhost:3000 TASK_AGENT_TOKEN=... npm run taskctl -- create --title "Send launch checklist" --space work --project launch
TASKCTL_BASE_URL=http://localhost:3000 TASK_AGENT_TOKEN=... npm run mcp
```

The MCP wrapper exposes:

- `task_search`
- `task_create`
- `task_update`
- `task_projects`
- `task_review_import`

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
```
