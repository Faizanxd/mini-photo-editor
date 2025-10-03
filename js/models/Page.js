// FILE: js/models/Page.js
import { ImageLayer } from "./ImageLayer.js";

export class Page {
  constructor(id, w = 900, h = 1600) {
    this.id = id || "page_" + Math.random().toString(36).slice(2, 9);
    this.layers = [];
    this.w = w;
    this.h = h;
    this.background = "#000000";
    this.backgroundDataUrl = null;
    this.backgroundLayer = null; // will hold ImageLayer if a background image is set
  }

  // Set the page background using an ImageLayer so it can be resized/selected
  setBackgroundFromDataUrl(dataUrl) {
    this.backgroundDataUrl = dataUrl;

    // Remove existing background layer if any
    if (this.backgroundLayer) {
      const idx = this.layers.findIndex(
        (l) => l.id === this.backgroundLayer.id
      );
      if (idx !== -1) this.layers.splice(idx, 1);
      this.backgroundLayer = null;
    }

    const bg = new ImageLayer();
    bg.isBackground = true;
    bg.zIndex = -10000; // ensure it renders beneath everything
    // size to page by default
    bg.x = 0;
    bg.y = 0;
    bg.width = this.w;
    bg.height = this.h;
    // load image
    bg.setImageFromDataUrl(dataUrl);

    // insert and keep it in the layers list
    this.layers.push(bg);
    this.backgroundLayer = bg;
    this.sortByZ();

    // when the image's Image object finishes loading the ImageLayer will dispatch
    // 'layer:imageLoaded' which the app listens for to re-render.
  }

  addLayer(layer) {
    this.layers.push(layer);
    this.sortByZ();
  }

  removeLayer(id) {
    this.layers = this.layers.filter((l) => l.id !== id);
    if (this.backgroundLayer && this.backgroundLayer.id === id)
      this.backgroundLayer = null;
  }

  sortByZ() {
    this.layers.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }

  draw(ctx) {
    ctx.save();
    // If the backgroundLayer exists it will be drawn as part of layers (since it's in layers)
    if (!this.backgroundLayer) {
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    for (const layer of this.layers) {
      layer.draw(ctx);
    }
    ctx.restore();
  }
}
