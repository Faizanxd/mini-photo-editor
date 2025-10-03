export class AddLayerCommand {
  constructor(project, pageIndex, layer) {
    this.project = project;
    this.pageIndex = pageIndex;
    this.layer = layer;
  }

  execute() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    // avoid duplicate add
    if (!page.layers.find((l) => l.id === this.layer.id)) {
      page.addLayer(this.layer);
    }
  }

  undo() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    page.removeLayer(this.layer.id);
  }
}
