// FILE: js/models/ImageLayer.js
import { Layer } from "./Layer.js";

export class ImageLayer extends Layer {
  constructor() {
    super();
    this.type = "image";
    this.imageDataUrl = null;
    this._image = null; // Image instance
    this.width = 200;
    this.height = 200;
    this.opacity = 1;
    this.isBackground = false;
    this.angle = 0; // degrees
  }

  setImageFromDataUrl(dataUrl) {
    this.imageDataUrl = dataUrl;
    const img = new Image();
    img.onload = () => {
      this._image = img;
      if (!this.isBackground) {
        const maxW = 600;
        const maxH = 800;
        const ar = img.width / img.height;
        if (img.width > maxW) {
          this.width = maxW;
          this.height = Math.round(maxW / ar);
        } else if (img.height > maxH) {
          this.height = maxH;
          this.width = Math.round(maxH * ar);
        } else {
          this.width = img.width;
          this.height = img.height;
        }
      }
      try {
        window.dispatchEvent(
          new CustomEvent("layer:imageLoaded", { detail: { layerId: this.id } })
        );
      } catch (e) {}
    };
    img.src = dataUrl;
  }

  setImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.setImageFromDataUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  draw(ctx) {
    if (!this.visible) return;
    if (!this._image) return;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const rad = ((this.angle || 0) * Math.PI) / 180;
    ctx.translate(cx, cy);
    ctx.rotate(rad);
    ctx.drawImage(
      this._image,
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height
    );
    ctx.restore();
  }

  measure() {
    // return axis-aligned bounding box (unenclosed) — used for layout, snapping, thumbnails
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }

  contains(point) {
    // inverse-rotate the point around center and test axis-aligned
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const rad = (-(this.angle || 0) * Math.PI) / 180;
    const dx = point.x - cx,
      dy = point.y - cy;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    const localX = rx + this.width / 2;
    const localY = ry + this.height / 2;
    return (
      localX >= 0 &&
      localX <= this.width &&
      localY >= 0 &&
      localY <= this.height
    );
  }
}
