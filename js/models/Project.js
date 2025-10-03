import { Page } from "./Page.js";
import { TextLayer } from "./TextLayer.js";
import { ImageLayer } from "./ImageLayer.js";

export class Project {
  constructor() {
    this.id = "project_" + Math.random().toString(36).slice(2, 9);
    this.title = "";
    this.pages = [new Page(undefined, 900, 1600)];
    this.activePageIndex = 0;
    this.createdAt = Date.now();
  }

  addPage() {
    const p = new Page();
    this.pages.push(p);
    return p;
  }

  addPageFromFile(file) {
    const p = new Page();
    this.pages.push(p);

    const reader = new FileReader();
    reader.onload = (ev) => {
      p.setBackgroundFromDataUrl(ev.target.result);
      window.dispatchEvent(
        new CustomEvent("project:pageImageLoaded", { detail: { pageId: p.id } })
      );
    };
    reader.readAsDataURL(file);

    return p.id;
  }

  get activePage() {
    return this.pages[this.activePageIndex];
  }

  removePageByIndex(index) {
    if (index < 0 || index >= this.pages.length) return false;
    this.pages.splice(index, 1);
    if (this.activePageIndex >= this.pages.length)
      this.activePageIndex = Math.max(0, this.pages.length - 1);
    return true;
  }
  findPageIndexById(id) {
    return this.pages.findIndex((p) => p.id === id);
  }

  // serialize project -> plain object
  toObject() {
    return {
      id: this.id,
      title: this.title || "",
      createdAt: this.createdAt,
      pages: this.pages.map((pg) => ({
        w: pg.w,
        h: pg.h,
        layers: pg.layers.map((l) => {
          if (l.type === "text")
            return {
              __type: "text",
              ...{
                id: l.id,
                x: l.x,
                y: l.y,
                zIndex: l.zIndex,
                visible: l.visible,
                text: l.text,
                fontFamily: l.fontFamily,
                fontSize: l.fontSize,
                color: l.color,
                align: l.align,
                bold: l.bold,
                italic: l.italic,
              },
            };
          if (l.type === "image")
            return {
              __type: "image",
              ...{
                id: l.id,
                x: l.x,
                y: l.y,
                zIndex: l.zIndex,
                visible: l.visible,
                imageDataUrl: l.imageDataUrl || null,
                width: l.width,
                height: l.height,
                opacity: l.opacity,
                isBackground: l.isBackground || false,
              },
            };
          // fallback: minimal
          return { __type: "layer", id: l.id, type: l.type };
        }),
      })),
      activePageIndex: this.activePageIndex,
    };
  }

  // restore from object
  static fromObject(obj) {
    const proj = new Project();
    proj.id = obj.id || proj.id;
    proj.title = obj.title || "";
    proj.createdAt = obj.createdAt || Date.now();
    proj.pages = [];
    if (Array.isArray(obj.pages)) {
      for (const pgObj of obj.pages) {
        const pg = new Page(undefined, pgObj.w || 900, pgObj.h || 1600);
        if (Array.isArray(pgObj.layers)) {
          for (const lobj of pgObj.layers) {
            if (lobj.__type === "text") {
              const t = new TextLayer(lobj.text || "");
              t.id = lobj.id || t.id;
              t.x = lobj.x || 0;
              t.y = lobj.y || 0;
              t.zIndex = lobj.zIndex || 0;
              t.visible = lobj.visible !== false;
              t.fontFamily = lobj.fontFamily || "sans-serif";
              t.fontSize = lobj.fontSize || 48;
              t.color = lobj.color || "#ffffff";
              t.align = lobj.align || "left";
              t.bold = !!lobj.bold;
              t.italic = !!lobj.italic;
              pg.addLayer(t);
            } else if (lobj.__type === "image") {
              const im = new ImageLayer();
              im.id = lobj.id || im.id;
              im.x = lobj.x || 0;
              im.y = lobj.y || 0;
              im.zIndex = lobj.zIndex || 0;
              im.visible = lobj.visible !== false;
              im.width = lobj.width || 200;
              im.height = lobj.height || 200;
              im.opacity = lobj.opacity != null ? lobj.opacity : 1;
              im.isBackground = !!lobj.isBackground;
              if (lobj.imageDataUrl) {
                im.setImageFromDataUrl(lobj.imageDataUrl);
              }
              pg.addLayer(im);
            } else {
              // unknown -> ignore
            }
          }
        }
        proj.pages.push(pg);
      }
    }
    proj.activePageIndex = Math.min(
      Math.max(0, obj.activePageIndex || 0),
      proj.pages.length - 1
    );
    return proj;
  }
}
