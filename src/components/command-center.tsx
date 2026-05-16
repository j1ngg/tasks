"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleDot,
  ClipboardCheck,
  ExternalLink,
  GitBranch,
  Inbox,
  Link2,
  LogIn,
  Plus,
  Search,
  Send,
  UserRoundCheck
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { AppSession } from "@/lib/auth";
import type { DashboardData, ImportSuggestion, ProjectRecord, Space, TaskRecord, TaskStatus } from "@/lib/types";

interface CommandCenterProps {
  initialData: DashboardData;
  session: AppSession | null;
  authConfigured: boolean;
  repoConfigured: boolean;
}

type ViewMode = "daily" | "board" | "projects";

const STATUS_LABELS: Record<TaskStatus, string> = {
  idea: "Idea",
  in_progress: "In Progress",
  in_review: "In Review",
  delegated: "Delegated",
  done: "Done"
};

const BOARD_COLUMNS: TaskStatus[] = ["idea", "in_progress", "in_review", "delegated", "done"];

export function CommandCenter({ initialData, session, authConfigured, repoConfigured }: CommandCenterProps) {
  const [tasks, setTasks] = useState(initialData.tasks);
  const [imports, setImports] = useState(initialData.imports);
  const [projects, setProjects] = useState(initialData.projects);
  const [view, setView] = useState<ViewMode>("daily");
  const [space, setSpace] = useState<Space>("work");
  const [query, setQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialData.tasks[0]?.id ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const demoMode = !repoConfigured;

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (task.space !== space) return false;
      if (!normalizedQuery) return true;
      return `${task.title} ${task.project} ${task.body} ${task.delegatee ?? ""}`.toLowerCase().includes(normalizedQuery);
    });
  }, [query, space, tasks]);

  const today = new Date().toISOString().slice(0, 10);
  const dueNow = filteredTasks.filter((task) => task.status !== "done" && task.dueDate && task.dueDate <= today);
  const upcoming = filteredTasks.filter((task) => task.status !== "done" && task.dueDate && task.dueDate > today).slice(0, 6);
  const delegated = filteredTasks.filter((task) => task.status === "delegated");
  const active = filteredTasks.filter((task) => task.status !== "done" && !dueNow.includes(task));
  const pendingImports = imports.filter((item) => item.status === "pending");
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? null;

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const project = String(form.get("project") ?? "").trim() || "inbox";
    const status = String(form.get("status") ?? "idea") as TaskStatus;
    const priority = String(form.get("priority") ?? "") as TaskRecord["priority"] | "";
    if (!title) return;

    setIsSaving(true);
    setMessage(null);
    const payload: Partial<TaskRecord> & Pick<TaskRecord, "title" | "space" | "project"> = {
      title,
      space,
      project,
      status,
      delegatedStatus: status === "delegated" ? "in_progress" : undefined,
      delegatee: String(form.get("delegatee") ?? "").trim() || undefined,
      dueDate: String(form.get("dueDate") ?? "") || undefined,
      followUpDate: String(form.get("followUpDate") ?? "") || undefined,
      priority: priority || undefined
    };

    if (demoMode) {
      const now = new Date().toISOString();
      const task = {
        ...payload,
        id: `demo-${tasks.length + 1}`,
        contextLinks: [],
        sourceLinks: [],
        createdAt: now,
        updatedAt: now,
        body: ""
      } as TaskRecord;
      setTasks((current) => [task, ...current]);
      setSelectedTaskId(task.id);
      setMessage("Captured locally in demo mode.");
      event.currentTarget.reset();
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create task.");
      setTasks((current) => [data.task, ...current]);
      setSelectedTaskId(data.task.id);
      setMessage("Captured.");
      event.currentTarget.reset();
      await refreshProjects();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create task.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateTask(id: string, patch: Partial<TaskRecord>) {
    const existing = tasks.find((task) => task.id === id);
    if (!existing) return;
    const optimistic = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    setTasks((current) => current.map((task) => (task.id === id ? optimistic : task)));

    if (demoMode) return;
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update task.");
      setTasks((current) => current.map((task) => (task.id === id ? data.task : task)));
    } catch (error) {
      setTasks((current) => current.map((task) => (task.id === id ? existing : task)));
      setMessage(error instanceof Error ? error.message : "Could not update task.");
    }
  }

  async function reviewImport(id: string, action: "accept" | "discard") {
    const item = imports.find((entry) => entry.id === id);
    if (!item) return;
    if (demoMode) {
      setImports((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, status: action === "accept" ? "accepted" : "discarded" } : entry))
      );
      if (action === "accept") {
        const now = new Date().toISOString();
        const task = {
          ...item.suggestedTask,
          id: `demo-import-${tasks.length + imports.length + 1}`,
          status: item.suggestedTask.status ?? "idea",
          contextLinks: item.suggestedTask.contextLinks ?? [],
          sourceLinks: item.sourceLinks,
          createdAt: now,
          updatedAt: now,
          body: item.suggestedTask.body ?? item.body
        } as TaskRecord;
        setTasks((current) => [task, ...current]);
        setSelectedTaskId(task.id);
      }
      return;
    }

    try {
      const response = await fetch(`/api/imports/${id}/${action}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `Could not ${action} import.`);
      setImports((current) => current.map((entry) => (entry.id === id ? data.import : entry)));
      if (action === "accept") {
        const refreshed = await fetch("/api/tasks?includeDone=true");
        if (refreshed.ok) setTasks((await refreshed.json()).tasks);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not ${action} import.`);
    }
  }

  async function scan(source: "granola" | "notion") {
    if (demoMode) {
      setMessage("Connect the Markdown repo before scanning sources.");
      return;
    }
    try {
      const response = await fetch(`/api/integrations/${source}/scan`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `Could not scan ${source}.`);
      setImports((current) => mergeImports(current, data.imports));
      setMessage(`${source === "granola" ? "Granola" : "Notion"} scan complete.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not scan ${source}.`);
    }
  }

  async function refreshProjects() {
    if (demoMode) return;
    const response = await fetch("/api/projects");
    if (response.ok) setProjects((await response.json()).projects);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Markdown source of truth</p>
          <h1>Task Command Center</h1>
        </div>
        <div className="topbar-actions">
          {session ? (
            <form action="/api/auth/logout" method="post">
              <button className="icon-text-button" type="submit">
                <UserRoundCheck size={18} /> {session.login}
              </button>
            </form>
          ) : authConfigured ? (
            <a className="icon-text-button" href="/api/auth/github/start">
              <LogIn size={18} /> Sign in
            </a>
          ) : (
            <span className="status-pill">Setup</span>
          )}
        </div>
      </header>

      {initialData.setupWarnings.length > 0 && (
        <section className="setup-band" aria-label="Setup warnings">
          {initialData.setupWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      )}

      <section className="control-strip" aria-label="Task controls">
        <div className="segmented" role="tablist" aria-label="Views">
          {(["daily", "board", "projects"] as ViewMode[]).map((mode) => (
            <button key={mode} className={view === mode ? "active" : ""} onClick={() => setView(mode)} type="button">
              {mode === "daily" ? <CircleDot size={16} /> : mode === "board" ? <GitBranch size={16} /> : <ClipboardCheck size={16} />}
              <span>{mode[0].toUpperCase() + mode.slice(1)}</span>
            </button>
          ))}
        </div>
        <div className="segmented compact" aria-label="Space">
          {(["work", "personal"] as Space[]).map((item) => (
            <button key={item} className={space === item ? "active" : ""} onClick={() => setSpace(item)} type="button">
              {item}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
        </label>
      </section>

      <section className="capture-band" aria-label="Quick capture">
        <form onSubmit={createTask} className="capture-form">
          <input name="title" placeholder="New task" required />
          <input name="project" placeholder="Project" list="project-list" />
          <select name="status" defaultValue="idea">
            {BOARD_COLUMNS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <input name="delegatee" placeholder="Delegatee" />
          <input name="dueDate" type="date" aria-label="Due date" />
          <input name="followUpDate" type="date" aria-label="Follow-up date" />
          <select name="priority" defaultValue="">
            <option value="">Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button className="primary-button" type="submit" disabled={isSaving}>
            <Plus size={18} /> Capture
          </button>
          <datalist id="project-list">
            {projects
              .filter((project) => project.space === space)
              .map((project) => (
                <option key={`${project.space}-${project.slug}`} value={project.slug} />
              ))}
          </datalist>
        </form>
        {message && <p className="inline-message">{message}</p>}
      </section>

      {view === "daily" && (
        <DailyView
          active={active}
          dueNow={dueNow}
          upcoming={upcoming}
          delegated={delegated}
          imports={pendingImports}
          onSelect={setSelectedTaskId}
          onUpdateTask={updateTask}
          onReviewImport={reviewImport}
          onScan={scan}
        />
      )}

      {view === "board" && <BoardView tasks={filteredTasks} onSelect={setSelectedTaskId} onUpdateTask={updateTask} />}

      {view === "projects" && (
        <ProjectsView projects={projects.filter((project) => project.space === space)} tasks={filteredTasks} onSelect={setSelectedTaskId} />
      )}

      <TaskDetail task={selectedTask} onUpdate={updateTask} />
    </main>
  );
}

function DailyView({
  active,
  dueNow,
  upcoming,
  delegated,
  imports,
  onSelect,
  onUpdateTask,
  onReviewImport,
  onScan
}: {
  active: TaskRecord[];
  dueNow: TaskRecord[];
  upcoming: TaskRecord[];
  delegated: TaskRecord[];
  imports: ImportSuggestion[];
  onSelect: (id: string) => void;
  onUpdateTask: (id: string, patch: Partial<TaskRecord>) => void;
  onReviewImport: (id: string, action: "accept" | "discard") => void;
  onScan: (source: "granola" | "notion") => void;
}) {
  return (
    <section className="daily-grid">
      <Panel title="Inbox" icon={<Inbox size={18} />} actions={<ScanButtons onScan={onScan} />}>
        {imports.length ? (
          imports.map((item) => <ImportRow key={item.id} item={item} onReview={onReviewImport} />)
        ) : (
          <EmptyState label="No pending imports" />
        )}
      </Panel>

      <Panel title="Today" icon={<CalendarDays size={18} />}>
        {dueNow.length ? dueNow.map((task) => <TaskRow key={task.id} task={task} onSelect={onSelect} onUpdate={onUpdateTask} />) : <EmptyState label="Nothing due" />}
      </Panel>

      <Panel title="Active" icon={<CircleDot size={18} />}>
        {active.slice(0, 8).map((task) => (
          <TaskRow key={task.id} task={task} onSelect={onSelect} onUpdate={onUpdateTask} />
        ))}
        {!active.length && <EmptyState label="No active tasks" />}
      </Panel>

      <Panel title="Delegated" icon={<Send size={18} />}>
        {delegated.length ? (
          delegated.map((task) => <TaskRow key={task.id} task={task} onSelect={onSelect} onUpdate={onUpdateTask} />)
        ) : (
          <EmptyState label="Nothing delegated" />
        )}
      </Panel>

      <Panel title="Next" icon={<ArrowRight size={18} />}>
        {upcoming.length ? (
          upcoming.map((task) => <TaskRow key={task.id} task={task} onSelect={onSelect} onUpdate={onUpdateTask} />)
        ) : (
          <EmptyState label="No upcoming due dates" />
        )}
      </Panel>
    </section>
  );
}

function BoardView({
  tasks,
  onSelect,
  onUpdateTask
}: {
  tasks: TaskRecord[];
  onSelect: (id: string) => void;
  onUpdateTask: (id: string, patch: Partial<TaskRecord>) => void;
}) {
  return (
    <section className="board-grid" aria-label="Task board">
      {BOARD_COLUMNS.map((status) => (
        <div className="board-column" key={status}>
          <header>
            <h2>{STATUS_LABELS[status]}</h2>
            <span>{tasks.filter((task) => task.status === status).length}</span>
          </header>
          {tasks
            .filter((task) => task.status === status)
            .map((task) => (
              <TaskRow key={task.id} task={task} onSelect={onSelect} onUpdate={onUpdateTask} compact />
            ))}
        </div>
      ))}
    </section>
  );
}

function ProjectsView({
  projects,
  tasks,
  onSelect
}: {
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="project-list" aria-label="Projects">
      {projects.map((project) => {
        const projectTasks = tasks.filter((task) => task.project === project.slug || task.project === project.name);
        return (
          <article className="project-row" key={`${project.space}-${project.slug}`}>
            <div>
              <h2>{project.name}</h2>
              <p>{projectTasks.filter((task) => task.status !== "done").length} open tasks</p>
            </div>
            <div className="project-task-strip">
              {projectTasks.slice(0, 4).map((task) => (
                <button key={task.id} type="button" onClick={() => onSelect(task.id)}>
                  {task.title}
                </button>
              ))}
            </div>
          </article>
        );
      })}
      {!projects.length && <EmptyState label="No projects yet" />}
    </section>
  );
}

function TaskDetail({ task, onUpdate }: { task: TaskRecord | null; onUpdate: (id: string, patch: Partial<TaskRecord>) => void }) {
  if (!task) return null;

  return (
    <aside className="detail-panel" aria-label="Task detail">
      <div className="detail-header">
        <div>
          <p className="eyebrow">{task.space} / {task.project}</p>
          <h2>{task.title}</h2>
        </div>
        <select
          value={task.status}
          onChange={(event) => {
            const status = event.target.value as TaskStatus;
            onUpdate(task.id, {
              status,
              delegatedStatus: status === "delegated" ? task.delegatedStatus ?? "in_progress" : undefined
            });
          }}
        >
          {BOARD_COLUMNS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="detail-meta">
        {task.dueDate && <span><CalendarDays size={15} /> Due {task.dueDate}</span>}
        {task.followUpDate && <span><Send size={15} /> Follow up {task.followUpDate}</span>}
        {task.delegatee && <span><UserRoundCheck size={15} /> {task.delegatee}</span>}
      </div>

      {task.status === "delegated" && (
        <div className="segmented compact">
          {(["in_progress", "in_review", "done"] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={task.delegatedStatus === status ? "active" : ""}
              onClick={() => onUpdate(task.id, { delegatedStatus: status })}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>
      )}

      {task.body && <p className="task-body">{task.body}</p>}

      <div className="link-list">
        {[...task.contextLinks, ...task.sourceLinks.map((link) => ({ type: link.source, label: link.title ?? link.id, url: link.url ?? "" }))].map(
          (link, index) =>
            link.url ? (
              <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noreferrer">
                <Link2 size={15} /> {link.label} <ExternalLink size={13} />
              </a>
            ) : null
        )}
      </div>
    </aside>
  );
}

function Panel({ title, icon, actions, children }: { title: string; icon: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>{icon} {title}</h2>
        {actions}
      </header>
      <div className="panel-content">{children}</div>
    </section>
  );
}

function TaskRow({
  task,
  onSelect,
  onUpdate,
  compact = false
}: {
  task: TaskRecord;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<TaskRecord>) => void;
  compact?: boolean;
}) {
  return (
    <article className={compact ? "task-row compact-row" : "task-row"}>
      <button className="check-button" type="button" aria-label="Mark done" onClick={() => onUpdate(task.id, { status: "done" })}>
        <Check size={16} />
      </button>
      <button className="task-main" type="button" onClick={() => onSelect(task.id)}>
        <span>{task.title}</span>
        <small>
          {task.project}
          {task.delegatee ? ` / ${task.delegatee}` : ""}
          {task.dueDate ? ` / ${task.dueDate}` : ""}
        </small>
      </button>
      <span className={`task-status status-${task.status}`}>{task.status === "delegated" ? task.delegatedStatus ?? "delegated" : STATUS_LABELS[task.status]}</span>
    </article>
  );
}

function ImportRow({ item, onReview }: { item: ImportSuggestion; onReview: (id: string, action: "accept" | "discard") => void }) {
  return (
    <article className="import-row">
      <div>
        <h3>{item.title}</h3>
        <p>{item.source} / {item.suggestedTask.project}</p>
      </div>
      <div className="row-actions">
        <button type="button" onClick={() => onReview(item.id, "discard")}>
          Dismiss
        </button>
        <button type="button" className="primary-mini" onClick={() => onReview(item.id, "accept")}>
          Accept
        </button>
      </div>
    </article>
  );
}

function ScanButtons({ onScan }: { onScan: (source: "granola" | "notion") => void }) {
  return (
    <div className="row-actions">
      <button type="button" onClick={() => onScan("granola")}>Granola</button>
      <button type="button" onClick={() => onScan("notion")}>Notion</button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="empty-state">{label}</p>;
}

function mergeImports(existing: ImportSuggestion[], incoming: ImportSuggestion[]) {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
