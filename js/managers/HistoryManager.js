// FILE: js/managers/HistoryManager.js
export class HistoryManager {
  constructor(maxSize = 200) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
  }

  execute(command) {
    if (!command || typeof command.execute !== "function") return;
    command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
    // only clear redo when user performs a brand-new action (execute)
    this.redoStack.length = 0;
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    if (typeof cmd.undo === "function") cmd.undo();
    this.redoStack.push(cmd);
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    // Re-execute command but do NOT call history.execute() (that would clear redoStack).
    if (typeof cmd.execute === "function") cmd.execute();
    this.undoStack.push(cmd);
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
  canUndo() {
    return this.undoStack.length > 0;
  }
  canRedo() {
    return this.redoStack.length > 0;
  }
}
