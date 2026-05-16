import { cookies } from "next/headers";
import { CommandCenter } from "@/components/command-center";
import { getSessionFromCookieValue, SESSION_COOKIE } from "@/lib/auth";
import { getEmptyTaskStore, getEnv, getSetupWarnings, getTaskStore, isAuthConfigured, isRepoConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Home() {
  const env = getEnv();
  const cookieStore = await cookies();
  const session = getSessionFromCookieValue(cookieStore.get(SESSION_COOKIE)?.value, env);
  const repoConfigured = isRepoConfigured(env);
  const authConfigured = isAuthConfigured(env);
  const canReadTasks = !repoConfigured || Boolean(session);
  const store = canReadTasks ? getTaskStore(env) : getEmptyTaskStore();
  const [tasks, projects, imports] = await Promise.all([store.listTasks({ includeDone: true }), store.listProjects(), store.listImports()]);
  const setupWarnings = getSetupWarnings(env);

  if (repoConfigured && !session) {
    setupWarnings.unshift("Sign in with the allowed GitHub account before loading real task Markdown.");
  }

  return (
    <CommandCenter
      initialData={{ tasks, projects, imports, setupWarnings }}
      session={session}
      authConfigured={authConfigured}
      repoConfigured={repoConfigured}
    />
  );
}
