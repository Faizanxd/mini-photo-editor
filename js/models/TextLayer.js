// FILE: js/models/TextLayer.js
import { Layer } from "./Layer.js";
export class TextLayer extends Layer {
  constructor(text = "New text") {
    super();
    this.type = "text";
    this.text = text;
    // NOTE: x,y are used as the alignment *anchor*:
    //  - align = 'left'   -> x is the left edge of the text box
    //  - align = 'center' -> x is the center of the text box
    //  - align = 'right'  -> x is the right edge of the text box
    this.x = 50;
    this.y = 50;
    this.fontFamily = "sans-serif";
    this.fontSize = 48;
    this.color = "#ffffff";
    this.align = "left"; // 'left' | 'center' | 'right'
    this.bold = false;
    this.italic = false;
    this.angle = 0; // degrees
    this.visible = true;
  }

  getFontString() {
    const style = (this.italic ? "italic " : "") + (this.bold ? "bold " : "");
    return `${style}${this.fontSize}px ${this.fontFamily}`.trim();
  }

  /**
   * measure(ctx)
   * returns axis-aligned bounding box { x, y, w, h } where x,y are the TOP-LEFT
   * of the drawn text box. This is used throughout for hit-testing, snapping, thumbnails.
   *
   * Important: layer.x is treated as an anchor depending on this.align; measure computes
   * the top-left accordingly so other systems keep working.
   */
  measure(ctx) {
    ctx = ctx || document.createElement("canvas").getContext("2d");
    ctx.save();
    ctx.font = this.getFontString();
    const metrics = ctx.measureText(this.text || "");
    const width = Math.max(0, metrics.width || 0);
    const height = this.fontSize;
    ctx.restore();

    let leftX;
    if (this.align === "center") {
      // x is center
      leftX = this.x - width / 2;
    } else if (this.align === "right") {
      // x is right
      leftX = this.x - width;
    } else {
      // left
      leftX = this.x;
    }

    // clamp (keep numbers finite)
    leftX = Number.isFinite(leftX) ? leftX : 0;
    const topY = this.y;

    return { x: leftX, y: topY, w: width, h: height };
  }

  contains(point, ctx) {
    const box = this.measure(ctx);
    // inverse-rotate the point around center and test axis-aligned
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

    // rotate around center
    ctx.translate(cx, cy);
    ctx.rotate(rad);

    // Choose textAlign and x offset relative to center so alignment draws correctly
    // We'll draw vertically so top aligns with -box.h/2
    if (this.align === "center") {
      ctx.textAlign = "center";
      ctx.fillText(this.text || "", 0, -box.h / 2);
    } else if (this.align === "right") {
      ctx.textAlign = "right";
      ctx.fillText(this.text || "", box.w / 2, -box.h / 2);
    } else {
      // left
      ctx.textAlign = "left";
      ctx.fillText(this.text || "", -box.w / 2, -box.h / 2);
    }

    ctx.restore();
  }
}
