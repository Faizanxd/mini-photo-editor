// FILE: js/ui.js
import * as storage from "./storage.js";
import { sanitizeFilename } from "./utils.js";
import { RemoveLayerCommand } from "./commands/RemoveLayerCommand.js";

export function initUI(env) {
  // env expects:
  // { project, canvasManager, history, createText, addOverlayFromFile, saveProject, loadProject, deleteSaved, downloadJSON, exportPNG }
  const nodes = {
    btnAddText: document.getElementById("btnAddText"),
    btnAddImage: document.getElementById("btnAddImage"),
    btnAddOverlay: document.getElementById("btnAddOverlay"),
    overlayLoader: document.getElementById("overlayLoader"),
    btnAddPage: document.getElementById("btnAddPage"),
    btnDeletePage: document.getElementById("btnDeletePage"),
    // NEW delete element button
    btnDeleteElement: document.getElementById("btnDeleteElement"),
    btnBringFront: document.getElementById("btnBringFront"),
    btnSendBack: document.getElementById("btnSendBack"),
    btnUndo: document.getElementById("btnUndo"),
    btnRedo: document.getElementById("btnRedo"),
    savedList: document.getElementById("savedList"),
    btnLoadSaved: document.getElementById("btnLoadSaved"),
    btnDeleteSaved: document.getElementById("btnDeleteSaved"),
    btnSave: document.getElementById("btnSave"),
    btnDownload: document.getElementById("btnDownload"),
    btnExportImage: document.getElementById("btnExportImage"),
    imageLoader: document.getElementById("imageLoader"),
    pagesList: document.getElementById("pagesList"),
    fontFamilySelect: document.getElementById("fontFamilySelect"),
    fontSizeRange: document.getElementById("fontSizeRange"),
    fontColor: document.getElementById("fontColor"),
    fontAlign: document.getElementById("fontAlign"),
    btnBold: document.getElementById("btnBold"),
    btnItalic: document.getElementById("btnItalic"),
    textEditor: document.getElementById("textEditor"),
    resizeHint: document.getElementById("resizeHint"),
  };

  const api = {
    sanitizeFilename,
    populateSavedList,
    refreshPagesList,
    setActiveLayer,
    openTextEditorForLayer,
    closeTextEditor,
    getNodes: () => nodes,
  };

  // Add Text
  nodes.btnAddText.addEventListener("click", () => {
    if (typeof env.createText === "function") {
      env.createText();
    } else {
      alert("Create-text function not available.");
    }
  });

  // Add page image (new page)
  nodes.btnAddImage.addEventListener("click", () => nodes.imageLoader.click());
  nodes.imageLoader.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const id = env.project.addPageFromFile(file);
    const idx = env.project.findPageIndexById(id);
    if (idx >= 0) env.project.activePageIndex = idx;
    api.refreshPagesList();
    env.canvasManager.render();
    nodes.imageLoader.value = "";
  });

  // Add Blank Page
  nodes.btnAddPage.addEventListener("click", () => {
    env.project.addPage();
    env.project.activePageIndex = env.project.pages.length - 1;
    api.refreshPagesList();
    env.canvasManager.render();
  });

  // Delete page
  nodes.btnDeletePage.addEventListener("click", () => {
    if (env.project.pages.length === 1) {
      alert("Cannot delete the last page");
      return;
    }
    if (!confirm("Delete current page?")) return;
    env.project.removePageByIndex(env.project.activePageIndex);
    api.refreshPagesList();
    env.canvasManager.render();
  });

  // Delete selected element (NEW) — behaves like the Delete key (undoable)
  nodes.btnDeleteElement?.addEventListener("click", () => {
    const page = env.project.activePage;
    const id = env.canvasManager.activeLayerId;
    if (!id) {
      alert("No element selected");
      return;
    }
    // perform the same remove-layer command the keyboard uses
    const cmd = new RemoveLayerCommand(
      env.project,
      env.project.activePageIndex,
      id
    );
    env.history.execute(cmd);
    env.canvasManager.setActiveLayerId(null);
    env.canvasManager.render();
    api.refreshPagesList();
  });

  // Add overlay
  nodes.btnAddOverlay.addEventListener("click", () =>
    nodes.overlayLoader.click()
  );
  nodes.overlayLoader.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (typeof env.addOverlayFromFile === "function")
      env.addOverlayFromFile(file);
    nodes.overlayLoader.value = "";
  });

  // Bring / Send
  nodes.btnBringFront.addEventListener("click", () => {
    if (typeof window.bringSelectedForward === "function")
      window.bringSelectedForward();
  });
  nodes.btnSendBack.addEventListener("click", () => {
    if (typeof window.sendSelectedBack === "function")
      window.sendSelectedBack();
  });

  // Undo / Redo buttons
  nodes.btnUndo.addEventListener("click", () => {
    env.history.undo();
    env.canvasManager.render();
    api.refreshPagesList();
  });
  nodes.btnRedo.addEventListener("click", () => {
    env.history.redo();
    env.canvasManager.render();
    api.refreshPagesList();
  });

  // Saved project controls
  nodes.btnSave.addEventListener("click", async () => {
    await env.saveProject();
    api.populateSavedList();
    alert("Saved");
  });
  nodes.btnLoadSaved.addEventListener("click", async () => {
    const sel = nodes.savedList.value;
    if (!sel) {
      alert("Select a saved project first");
      return;
    }
    const ok = await env.loadProject(sel);
    if (ok) {
      api.refreshPagesList();
      env.canvasManager.render();
      alert("Loaded");
    } else alert("Failed to load");
  });
  nodes.btnDeleteSaved.addEventListener("click", () => {
    const sel = nodes.savedList.value;
    if (!sel) {
      alert("Select a saved project first");
      return;
    }
    if (!confirm("Delete saved project?")) return;
    env.deleteSaved(sel);
    api.populateSavedList();
  });
  nodes.btnDownload.addEventListener("click", () => env.downloadJSON());
  nodes.btnExportImage.addEventListener("click", () => env.exportPNG(2));

  // font/style controls
  nodes.fontFamilySelect.addEventListener("change", (e) => {
    if (typeof window.setActiveTextProp === "function")
      window.setActiveTextProp("fontFamily", e.target.value);
  });
  nodes.fontSizeRange.addEventListener("input", (e) => {
    if (typeof window.setActiveTextProp === "function")
      window.setActiveTextProp("fontSize", parseInt(e.target.value, 10));
  });
  nodes.fontColor.addEventListener("input", (e) => {
    if (typeof window.setActiveTextProp === "function")
      window.setActiveTextProp("color", e.target.value);
  });
  nodes.fontAlign.addEventListener("change", (e) => {
    if (typeof window.setActiveTextProp === "function")
      window.setActiveTextProp("align", e.target.value);
  });
  nodes.btnBold.addEventListener("click", () => {
    if (typeof window.toggleActiveProp === "function")
      window.toggleActiveProp("bold");
  });
  nodes.btnItalic.addEventListener("click", () => {
    if (typeof window.toggleActiveProp === "function")
      window.toggleActiveProp("italic");
  });

  // saved list population
  function populateSavedList() {
    const idx = storage.loadIndex();
    nodes.savedList.innerHTML = "";
    idx.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    for (const m of idx) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.title || "(untitled)"} — ${new Date(
        m.savedAt || 0
      ).toLocaleString()}`;
      nodes.savedList.appendChild(opt);
    }
  }

  function refreshPagesList() {
    nodes.pagesList.innerHTML = "";
    env.project.pages.forEach((p, i) => {
      const div = document.createElement("div");
      div.className = "page-thumb";
      if (i === env.project.activePageIndex) div.classList.add("active");
      const dataUrl = env.canvasManager.renderPageToThumbnail(p, 220);
      const img = document.createElement("img");
      img.src = dataUrl;
      div.appendChild(img);
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = `#${i + 1}`;
      div.appendChild(label);
      div.onclick = () => {
        env.project.activePageIndex = i;
        env.canvasManager.render();
        refreshPagesList();
      };
      nodes.pagesList.appendChild(div);
    });
  }

  function setActiveLayer(layer) {
    const id = layer ? layer.id : null;
    env.canvasManager.setActiveLayerId(id);
    env.canvasManager.render();
    if (layer && layer.type === "image")
      nodes.resizeHint.style.display = "block";
    else nodes.resizeHint.style.display = "none";
  }

  // Open the inline editor for a given text layer (positions overlay editor)
  function openTextEditorForLayer(layer) {
    nodes.textEditor.style.display = "block";
    nodes.textEditor.setAttribute("aria-hidden", "false");
    const rect = document
      .getElementById("editorCanvas")
      .getBoundingClientRect();
    const scale = rect.width / env.canvasManager.workingW;
    const box = layer.measure(env.canvasManager.ctx);
    nodes.textEditor.style.left = Math.round(box.x * scale) + "px";
    nodes.textEditor.style.top = Math.round(box.y * scale) + "px";
    nodes.textEditor.style.minWidth =
      Math.max(80, Math.round(box.w * scale)) + "px";
    nodes.textEditor.style.fontSize =
      Math.max(12, Math.round(layer.fontSize * scale)) + "px";
    nodes.textEditor.style.fontFamily = layer.fontFamily;
    nodes.textEditor.textContent = layer.text;
    nodes.textEditor.focus();
    // select everything to let user start typing
    document.getSelection()?.selectAllChildren(nodes.textEditor);
  }

  // Close editor; if save==true, call global saveTextEdit (which interactions implements)
  function closeTextEditor(save) {
    if (save) {
      if (typeof window.saveTextEdit === "function")
        window.saveTextEdit(nodes.textEditor.textContent || "");
    } else {
      // cancel: restore original text if pendingEdit exists
      if (typeof window.cancelTextEdit === "function") window.cancelTextEdit();
    }
    nodes.textEditor.style.display = "none";
    nodes.textEditor.setAttribute("aria-hidden", "true");
    nodes.textEditor.textContent = "";
  }

  // Live preview while editing: update the actual layer text as user types (does not push history yet)
  nodes.textEditor.addEventListener("input", (e) => {
    const id = env.canvasManager.activeLayerId;
    if (!id) return;
    const layer = env.project.activePage.layers.find((l) => l.id === id);
    if (layer && layer.type === "text") {
      layer.text = nodes.textEditor.textContent || "";
      env.canvasManager.render();
    }
  });

  // Enter = commit, Escape = cancel
  nodes.textEditor.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      closeTextEditor(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeTextEditor(false);
    }
  });

  // Click outside -> commit and close
  document.addEventListener("pointerdown", (ev) => {
    if (nodes.textEditor.style.display !== "block") return;
    if (ev.target === nodes.textEditor) return;
    // allow clicks on editor toolbar elements (font controls) to not close; check if target is inside toolbar
    const toolbar = document.getElementById("textToolbar");
    if (toolbar && toolbar.contains(ev.target)) return;
    closeTextEditor(true);
  });

  // expose API
  api.populateSavedList = populateSavedList;
  api.refreshPagesList = refreshPagesList;
  api.setActiveLayer = setActiveLayer;
  api.openTextEditorForLayer = openTextEditorForLayer;
  api.closeTextEditor = closeTextEditor;

  return api;
}
