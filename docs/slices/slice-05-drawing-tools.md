# Slice 5: Drawing Tools (Point, Line, Circle)

## User Value

As a user, I need tools to create new geometry objects (points, lines, circles) so that I can build my garden plan from scratch by adding trees, paths, boundaries, and reference markers.

## Slice Features

1. **Tool palette** - UI for switching between Select, Point, Line, and Circle tools
2. **Point drawing tool** - click to place points at precise coordinates
3. **Line drawing tool** - click start point, then end point to create line segments
4. **Circle drawing tool** - click center, then drag to set radius
5. **Numeric input panel** - enter exact coordinates and dimensions
6. **Live preview** - show shape being drawn before confirming
7. **Tool-specific instructions** - display current step in drawing workflow
8. **Escape to cancel** - press ESC to abort current drawing operation
9. **New objects added to project** - persist drawn shapes immediately

## Technical Implementation Sketch

### File Structure

```
src/
├── tools/
│   ├── PointTool.ts          # Point creation tool
│   ├── LineTool.ts           # Line segment creation tool
│   └── CircleTool.ts         # Circle creation tool
├── ui/
│   ├── Toolbar.ts            # Tool palette UI
│   ├── PropertyPanel.ts      # Numeric input panel
│   └── StatusBar.ts          # Instructions and status messages
└── main.ts                   # Updated with all tools and UI
```

### Core Concepts

**Drawing Workflow**:
- Each drawing tool has multiple steps (e.g., Line: click start → click end)
- Preview geometry renders during drawing (dotted/transparent)
- Confirm creates permanent object, ESC cancels

**Tool State Machine**:
- `IDLE`: No active drawing
- `DRAWING`: Multi-step input in progress (e.g., waiting for second click)
- `COMPLETE`: Drawing finished, object created

**Object ID Generation**:
- Use timestamp + random suffix for unique IDs
- Format: `{type}-{timestamp}-{random}` (e.g., `circle-1704992400123-a3f`)

### src/tools/PointTool.ts

```typescript
import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point } from '../geometry/types';

export class PointTool implements Tool {
  readonly name = 'point';

  private project: Project;
  private onUpdate: () => void;
  private previewPoint: Point | null = null;
  private previewGroup: SVGGElement;

  constructor(project: Project, previewGroup: SVGGElement, onUpdate: () => void) {
    this.project = project;
    this.previewGroup = previewGroup;
    this.onUpdate = onUpdate;
  }

  onActivate(): void {
    console.log('Point tool activated - click to place point');
  }

  onDeactivate(): void {
    this.clearPreview();
  }

  onMouseDown(event: ToolMouseEvent): void {
    // Not used for point tool
  }

  onMouseMove(event: ToolMouseEvent): void {
    // Update preview
    this.previewPoint = event.worldPos;
    this.renderPreview();
  }

  onMouseUp(event: ToolMouseEvent): void {
    // Not used for point tool
  }

  onMouseClick(event: ToolMouseEvent): void {
    // Create point at click location
    const id = this.generateId('point');
    const point = new GeometryObject(
      id,
      'default',
      {
        type: GeometryType.POINT,
        position: { x: event.worldPos.x, y: event.worldPos.y }
      },
      { stroke: '#333333', strokeWidth: 2 },
      { name: `Point ${id}`, category: 'reference' }
    );

    this.project.addObject(point);
    this.onUpdate();
    console.log(`Created point at (${event.worldPos.x.toFixed(1)}, ${event.worldPos.y.toFixed(1)})`);
  }

  getCursor(): string {
    return 'crosshair';
  }

  private renderPreview(): void {
    this.clearPreview();
    
    if (!this.previewPoint) return;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', this.previewPoint.x.toString());
    circle.setAttribute('cy', this.previewPoint.y.toString());
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', '#666');
    circle.setAttribute('opacity', '0.5');
    circle.setAttribute('pointer-events', 'none');
    
    this.previewGroup.appendChild(circle);
  }

  private clearPreview(): void {
    while (this.previewGroup.firstChild) {
      this.previewGroup.removeChild(this.previewGroup.firstChild);
    }
  }

  private generateId(type: string): string {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }
}
```

### src/tools/LineTool.ts

```typescript
import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point } from '../geometry/types';

enum LineToolState {
  WAITING_FOR_START,
  WAITING_FOR_END
}

export class LineTool implements Tool {
  readonly name = 'line';

  private project: Project;
  private onUpdate: () => void;
  private previewGroup: SVGGElement;
  private state: LineToolState = LineToolState.WAITING_FOR_START;
  private startPoint: Point | null = null;
  private currentPoint: Point | null = null;

  constructor(project: Project, previewGroup: SVGGElement, onUpdate: () => void) {
    this.project = project;
    this.previewGroup = previewGroup;
    this.onUpdate = onUpdate;
  }

  onActivate(): void {
    this.reset();
    console.log('Line tool activated - click start point');
  }

  onDeactivate(): void {
    this.reset();
  }

  onMouseDown(event: ToolMouseEvent): void {
    // Not used
  }

  onMouseMove(event: ToolMouseEvent): void {
    this.currentPoint = event.worldPos;
    this.renderPreview();
  }

  onMouseUp(event: ToolMouseEvent): void {
    // Not used
  }

  onMouseClick(event: ToolMouseEvent): void {
    if (this.state === LineToolState.WAITING_FOR_START) {
      this.startPoint = { x: event.worldPos.x, y: event.worldPos.y };
      this.state = LineToolState.WAITING_FOR_END;
      console.log(`Start point set at (${event.worldPos.x.toFixed(1)}, ${event.worldPos.y.toFixed(1)}) - click end point`);
    } else if (this.state === LineToolState.WAITING_FOR_END && this.startPoint) {
      // Create line
      const id = this.generateId('line');
      const line = new GeometryObject(
        id,
        'default',
        {
          type: GeometryType.LINE,
          start: this.startPoint,
          end: { x: event.worldPos.x, y: event.worldPos.y }
        },
        { stroke: '#333333', strokeWidth: 2 },
        { name: `Line ${id}` }
      );

      this.project.addObject(line);
      this.onUpdate();
      
      const length = this.calculateDistance(this.startPoint, event.worldPos);
      console.log(`Created line, length: ${length.toFixed(1)} cm`);
      
      this.reset();
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  private renderPreview(): void {
    this.clearPreview();

    if (this.state === LineToolState.WAITING_FOR_START && this.currentPoint) {
      // Show point preview
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.currentPoint.x.toString());
      circle.setAttribute('cy', this.currentPoint.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#666');
      circle.setAttribute('opacity', '0.5');
      this.previewGroup.appendChild(circle);
    } else if (this.state === LineToolState.WAITING_FOR_END && this.startPoint && this.currentPoint) {
      // Show start point
      const startCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      startCircle.setAttribute('cx', this.startPoint.x.toString());
      startCircle.setAttribute('cy', this.startPoint.y.toString());
      startCircle.setAttribute('r', '4');
      startCircle.setAttribute('fill', '#0066ff');
      this.previewGroup.appendChild(startCircle);

      // Show preview line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', this.startPoint.x.toString());
      line.setAttribute('y1', this.startPoint.y.toString());
      line.setAttribute('x2', this.currentPoint.x.toString());
      line.setAttribute('y2', this.currentPoint.y.toString());
      line.setAttribute('stroke', '#666');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '5 5');
      line.setAttribute('opacity', '0.7');
      line.setAttribute('pointer-events', 'none');
      this.previewGroup.appendChild(line);

      // Show length label
      const midX = (this.startPoint.x + this.currentPoint.x) / 2;
      const midY = (this.startPoint.y + this.currentPoint.y) / 2;
      const length = this.calculateDistance(this.startPoint, this.currentPoint);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midX.toString());
      text.setAttribute('y', (midY - 10).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#0066ff');
      text.setAttribute('font-size', '14');
      text.setAttribute('font-family', 'monospace');
      text.textContent = `${length.toFixed(1)} cm`;
      this.previewGroup.appendChild(text);
    }
  }

  private clearPreview(): void {
    while (this.previewGroup.firstChild) {
      this.previewGroup.removeChild(this.previewGroup.firstChild);
    }
  }

  private reset(): void {
    this.state = LineToolState.WAITING_FOR_START;
    this.startPoint = null;
    this.currentPoint = null;
    this.clearPreview();
  }

  private calculateDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private generateId(type: string): string {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }

  // Handle ESC key to cancel
  onKeyDown(key: string): void {
    if (key === 'Escape') {
      console.log('Line drawing cancelled');
      this.reset();
    }
  }
}
```

### src/tools/CircleTool.ts

```typescript
import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point } from '../geometry/types';

enum CircleToolState {
  WAITING_FOR_CENTER,
  WAITING_FOR_RADIUS
}

export class CircleTool implements Tool {
  readonly name = 'circle';

  private project: Project;
  private onUpdate: () => void;
  private previewGroup: SVGGElement;
  private state: CircleToolState = CircleToolState.WAITING_FOR_CENTER;
  private centerPoint: Point | null = null;
  private currentPoint: Point | null = null;

  constructor(project: Project, previewGroup: SVGGElement, onUpdate: () => void) {
    this.project = project;
    this.previewGroup = previewGroup;
    this.onUpdate = onUpdate;
  }

  onActivate(): void {
    this.reset();
    console.log('Circle tool activated - click center point');
  }

  onDeactivate(): void {
    this.reset();
  }

  onMouseDown(event: ToolMouseEvent): void {
    // Not used
  }

  onMouseMove(event: ToolMouseEvent): void {
    this.currentPoint = event.worldPos;
    this.renderPreview();
  }

  onMouseUp(event: ToolMouseEvent): void {
    // Not used
  }

  onMouseClick(event: ToolMouseEvent): void {
    if (this.state === CircleToolState.WAITING_FOR_CENTER) {
      this.centerPoint = { x: event.worldPos.x, y: event.worldPos.y };
      this.state = CircleToolState.WAITING_FOR_RADIUS;
      console.log(`Center set at (${event.worldPos.x.toFixed(1)}, ${event.worldPos.y.toFixed(1)}) - click to set radius`);
    } else if (this.state === CircleToolState.WAITING_FOR_RADIUS && this.centerPoint) {
      const radius = this.calculateDistance(this.centerPoint, event.worldPos);
      
      if (radius < 1) {
        console.log('Radius too small, try again');
        return;
      }

      // Create circle
      const id = this.generateId('circle');
      const circle = new GeometryObject(
        id,
        'default',
        {
          type: GeometryType.CIRCLE,
          center: this.centerPoint,
          radius: radius
        },
        { stroke: '#228B22', strokeWidth: 2, fill: '#90EE90', opacity: 0.3 },
        { name: `Circle ${id}`, category: 'vegetation' }
      );

      this.project.addObject(circle);
      this.onUpdate();
      console.log(`Created circle, radius: ${radius.toFixed(1)} cm`);
      
      this.reset();
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  private renderPreview(): void {
    this.clearPreview();

    if (this.state === CircleToolState.WAITING_FOR_CENTER && this.currentPoint) {
      // Show center preview
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.currentPoint.x.toString());
      circle.setAttribute('cy', this.currentPoint.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#666');
      circle.setAttribute('opacity', '0.5');
      this.previewGroup.appendChild(circle);
    } else if (this.state === CircleToolState.WAITING_FOR_RADIUS && this.centerPoint && this.currentPoint) {
      const radius = this.calculateDistance(this.centerPoint, this.currentPoint);

      // Show center point
      const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      centerCircle.setAttribute('cx', this.centerPoint.x.toString());
      centerCircle.setAttribute('cy', this.centerPoint.y.toString());
      centerCircle.setAttribute('r', '4');
      centerCircle.setAttribute('fill', '#0066ff');
      this.previewGroup.appendChild(centerCircle);

      // Show preview circle
      const previewCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      previewCircle.setAttribute('cx', this.centerPoint.x.toString());
      previewCircle.setAttribute('cy', this.centerPoint.y.toString());
      previewCircle.setAttribute('r', radius.toString());
      previewCircle.setAttribute('stroke', '#666');
      previewCircle.setAttribute('stroke-width', '2');
      previewCircle.setAttribute('stroke-dasharray', '5 5');
      previewCircle.setAttribute('fill', 'none');
      previewCircle.setAttribute('opacity', '0.7');
      previewCircle.setAttribute('pointer-events', 'none');
      this.previewGroup.appendChild(previewCircle);

      // Show radius line
      const radiusLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      radiusLine.setAttribute('x1', this.centerPoint.x.toString());
      radiusLine.setAttribute('y1', this.centerPoint.y.toString());
      radiusLine.setAttribute('x2', this.currentPoint.x.toString());
      radiusLine.setAttribute('y2', this.currentPoint.y.toString());
      radiusLine.setAttribute('stroke', '#0066ff');
      radiusLine.setAttribute('stroke-width', '1');
      radiusLine.setAttribute('pointer-events', 'none');
      this.previewGroup.appendChild(radiusLine);

      // Show radius label
      const midX = (this.centerPoint.x + this.currentPoint.x) / 2;
      const midY = (this.centerPoint.y + this.currentPoint.y) / 2;
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midX.toString());
      text.setAttribute('y', (midY - 10).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#0066ff');
      text.setAttribute('font-size', '14');
      text.setAttribute('font-family', 'monospace');
      text.textContent = `r: ${radius.toFixed(1)} cm`;
      this.previewGroup.appendChild(text);
    }
  }

  private clearPreview(): void {
    while (this.previewGroup.firstChild) {
      this.previewGroup.removeChild(this.previewGroup.firstChild);
    }
  }

  private reset(): void {
    this.state = CircleToolState.WAITING_FOR_CENTER;
    this.centerPoint = null;
    this.currentPoint = null;
    this.clearPreview();
  }

  private calculateDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private generateId(type: string): string {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      console.log('Circle drawing cancelled');
      this.reset();
    }
  }
}
```

### src/viewport/Viewport.ts (add preview group)

```typescript
// Add to constructor:
private previewGroup: SVGGElement;

constructor(container: HTMLElement) {
  // ... existing code ...
  
  // Create preview group (above objects, below selection)
  this.previewGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  this.previewGroup.id = 'preview';
  this.worldGroup.appendChild(this.previewGroup);
  
  // ... rest of constructor ...
}

// Add getter:
getPreviewGroup(): SVGGElement {
  return this.previewGroup;
}

// Update render to handle preview scaling:
private render(): void {
  this.worldGroup.setAttribute('transform', this.transform.toSVGTransform());
  this.grid.render(this.worldGroup, this.transform.getState());
  
  if (this.renderer && this.project) {
    this.renderer.render(this.project, this.transform.getState().zoom);
  }
  
  if (this.selectionRenderer) {
    this.selectionRenderer.render(this.transform.getState().zoom);
  }
  
  // Scale preview elements for proper display
  this.scalePreviewElements(this.transform.getState().zoom);
}

private scalePreviewElements(zoom: number): void {
  // Scale text and stroke-widths in preview for visibility
  const texts = this.previewGroup.querySelectorAll('text');
  texts.forEach(text => {
    text.setAttribute('font-size', (14 / zoom).toString());
    text.setAttribute('stroke-width', (0.5 / zoom).toString());
  });
  
  const lines = this.previewGroup.querySelectorAll('line');
  lines.forEach(line => {
    const width = line.getAttribute('stroke-width');
    if (width && !line.hasAttribute('data-no-scale')) {
      line.setAttribute('stroke-width', (parseFloat(width) / zoom).toString());
    }
  });
  
  const circles = this.previewGroup.querySelectorAll('circle');
  circles.forEach(circle => {
    const r = circle.getAttribute('r');
    if (r && parseFloat(r) < 10) { // Small circles (handles, etc.)
      circle.setAttribute('r', (parseFloat(r) / zoom).toString());
    }
  });
}
```

### src/main.ts (add toolbar and all tools)

```typescript
import { PointTool } from './tools/PointTool';
import { LineTool } from './tools/LineTool';
import { CircleTool } from './tools/CircleTool';

// Update HTML to include toolbar:
app.innerHTML = `
  <div style="display: flex; flex-direction: column; width: 100%; height: 100vh;">
    <div style="padding: 10px; background: #333; color: white; display: flex; gap: 10px; align-items: center;">
      <h1 style="margin: 0; font-size: 18px;">GardenCAD</h1>
      <div style="display: flex; gap: 5px; margin-left: 20px;" id="toolbar">
        <button id="tool-select" class="tool-btn active">Select</button>
        <button id="tool-point" class="tool-btn">Point</button>
        <button id="tool-line" class="tool-btn">Line</button>
        <button id="tool-circle" class="tool-btn">Circle</button>
      </div>
      <button id="reset-view" style="margin-left: auto;">Reset View</button>
    </div>
    <div id="viewport-container" style="flex: 1; position: relative;"></div>
    <div style="padding: 8px; background: #f0f0f0; font-size: 12px; font-family: monospace;" id="status-bar">
      Select tool active
    </div>
  </div>
`;

// Add CSS for tool buttons:
const style = document.createElement('style');
style.textContent = `
  .tool-btn {
    padding: 6px 12px;
    border: 1px solid #555;
    background: #444;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }
  .tool-btn:hover {
    background: #555;
  }
  .tool-btn.active {
    background: #0066ff;
    border-color: #0066ff;
  }
`;
document.head.appendChild(style);

// Initialize all tools:
const selectTool = new SelectTool(
  project,
  viewport.getSelection()!,
  () => viewport.render()
);

const pointTool = new PointTool(
  project,
  viewport.getPreviewGroup(),
  () => viewport.render()
);

const lineTool = new LineTool(
  project,
  viewport.getPreviewGroup(),
  () => viewport.render()
);

const circleTool = new CircleTool(
  project,
  viewport.getPreviewGroup(),
  () => viewport.render()
);

// Tool switching:
const tools = { select: selectTool, point: pointTool, line: lineTool, circle: circleTool };
let activeTool: string = 'select';

function setTool(toolName: string): void {
  activeTool = toolName;
  viewport.setTool(tools[toolName as keyof typeof tools]);
  
  // Update button states:
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tool-${toolName}`)?.classList.add('active');
  
  // Update status:
  const messages: Record<string, string> = {
    select: 'Select tool active - click to select, drag to move',
    point: 'Point tool active - click to place point',
    line: 'Line tool active - click start point, then end point',
    circle: 'Circle tool active - click center, then click to set radius'
  };
  const statusBar = document.getElementById('status-bar');
  if (statusBar) statusBar.textContent = messages[toolName];
}

// Attach button handlers:
document.getElementById('tool-select')?.addEventListener('click', () => setTool('select'));
document.getElementById('tool-point')?.addEventListener('click', () => setTool('point'));
document.getElementById('tool-line')?.addEventListener('click', () => setTool('line'));
document.getElementById('tool-circle')?.addEventListener('click', () => setTool('circle'));

viewport.setTool(selectTool);

// Keyboard shortcuts:
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (activeTool === 'line' && lineTool.onKeyDown) {
      lineTool.onKeyDown('Escape');
    } else if (activeTool === 'circle' && circleTool.onKeyDown) {
      circleTool.onKeyDown('Escape');
    }
  }
  
  // Tool shortcuts:
  if (e.key === 'v' || e.key === 'V') setTool('select');
  if (e.key === 'p' || e.key === 'P') setTool('point');
  if (e.key === 'l' || e.key === 'L') setTool('line');
  if (e.key === 'c' || e.key === 'C') setTool('circle');
});

console.log('All drawing tools loaded. Shortcuts: V=Select, P=Point, L=Line, C=Circle');
```

## Test Plan

### Manual Testing Steps

1. **Toolbar UI test**
   - Load application
   - Verify toolbar shows: Select, Point, Line, Circle buttons
   - Verify Select button highlighted (active)
   - Verify status bar shows "Select tool active..."

2. **Point tool test**
   - Click "Point" button
   - Verify button highlights
   - Verify status bar updates with point instructions
   - Verify cursor changes to crosshair
   - Move mouse over canvas
   - Verify small preview circle follows cursor
   - Click at position (1000, 1000)
   - Verify point created at that location
   - Verify console logs point creation with coordinates
   - Click at several other positions
   - Verify each click creates a new point

3. **Line tool test**
   - Click "Line" button
   - Verify tool switches and status updates
   - Move mouse over canvas
   - Verify preview point follows cursor
   - Click at (500, 500) for start point
   - Verify console shows "Start point set..."
   - Move mouse
   - Verify dotted preview line follows cursor from start point
   - Verify blue length label shows distance in cm
   - Move to approximately (1500, 1200)
   - Verify length label updates in real-time
   - Click to set end point
   - Verify solid line created
   - Verify console logs "Created line, length: XXX cm"
   - Verify tool stays in line mode for next line

4. **Circle tool test**
   - Click "Circle" button
   - Verify tool switches
   - Click at (800, 700) for center
   - Verify console shows "Center set..."
   - Move mouse outward
   - Verify dotted preview circle expands with cursor
   - Verify blue radius line from center to cursor
   - Verify radius label shows "r: XXX cm"
   - Click at approximately 200cm from center
   - Verify solid circle created with semi-transparent fill
   - Verify console logs "Created circle, radius: XXX cm"
   - Verify tool stays in circle mode

5. **ESC key cancel test**
   - Select Line tool
   - Click start point
   - Press ESC key
   - Verify preview disappears
   - Verify line not created
   - Verify tool resets to waiting for start point
   - Repeat with Circle tool
   - Click center
   - Press ESC
   - Verify preview clears

6. **Keyboard shortcut test**
   - Press 'V' key
   - Verify Select tool activates
   - Press 'P' key
   - Verify Point tool activates
   - Press 'L' key
   - Verify Line tool activates
   - Press 'C' key
   - Verify Circle tool activates
   - Test uppercase (Shift+V, etc.)
   - Verify same behavior

7. **Tool isolation test**
   - Switch to Line tool
   - Start drawing a line (click start point)
   - Switch to Circle tool mid-drawing
   - Verify line preview clears
   - Verify circle tool starts fresh
   - Draw a circle
   - Switch to Point tool
   - Verify no interference

8. **Coordinate accuracy test**
   - Select Point tool
   - Watch coordinate display while moving mouse
   - Click when display shows (1200.0, 800.0)
   - Switch to Select tool
   - Hover over created point
   - Verify coordinates match (within 1-2 cm)

9. **Visual preview test**
   - Line tool: Verify preview is dotted/dashed
   - Circle tool: Verify preview is dotted/dashed
   - Verify preview elements clear when tool switches
   - Verify preview updates smoothly on mouse move
   - Verify labels are readable at different zoom levels

10. **Persistence test**
    - Draw several objects with each tool
    - Switch to Select tool
    - Verify all drawn objects are selectable
    - Verify objects persist after tool switches
    - Pan and zoom
    - Verify all drawn objects remain at correct positions

## Acceptance Criteria

- [ ] Toolbar displays tool buttons (Select, Point, Line, Circle)
- [ ] Active tool button is visually highlighted
- [ ] Status bar shows tool-specific instructions
- [ ] Point tool creates points on single click
- [ ] Line tool requires two clicks (start, end) and shows preview
- [ ] Circle tool requires two clicks (center, radius) and shows preview
- [ ] All tools show live preview with measurements
- [ ] Preview is visually distinct (dotted/dashed, semi-transparent)
- [ ] Measurement labels appear during line and circle drawing
- [ ] ESC key cancels multi-step drawing operations
- [ ] Keyboard shortcuts switch tools (V, P, L, C)
- [ ] Cursor changes to crosshair for drawing tools
- [ ] New objects added to project immediately
- [ ] Objects persist after tool switches
- [ ] Console logs creation events with coordinates/dimensions
- [ ] No interference between tools when switching mid-operation
- [ ] Preview elements scale properly at different zoom levels
- [ ] No TypeScript compilation errors

## Deliverables

1. **src/tools/PointTool.ts** - Point creation tool with preview
2. **src/tools/LineTool.ts** - Line creation with two-step workflow and length display
3. **src/tools/CircleTool.ts** - Circle creation with radius display
4. **Updated src/viewport/Viewport.ts** - Preview group and scaling
5. **Updated src/main.ts** - Toolbar UI, tool initialization, keyboard shortcuts
6. **Working tool palette** - UI for switching between tools
7. **Working drawing tools** - Create points, lines, and circles with live preview
8. **Enhanced styles** - Tool button styling and active states

---

**Estimated effort**: 3-4 hours  
**Dependencies**: Slice 4 (selection tool and tool infrastructure)  
**Risk**: Medium - multi-step tool workflows and preview rendering require careful state management
