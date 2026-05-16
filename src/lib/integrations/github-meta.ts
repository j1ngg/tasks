export interface GitHubIssuePreview {
  type: "issue" | "pull";
  owner: string;
  repo: string;
  number: number;
  title: string;
  state: string;
  url: string;
}

export function parseGitHubIssueUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.hostname !== "github.com") return null;
  const [, owner, repo, kind, number] = parsed.pathname.split("/");
  if (!owner || !repo || (kind !== "issues" && kind !== "pull") || !number) return null;
  return { owner, repo, kind: kind as "issues" | "pull", number };
}

export async function getGitHubIssuePreview(url: string, token?: string, fetchImpl: typeof fetch = fetch) {
  const parsed = parseGitHubIssueUrl(url);
  if (!parsed) return null;

  const response = await fetchImpl(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/${parsed.kind}/${parsed.number}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as { title: string; state: string; html_url: string };
  return {
    type: parsed.kind === "pull" ? "pull" : "issue",
    owner: parsed.owner,
    repo: parsed.repo,
    number: Number(parsed.number),
    title: payload.title,
    state: payload.state,
    url: payload.html_url
  } satisfies GitHubIssuePreview;
}
