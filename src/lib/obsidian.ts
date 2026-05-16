export function obsidianOpenUrl(input: { vault?: string; file?: string; path?: string }) {
  const params = new URLSearchParams();
  if (input.path) {
    params.set("path", input.path);
  } else {
    if (input.vault) params.set("vault", input.vault);
    if (input.file) params.set("file", input.file);
  }
  return `obsidian://open?${params.toString()}`;
}
