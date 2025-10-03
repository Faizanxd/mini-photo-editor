export class ResizeLayerCommand {
  constructor(project, pageIndex, layerId, fromSize, toSize) {
    this.project = project;
    this.pageIndex = pageIndex;
    this.layerId = layerId;
    this.from = { x: fromSize.x, y: fromSize.y, w: fromSize.w, h: fromSize.h };
    this.to = { x: toSize.x, y: toSize.y, w: toSize.w, h: toSize.h };
  }

  execute() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    const layer = page.layers.find((l) => l.id === this.layerId);
    if (!layer) return;
    layer.x = this.to.x;
    layer.y = this.to.y;
    layer.width = this.to.w;
    layer.height = this.to.h;
  }

  undo() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    const layer = page.layers.find((l) => l.id === this.layerId);
    if (!layer) return;
    layer.x = this.from.x;
    layer.y = this.from.y;
    layer.width = this.from.w;
    layer.height = this.from.h;
  }
}
