export class CommandBase {
  constructor(name = "cmd") {
    this.name = name;
  }
  execute() {}
  undo() {}
}
