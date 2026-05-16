#!/usr/bin/env node

const BASE_URL = process.env.TASKCTL_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TOKEN = process.env.TASK_AGENT_TOKEN;

const [, , command, ...args] = process.argv;

if (!command || command === "help" || command === "--help") {
  printHelp();
  process.exit(0);
}

if (!TOKEN) {
  fail("TASK_AGENT_TOKEN is required.");
}

try {
  switch (command) {
    case "search":
      await search(args);
      break;
    case "create":
      await create(args);
      break;
    case "update":
      await update(args);
      break;
    case "projects":
      await get("/api/projects");
      break;
    case "imports":
      await get("/api/imports");
      break;
    case "accept":
      await post(`/api/imports/${required(args[0], "import id")}/accept`, {});
      break;
    case "discard":
      await post(`/api/imports/${required(args[0], "import id")}/discard`, {});
      break;
    case "merge":
      await merge(args);
      break;
    default:
      fail(`Unknown command: ${command}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

async function search(args) {
  const flags = parseFlags(args);
  const params = new URLSearchParams();
  if (flags._.length) params.set("q", flags._.join(" "));
  for (const key of ["space", "project", "status"]) {
    if (flags[key]) params.set(key, flags[key]);
  }
  if (flags["include-done"] || flags.includeDone) params.set("includeDone", "true");
  await get(`/api/tasks?${params.toString()}`);
}

async function create(args) {
  const flags = parseFlags(args);
  const body = {
    title: required(flags.title ?? flags._.join(" "), "title"),
    space: flags.space ?? "work",
    project: flags.project ?? "inbox",
    status: flags.status ?? "idea",
    delegatedStatus: flags.status === "delegated" ? flags.delegatedStatus ?? "in_progress" : undefined,
    delegatee: flags.delegatee,
    dueDate: flags.due ?? flags.dueDate,
    followUpDate: flags.followUp ?? flags.followUpDate,
    priority: flags.priority,
    body: flags.body
  };
  await post("/api/tasks", body);
}

async function update(args) {
  const [id, ...rest] = args;
  required(id, "task id");
  const flags = parseFlags(rest);
  const body = {};
  for (const [flag, field] of [
    ["title", "title"],
    ["space", "space"],
    ["project", "project"],
    ["status", "status"],
    ["delegatedStatus", "delegatedStatus"],
    ["delegatee", "delegatee"],
    ["due", "dueDate"],
    ["dueDate", "dueDate"],
    ["followUp", "followUpDate"],
    ["followUpDate", "followUpDate"],
    ["priority", "priority"],
    ["body", "body"]
  ]) {
    if (flags[flag]) body[field] = flags[flag];
  }
  await patch(`/api/tasks/${id}`, body);
}

async function merge(args) {
  const [importId, ...rest] = args;
  required(importId, "import id");
  const flags = parseFlags(rest);
  await post(`/api/imports/${importId}/merge`, { taskId: required(flags.task ?? flags.taskId, "task id") });
}

async function get(path) {
  return request("GET", path);
}

async function post(path, body) {
  return request("POST", path, body);
}

async function patch(path, body) {
  return request("PATCH", path, body);
}

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
  if (!response.ok) {
    throw new Error(payload.error ?? `${method} ${path} failed with ${response.status}`);
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

function parseFlags(args) {
  const flags = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      flags._.push(arg);
      continue;
    }

    const [rawKey, rawValue] = arg.slice(2).split("=");
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (rawValue !== undefined) {
      flags[key] = rawValue;
    } else if (args[i + 1] && !args[i + 1].startsWith("--")) {
      flags[key] = args[i + 1];
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function stripUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}

function required(value, label) {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function printHelp() {
  process.stdout.write(`taskctl

Commands:
  search [query] [--space work|personal] [--project slug] [--status status] [--include-done]
  create --title "Task" --space work --project inbox [--status delegated --delegatee Name]
  update <taskId> [--status done] [--due YYYY-MM-DD] [--follow-up YYYY-MM-DD]
  projects
  imports
  accept <importId>
  discard <importId>
  merge <importId> --task <taskId>

Environment:
  TASKCTL_BASE_URL=http://localhost:3000
  TASK_AGENT_TOKEN=...
`);
}
