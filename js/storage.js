// FILE: js/storage.js
// Robust localStorage-backed project store with quota handling and pruning.

const INDEX_KEY = "portrait_index";
const PROJECT_PREFIX = "portrait_project:";

function _loadIndexRaw() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse project index from localStorage", e);
    return [];
  }
}

function _saveIndexRaw(indexArr) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(indexArr));
    return true;
  } catch (e) {
    console.error("Failed to write project index to localStorage", e);
    return false;
  }
}

function isQuotaExceeded(e) {
  if (!e) return false;
  if (e.code && (e.code === 22 || e.code === 1014)) return true;
  if (
    e.name &&
    (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")
  )
    return true;
  return false;
}

export function loadIndex() {
  return _loadIndexRaw();
}

/**
 * Try to save a project object to localStorage. Returns an object:
 *  { ok: true } on success
 *  { ok: false, reason: 'quota' } if storage full and pruning didn't help
 *  { ok: false, reason: 'indexFailed' } if index write failed
 *  { ok: false, reason: 'other', error } for other errors
 */
export function saveProjectToLocal(projectObject) {
  try {
    if (!projectObject.id) {
      projectObject.id =
        "p-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 8);
    }
    projectObject.savedAt = Date.now();
    const key = PROJECT_PREFIX + projectObject.id;

    // First: attempt straightforward write
    try {
      localStorage.setItem(key, JSON.stringify(projectObject));
    } catch (e) {
      // handle quota - try pruning oldest projects and retry
      if (isQuotaExceeded(e)) {
        console.warn(
          "Quota exceeded — attempting to prune oldest saved projects to free space."
        );
        // load index and sort oldest first
        let idx = _loadIndexRaw()
          .slice()
          .sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
        // remove oldest entries one by one (except the one we're trying to save)
        for (let i = 0; i < idx.length; i++) {
          const cand = idx[i];
          if (cand.id === projectObject.id) continue;
          try {
            localStorage.removeItem(PROJECT_PREFIX + cand.id);
          } catch (removeErr) {
            console.warn("Failed to remove candidate during prune", removeErr);
          }
          // update index in-memory and persist
          const newIdx = _loadIndexRaw().filter((it) => it.id !== cand.id);
          const saved = _saveIndexRaw(newIdx);
          if (!saved) {
            // if index cannot be updated, continue trying further removals, but don't rely on index
            console.warn("Failed to update index during prune - continuing");
          }
          // try writing the project again
          try {
            localStorage.setItem(key, JSON.stringify(projectObject));
            // success — ensure entry exists in index
            const idxNow = _loadIndexRaw();
            const existing = idxNow.find((i) => i.id === projectObject.id);
            const entry = {
              id: projectObject.id,
              title: projectObject.title || "(untitled)",
              savedAt: projectObject.savedAt,
            };
            if (existing) {
              existing.title = entry.title;
              existing.savedAt = entry.savedAt;
            } else {
              idxNow.push(entry);
            }
            _saveIndexRaw(idxNow);
            return { ok: true };
          } catch (retryErr) {
            if (!isQuotaExceeded(retryErr)) {
              console.error(
                "Save failed after prune attempt (non-quota):",
                retryErr
              );
              return { ok: false, reason: "other", error: retryErr };
            }
            // else still quota — continue loop to remove next oldest
          }
        } // end for
        // exhausted prune candidates and still can't save
        console.error(
          "Prune exhausted and still cannot save (localStorage full)."
        );
        return { ok: false, reason: "quota" };
      } else {
        console.error("Failed to write project to localStorage", e);
        return { ok: false, reason: "other", error: e };
      }
    }

    // at this point project written successfully, update the index
    const idx = _loadIndexRaw();
    const existing = idx.find((i) => i.id === projectObject.id);
    const entry = {
      id: projectObject.id,
      title: projectObject.title || "(untitled)",
      savedAt: projectObject.savedAt,
    };
    if (existing) {
      existing.title = entry.title;
      existing.savedAt = entry.savedAt;
    } else {
      idx.push(entry);
    }
    // sort by savedAt desc
    idx.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    const ok = _saveIndexRaw(idx);
    if (!ok) {
      // if index failed to save, remove the project we just wrote to avoid inconsistent state
      try {
        localStorage.removeItem(key);
      } catch (_) {}
      return { ok: false, reason: "indexFailed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("saveProjectToLocal unexpected error", err);
    return { ok: false, reason: "other", error: err };
  }
}

export function loadProjectFromLocal(id) {
  try {
    const key = PROJECT_PREFIX + id;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load project", e);
    return null;
  }
}

export function deleteProjectFromLocal(id) {
  try {
    const key = PROJECT_PREFIX + id;
    localStorage.removeItem(key);
    const idx = _loadIndexRaw().filter((i) => i.id !== id);
    _saveIndexRaw(idx);
    return true;
  } catch (e) {
    console.error("Failed to delete project", e);
    return false;
  }
}
