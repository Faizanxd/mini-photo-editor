// FILE: app.js
import { Project } from "./js/models/Project.js";
import { TextLayer } from "./js/models/TextLayer.js";
import { ImageLayer } from "./js/models/ImageLayer.js";
import { CanvasManager } from "./js/managers/CanvasManager.js";
import { HistoryManager } from "./js/managers/HistoryManager.js";
import { AddLayerCommand } from "./js/commands/AddLayerCommand.js";
import { initUI } from "./js/ui.js";
import { initInteractions } from "./js/interactions.js";
import * as storage from "./js/storage.js";
import * as exporter from "./js/export.js";

// core singletons
const project = new Project();
const canvasEl = document.getElementById("editorCanvas");
const canvasManager = new CanvasManager(canvasEl, project, 900, 1600);
const history = new HistoryManager(400);

// createText now delegates to interaction bridge if available.
// This avoids timing/race issues and keeps pendingEdit handling in one place.
function createText() {
  // Prefer interactions bridge (it will open the inline editor and set pendingEdit)
  if (typeof window.createTextThroughUI === "function") {
    window.createTextThroughUI();
    return;
  }

  // Fallback: create text layer, select it and show editor (best-effort)
  const pageIndex = project.activePageIndex;
  const page = project.activePage;
  const t = new TextLayer("Double-click to edit");
  t.x = Math.round(page.w / 2 - 120);
  t.y = Math.round(page.h / 2 - 24);
  const cmd = new AddLayerCommand(project, pageIndex, t);
  history.execute(cmd);
  // select and render
  canvasManager.setActiveLayerId(t.id);
  canvasManager.render();
  // if interactions bridge isn't available we cannot reliably open the inline editor/pendingEdit,
  // user can double-click to edit as usual.
}

// addOverlay from file (delegates to interactions bridge if present)
function addOverlayFromFile(file) {
  if (typeof window.addOverlayThroughUI === "function") {
    window.addOverlayThroughUI(file);
    return;
  }
  // fallback
  const layer = new ImageLayer();
  layer.setImageFromFile(file);
  layer.x = 150;
  layer.y = 200;
  const pageIndex = project.activePageIndex;
  const cmd = new AddLayerCommand(project, pageIndex, layer);
  history.execute(cmd);
  layer.zIndex =
    (Math.max(0, ...project.activePage.layers.map((l) => l.zIndex || 0)) || 0) +
    1;
  project.activePage.sortByZ();
  canvasManager.render();
}

// small helpers for save/load passed into UI
async function saveProject() {
  if (!project.title) {
    const t = prompt("Enter a title for this project:", "");
    if (!t) return;
    project.title = t.trim();
  }
  const obj = project.toObject();
  storage.saveProjectToLocal(obj);
}

async function loadProjectById(id) {
  const obj = storage.loadProjectFromLocal(id);
  if (!obj) return false;
  const loaded = Project.fromObject(obj);
  project.id = loaded.id;
  project.title = loaded.title;
  project.pages = loaded.pages;
  project.activePageIndex = loaded.activePageIndex;
  project.createdAt = loaded.createdAt || Date.now();
  canvasManager.render();
  return true;
}

function deleteSaved(id) {
  return storage.deleteProjectFromLocal(id);
}

function downloadJSON() {
  const obj = project.toObject();
  const filename = `${(project.title || "portrait")
    .replace(/[^a-z0-9-_ ]/gi, "")
    .slice(0, 50)}-${new Date().toISOString()}.json`;
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  exporter.downloadBlob(blob, filename);
}

async function exportPNG(scale = 2) {
  const { blob } = await exporter.exportCurrentPageAsPNG(project.activePage, {
    scale,
  });
  if (blob)
    exporter.downloadBlob(
      blob,
      `${(project.title || "portrait")
        .replace(/[^a-z0-9-_ ]/gi, "")
        .slice(0, 50)}-page${project.activePageIndex + 1}.png`
    );
}

// initialize UI - pass callbacks
const ui = initUI({
  project,
  canvasManager,
  history,
  createText,
  addOverlayFromFile,
  saveProject,
  loadProject: loadProjectById,
  deleteSaved,
  downloadJSON,
  exportPNG,
});

// init interactions (needs ui to exist)
initInteractions({ project, canvasManager, history, ui });

// initial render + populate
ui.populateSavedList();
ui.refreshPagesList();
canvasManager.render();

// expose for debugging
window._editor = { project, canvasManager, history, ui };
