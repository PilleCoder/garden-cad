# Slice 14: Undo/Redo System

## User Value

As a user, I need to undo and redo my actions so that I can experiment freely, correct mistakes instantly, and iterate on designs without fear of losing work or making irreversible changes.

## Slice Features

1. **Command pattern** - All mutations wrapped as reversible commands
2. **Undo operation** - Reverse last action (Ctrl+Z)
3. **Redo operation** - Reapply undone action (Ctrl+Y or Ctrl+Shift+Z)
4. **History stack** - Store up to 50 commands
5. **History limit** - Automatic pruning of oldest commands
6. **Undo/redo buttons** - UI buttons with enabled/disabled state
7. **History visualization** - Show list of recent actions
8. **Command grouping** - Batch related commands (e.g., multi-selection move)
9. **Clear history** - Reset stack on project load
10. **Keyboard shortcuts** - Standard undo/redo hotkeys
11. **Status feedback** - Display what was undone/redone

## Technical Implementation Sketch

### File Structure

```
src/
├── commands/
│   ├── Command.ts              # Command interface
│   ├── CommandHistory.ts       # History stack manager
│   ├── AddObjectCommand.ts     # Add geometry object
│   ├── DeleteObjectCommand.ts  # Delete object
│   ├── MoveObjectCommand.ts    # Move object
│   ├── ModifyObjectCommand.ts  # Change object properties
│   ├── AddLayerCommand.ts      # Layer management
│   └── CompositeCommand.ts     # Group multiple commands
├── ui/
│   └── HistoryPanel.ts         # History visualization
└── main.ts                     # Updated with undo/redo integration
```

### Core Concepts

**Command Interface**:
```typescript
interface Command {
  execute(): void;    // Perform the action
  undo(): void;       // Reverse the action
  redo(): void;       // Reapply after undo (usually same as execute)
  describe(): string; // Human-readable description
}
```

**History Stack**:
- Commands stored in array
- Current index tracks position
- Undo: index--, call undo()
- Redo: index++, call redo()
- New command: truncate forward history, push command

**Integration Pattern**:
Instead of direct mutations:
```typescript
// OLD: project.addObject(obj)
// NEW: 
const cmd = new AddObjectCommand(project, obj);
commandHistory.execute(cmd);
```

### src/commands/Command.ts

```typescript
export interface Command {
  /**
   * Execute the command (perform the action).
   */
  execute(): void;

  /**
   * Undo the command (reverse the action).
   */
  undo(): void;

  /**
   * Redo the command (reapply after undo).
   * Default implementation calls execute().
   */
  redo(): void;

  /**
   * Get a human-readable description of this command.
   */
  describe(): string;
}
```

### src/commands/CommandHistory.ts

```typescript
import { Command } from './Command';

export class CommandHistory {
  private history: Command[] = [];
  private currentIndex: number = -1;
  private maxHistory: number = 50;
  private onUpdate: () => void;

  constructor(onUpdate: () => void) {
    this.onUpdate = onUpdate;
  }

  /**
   * Execute a command and add it to history.
   */
  execute(command: Command): void {
    // Truncate forward history if we're in the middle
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Execute the command
    command.execute();

    // Add to history
    this.history.push(command);
    this.currentIndex++;

    // Prune if exceeds limit
    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.currentIndex--;
    }

    console.log(`Executed: ${command.describe()}`);
    this.onUpdate();
  }

  /**
   * Undo the last command.
   */
  undo(): boolean {
    if (!this.canUndo()) {
      console.log('Nothing to undo');
      return false;
    }

    const command = this.history[this.currentIndex];
    command.undo();
    this.currentIndex--;

    console.log(`Undone: ${command.describe()}`);
    this.onUpdate();
    return true;
  }

  /**
   * Redo the next command.
   */
  redo(): boolean {
    if (!this.canRedo()) {
      console.log('Nothing to redo');
      return false;
    }

    this.currentIndex++;
    const command = this.history[this.currentIndex];
    command.redo();

    console.log(`Redone: ${command.describe()}`);
    this.onUpdate();
    return true;
  }

  /**
   * Check if undo is available.
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is available.
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get the history for visualization.
   */
  getHistory(): Command[] {
    return this.history;
  }

  /**
   * Get the current index.
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Clear all history.
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    console.log('History cleared');
    this.onUpdate();
  }

  /**
   * Get description of next undo command.
   */
  getUndoDescription(): string | null {
    if (!this.canUndo()) return null;
    return this.history[this.currentIndex].describe();
  }

  /**
   * Get description of next redo command.
   */
  getRedoDescription(): string | null {
    if (!this.canRedo()) return null;
    return this.history[this.currentIndex + 1].describe();
  }

  /**
   * Set maximum history size.
   */
  setMaxHistory(max: number): void {
    this.maxHistory = max;
    // Prune if needed
    while (this.history.length > this.maxHistory) {
      this.history.shift();
      this.currentIndex--;
    }
  }
}
```

### src/commands/AddObjectCommand.ts

```typescript
import { Command } from './Command';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';

export class AddObjectCommand implements Command {
  private project: Project;
  private object: GeometryObject;

  constructor(project: Project, object: GeometryObject) {
    this.project = project;
    this.object = object;
  }

  execute(): void {
    this.project.addObject(this.object);
  }

  undo(): void {
    this.project.removeObject(this.object.id);
  }

  redo(): void {
    this.execute();
  }

  describe(): string {
    const name = this.object.metadata.name || this.object.id;
    return `Add ${this.object.geometry.type} "${name}"`;
  }
}
```

### src/commands/DeleteObjectCommand.ts

```typescript
import { Command } from './Command';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';

export class DeleteObjectCommand implements Command {
  private project: Project;
  private object: GeometryObject;

  constructor(project: Project, object: GeometryObject) {
    this.project = project;
    this.object = object;
  }

  execute(): void {
    this.project.removeObject(this.object.id);
  }

  undo(): void {
    this.project.addObject(this.object);
  }

  redo(): void {
    this.execute();
  }

  describe(): string {
    const name = this.object.metadata.name || this.object.id;
    return `Delete ${this.object.geometry.type} "${name}"`;
  }
}
```

### src/commands/MoveObjectCommand.ts

```typescript
import { Command } from './Command';
import { GeometryObject } from '../geometry/GeometryObject';
import { Point, GeometryType } from '../geometry/types';

export class MoveObjectCommand implements Command {
  private object: GeometryObject;
  private oldPosition: any;
  private newPosition: any;
  private delta: Point;

  constructor(object: GeometryObject, delta: Point) {
    this.object = object;
    this.delta = delta;
    this.oldPosition = this.capturePosition(object);
    this.newPosition = null;
  }

  execute(): void {
    this.applyDelta(this.delta);
    this.newPosition = this.capturePosition(this.object);
  }

  undo(): void {
    this.restorePosition(this.oldPosition);
  }

  redo(): void {
    this.restorePosition(this.newPosition);
  }

  describe(): string {
    const name = this.object.metadata.name || this.object.id;
    return `Move ${this.object.geometry.type} "${name}"`;
  }

  private capturePosition(obj: GeometryObject): any {
    const geom = obj.geometry;
    
    switch (geom.type) {
      case GeometryType.POINT:
        return { ...geom.point };
      
      case GeometryType.LINE:
        return {
          start: { ...geom.start },
          end: { ...geom.end }
        };
      
      case GeometryType.CIRCLE:
        return { ...geom.center };
      
      case GeometryType.POLYLINE:
      case GeometryType.POLYGON:
        return geom.points.map((p: Point) => ({ ...p }));
      
      default:
        return null;
    }
  }

  private restorePosition(position: any): void {
    const geom = this.object.geometry as any;
    
    switch (geom.type) {
      case GeometryType.POINT:
        geom.point = { ...position };
        break;
      
      case GeometryType.LINE:
        geom.start = { ...position.start };
        geom.end = { ...position.end };
        break;
      
      case GeometryType.CIRCLE:
        geom.center = { ...position };
        break;
      
      case GeometryType.POLYLINE:
      case GeometryType.POLYGON:
        geom.points = position.map((p: Point) => ({ ...p }));
        break;
    }
  }

  private applyDelta(delta: Point): void {
    const geom = this.object.geometry as any;
    
    switch (geom.type) {
      case GeometryType.POINT:
        geom.point.x += delta.x;
        geom.point.y += delta.y;
        break;
      
      case GeometryType.LINE:
        geom.start.x += delta.x;
        geom.start.y += delta.y;
        geom.end.x += delta.x;
        geom.end.y += delta.y;
        break;
      
      case GeometryType.CIRCLE:
        geom.center.x += delta.x;
        geom.center.y += delta.y;
        break;
      
      case GeometryType.POLYLINE:
      case GeometryType.POLYGON:
        geom.points.forEach((p: Point) => {
          p.x += delta.x;
          p.y += delta.y;
        });
        break;
    }
  }
}
```

### src/commands/ModifyObjectCommand.ts

```typescript
import { Command } from './Command';
import { GeometryObject } from '../geometry/GeometryObject';

export class ModifyObjectCommand implements Command {
  private object: GeometryObject;
  private property: string;
  private oldValue: any;
  private newValue: any;

  constructor(object: GeometryObject, property: string, newValue: any) {
    this.object = object;
    this.property = property;
    this.oldValue = this.getPropertyValue(property);
    this.newValue = newValue;
  }

  execute(): void {
    this.setPropertyValue(this.property, this.newValue);
  }

  undo(): void {
    this.setPropertyValue(this.property, this.oldValue);
  }

  redo(): void {
    this.execute();
  }

  describe(): string {
    const name = this.object.metadata.name || this.object.id;
    return `Modify ${this.property} of "${name}"`;
  }

  private getPropertyValue(property: string): any {
    const parts = property.split('.');
    let value: any = this.object;
    
    for (const part of parts) {
      value = value[part];
    }
    
    // Deep clone if object
    if (typeof value === 'object' && value !== null) {
      return JSON.parse(JSON.stringify(value));
    }
    
    return value;
  }

  private setPropertyValue(property: string, value: any): void {
    const parts = property.split('.');
    let target: any = this.object;
    
    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]];
    }
    
    const lastPart = parts[parts.length - 1];
    
    // Deep clone if object
    if (typeof value === 'object' && value !== null) {
      target[lastPart] = JSON.parse(JSON.stringify(value));
    } else {
      target[lastPart] = value;
    }
  }
}
```

### src/commands/CompositeCommand.ts

```typescript
import { Command } from './Command';

/**
 * Groups multiple commands into a single undoable unit.
 * Useful for batch operations like moving multiple selected objects.
 */
export class CompositeCommand implements Command {
  private commands: Command[];
  private description: string;

  constructor(commands: Command[], description: string) {
    this.commands = commands;
    this.description = description;
  }

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  redo(): void {
    for (const cmd of this.commands) {
      cmd.redo();
    }
  }

  describe(): string {
    return this.description;
  }

  getCommands(): Command[] {
    return this.commands;
  }
}
```

### src/ui/HistoryPanel.ts

```typescript
import { CommandHistory } from '../commands/CommandHistory';

export class HistoryPanel {
  private container: HTMLElement;
  private commandHistory: CommandHistory;

  constructor(commandHistory: CommandHistory) {
    this.commandHistory = commandHistory;
    this.container = this.createPanel();
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'history-panel';
    panel.style.cssText = `
      position: absolute;
      top: 220px;
      right: 10px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-family: Arial, sans-serif;
      font-size: 13px;
      max-width: 250px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 100;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'History';
    title.style.cssText = 'font-weight: bold; margin-bottom: 10px; font-size: 14px;';
    panel.appendChild(title);

    // History list
    const list = document.createElement('div');
    list.id = 'history-list';
    panel.appendChild(list);

    return panel;
  }

  update(): void {
    const list = this.container.querySelector('#history-list') as HTMLElement;
    if (!list) return;

    list.innerHTML = '';

    const history = this.commandHistory.getHistory();
    const currentIndex = this.commandHistory.getCurrentIndex();

    if (history.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No history';
      empty.style.cssText = 'color: #999; font-style: italic;';
      list.appendChild(empty);
      return;
    }

    history.forEach((cmd, index) => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 6px;
        margin-bottom: 4px;
        border-radius: 3px;
        cursor: pointer;
        ${index <= currentIndex ? 'color: #333;' : 'color: #999; text-decoration: line-through;'}
        ${index === currentIndex ? 'background: #e6f2ff; font-weight: bold;' : ''}
      `;
      item.textContent = `${index + 1}. ${cmd.describe()}`;
      
      // Click to jump to this point in history
      item.addEventListener('click', () => {
        while (this.commandHistory.getCurrentIndex() > index) {
          this.commandHistory.undo();
        }
        while (this.commandHistory.getCurrentIndex() < index) {
          this.commandHistory.redo();
        }
      });

      list.appendChild(item);
    });
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.container);
    this.update();
  }

  unmount(): void {
    this.container.remove();
  }
}
```

### Update src/tools/SelectTool.ts for undo

```typescript
import { MoveObjectCommand } from '../commands/MoveObjectCommand';
import { CommandHistory } from '../commands/CommandHistory';

export class SelectTool implements Tool {
  // ... existing fields ...
  private commandHistory: CommandHistory;

  constructor(
    // ... existing params ...
    commandHistory: CommandHistory
  ) {
    // ... existing initialization ...
    this.commandHistory = commandHistory;
  }

  // In onMouseUp, replace direct mutation with command:
  onMouseUp(event: ToolMouseEvent): void {
    if (this.isDragging && this.selection.hasSelection()) {
      const dx = event.worldPos.x - this.dragStart.x;
      const dy = event.worldPos.y - this.dragStart.y;
      
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        const selected = this.selection.getSelectedObjects();
        
        if (selected.length === 1) {
          // Single object move
          const cmd = new MoveObjectCommand(selected[0], { x: dx, y: dy });
          this.commandHistory.execute(cmd);
        } else {
          // Multiple objects - use composite command
          const commands = selected.map(obj => 
            new MoveObjectCommand(obj, { x: dx, y: dy })
          );
          const composite = new CompositeCommand(
            commands, 
            `Move ${selected.length} objects`
          );
          this.commandHistory.execute(composite);
        }
        
        this.onUpdate();
      }
    }
    
    this.isDragging = false;
  }
}
```

### Update drawing tools for undo

```typescript
// In PointTool, LineTool, CircleTool, etc.:
import { AddObjectCommand } from '../commands/AddObjectCommand';
import { CommandHistory } from '../commands/CommandHistory';

// Replace:
// this.project.addObject(obj);

// With:
const cmd = new AddObjectCommand(this.project, obj);
this.commandHistory.execute(cmd);
```

### src/main.ts (undo/redo integration)

```typescript
import { CommandHistory } from './commands/CommandHistory';
import { HistoryPanel } from './ui/HistoryPanel';

// Create command history
const commandHistory = new CommandHistory(() => {
  updateView();
  historyPanel.update();
  updateUndoRedoButtons();
});

// Create history panel
const historyPanel = new HistoryPanel(commandHistory);
historyPanel.mount(document.body);

// Add undo/redo buttons to toolbar
const undoBtn = document.createElement('button');
undoBtn.id = 'undo-btn';
undoBtn.textContent = '↶ Undo';
undoBtn.title = 'Undo (Ctrl+Z)';
undoBtn.style.cssText = 'margin-left: 20px;';
undoBtn.disabled = true;
undoBtn.addEventListener('click', () => {
  commandHistory.undo();
});
document.querySelector('.toolbar')?.appendChild(undoBtn);

const redoBtn = document.createElement('button');
redoBtn.id = 'redo-btn';
redoBtn.textContent = '↷ Redo';
redoBtn.title = 'Redo (Ctrl+Y)';
redoBtn.disabled = true;
redoBtn.addEventListener('click', () => {
  commandHistory.redo();
});
document.querySelector('.toolbar')?.appendChild(redoBtn);

function updateUndoRedoButtons(): void {
  undoBtn.disabled = !commandHistory.canUndo();
  redoBtn.disabled = !commandHistory.canRedo();
  
  // Update tooltips with descriptions
  const undoDesc = commandHistory.getUndoDescription();
  undoBtn.title = undoDesc ? `Undo: ${undoDesc} (Ctrl+Z)` : 'Undo (Ctrl+Z)';
  
  const redoDesc = commandHistory.getRedoDescription();
  redoBtn.title = redoDesc ? `Redo: ${redoDesc} (Ctrl+Y)` : 'Redo (Ctrl+Y)';
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Undo: Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    commandHistory.undo();
  }
  
  // Redo: Ctrl+Y or Ctrl+Shift+Z
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    commandHistory.redo();
  }
});

// Pass commandHistory to all tools
const selectTool = new SelectTool(
  // ... existing params ...
  commandHistory
);

const pointTool = new PointTool(
  // ... existing params ...
  commandHistory
);

// ... same for all other tools ...

// Clear history when loading a project
function loadProject(data: any) {
  commandHistory.clear();
  // ... existing load logic ...
}

// Delete key support (with undo)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' && activeTool === 'select') {
    const selected = selection.getSelectedObjects();
    if (selected.length > 0) {
      if (selected.length === 1) {
        const cmd = new DeleteObjectCommand(project, selected[0]);
        commandHistory.execute(cmd);
      } else {
        const commands = selected.map(obj => new DeleteObjectCommand(project, obj));
        const composite = new CompositeCommand(commands, `Delete ${selected.length} objects`);
        commandHistory.execute(composite);
      }
      selection.clear();
      updateView();
    }
  }
});

console.log('Undo/Redo system loaded. Shortcuts: Ctrl+Z (undo), Ctrl+Y (redo)');
```

### CSS Styling

```css
#undo-btn:disabled,
#redo-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

#undo-btn:not(:disabled):hover,
#redo-btn:not(:disabled):hover {
  background: #e6f2ff;
}

#history-list div:hover {
  background: #f0f0f0;
}
```

## Test Plan

### Manual Testing Steps

1. **Basic undo test**
   - Create a point at (100, 100)
   - Press Ctrl+Z
   - Verify point disappears
   - Verify console shows "Undone: Add point..."

2. **Basic redo test**
   - After undoing point creation
   - Press Ctrl+Y
   - Verify point reappears at same location
   - Verify console shows "Redone: Add point..."

3. **Multiple undo test**
   - Create 5 different objects (point, line, circle, etc.)
   - Press Ctrl+Z five times
   - Verify all objects removed in reverse order
   - Verify each undo logged to console

4. **Undo/redo buttons test**
   - Start with empty canvas
   - Verify Undo button disabled
   - Verify Redo button disabled
   - Create an object
   - Verify Undo button enabled
   - Undo the creation
   - Verify Redo button enabled

5. **Move undo test**
   - Create point at (0, 0)
   - Move it to (100, 100)
   - Press Ctrl+Z
   - Verify point returns to (0, 0)
   - Press Ctrl+Y
   - Verify point moves back to (100, 100)

6. **Delete undo test**
   - Create several objects
   - Select one object
   - Press Delete key
   - Verify object deleted
   - Press Ctrl+Z
   - Verify object restored

7. **Multi-selection move undo test**
   - Create 3 objects
   - Select all (drag selection box)
   - Move them together
   - Press Ctrl+Z
   - Verify all 3 return to original positions
   - Press Ctrl+Y
   - Verify all 3 move back together

8. **History truncation test**
   - Perform 10 actions
   - Undo 5 actions (back to action 5)
   - Perform new action
   - Verify forward history (actions 6-10) erased
   - Cannot redo actions 6-10

9. **History limit test**
   - Set history limit to 5
   - Perform 10 actions
   - Press Ctrl+Z 5 times
   - Verify can only undo 5 actions
   - Verify oldest 5 actions pruned

10. **History panel test**
    - Open history panel
    - Perform 5 different actions
    - Verify 5 items in list
    - Verify current action highlighted
    - Undo 2 actions
    - Verify last 2 items grayed out

11. **History panel navigation test**
    - Build history with 10 actions
    - Click on action #5 in history panel
    - Verify state jumps to action #5
    - Verify actions 6-10 grayed out
    - Click action #8
    - Verify state jumps to #8

12. **Keyboard shortcut test**
    - Test Ctrl+Z (undo)
    - Test Ctrl+Y (redo)
    - Test Ctrl+Shift+Z (alternate redo)
    - Verify all work correctly

13. **Command descriptions test**
    - Create point
    - Verify description: "Add point ..."
    - Move point
    - Verify description: "Move point ..."
    - Delete point
    - Verify description: "Delete point ..."
    - Hover undo button
    - Verify tooltip shows specific action

14. **Clear history on load test**
    - Build up history (10 actions)
    - Save project
    - Load project
    - Verify history cleared
    - Verify undo button disabled

15. **Complex workflow test**
    - Create 5 objects
    - Move 2 objects
    - Delete 1 object
    - Create 3 more objects
    - Undo all actions in reverse
    - Verify each undo correct
    - Redo all actions
    - Verify final state matches initial

## Acceptance Criteria

- [ ] Command interface defined (execute/undo/redo/describe)
- [ ] CommandHistory class manages stack
- [ ] AddObjectCommand implemented
- [ ] DeleteObjectCommand implemented
- [ ] MoveObjectCommand implemented
- [ ] ModifyObjectCommand implemented
- [ ] CompositeCommand for batch operations
- [ ] Undo button in toolbar
- [ ] Redo button in toolbar
- [ ] Buttons enabled/disabled based on state
- [ ] Ctrl+Z performs undo
- [ ] Ctrl+Y performs redo
- [ ] Ctrl+Shift+Z performs redo (alternate)
- [ ] History limited to 50 commands (configurable)
- [ ] Old commands pruned when limit exceeded
- [ ] Forward history truncated on new action
- [ ] HistoryPanel visualizes command list
- [ ] Current command highlighted in panel
- [ ] Click history item to jump to that state
- [ ] Undone commands grayed out in panel
- [ ] Command descriptions human-readable
- [ ] Console logs undo/redo actions
- [ ] All tools integrated with command system
- [ ] Multi-selection moves use CompositeCommand
- [ ] Delete key uses DeleteObjectCommand
- [ ] History cleared on project load
- [ ] No TypeScript compilation errors

## Deliverables

1. **src/commands/Command.ts** - Command interface
2. **src/commands/CommandHistory.ts** - History stack manager
3. **src/commands/AddObjectCommand.ts** - Add object command
4. **src/commands/DeleteObjectCommand.ts** - Delete object command
5. **src/commands/MoveObjectCommand.ts** - Move object command
6. **src/commands/ModifyObjectCommand.ts** - Modify properties command
7. **src/commands/CompositeCommand.ts** - Batch command wrapper
8. **src/ui/HistoryPanel.ts** - History visualization panel
9. **Updated all tools** - Integration with CommandHistory
10. **Updated src/main.ts** - Undo/redo UI, keyboard shortcuts, history panel
11. **Working undo/redo system** - Full integration with all mutations

---

**Estimated effort**: 4-5 hours  
**Dependencies**: All previous slices (integrates with all tools)  
**Risk**: Medium - requires refactoring all mutation points, careful state management
