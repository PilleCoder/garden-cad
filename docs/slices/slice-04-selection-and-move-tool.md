# Slice 4: Selection and Move Tool

## User Value

As a user, I need to select and move geometry objects with my mouse so that I can adjust the layout of my garden plan and position elements precisely.

## Slice Features

1. **Click to select objects** - single object selection with visual feedback
2. **Selection highlight** - selected objects show distinct visual state
3. **Drag to move** - click and drag selected objects to new positions
4. **Live coordinate preview** - display object coordinates during drag
5. **Precise positioning** - maintain centimeter-level accuracy during moves
6. **Deselection** - click empty space to clear selection
7. **Selection state persistence** - selection survives pan/zoom operations
8. **Mouse cursor feedback** - cursor changes on hover and during drag

## Technical Implementation Sketch

### File Structure

```
src/
├── tools/
│   ├── Tool.ts               # Base tool interface
│   ├── ToolManager.ts        # Tool switching and coordination
│   └── SelectTool.ts         # Selection and move implementation
├── selection/
│   ├── Selection.ts          # Selection state management
│   └── SelectionRenderer.ts  # Visual selection indicators
├── viewport/
│   └── Viewport.ts           # Updated with tool integration
└── main.ts                   # Updated with tool initialization
```

### Core Concepts

**Tool Pattern**:
- Each tool (Select, Draw, Measure) implements a common `Tool` interface
- ToolManager coordinates active tool and routes events
- Tools receive world coordinates (not screen coordinates)

**Selection Model**:
- Tracks currently selected object IDs
- Emits events on selection change
- Supports single selection (multi-selection in future slice)

**Hit Testing**:
- Convert mouse click to world coordinates
- Test each object's geometry for intersection
- Use appropriate hit test algorithm per geometry type

### src/tools/Tool.ts

```typescript
import { Point } from '../types/geometry';

export interface ToolMouseEvent {
  worldPos: Point;
  screenPos: Point;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

export interface Tool {
  readonly name: string;
  
  // Lifecycle
  onActivate(): void;
  onDeactivate(): void;
  
  // Mouse events (world coordinates provided)
  onMouseDown(event: ToolMouseEvent): void;
  onMouseMove(event: ToolMouseEvent): void;
  onMouseUp(event: ToolMouseEvent): void;
  onMouseClick(event: ToolMouseEvent): void;
  
  // Cursor
  getCursor(): string;
}
```

### src/tools/ToolManager.ts

```typescript
import { Tool } from './Tool';
import { ViewportTransform } from '../viewport/ViewportTransform';

export class ToolManager {
  private activeTool: Tool | null = null;
  private svg: SVGSVGElement;
  private transform: ViewportTransform;

  constructor(svg: SVGSVGElement, transform: ViewportTransform) {
    this.svg = svg;
    this.transform = transform;
    this.attachEventListeners();
  }

  setActiveTool(tool: Tool): void {
    if (this.activeTool) {
      this.activeTool.onDeactivate();
    }
    this.activeTool = tool;
    if (this.activeTool) {
      this.activeTool.onActivate();
      this.updateCursor();
    }
  }

  getActiveTool(): Tool | null {
    return this.activeTool;
  }

  private attachEventListeners(): void {
    this.svg.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.svg.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.svg.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.svg.addEventListener('click', this.handleClick.bind(this));
  }

  private convertMouseEvent(e: MouseEvent) {
    const rect = this.svg.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = this.transform.screenToWorld(screenX, screenY);

    return {
      worldPos,
      screenPos: { x: screenX, y: screenY },
      button: e.button,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey
    };
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.activeTool) return;
    if (e.shiftKey || e.button === 1) return; // Let viewport handle pan
    
    const toolEvent = this.convertMouseEvent(e);
    this.activeTool.onMouseDown(toolEvent);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.activeTool) return;
    const toolEvent = this.convertMouseEvent(e);
    this.activeTool.onMouseMove(toolEvent);
    this.updateCursor();
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.activeTool) return;
    const toolEvent = this.convertMouseEvent(e);
    this.activeTool.onMouseUp(toolEvent);
  }

  private handleClick(e: MouseEvent): void {
    if (!this.activeTool) return;
    if (e.shiftKey || e.button === 1) return;
    
    const toolEvent = this.convertMouseEvent(e);
    this.activeTool.onMouseClick(toolEvent);
  }

  private updateCursor(): void {
    if (this.activeTool) {
      this.svg.style.cursor = this.activeTool.getCursor();
    }
  }
}
```

### src/selection/Selection.ts

```typescript
export type SelectionChangeListener = (selectedIds: Set<string>) => void;

export class Selection {
  private selectedIds: Set<string> = new Set();
  private listeners: SelectionChangeListener[] = [];

  select(objectId: string): void {
    this.selectedIds.clear();
    this.selectedIds.add(objectId);
    this.notifyListeners();
  }

  deselect(): void {
    this.selectedIds.clear();
    this.notifyListeners();
  }

  isSelected(objectId: string): boolean {
    return this.selectedIds.has(objectId);
  }

  getSelectedIds(): Set<string> {
    return new Set(this.selectedIds);
  }

  hasSelection(): boolean {
    return this.selectedIds.size > 0;
  }

  getFirstSelected(): string | null {
    return this.selectedIds.size > 0 ? Array.from(this.selectedIds)[0] : null;
  }

  onChange(listener: SelectionChangeListener): void {
    this.listeners.push(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.getSelectedIds());
    }
  }
}
```

### src/selection/SelectionRenderer.ts

```typescript
import { Project } from '../model/Project';
import { Selection } from './Selection';
import { GeometryType } from '../geometry/types';

export class SelectionRenderer {
  private selectionGroup: SVGGElement;
  private selection: Selection;
  private project: Project;

  constructor(worldGroup: SVGGElement, selection: Selection, project: Project) {
    this.selection = selection;
    this.project = project;
    
    // Create selection overlay group
    this.selectionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.selectionGroup.id = 'selection';
    worldGroup.appendChild(this.selectionGroup);

    // Listen to selection changes
    this.selection.onChange(() => this.render());
  }

  render(zoom: number = 1): void {
    // Clear existing selection indicators
    while (this.selectionGroup.firstChild) {
      this.selectionGroup.removeChild(this.selectionGroup.firstChild);
    }

    const selectedIds = this.selection.getSelectedIds();
    for (const id of selectedIds) {
      const obj = this.project.getObject(id);
      if (!obj) continue;

      // Create selection highlight based on geometry type
      const highlight = this.createHighlight(obj, zoom);
      if (highlight) {
        this.selectionGroup.appendChild(highlight);
      }
    }
  }

  private createHighlight(obj: any, zoom: number): SVGElement | null {
    const geom = obj.geometry;
    
    switch (geom.type) {
      case GeometryType.POINT: {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', geom.position.x.toString());
        circle.setAttribute('cy', geom.position.y.toString());
        circle.setAttribute('r', (8 / zoom).toString());
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#0066ff');
        circle.setAttribute('stroke-width', (2 / zoom).toString());
        return circle;
      }

      case GeometryType.LINE: {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Highlight line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', geom.start.x.toString());
        line.setAttribute('y1', geom.start.y.toString());
        line.setAttribute('x2', geom.end.x.toString());
        line.setAttribute('y2', geom.end.y.toString());
        line.setAttribute('stroke', '#0066ff');
        line.setAttribute('stroke-width', ((obj.style.strokeWidth || 2) / zoom + 2 / zoom).toString());
        line.setAttribute('opacity', '0.5');
        group.appendChild(line);

        // Endpoint handles
        [geom.start, geom.end].forEach(point => {
          const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          handle.setAttribute('cx', point.x.toString());
          handle.setAttribute('cy', point.y.toString());
          handle.setAttribute('r', (6 / zoom).toString());
          handle.setAttribute('fill', 'white');
          handle.setAttribute('stroke', '#0066ff');
          handle.setAttribute('stroke-width', (2 / zoom).toString());
          group.appendChild(handle);
        });

        return group;
      }

      case GeometryType.CIRCLE: {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', geom.center.x.toString());
        circle.setAttribute('cy', geom.center.y.toString());
        circle.setAttribute('r', geom.radius.toString());
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#0066ff');
        circle.setAttribute('stroke-width', (2 / zoom).toString());
        circle.setAttribute('stroke-dasharray', `${8 / zoom} ${4 / zoom}`);
        return circle;
      }

      default:
        return null;
    }
  }
}
```

### src/tools/SelectTool.ts

```typescript
import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { Selection } from '../selection/Selection';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point } from '../geometry/types';

export class SelectTool implements Tool {
  readonly name = 'select';

  private project: Project;
  private selection: Selection;
  private isDragging: boolean = false;
  private dragStartWorld: Point | null = null;
  private draggedObject: GeometryObject | null = null;
  private dragOffset: Point = { x: 0, y: 0 };
  private onUpdate: () => void;

  constructor(project: Project, selection: Selection, onUpdate: () => void) {
    this.project = project;
    this.selection = selection;
    this.onUpdate = onUpdate;
  }

  onActivate(): void {
    console.log('Select tool activated');
  }

  onDeactivate(): void {
    this.isDragging = false;
    this.draggedObject = null;
  }

  onMouseDown(event: ToolMouseEvent): void {
    // Check if clicking on selected object to start drag
    const selectedId = this.selection.getFirstSelected();
    if (selectedId) {
      const obj = this.project.getObject(selectedId);
      if (obj && this.hitTest(obj, event.worldPos)) {
        this.isDragging = true;
        this.dragStartWorld = event.worldPos;
        this.draggedObject = obj;
        this.dragOffset = this.getObjectPosition(obj);
        return;
      }
    }
  }

  onMouseMove(event: ToolMouseEvent): void {
    if (this.isDragging && this.dragStartWorld && this.draggedObject) {
      const dx = event.worldPos.x - this.dragStartWorld.x;
      const dy = event.worldPos.y - this.dragStartWorld.y;
      
      // Calculate new position
      const newPos: Point = {
        x: this.dragOffset.x + dx,
        y: this.dragOffset.y + dy
      };

      // Update object geometry
      const updatedObj = this.moveObject(this.draggedObject, newPos);
      this.project.addObject(updatedObj); // Replace with updated
      this.onUpdate();
    }
  }

  onMouseUp(event: ToolMouseEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.dragStartWorld = null;
      this.draggedObject = null;
      console.log('Move completed');
    }
  }

  onMouseClick(event: ToolMouseEvent): void {
    if (this.isDragging) return; // Was dragging, not a click

    // Hit test all objects
    const objects = this.project.getAllObjects();
    let hitObject: GeometryObject | null = null;

    // Reverse order to select topmost object
    for (let i = objects.length - 1; i >= 0; i--) {
      if (this.hitTest(objects[i], event.worldPos)) {
        hitObject = objects[i];
        break;
      }
    }

    if (hitObject) {
      this.selection.select(hitObject.id);
      console.log(`Selected: ${hitObject.metadata.name || hitObject.id}`);
    } else {
      this.selection.deselect();
      console.log('Deselected');
    }
  }

  getCursor(): string {
    if (this.isDragging) {
      return 'grabbing';
    }
    
    // Check if hovering over selected object
    const selectedId = this.selection.getFirstSelected();
    if (selectedId) {
      return 'grab';
    }
    
    return 'default';
  }

  // Hit testing per geometry type
  private hitTest(obj: GeometryObject, point: Point): boolean {
    const tolerance = 5; // 5 cm tolerance

    switch (obj.geometry.type) {
      case GeometryType.POINT: {
        const geom = obj.geometry as any;
        const dx = point.x - geom.position.x;
        const dy = point.y - geom.position.y;
        return Math.sqrt(dx * dx + dy * dy) <= tolerance;
      }

      case GeometryType.LINE: {
        const geom = obj.geometry as any;
        const dist = this.pointToLineDistance(point, geom.start, geom.end);
        return dist <= tolerance + (obj.style.strokeWidth || 2) / 2;
      }

      case GeometryType.CIRCLE: {
        const geom = obj.geometry as any;
        const dx = point.x - geom.center.x;
        const dy = point.y - geom.center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Hit if near circumference or inside
        return dist <= geom.radius + tolerance;
      }

      default:
        return false;
    }
  }

  // Point to line segment distance
  private pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      const px = point.x - lineStart.x;
      const py = point.y - lineStart.y;
      return Math.sqrt(px * px + py * py);
    }

    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    const distX = point.x - projX;
    const distY = point.y - projY;

    return Math.sqrt(distX * distX + distY * distY);
  }

  // Get object position (varies by type)
  private getObjectPosition(obj: GeometryObject): Point {
    switch (obj.geometry.type) {
      case GeometryType.POINT:
        return { ...(obj.geometry as any).position };
      case GeometryType.LINE:
        return { ...(obj.geometry as any).start };
      case GeometryType.CIRCLE:
        return { ...(obj.geometry as any).center };
      default:
        return { x: 0, y: 0 };
    }
  }

  // Move object (returns new object with updated geometry)
  private moveObject(obj: GeometryObject, newPos: Point): GeometryObject {
    const oldPos = this.getObjectPosition(obj);
    const dx = newPos.x - oldPos.x;
    const dy = newPos.y - oldPos.y;

    let newGeometry: any;

    switch (obj.geometry.type) {
      case GeometryType.POINT:
        newGeometry = {
          ...obj.geometry,
          position: newPos
        };
        break;

      case GeometryType.LINE:
        const lineGeom = obj.geometry as any;
        newGeometry = {
          ...obj.geometry,
          start: { x: lineGeom.start.x + dx, y: lineGeom.start.y + dy },
          end: { x: lineGeom.end.x + dx, y: lineGeom.end.y + dy }
        };
        break;

      case GeometryType.CIRCLE:
        newGeometry = {
          ...obj.geometry,
          center: newPos
        };
        break;

      default:
        return obj;
    }

    return obj.clone({ geometry: newGeometry });
  }
}
```

### src/viewport/Viewport.ts (updates)

```typescript
// Add to imports:
import { ToolManager } from '../tools/ToolManager';
import { Selection } from '../selection/Selection';
import { SelectionRenderer } from '../selection/SelectionRenderer';

export class Viewport {
  // Add properties:
  private toolManager?: ToolManager;
  private selection?: Selection;
  private selectionRenderer?: SelectionRenderer;

  // Update setProject:
  setProject(project: Project): void {
    this.project = project;
    this.renderer = new Renderer(this.worldGroup);
    
    // Initialize selection system
    this.selection = new Selection();
    this.selectionRenderer = new SelectionRenderer(this.worldGroup, this.selection, project);
    
    // Initialize tool manager
    this.toolManager = new ToolManager(this.svg, this.transform);
    
    this.render();
  }

  // Add method to set active tool:
  setTool(tool: any): void {
    if (this.toolManager) {
      this.toolManager.setActiveTool(tool);
    }
  }

  getSelection(): Selection | undefined {
    return this.selection;
  }

  // Update render to include selection:
  private render(): void {
    this.worldGroup.setAttribute('transform', this.transform.toSVGTransform());
    this.grid.render(this.worldGroup, this.transform.getState());
    
    if (this.renderer && this.project) {
      this.renderer.render(this.project, this.transform.getState().zoom);
    }
    
    if (this.selectionRenderer) {
      this.selectionRenderer.render(this.transform.getState().zoom);
    }
  }
}
```

### src/main.ts (updates)

```typescript
import { SelectTool } from './tools/SelectTool';

// After viewport initialization:
const selectTool = new SelectTool(
  project,
  viewport.getSelection()!,
  () => viewport.render() // Callback to trigger re-render
);

viewport.setTool(selectTool);
console.log('Select tool active - click objects to select, drag to move');
```

## Test Plan

### Manual Testing Steps

1. **Selection test - click object**
   - Load application
   - Click on apple tree circle
   - Verify blue dashed outline appears around tree
   - Verify console shows "Selected: Apple Tree"
   - Click on different object (cherry tree)
   - Verify selection moves to cherry tree
   - Verify only one object selected at a time

2. **Selection test - different geometry types**
   - Click on origin point
   - Verify blue circle outline appears
   - Click on boundary line
   - Verify line highlights with blue glow and endpoint handles
   - Click on path line
   - Verify thick path shows selection
   - Verify selection visual adapts to each geometry type

3. **Deselection test**
   - Select any object
   - Verify selection highlight visible
   - Click on empty canvas area
   - Verify selection highlight disappears
   - Verify console shows "Deselected"

4. **Move test - tree circle**
   - Select apple tree
   - Click and hold on tree
   - Verify cursor changes to "grabbing"
   - Drag mouse to new position
   - Verify tree moves smoothly with cursor
   - Release mouse
   - Verify tree stays at new position
   - Check coordinate display during drag
   - Verify coordinates update in real-time

5. **Move test - line**
   - Select boundary line
   - Drag line to new position
   - Verify entire line moves (both endpoints)
   - Verify line maintains length and angle
   - Release
   - Verify line at new position

6. **Move test - point**
   - Select origin point or reference point
   - Drag to new location
   - Verify point moves
   - Verify precise position tracking

7. **Move accuracy test**
   - Select tree at known position (e.g., 500, 400)
   - Drag 300 cm to the right
   - Read coordinates during drag
   - Release at ~(800, 400)
   - Hover over tree center
   - Verify coordinates show ~(800, 400)

8. **Selection persistence during viewport changes**
   - Select an object
   - Verify selection highlight visible
   - Pan viewport
   - Verify selection highlight moves with object
   - Zoom in/out
   - Verify selection highlight scales appropriately
   - Verify selection remains on same object

9. **Hit testing tolerance**
   - Click slightly off-center on small point
   - Verify point still selects (5cm tolerance)
   - Click far from any object
   - Verify no selection occurs

10. **Cursor feedback test**
    - Hover over empty space → default cursor
    - Select object → cursor changes to "grab"
    - Start dragging → cursor changes to "grabbing"
    - Release → cursor returns to "grab"
    - Deselect → cursor returns to "default"

## Acceptance Criteria

- [ ] Click selects object under cursor
- [ ] Selected object shows blue highlight appropriate to geometry type
- [ ] Point selection shows circular outline
- [ ] Line selection shows highlight with endpoint handles
- [ ] Circle selection shows dashed outline
- [ ] Only one object selected at a time
- [ ] Click empty space deselects current selection
- [ ] Drag moves selected object smoothly
- [ ] Object position updates in real-time during drag
- [ ] Moved objects maintain geometric properties (line length, circle radius)
- [ ] Coordinate display shows accurate position during move
- [ ] Selection persists during pan and zoom
- [ ] Selection highlight scales with zoom level
- [ ] Hit testing includes 5cm tolerance for easier clicking
- [ ] Cursor provides visual feedback (default/grab/grabbing)
- [ ] Console logs selection and move actions
- [ ] No TypeScript compilation errors
- [ ] No interference with pan (Shift+drag) interaction

## Deliverables

1. **src/tools/Tool.ts** - Base tool interface
2. **src/tools/ToolManager.ts** - Tool coordination and event routing
3. **src/tools/SelectTool.ts** - Selection and move implementation
4. **src/selection/Selection.ts** - Selection state management
5. **src/selection/SelectionRenderer.ts** - Visual selection indicators
6. **Updated src/viewport/Viewport.ts** - Tool integration
7. **Updated src/main.ts** - SelectTool initialization
8. **Working selection/move interaction** - Click to select, drag to move

---

**Estimated effort**: 3-4 hours  
**Dependencies**: Slice 3 (geometry rendering)  
**Risk**: Medium - hit testing and drag interaction require careful coordinate handling
