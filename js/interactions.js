// FILE: js/interactions.js
import { TextLayer } from "./models/TextLayer.js";
import { ImageLayer } from "./models/ImageLayer.js";
import { AddLayerCommand } from "./commands/AddLayerCommand.js";
import { MoveLayerCommand } from "./commands/MoveLayerCommand.js";
import { ResizeLayerCommand } from "./commands/ResizeLayerCommand.js";
import { RemoveLayerCommand } from "./commands/RemoveLayerCommand.js";
import { EditTextCommand } from "./commands/EditTextCommand.js";
import { ChangePropCommand } from "./commands/ChangePropCommand.js";
import { ZIndexCommand } from "./commands/ZIndexCommand.js";

export function initInteractions({ project, canvasManager, history, ui }) {
  const canvas = document.getElementById("editorCanvas");
  let isDragging = false;
  let dragLayer = null;
  let dragStart = { x: 0, y: 0 };
  let layerStart = { x: 0, y: 0 };

  let isResizing = false;
  let resizeHandle = null;
  let resizeStart = { x: 0, y: 0 };
  let sizeStart = { w: 0, h: 0, x: 0, y: 0, layerId: null };

  let isRotating = false;
  let rotateStartAngle = 0;
  let rotateStartPointerAngle = 0;
  let rotateLayer = null;

  let isEditing = false;
  let pendingEdit = null;
  let lastHover = null;

  const SNAP = 8; // px snapping threshold
  const ANGLE_SNAP = 15; // degrees when holding Shift or for angle guide snapping

  // helper: compute angle (deg) from center to point
  function angleDeg(cx, cy, px, py) {
    return (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
  }

  // --- global bridges ---
  window.createTextThroughUI = function () {
    // debounce quick double calls
    window._lastTextCreateAt = window._lastTextCreateAt || 0;
    const now = Date.now();
    if (now - window._lastTextCreateAt < 300) return;
    window._lastTextCreateAt = now;

    const t = new TextLayer("Double-click to edit");
    const pageIndex = project.activePageIndex;
    t.x = Math.round(project.activePage.w / 2 - 120);
    t.y = Math.round(project.activePage.h / 2 - 24);
    const cmd = new AddLayerCommand(project, pageIndex, t);
    history.execute(cmd);

    // select it and open inline editor
    canvasManager.setActiveLayerId(t.id);
    pendingEdit = {
      pageIndex: project.activePageIndex,
      layerId: t.id,
      oldText: t.text,
    };
    isEditing = true;
    if (ui && typeof ui.openTextEditorForLayer === "function")
      ui.openTextEditorForLayer(t);
    canvasManager.render();
    if (ui && typeof ui.refreshPagesList === "function") ui.refreshPagesList();
  };

  window.addOverlayThroughUI = function (file) {
    const layer = new ImageLayer();
    layer.setImageFromFile(file);
    layer.x = 150;
    layer.y = 200;
    const pageIndex = project.activePageIndex;
    const cmd = new AddLayerCommand(project, pageIndex, layer);
    history.execute(cmd);
    layer.zIndex =
      (Math.max(0, ...project.activePage.layers.map((l) => l.zIndex || 0)) ||
        0) + 1;
    project.activePage.sortByZ();
    canvasManager.render();
    if (ui && typeof ui.refreshPagesList === "function") ui.refreshPagesList();
  };

  window.bringSelectedForward = function () {
    const page = project.activePage;
    const id = canvasManager.activeLayerId;
    if (!id) return;
    const layer = page.layers.find((l) => l.id === id);
    if (!layer) return;
    const oldZ = layer.zIndex || 0;
    const newZ =
      (Math.max(0, ...page.layers.map((l) => l.zIndex || 0)) || 0) + 1;
    const cmd = new ZIndexCommand(
      project,
      project.activePageIndex,
      id,
      oldZ,
      newZ
    );
    history.execute(cmd);
    canvasManager.render();
    if (ui && typeof ui.refreshPagesList === "function") ui.refreshPagesList();
  };

  window.sendSelectedBack = function () {
    const page = project.activePage;
    const id = canvasManager.activeLayerId;
    if (!id) return;
    const layer = page.layers.find((l) => l.id === id);
    if (!layer) return;
    const oldZ = layer.zIndex || 0;
    const newZ = (Math.min(...page.layers.map((l) => l.zIndex || 0)) || 0) - 1;
    const cmd = new ZIndexCommand(
      project,
      project.activePageIndex,
      id,
      oldZ,
      newZ
    );
    history.execute(cmd);
    canvasManager.render();
    if (ui && typeof ui.refreshPagesList === "function") ui.refreshPagesList();
  };

  // Save text edit called from UI close
  window.saveTextEdit = function (newText) {
    if (!pendingEdit) return;
    const { pageIndex, layerId, oldText } = pendingEdit;
    if (newText !== oldText) {
      const cmd = new EditTextCommand(
        project,
        pageIndex,
        layerId,
        oldText,
        newText
      );
      history.execute(cmd);
    }
    pendingEdit = null;
    isEditing = false;
    canvasManager.render();
    if (ui && typeof ui.refreshPagesList === "function") ui.refreshPagesList();
  };

  // CANCEL text edit: restore old text and clear pending state (important to avoid freezing)
  window.cancelTextEdit = function () {
    if (!pendingEdit) {
      isEditing = false;
      return;
    }
    const { pageIndex, layerId, oldText } = pendingEdit;
    const page = project.pages[pageIndex];
    if (page) {
      const layer = page.layers.find((l) => l.id === layerId);
      if (layer && layer.type === "text") {
        layer.text = oldText; // restore previous text
      }
    }
    pendingEdit = null;
    isEditing = false;
    canvasManager.render();
    if (ui && typeof ui.refreshPagesList === "function") ui.refreshPagesList();
  };

  // helper to set text property (used by UI)
  window.setActiveTextProp = function (prop, value) {
    const page = project.activePage;
    const layer = page.layers.find((l) => l.id === canvasManager.activeLayerId);
    if (!layer) return;
    if (layer.type === "text") {
      if (prop === "align") {
        const ctx = canvasManager.ctx;
        ctx.save();
        ctx.font = layer.getFontString();
        const metrics = ctx.measureText(layer.text || "");
        const width = metrics.width || 0;
        ctx.restore();
        const box = layer.measure(canvasManager.ctx);
        const visualCenter = box.x + width / 2;
        let newX;
        if (value === "left") newX = visualCenter - width / 2;
        else if (value === "center") newX = visualCenter;
        else newX = visualCenter + width / 2;

        const cmdMove = new MoveLayerCommand(
          project,
          project.activePageIndex,
          layer.id,
          { x: layer.x, y: layer.y },
          { x: newX, y: layer.y }
        );
        const cmdAlign = new ChangePropCommand(
          project,
          project.activePageIndex,
          layer.id,
          "align",
          layer.align,
          value
        );
        history.execute(cmdMove);
        history.execute(cmdAlign);
      } else {
        const oldVal = layer[prop];
        if (oldVal === value) return;
        const cmd = new ChangePropCommand(
          project,
          project.activePageIndex,
          layer.id,
          prop,
          oldVal,
          value
        );
        history.execute(cmd);
      }
      canvasManager.render();
      if (ui && typeof ui.refreshPagesList === "function")
        ui.refreshPagesList();
      return;
    }

    if (layer.type === "image" && prop === "align") {
      let newX;
      const pageW = project.activePage.w;
      if (value === "left") newX = 0;
      else if (value === "right")
        newX = Math.max(0, pageW - (layer.width || 0));
      else newX = Math.round((pageW - (layer.width || 0)) / 2);
      const cmd = new MoveLayerCommand(
        project,
        project.activePageIndex,
        layer.id,
        { x: layer.x, y: layer.y },
        { x: newX, y: layer.y }
      );
      history.execute(cmd);
      canvasManager.render();
      if (ui && typeof ui.refreshPagesList === "function")
        ui.refreshPagesList();
    }
  };

  window.toggleActiveProp = function (prop) {
    const page = project.activePage;
    const layer = page.layers.find((l) => l.id === canvasManager.activeLayerId);
    if (!layer) return;
    const cmd = new ChangePropCommand(
      project,
      project.activePageIndex,
      layer.id,
      prop,
      !!layer[prop],
      !layer[prop]
    );
    history.execute(cmd);
    canvasManager.render();
    if (ui && typeof ui.refreshPagesList === "function") ui.refreshPagesList();
  };

  // --- Hit testing helpers ---
  // rotate a point around (cx,cy) by deg
  function rotatePoint(x, y, cx, cy, deg) {
    const rad = (deg * Math.PI) / 180;
    const dx = x - cx,
      dy = y - cy;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    return { x: cx + rx, y: cy + ry };
  }

  function hitTestLayers(point) {
    const page = project.activePage;
    for (let i = page.layers.length - 1; i >= 0; i--) {
      const layer = page.layers[i];
      if (layer.type === "image" || layer.type === "text") {
        const m = layer.measure(); // axis-aligned box (x,y,w,h)
        const cx = m.x + m.w / 2,
          cy = m.y + m.h / 2;
        const angle = layer.angle || 0;
        // compute corners
        const localCorners = [
          { x: m.x, y: m.y }, // nw
          { x: m.x + m.w, y: m.y }, // ne
          { x: m.x + m.w, y: m.y + m.h }, // se
          { x: m.x, y: m.y + m.h }, // sw
        ];
        const corners = localCorners.map((p) =>
          rotatePoint(p.x, p.y, cx, cy, angle)
        );
        // handles detection (within 10px)
        const handles = [
          { x: corners[0].x, y: corners[0].y, name: "nw" },
          { x: corners[1].x, y: corners[1].y, name: "ne" },
          { x: corners[2].x, y: corners[2].y, name: "se" },
          { x: corners[3].x, y: corners[3].y, name: "sw" },
        ];
        for (const h of handles) {
          if (Math.abs(point.x - h.x) <= 10 && Math.abs(point.y - h.y) <= 10) {
            return { layer, hitType: "handle", handleName: h.name };
          }
        }
        // rotate handle detection (top-center offset)
        const topCenter = {
          x: (corners[0].x + corners[1].x) / 2,
          y: (corners[0].y + corners[1].y) / 2,
        };
        const dirX = topCenter.x - cx,
          dirY = topCenter.y - cy;
        const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        const nx = dirX / len;
        const ny = dirY / len;
        const rotateX = topCenter.x + nx * canvasManager.rotateHandleDistance;
        const rotateY = topCenter.y + ny * canvasManager.rotateHandleDistance;
        const distRotate = Math.hypot(point.x - rotateX, point.y - rotateY);
        if (distRotate <= 12) return { layer, hitType: "rotate" };

        // point-in-rotated-rect: inverse-rotate point to axis-aligned and test
        const inv = rotatePoint(point.x, point.y, cx, cy, -angle);
        if (
          inv.x >= m.x &&
          inv.x <= m.x + m.w &&
          inv.y >= m.y &&
          inv.y <= m.y + m.h
        ) {
          return { layer, hitType: "body" };
        }
      }
    }
    return null;
  }

  // --- snapping & bounds helpers ---
  function computeSnapsForMove(layer, candidateX, candidateY) {
    const page = project.activePage;
    const w = layer.width || 0,
      h = layer.height || 0;
    const guides = [];
    let snapX = candidateX;
    let snapY = candidateY;

    // page vertical edges and center
    const pageLeft = 0,
      pageRight = page.w,
      pageCenterX = page.w / 2;
    if (Math.abs(candidateX - pageLeft) <= SNAP) {
      snapX = pageLeft;
      guides.push({ x1: pageLeft, y1: 0, x2: pageLeft, y2: page.h });
    }
    if (Math.abs(candidateX + w - pageRight) <= SNAP) {
      snapX = pageRight - w;
      guides.push({ x1: pageRight, y1: 0, x2: pageRight, y2: page.h });
    }
    if (Math.abs(candidateX + w / 2 - pageCenterX) <= SNAP) {
      snapX = Math.round(pageCenterX - w / 2);
      guides.push({ x1: pageCenterX, y1: 0, x2: pageCenterX, y2: page.h });
    }

    // page horizontal edges and center
    const pageTop = 0,
      pageBottom = page.h,
      pageCenterY = page.h / 2;
    if (Math.abs(candidateY - pageTop) <= SNAP) {
      snapY = pageTop;
      guides.push({ x1: 0, y1: pageTop, x2: page.w, y2: pageTop });
    }
    if (Math.abs(candidateY + h - pageBottom) <= SNAP) {
      snapY = pageBottom - h;
      guides.push({ x1: 0, y1: pageBottom, x2: page.w, y2: pageBottom });
    }
    if (Math.abs(candidateY + h / 2 - pageCenterY) <= SNAP) {
      snapY = Math.round(pageCenterY - h / 2);
      guides.push({ x1: 0, y1: pageCenterY, x2: page.w, y2: pageCenterY });
    }

    // snap to other layers edges (axis aligned)
    for (const other of page.layers) {
      if (other.id === layer.id) continue;
      const om = other.measure();
      // left align
      if (Math.abs(candidateX - om.x) <= SNAP) {
        snapX = om.x;
        guides.push({ x1: om.x, y1: 0, x2: om.x, y2: page.h });
      }
      // right align
      if (Math.abs(candidateX + w - (om.x + om.w)) <= SNAP) {
        snapX = om.x + om.w - w;
        guides.push({ x1: om.x + om.w, y1: 0, x2: om.x + om.w, y2: page.h });
      }
      // center x align
      const otherCenterX = om.x + om.w / 2;
      if (Math.abs(candidateX + w / 2 - otherCenterX) <= SNAP) {
        snapX = Math.round(otherCenterX - w / 2);
        guides.push({ x1: otherCenterX, y1: 0, x2: otherCenterX, y2: page.h });
      }

      // top / bottom / center y
      if (Math.abs(candidateY - om.y) <= SNAP) {
        snapY = om.y;
        guides.push({ x1: 0, y1: om.y, x2: page.w, y2: om.y });
      }
      if (Math.abs(candidateY + h - (om.y + om.h)) <= SNAP) {
        snapY = om.y + om.h - h;
        guides.push({ x1: 0, y1: om.y + om.h, x2: page.w, y2: om.y + om.h });
      }
      const otherCenterY = om.y + om.h / 2;
      if (Math.abs(candidateY + h / 2 - otherCenterY) <= SNAP) {
        snapY = Math.round(otherCenterY - h / 2);
        guides.push({ x1: 0, y1: otherCenterY, x2: page.w, y2: otherCenterY });
      }
    }

    // enforce bounds so object cannot go outside page area
    snapX = Math.max(0, Math.min(snapX, page.w - w));
    snapY = Math.max(0, Math.min(snapY, page.h - h));

    return { x: snapX, y: snapY, guides };
  }

  // compute angle snapping (if shiftKey pressed)
  function snappedAngle(angleDeg, shiftKey) {
    if (shiftKey) {
      return Math.round(angleDeg / ANGLE_SNAP) * ANGLE_SNAP;
    }
    // also snap to 0/90/180/270 if within a few degrees
    const poss = [0, 90, 180, 270];
    for (const p of poss) {
      if (Math.abs(((angleDeg - p + 540) % 360) - 180) <= 4) return p; // within 4 deg
    }
    return angleDeg;
  }

  // pointer cursor feedback
  canvas.addEventListener("pointermove", (ev) => {
    const pt = canvasManager.clientToCanvasPoint(ev.clientX, ev.clientY);
    if (isDragging || isResizing || isRotating) return;
    const hit = hitTestLayers(pt);
    let cursor = "default";
    if (hit) {
      if (hit.hitType === "handle") {
        const h = hit.handleName;
        if (h === "nw" || h === "se") cursor = "nwse-resize";
        else cursor = "nesw-resize";
      } else if (hit.hitType === "rotate") cursor = "grab";
      else cursor = hit.layer.type === "image" ? "move" : "text";
    }
    if (lastHover !== cursor) {
      canvas.style.cursor = cursor;
      lastHover = cursor;
    }
  });

  // pointerdown
  canvas.addEventListener("pointerdown", (ev) => {
    if (isEditing) return;
    canvas.setPointerCapture(ev.pointerId);
    const pt = canvasManager.clientToCanvasPoint(ev.clientX, ev.clientY);
    const hit = hitTestLayers(pt);
    if (hit) {
      // set active
      if (ui && typeof ui.setActiveLayer === "function")
        ui.setActiveLayer(hit.layer);
      if (hit.hitType === "handle") {
        dragLayer = hit.layer;
        isResizing = true;
        resizeHandle = hit.handleName;
        resizeStart = pt;
        sizeStart = {
          w: hit.layer.width || 1,
          h: hit.layer.height || 1,
          x: hit.layer.x,
          y: hit.layer.y,
          layerId: hit.layer.id,
        };
        canvasManager.snapGuides = [];
      } else if (hit.hitType === "rotate") {
        rotateLayer = hit.layer;
        isRotating = true;
        const m = rotateLayer.measure();
        const cx = m.x + m.w / 2,
          cy = m.y + m.h / 2;
        rotateStartAngle = rotateLayer.angle || 0;
        rotateStartPointerAngle = angleDeg(cx, cy, pt.x, pt.y);
        canvasManager.snapGuides = [];
      } else {
        isDragging = true;
        dragLayer = hit.layer;
        dragStart = pt;
        layerStart = { x: hit.layer.x, y: hit.layer.y, layerId: hit.layer.id };
        canvasManager.snapGuides = [];
      }
    } else {
      if (ui && typeof ui.setActiveLayer === "function")
        ui.setActiveLayer(null);
    }
  });

  // pointermove (drag/resizing/rotating)
  canvas.addEventListener("pointermove", (ev) => {
    const pt = canvasManager.clientToCanvasPoint(ev.clientX, ev.clientY);

    // ROTATE
    if (isRotating && rotateLayer) {
      const m = rotateLayer.measure();
      const cx = m.x + m.w / 2,
        cy = m.y + m.h / 2;
      const currentPointerAngle = angleDeg(cx, cy, pt.x, pt.y);
      let newAngle =
        rotateStartAngle + (currentPointerAngle - rotateStartPointerAngle);
      newAngle = ((newAngle % 360) + 360) % 360;
      const snapped = snappedAngle(newAngle, ev.shiftKey);
      rotateLayer.angle = snapped;
      canvasManager.snapGuides = [];
      const nearCardinal = [0, 90, 180, 270].some(
        (c) => Math.abs(((snapped - c + 540) % 360) - 180) <= 2
      );
      if (nearCardinal) {
        canvasManager.snapGuides.push({
          x1: 0,
          y1: cy,
          x2: project.activePage.w,
          y2: cy,
        });
        canvasManager.snapGuides.push({
          x1: cx,
          y1: 0,
          x2: cx,
          y2: project.activePage.h,
        });
      }
      canvasManager.render();
      return;
    }

    // RESIZE
    if (
      isResizing &&
      dragLayer &&
      (dragLayer.type === "image" || dragLayer.type === "text")
    ) {
      const dx = pt.x - resizeStart.x;
      const dy = pt.y - resizeStart.y;
      let newW = sizeStart.w;
      let newH = sizeStart.h;
      let newX = sizeStart.x;
      let newY = sizeStart.y;
      const preserve = ev.shiftKey;
      const ar = sizeStart.w / sizeStart.h || 1;

      if (resizeHandle === "se") {
        newW = Math.max(20, Math.round(sizeStart.w + dx));
        newH = Math.max(20, Math.round(sizeStart.h + dy));
        if (preserve) newH = Math.round(newW / ar);
      } else if (resizeHandle === "nw") {
        newW = Math.max(20, Math.round(sizeStart.w - dx));
        newH = Math.max(20, Math.round(sizeStart.h - dy));
        newX = Math.round(sizeStart.x + dx);
        newY = Math.round(sizeStart.y + dy);
        if (preserve) {
          newH = Math.round(newW / ar);
          newY = Math.round(sizeStart.y + (sizeStart.h - newH));
        }
      } else if (resizeHandle === "ne") {
        newW = Math.max(20, Math.round(sizeStart.w + dx));
        newH = Math.max(20, Math.round(sizeStart.h - dy));
        newY = Math.round(sizeStart.y + dy);
        if (preserve) {
          newH = Math.round(newW / ar);
          newY = Math.round(sizeStart.y + (sizeStart.h - newH));
        }
      } else if (resizeHandle === "sw") {
        newW = Math.max(20, Math.round(sizeStart.w - dx));
        newH = Math.max(20, Math.round(sizeStart.h + dy));
        newX = Math.round(sizeStart.x + dx);
        if (preserve) {
          newH = Math.round(newW / ar);
        }
      }

      // Clamp so object stays within page
      const pageW = project.activePage.w,
        pageH = project.activePage.h;
      if (newX < 0) {
        // shift right, reduce width accordingly
        newW = Math.max(20, newW + newX);
        newX = 0;
      }
      if (newY < 0) {
        newH = Math.max(20, newH + newY);
        newY = 0;
      }
      if (newX + newW > pageW) newW = Math.max(20, pageW - newX);
      if (newY + newH > pageH) newH = Math.max(20, pageH - newY);

      // Apply candidate and compute snapping for top-left
      // temporarily set width/height for candidate snapping
      dragLayer.width = newW;
      dragLayer.height = newH;
      const snaps = computeSnapsForMove(dragLayer, newX, newY);
      canvasManager.snapGuides = snaps.guides;
      dragLayer.x = snaps.x;
      dragLayer.y = snaps.y;
      dragLayer.width = newW;
      dragLayer.height = newH;

      canvasManager.render();
      return;
    }

    // DRAG
    if (isDragging && dragLayer) {
      const dx = pt.x - dragStart.x;
      const dy = pt.y - dragStart.y;
      const candidateX = layerStart.x + dx;
      const candidateY = layerStart.y + dy;
      const snaps = computeSnapsForMove(dragLayer, candidateX, candidateY);
      canvasManager.snapGuides = snaps.guides;
      dragLayer.x = snaps.x;
      dragLayer.y = snaps.y;
      canvasManager.render();
    }
  });

  // pointerup: finish actions & push history entries
  canvas.addEventListener("pointerup", (ev) => {
    if (isDragging && dragLayer) {
      const final = { x: dragLayer.x, y: dragLayer.y };
      const pageIndex = project.activePageIndex;
      const cmd = new MoveLayerCommand(
        project,
        pageIndex,
        dragLayer.id,
        { x: layerStart.x, y: layerStart.y },
        final
      );
      history.execute(cmd);
      canvasManager.snapGuides = [];
      canvasManager.render();
      if (ui && typeof ui.refreshPagesList === "function")
        ui.refreshPagesList();
      isDragging = false;
      dragLayer = null;
    }
    if (isResizing && sizeStart.layerId) {
      const layerId = sizeStart.layerId;
      const pageIndex = project.activePageIndex;
      const layer = project.activePage.layers.find((l) => l.id === layerId);
      if (layer) {
        const fromSize = {
          x: sizeStart.x,
          y: sizeStart.y,
          w: sizeStart.w,
          h: sizeStart.h,
        };
        const toSize = {
          x: layer.x,
          y: layer.y,
          w: layer.width,
          h: layer.height,
        };
        const cmd = new ResizeLayerCommand(
          project,
          pageIndex,
          layerId,
          fromSize,
          toSize
        );
        history.execute(cmd);
        canvasManager.snapGuides = [];
        canvasManager.render();
        if (ui && typeof ui.refreshPagesList === "function")
          ui.refreshPagesList();
      }
      isResizing = false;
      resizeHandle = null;
    }
    if (isRotating && rotateLayer) {
      const layerId = rotateLayer.id;
      const pageIndex = project.activePageIndex;
      const oldAngle = rotateStartAngle;
      const newAngle = rotateLayer.angle || 0;
      if (oldAngle !== newAngle) {
        const cmd = new ChangePropCommand(
          project,
          pageIndex,
          layerId,
          "angle",
          oldAngle,
          newAngle
        );
        history.execute(cmd);
      }
      canvasManager.snapGuides = [];
      canvasManager.render();
      if (ui && typeof ui.refreshPagesList === "function")
        ui.refreshPagesList();
      isRotating = false;
      rotateLayer = null;
    }

    try {
      canvas.releasePointerCapture(ev.pointerId);
    } catch (e) {}
  });

  // dblclick text => start editing
  canvas.addEventListener("dblclick", (ev) => {
    const pt = canvasManager.clientToCanvasPoint(ev.clientX, ev.clientY);
    const hit = hitTestLayers(pt);
    if (hit && hit.layer.type === "text") {
      pendingEdit = {
        pageIndex: project.activePageIndex,
        layerId: hit.layer.id,
        oldText: hit.layer.text,
      };
      isEditing = true;
      if (ui && typeof ui.openTextEditorForLayer === "function")
        ui.openTextEditorForLayer(hit.layer);
    }
  });

  // keyboard shortcuts & delete
  document.addEventListener("keydown", (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
      ev.preventDefault();
      history.undo();
      canvasManager.render();
      if (ui && typeof ui.refreshPagesList === "function")
        ui.refreshPagesList();
    }
    if (
      (ev.ctrlKey || ev.metaKey) &&
      (ev.key.toLowerCase() === "y" ||
        (ev.shiftKey && ev.key.toLowerCase() === "z"))
    ) {
      ev.preventDefault();
      history.redo();
      canvasManager.render();
      if (ui && typeof ui.refreshPagesList === "function")
        ui.refreshPagesList();
    }
    if (ev.key === "Delete" || ev.key === "Backspace") {
      const page = project.activePage;
      const id = canvasManager.activeLayerId;
      if (!id) return;
      const cmd = new RemoveLayerCommand(project, project.activePageIndex, id);
      history.execute(cmd);
      canvasManager.setActiveLayerId(null);
      canvasManager.render();
      if (ui && typeof ui.refreshPagesList === "function")
        ui.refreshPagesList();
    }
  });

  // when images load
  window.addEventListener("layer:imageLoaded", () => {
    canvasManager.render();
    if (ui && typeof ui.refreshPagesList === "function") ui.refreshPagesList();
  });
  window.addEventListener("project:pageImageLoaded", () => {
    canvasManager.render();
    if (ui && typeof ui.refreshPagesList === "function") ui.refreshPagesList();
  });
}
