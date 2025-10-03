export class EditTextCommand {
  constructor(project, pageIndex, layerId, oldText, newText) {
    this.project = project;
    this.pageIndex = pageIndex;
    this.layerId = layerId;
    this.oldText = oldText;
    this.newText = newText;
  }
  execute() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    const layer = page.layers.find((l) => l.id === this.layerId);
    if (!layer) return;
    layer.text = this.newText;
  }
  undo() {
    const page = this.project.pages[this.pageIndex];
    if (!page) return;
    const layer = page.layers.find((l) => l.id === this.layerId);
    if (!layer) return;
    layer.text = this.oldText;
  }
}
