export class MoveLayerCommand {
  constructor(project, pageIndex, layerId, fromPos, toPos) {
    this.project = project;
    this.pageIndex = pageIndex;
    this.layerId = layerId;
    this.from = { x: fromPos.x, y: fromPos.y };
    this.to = { x: toPos.x, y: toPos.y };
  }

  execute() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    const layer = page.layers.find((l) => l.id === this.layerId);
    if (!layer) return;
    layer.x = this.to.x;
    layer.y = this.to.y;
  }

  undo() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    const layer = page.layers.find((l) => l.id === this.layerId);
    if (!layer) return;
    layer.x = this.from.x;
    layer.y = this.from.y;
  }
}
