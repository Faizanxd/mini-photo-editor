export class ChangePropCommand {
  constructor(project, pageIndex, layerId, propName, oldValue, newValue) {
    this.project = project;
    this.pageIndex = pageIndex;
    this.layerId = layerId;
    this.propName = propName;
    this.oldValue = oldValue;
    this.newValue = newValue;
  }
  execute() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    const layer = page.layers.find((l) => l.id === this.layerId);
    if (!layer) return;
    layer[this.propName] = this.newValue;
  }
  undo() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    const layer = page.layers.find((l) => l.id === this.layerId);
    if (!layer) return;
    layer[this.propName] = this.oldValue;
  }
}
