export function sanitizeFilename(name) {
  return (name || "file")
    .replace(/[^a-z0-9-_ ]/gi, "")
    .slice(0, 50)
    .trim()
    .replace(/\s+/g, "-");
}
