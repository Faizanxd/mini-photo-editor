const STORAGE_PREFIX = "portrait-editor";
function storageKey(id) {
  return `${STORAGE_PREFIX}:project:${id}`;
}
function indexKey() {
  return `${STORAGE_PREFIX}:index`;
}

export function loadIndex() {
  try {
    const raw = localStorage.getItem(indexKey());
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("loadIndex error", e);
    return [];
  }
}
export function saveIndex(idx) {
  try {
    localStorage.setItem(indexKey(), JSON.stringify(idx));
  } catch (e) {
    console.error("saveIndex error", e);
  }
}

export function saveProjectToLocal(projectObj) {
  const id =
    projectObj.id || "project_" + Math.random().toString(36).slice(2, 9);
  const key = storageKey(id);
  try {
    localStorage.setItem(key, JSON.stringify(projectObj));
    const idx = loadIndex();
    const existing = idx.find((i) => i.id === id);
    const meta = {
      id,
      title: projectObj.title || "Untitled " + id.slice(-4),
      savedAt: Date.now(),
    };
    if (existing) {
      Object.assign(existing, meta);
    } else {
      idx.push(meta);
    }
    saveIndex(idx);
    return id;
  } catch (e) {
    console.error("saveProjectToLocal error", e);
    return null;
  }
}

export function loadProjectFromLocal(id) {
  const key = storageKey(id);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("loadProjectFromLocal error", e);
    return null;
  }
}

export function deleteProjectFromLocal(id) {
  const key = storageKey(id);
  try {
    localStorage.removeItem(key);
    let idx = loadIndex();
    idx = idx.filter((i) => i.id !== id);
    saveIndex(idx);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}
