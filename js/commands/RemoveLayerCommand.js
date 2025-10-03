export class RemoveLayerCommand {
  constructor(project, pageIndex, layerId) {
    this.project = project;
    this.pageIndex = pageIndex;
    this.layerId = layerId;
    this._removedLayer = null;
    this._removedIndex = -1;
  }

  execute() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    const idx = page.layers.findIndex((l) => l.id === this.layerId);
    if (idx === -1) return;
    this._removedLayer = page.layers[idx];
    this._removedIndex = idx;
    page.layers.splice(idx, 1);
  }

  undo() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    if (this._removedLayer) {
      page.layers.splice(
        Math.min(this._removedIndex, page.layers.length),
        0,
        this._removedLayer
      );
      page.sortByZ();
    }
  }
}
