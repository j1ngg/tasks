const SLUG_SAFE = /[^a-z0-9]+/g;

export function slugify(input: string, fallback = "item") {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(SLUG_SAFE, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || fallback;
}

export function slugifyIdentifier(input: string, fallback = "source") {
  return slugify(input.replace(/[:/\\?#\[\]@!$&()*+,;=.]+/g, "-"), fallback);
}

export function createTaskId(title: string, now = new Date()) {
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  const entropy =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${day}-${slugify(title, "task").slice(0, 36)}-${entropy}`;
}

export function createImportId(source: string, sourceId: string) {
  return `${slugifyIdentifier(source)}-${slugifyIdentifier(sourceId)}`;
}
