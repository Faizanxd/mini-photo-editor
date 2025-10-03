export class Layer {
  constructor(id) {
    this.id = id || "layer_" + Math.random().toString(36).slice(2, 9);
    this.x = 0;
    this.y = 0;
    this.zIndex = 0;
    this.visible = true;
    this.type = "layer";
  }

  draw(ctx) {}
  contains(point) {
    return false;
  }
  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      zIndex: this.zIndex,
      visible: this.visible,
      type: this.type,
    };
  }
}
