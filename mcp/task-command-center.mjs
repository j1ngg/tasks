#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.TASKCTL_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TOKEN = process.env.TASK_AGENT_TOKEN;

if (!TOKEN) {
  process.stderr.write("TASK_AGENT_TOKEN is required for the task MCP server.\n");
  process.exit(1);
}

const server = new McpServer({
  name: "task-command-center",
  version: "0.1.0"
});

server.registerTool(
  "task_search",
  {
    title: "Search tasks",
    description: "Search Markdown-backed tasks.",
    inputSchema: {
      q: z.string().optional(),
      space: z.enum(["personal", "work"]).optional(),
      project: z.string().optional(),
      status: z.enum(["idea", "in_progress", "in_review", "delegated", "done"]).optional(),
      includeDone: z.boolean().optional()
    }
  },
  async (input) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) params.set(key, String(value));
    }
    return textResponse(await request("GET", `/api/tasks?${params.toString()}`));
  }
);

server.registerTool(
  "task_create",
  {
    title: "Create task",
    description: "Create a Markdown-backed task.",
    inputSchema: {
      title: z.string(),
      space: z.enum(["personal", "work"]),
      project: z.string(),
      status: z.enum(["idea", "in_progress", "in_review", "delegated", "done"]).optional(),
      delegatedStatus: z.enum(["in_progress", "in_review", "done"]).optional(),
      delegatee: z.string().optional(),
      dueDate: z.string().optional(),
      followUpDate: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      body: z.string().optional()
    }
  },
  async (input) => textResponse(await request("POST", "/api/tasks", input))
);

server.registerTool(
  "task_update",
  {
    title: "Update task",
    description: "Update a Markdown-backed task.",
    inputSchema: {
      id: z.string(),
      title: z.string().optional(),
      space: z.enum(["personal", "work"]).optional(),
      project: z.string().optional(),
      status: z.enum(["idea", "in_progress", "in_review", "delegated", "done"]).optional(),
      delegatedStatus: z.enum(["in_progress", "in_review", "done"]).optional(),
      delegatee: z.string().optional(),
      dueDate: z.string().optional(),
      followUpDate: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      body: z.string().optional()
    }
  },
  async ({ id, ...patch }) => textResponse(await request("PATCH", `/api/tasks/${id}`, patch))
);

server.registerTool(
  "task_projects",
  {
    title: "List projects",
    description: "List personal and work projects.",
    inputSchema: {}
  },
  async () => textResponse(await request("GET", "/api/projects"))
);

server.registerTool(
  "task_review_import",
  {
    title: "Review import",
    description: "Accept, discard, or merge a pending import suggestion.",
    inputSchema: {
      id: z.string(),
      action: z.enum(["accept", "discard", "merge"]),
      taskId: z.string().optional()
    }
  },
  async ({ id, action, taskId }) => {
    if (action === "merge" && !taskId) throw new Error("taskId is required when action is merge.");
    const path = action === "merge" ? `/api/imports/${id}/merge` : `/api/imports/${id}/${action}`;
    return textResponse(await request("POST", path, action === "merge" ? { taskId } : {}));
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

async function request(method, path, body) {
  const response = await fetch(new URL(path, BASE_URL), {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(stripUndefined(body)) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `${method} ${path} failed with ${response.status}`);
  return payload;
}

function textResponse(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function stripUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}
