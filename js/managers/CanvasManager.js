// FILE: js/managers/CanvasManager.js
export class CanvasManager {
  constructor(canvasEl, project, workingW = 900, workingH = 1600) {
    this.canvas = canvasEl;
    this.ctx = this.canvas.getContext("2d");
    this.project = project;
    this.workingW = workingW;
    this.workingH = workingH;
    this.dpr = Math.max(1, window.devicePixelRatio || 1);

    this.activeLayerId = null; // id of selected layer
    this.snapGuides = []; // array of {x1,y1,x2,y2}
    this.handleSize = 12;
    this.rotateHandleDistance = 36;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.canvas.width = this.workingW * this.dpr;
    this.canvas.height = this.workingH * this.dpr;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.workingW, this.workingH);
  }

  setActiveLayerId(id) {
    this.activeLayerId = id;
  }

  render() {
    const page = this.project.activePage;
    if (!page) return;
    this.clear();

    // ensure page background is white for blank pages (draw white before page.draw)
    this.ctx.save();
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, page.w, page.h);
    this.ctx.restore();

    // draw the page (page.draw will draw background image if any, overlays, text, etc.)
    page.draw(this.ctx);

    // draw snapping guides if any
    if (this.snapGuides && this.snapGuides.length) {
      this.ctx.save();
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([4, 4]);
      this.ctx.strokeStyle = "rgba(255,80,80,0.92)";
      for (const g of this.snapGuides) {
        this.ctx.beginPath();
        this.ctx.moveTo(g.x1, g.y1);
        this.ctx.lineTo(g.x2, g.y2);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // draw selection if activeLayerId present
    if (this.activeLayerId) {
      const layer = page.layers.find((l) => l.id === this.activeLayerId);
      if (layer) {
        this.ctx.save();
        // Compute rotated rectangle corners from layer.measure()
        const m = layer.measure(); // {x,y,w,h}
        const cx = m.x + m.w / 2;
        const cy = m.y + m.h / 2;
        const angleRad = ((layer.angle || 0) * Math.PI) / 180;

        // corners relative to center before rotation
        const corners = [
          { x: -m.w / 2, y: -m.h / 2 }, // nw
          { x: m.w / 2, y: -m.h / 2 }, // ne
          { x: m.w / 2, y: m.h / 2 }, // se
          { x: -m.w / 2, y: m.h / 2 }, // sw
        ].map((p) => {
          const rx = p.x * Math.cos(angleRad) - p.y * Math.sin(angleRad);
          const ry = p.x * Math.sin(angleRad) + p.y * Math.cos(angleRad);
          return { x: cx + rx, y: cy + ry };
        });

        // dashed rotated outline
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = "#3b82f6";
        this.ctx.setLineDash([6, 4]);
        this.ctx.beginPath();
        this.ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++)
          this.ctx.lineTo(corners[i].x, corners[i].y);
        this.ctx.closePath();
        this.ctx.stroke();

        // draw corner handles (filled squares) at corners
        for (const c of corners) {
          this.ctx.save();
          const s = this.handleSize;
          this.ctx.fillStyle = "#3b82f6";
          this.ctx.fillRect(
            Math.round(c.x - s / 2),
            Math.round(c.y - s / 2),
            s,
            s
          );
          this.ctx.restore();
        }

        // rotation handle: top-center (above top edge by rotateHandleDistance)
        const topCenter = {
          x: (corners[0].x + corners[1].x) / 2,
          y: (corners[0].y + corners[1].y) / 2,
        };
        const dirX = topCenter.x - cx;
        const dirY = topCenter.y - cy;
        const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        const nx = dirX / len;
        const ny = dirY / len;
        const rotateX = topCenter.x + nx * this.rotateHandleDistance;
        const rotateY = topCenter.y + ny * this.rotateHandleDistance;

        // draw connector line
        this.ctx.save();
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = "#3b82f6";
        this.ctx.beginPath();
        this.ctx.moveTo(topCenter.x, topCenter.y);
        this.ctx.lineTo(rotateX, rotateY);
        this.ctx.stroke();
        this.ctx.restore();

        // draw rotate handle circle
        this.ctx.beginPath();
        this.ctx.fillStyle = "#fff";
        this.ctx.strokeStyle = "#3b82f6";
        this.ctx.lineWidth = 2;
        this.ctx.arc(rotateX, rotateY, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.restore();
      }
    }
  }

  // convert DOM event client coords -> logical canvas coords used in drawing (900x1600)
  clientToCanvasPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.workingW / rect.width;
    const scaleY = this.workingH / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // Render a page via page.draw onto an offscreen canvas scaled to thumbW,
  // ensuring thumbnails always reflect the page's current layers (background, overlays, text).
  renderPageToThumbnail(page, thumbW = 240) {
    const scale = thumbW / page.w;
    const thumbH = Math.round(page.h * scale);
    const off = document.createElement("canvas");
    off.width = Math.round(page.w * scale);
    off.height = thumbH;
    const ctx = off.getContext("2d");
    ctx.save();
    ctx.scale(scale, scale);

    // ensure white bg for thumbnail as well
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, page.w, page.h);

    page.draw(ctx);
    ctx.restore();
    return off.toDataURL("image/png");
  }
}
