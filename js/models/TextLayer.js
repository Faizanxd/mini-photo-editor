// FILE: js/models/TextLayer.js
import { Layer } from "./Layer.js";
export class TextLayer extends Layer {
  constructor(text = "New text") {
    super();
    this.type = "text";
    this.text = text;
    this.fontFamily = "sans-serif";
    this.fontSize = 48;
    this.color = "#ffffff";
    this.align = "left";
    this.bold = false;
    this.italic = false;
    this.angle = 0; // degrees
  }

  getFontString() {
    const style = (this.italic ? "italic " : "") + (this.bold ? "bold " : "");
    return `${style}${this.fontSize}px ${this.fontFamily}`.trim();
  }

  measure(ctx) {
    // measure width and height for the text (axis-aligned box before rotation)
    ctx = ctx || document.createElement("canvas").getContext("2d");
    ctx.save();
    ctx.font = this.getFontString();
    const metrics = ctx.measureText(this.text || "");
    const width = Math.max(0, metrics.width || 0);
    const height = this.fontSize;
    ctx.restore();

    let leftX = this.x;
    if (this.align === "center") leftX = this.x - width / 2;
    if (this.align === "right") leftX = this.x - width;
    // We store x,y as top-left-like for the box (y is top)
    return { x: leftX, y: this.y, w: width, h: height };
  }

  contains(point, ctx) {
    const box = this.measure(ctx);
    // inverse-rotate point and test
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const rad = (-(this.angle || 0) * Math.PI) / 180;
    const dx = point.x - cx,
      dy = point.y - cy;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    const localX = rx + box.w / 2;
    const localY = ry + box.h / 2;
    return localX >= 0 && localX <= box.w && localY >= 0 && localY <= box.h;
  }

  draw(ctx) {
    if (!this.visible) return;
    ctx.save();
    ctx.font = this.getFontString();
    ctx.fillStyle = this.color;
    ctx.textBaseline = "top";

    const box = this.measure(ctx);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const rad = ((this.angle || 0) * Math.PI) / 180;

    ctx.translate(cx, cy);
    ctx.rotate(rad);
    ctx.textAlign = "left";

    // draw text at -width/2, -height/2 so it's centered in the rotated frame
    ctx.fillText(this.text || "", -box.w / 2, -box.h / 2);
    ctx.restore();
  }
}
