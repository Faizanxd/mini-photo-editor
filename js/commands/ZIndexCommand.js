/* FILE: js/commands/ZIndexCommand.js */
export class ZIndexCommand {
  constructor(project, pageIndex, layerId, oldZ, newZ) {
    this.project = project;
    this.pageIndex = pageIndex;
    this.layerId = layerId;
    this.oldZ = oldZ;
    this.newZ = newZ;
  }
  execute() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    const layer = page.layers.find((l) => l.id === this.layerId);
    if (!layer) return;
    layer.zIndex = this.newZ;
    page.sortByZ();
  }
  undo() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    const layer = page.layers.find((l) => l.id === this.layerId);
    if (!layer) return;
    layer.zIndex = this.oldZ;
    page.sortByZ();
  }
}
