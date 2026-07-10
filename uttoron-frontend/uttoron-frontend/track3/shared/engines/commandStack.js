/* Command-pattern undo/redo stack (spec §2.7 / Lesson 2 Module 3).
   Every edit is pushed as a { label, do(), undo() } command rather than
   a snapshot, so history can be stepped through in either direction. */
(function (global) {
    "use strict";

    function CommandStack() {
        this.undoStack = [];
        this.redoStack = [];
    }

    CommandStack.prototype.do = function (command) {
        command.do();
        this.undoStack.push(command);
        this.redoStack = [];
    };

    CommandStack.prototype.undo = function () {
        const cmd = this.undoStack.pop();
        if (!cmd) return null;
        cmd.undo();
        this.redoStack.push(cmd);
        return cmd;
    };

    CommandStack.prototype.redo = function () {
        const cmd = this.redoStack.pop();
        if (!cmd) return null;
        cmd.do();
        this.undoStack.push(cmd);
        return cmd;
    };

    CommandStack.prototype.canUndo = function () { return this.undoStack.length > 0; };
    CommandStack.prototype.canRedo = function () { return this.redoStack.length > 0; };
    CommandStack.prototype.history = function () { return this.undoStack.map(function (c) { return c.label; }); };

    global.T3 = global.T3 || {};
    global.T3.CommandStack = CommandStack;
})(window);
