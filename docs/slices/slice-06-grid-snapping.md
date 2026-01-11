# Slice 6: Grid Snapping

## User Value

As a user, I need objects to snap to grid lines so that I can create precisely aligned layouts with consistent spacing and ensure accurate measurements aligned to convenient intervals (1cm, 5cm, 10cm, etc.).

## Slice Features

1. **Configurable grid spacing** - Choose from 1cm, 5cm, 10cm, 50cm, 100cm intervals
2. **Grid dropdown selector** - UI control to change grid spacing
3. **Snap-to-grid toggle** - Enable/disable snapping with button and keyboard shortcut
4. **Visual snap indicator** - Show when cursor/object is snapped to grid
5. **Snap during drawing** - All drawing tools snap points to grid when enabled
6. **Snap during moving** - Selection/move operations snap to grid when enabled
7. **Grid visual updates** - Grid re-renders when spacing changes
8. **Snap feedback** - Visual and console feedback when snapping occurs

## Technical Implementation Sketch

### File Structure

```
src/
├── snapping/
│   ├── SnapManager.ts        # Centralized snapping logic
│   └── SnapIndicator.ts      # Visual snap feedback
├── viewport/
│   └── Grid.ts               # Updated with configurable spacing
├── tools/
│   └── Tool.ts               # Updated with snap support
└── main.ts                   # Updated with snap UI controls
```

### Core Concepts

**Snap System Architecture**:
- Centralized `SnapManager` service used by all tools
- Tools query snap manager with raw coordinates
- Snap manager returns snapped coordinates based on current settings
- Visual indicator shows snap points as they occur

**Snap Modes**:
- `NONE`: No snapping
- `GRID`: Snap to nearest grid intersection
- (Future: `ENDPOINT`, `MIDPOINT`, `INTERSECTION`)

**Grid Spacing Options**:
- 1 cm (millimeter-level precision)
- 5 cm (typical small detail spacing)
- 10 cm (default, decimeter precision)
- 50 cm (half-meter intervals)
- 100 cm (meter intervals)

### src/snapping/SnapManager.ts

```typescript
import { Point } from '../types/geometry';

export enum SnapMode {
  NONE = 'none',
  GRID = 'grid'
}

export interface SnapResult {
  point: Point;
  snapped: boolean;
  snapType?: SnapMode;
}

export class SnapManager {
  private enabled: boolean = true;
  private gridSpacing: number = 100; // cm
  private mode: SnapMode = SnapMode.GRID;
  private listeners: Array<() => void> = [];

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.notifyListeners();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setGridSpacing(spacing: number): void {
    this.gridSpacing = spacing;
    this.notifyListeners();
  }

  getGridSpacing(): number {
    return this.gridSpacing;
  }

  setMode(mode: SnapMode): void {
    this.mode = mode;
    this.notifyListeners();
  }

  getMode(): SnapMode {
    return this.mode;
  }

  // Snap a point according to current settings
  snap(point: Point): SnapResult {
    if (!this.enabled) {
      return { point, snapped: false };
    }

    switch (this.mode) {
      case SnapMode.GRID:
        return this.snapToGrid(point);
      default:
        return { point, snapped: false };
    }
  }

  private snapToGrid(point: Point): SnapResult {
    const snappedX = Math.round(point.x / this.gridSpacing) * this.gridSpacing;
    const snappedY = Math.round(point.y / this.gridSpacing) * this.gridSpacing;

    const snapped = snappedX !== point.x || snappedY !== point.y;

    return {
      point: { x: snappedX, y: snappedY },
      snapped,
      snapType: SnapMode.GRID
    };
  }

  // Listen to snap setting changes
  onChange(listener: () => void): void {
    this.listeners.push(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // Toggle snap on/off
  toggle(): boolean {
    this.enabled = !this.enabled;
    this.notifyListeners();
    return this.enabled;
  }
}
```

### src/snapping/SnapIndicator.ts

```typescript
import { Point } from '../types/geometry';
import { SnapResult } from './SnapManager';

export class SnapIndicator {
  private indicatorGroup: SVGGElement;
  private currentIndicator: SVGElement | null = null;

  constructor(worldGroup: SVGGElement) {
    this.indicatorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.indicatorGroup.id = 'snap-indicator';
    worldGroup.appendChild(this.indicatorGroup);
  }

  // Show snap indicator at position
  show(snapResult: SnapResult, zoom: number): void {
    this.clear();

    if (!snapResult.snapped) {
      return;
    }

    // Create crosshair indicator
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const size = 8 / zoom; // 8px in screen space

    // Horizontal line
    const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hLine.setAttribute('x1', (snapResult.point.x - size).toString());
    hLine.setAttribute('y1', snapResult.point.y.toString());
    hLine.setAttribute('x2', (snapResult.point.x + size).toString());
    hLine.setAttribute('y2', snapResult.point.y.toString());
    hLine.setAttribute('stroke', '#ff6600');
    hLine.setAttribute('stroke-width', (2 / zoom).toString());
    group.appendChild(hLine);

    // Vertical line
    const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    vLine.setAttribute('x1', snapResult.point.x.toString());
    vLine.setAttribute('y1', (snapResult.point.y - size).toString());
    vLine.setAttribute('x2', snapResult.point.x.toString());
    vLine.setAttribute('y2', (snapResult.point.y + size).toString());
    vLine.setAttribute('stroke', '#ff6600');
    vLine.setAttribute('stroke-width', (2 / zoom).toString());
    group.appendChild(vLine);

    // Center circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', snapResult.point.x.toString());
    circle.setAttribute('cy', snapResult.point.y.toString());
    circle.setAttribute('r', (3 / zoom).toString());
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', '#ff6600');
    circle.setAttribute('stroke-width', (2 / zoom).toString());
    group.appendChild(circle);

    this.currentIndicator = group;
    this.indicatorGroup.appendChild(group);
  }

  clear(): void {
    if (this.currentIndicator) {
      this.indicatorGroup.removeChild(this.currentIndicator);
      this.currentIndicator = null;
    }
  }

  hide(): void {
    this.clear();
  }
}
```

### src/viewport/Grid.ts (update with configurable spacing)

```typescript
// Update Grid class to support dynamic spacing:

export class Grid {
  private gridSpacing: number = 100; // Default 100 cm

  setSpacing(spacingCm: number): void {
    this.gridSpacing = spacingCm;
  }

  getSpacing(): number {
    return this.gridSpacing;
  }

  render(svg: SVGSVGElement, viewportState: ViewportState): void {
    const existingGrid = svg.querySelector('#grid');
    if (existingGrid) {
      existingGrid.remove();
    }

    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridGroup.id = 'grid';

    // Calculate visible world bounds
    const svgRect = svg.getBoundingClientRect();
    const topLeft = this.screenToWorldSimple(0, 0, viewportState);
    const bottomRight = this.screenToWorldSimple(svgRect.width, svgRect.height, viewportState);

    const minX = Math.floor(topLeft.x / this.gridSpacing) * this.gridSpacing;
    const maxX = Math.ceil(bottomRight.x / this.gridSpacing) * this.gridSpacing;
    const minY = Math.floor(topLeft.y / this.gridSpacing) * this.gridSpacing;
    const maxY = Math.ceil(bottomRight.y / this.gridSpacing) * this.gridSpacing;

    // Determine if we should draw major/minor grid
    const drawMinor = this.gridSpacing >= 50;

    // Vertical lines
    for (let x = minX; x <= maxX; x += this.gridSpacing) {
      const isMajor = x % (this.gridSpacing * 5) === 0;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x.toString());
      line.setAttribute('y1', minY.toString());
      line.setAttribute('x2', x.toString());
      line.setAttribute('y2', maxY.toString());
      line.setAttribute('stroke', isMajor ? '#ccc' : '#e8e8e8');
      line.setAttribute('stroke-width', (isMajor ? 1.5 / viewportState.zoom : 1 / viewportState.zoom).toString());
      gridGroup.appendChild(line);
    }

    // Horizontal lines
    for (let y = minY; y <= maxY; y += this.gridSpacing) {
      const isMajor = y % (this.gridSpacing * 5) === 0;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', minX.toString());
      line.setAttribute('y1', y.toString());
      line.setAttribute('x2', maxX.toString());
      line.setAttribute('y2', y.toString());
      line.setAttribute('stroke', isMajor ? '#ccc' : '#e8e8e8');
      line.setAttribute('stroke-width', (isMajor ? 1.5 / viewportState.zoom : 1 / viewportState.zoom).toString());
      gridGroup.appendChild(line);
    }

    svg.appendChild(gridGroup);
  }

  private screenToWorldSimple(screenX: number, screenY: number, state: ViewportState) {
    return {
      x: (screenX - state.panX) / state.zoom,
      y: (screenY - state.panY) / state.zoom
    };
  }
}
```

### Update Tools to Use Snapping

Each tool needs to be updated to use the SnapManager. Example for PointTool:

```typescript
// src/tools/PointTool.ts - Updated

import { SnapManager } from '../snapping/SnapManager';
import { SnapIndicator } from '../snapping/SnapIndicator';

export class PointTool implements Tool {
  // ... existing properties ...
  private snapManager: SnapManager;
  private snapIndicator: SnapIndicator;

  constructor(
    project: Project,
    previewGroup: SVGGElement,
    snapManager: SnapManager,
    snapIndicator: SnapIndicator,
    onUpdate: () => void
  ) {
    this.project = project;
    this.previewGroup = previewGroup;
    this.snapManager = snapManager;
    this.snapIndicator = snapIndicator;
    this.onUpdate = onUpdate;
  }

  onMouseMove(event: ToolMouseEvent): void {
    // Apply snapping
    const snapResult = this.snapManager.snap(event.worldPos);
    this.previewPoint = snapResult.point;
    
    // Show snap indicator
    this.snapIndicator.show(snapResult, 1.0); // TODO: pass actual zoom
    
    this.renderPreview();
  }

  onMouseClick(event: ToolMouseEvent): void {
    // Apply snapping to final position
    const snapResult = this.snapManager.snap(event.worldPos);
    
    const id = this.generateId('point');
    const point = new GeometryObject(
      id,
      'default',
      {
        type: GeometryType.POINT,
        position: snapResult.point
      },
      { stroke: '#333333', strokeWidth: 2 },
      { name: `Point ${id}`, category: 'reference' }
    );

    this.project.addObject(point);
    this.onUpdate();
    
    if (snapResult.snapped) {
      console.log(`Created point at (${snapResult.point.x}, ${snapResult.point.y}) [SNAPPED]`);
    } else {
      console.log(`Created point at (${snapResult.point.x.toFixed(1)}, ${snapResult.point.y.toFixed(1)})`);
    }
  }

  // ... rest of class ...
}
```

Similar updates needed for LineTool, CircleTool, and SelectTool.

### src/viewport/Viewport.ts (add snap system)

```typescript
import { SnapManager } from '../snapping/SnapManager';
import { SnapIndicator } from '../snapping/SnapIndicator';

export class Viewport {
  // Add properties:
  private snapManager: SnapManager;
  private snapIndicator: SnapIndicator;

  constructor(container: HTMLElement) {
    // ... existing code ...

    // Initialize snap system
    this.snapManager = new SnapManager();
    this.snapIndicator = new SnapIndicator(this.worldGroup);

    // Listen to snap changes to update grid
    this.snapManager.onChange(() => {
      this.grid.setSpacing(this.snapManager.getGridSpacing());
      this.render();
    });

    // ... rest of constructor ...
  }

  getSnapManager(): SnapManager {
    return this.snapManager;
  }

  getSnapIndicator(): SnapIndicator {
    return this.snapIndicator;
  }

  // ... rest of class ...
}
```

### src/main.ts (add snap UI controls)

```typescript
// Update toolbar HTML to include snap controls:
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
      <div style="display: flex; gap: 10px; align-items: center; margin-left: 20px; border-left: 1px solid #555; padding-left: 20px;">
        <label style="font-size: 13px;">Grid:</label>
        <select id="grid-spacing" style="padding: 4px 8px; background: #444; color: white; border: 1px solid #555; border-radius: 4px;">
          <option value="1">1 cm</option>
          <option value="5">5 cm</option>
          <option value="10" selected>10 cm</option>
          <option value="50">50 cm</option>
          <option value="100">100 cm</option>
        </select>
        <button id="snap-toggle" class="snap-btn active" title="Toggle snap (G)">
          <span id="snap-icon">🧲</span> Snap
        </button>
      </div>
      <button id="reset-view" style="margin-left: auto;">Reset View</button>
    </div>
    <div id="viewport-container" style="flex: 1; position: relative;"></div>
    <div style="padding: 8px; background: #f0f0f0; font-size: 12px; font-family: monospace; display: flex; justify-content: space-between;" id="status-bar">
      <span id="status-text">Select tool active</span>
      <span id="snap-status" style="color: #0066ff; font-weight: bold;">SNAP: ON (10 cm)</span>
    </div>
  </div>
`;

// Add CSS for snap button:
style.textContent += `
  .snap-btn {
    padding: 6px 12px;
    border: 1px solid #555;
    background: #444;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .snap-btn:hover {
    background: #555;
  }
  .snap-btn.active {
    background: #228B22;
    border-color: #228B22;
  }
`;

// Get snap manager
const snapManager = viewport.getSnapManager();
const snapIndicator = viewport.getSnapIndicator();

// Initialize tools with snap support (update all tool constructors):
const pointTool = new PointTool(
  project,
  viewport.getPreviewGroup(),
  snapManager,
  snapIndicator,
  () => viewport.render()
);

// Similar for lineTool and circleTool...

// Grid spacing control
document.getElementById('grid-spacing')?.addEventListener('change', (e) => {
  const spacing = parseInt((e.target as HTMLSelectElement).value);
  snapManager.setGridSpacing(spacing);
  updateSnapStatus();
  console.log(`Grid spacing set to ${spacing} cm`);
});

// Snap toggle button
document.getElementById('snap-toggle')?.addEventListener('click', () => {
  const enabled = snapManager.toggle();
  const btn = document.getElementById('snap-toggle');
  if (btn) {
    if (enabled) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  updateSnapStatus();
  console.log(`Snap ${enabled ? 'enabled' : 'disabled'}`);
});

// Update snap status display
function updateSnapStatus(): void {
  const statusEl = document.getElementById('snap-status');
  if (statusEl) {
    if (snapManager.isEnabled()) {
      statusEl.textContent = `SNAP: ON (${snapManager.getGridSpacing()} cm)`;
      statusEl.style.color = '#0066ff';
    } else {
      statusEl.textContent = 'SNAP: OFF';
      statusEl.style.color = '#999';
    }
  }
}

// Keyboard shortcuts (add to existing keydown handler):
document.addEventListener('keydown', (e) => {
  // ... existing shortcuts ...
  
  // Toggle snap with 'G' key
  if (e.key === 'g' || e.key === 'G') {
    const enabled = snapManager.toggle();
    const btn = document.getElementById('snap-toggle');
    if (btn) {
      if (enabled) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
    updateSnapStatus();
  }
});

console.log('Snap system loaded. Press G to toggle, use dropdown to change grid spacing');
```

## Test Plan

### Manual Testing Steps

1. **Grid spacing UI test**
   - Load application
   - Verify dropdown shows grid spacing options (1, 5, 10, 50, 100 cm)
   - Verify "10 cm" is selected by default
   - Verify snap button shows "🧲 Snap" with green highlight
   - Verify status bar shows "SNAP: ON (10 cm)"

2. **Grid spacing change test**
   - Select "5 cm" from dropdown
   - Verify grid re-renders with finer spacing
   - Verify status bar updates to "SNAP: ON (5 cm)"
   - Select "100 cm"
   - Verify grid shows coarser spacing (1 meter intervals)
   - Select "1 cm"
   - Verify very fine grid (may be dense at low zoom)

3. **Snap toggle test**
   - Click snap button
   - Verify button loses green highlight
   - Verify status bar shows "SNAP: OFF"
   - Click again
   - Verify button regains green highlight
   - Verify status shows "SNAP: ON (X cm)"

4. **Snap during point drawing test**
   - Select Point tool
   - Ensure snap is ON, grid = 10 cm
   - Move mouse near but not exactly on grid intersection
   - Verify orange crosshair snap indicator appears at nearest grid point
   - Click to place point
   - Verify point placed exactly at grid intersection
   - Verify console shows coordinates as multiples of 10 (e.g., 500, 1200)
   - Move mouse to another location
   - Verify snap indicator follows nearest grid point

5. **Snap during line drawing test**
   - Select Line tool
   - Grid = 10 cm, snap ON
   - Click start point near (495, 503)
   - Verify start point snaps to (500, 500)
   - Move mouse near (1203, 798)
   - Verify preview line end snaps to (1200, 800)
   - Verify length label shows precise distance (e.g., 806.2 cm)
   - Click to complete line
   - Verify line endpoints at exact grid positions

6. **Snap during circle drawing test**
   - Select Circle tool
   - Click center near (753, 602)
   - Verify center snaps to (750, 600)
   - Move mouse to set radius
   - Note: radius value itself doesn't snap, only center position
   - Complete circle
   - Verify center at exact grid position

7. **Snap during move test**
   - Select tool, select an object
   - Drag object near grid intersection
   - Verify object snaps to grid during drag
   - Release at snapped position
   - Verify object placed at exact grid point
   - Hover to verify coordinates

8. **Snap OFF test**
   - Turn snap OFF (click button or press G)
   - Select Point tool
   - Move mouse and click
   - Verify NO orange snap indicator appears
   - Verify point placed at exact mouse position (not grid)
   - Check coordinates - should show decimals, not round numbers

9. **Keyboard shortcut test**
   - Press 'G' key
   - Verify snap toggles OFF (button and status update)
   - Press 'G' again
   - Verify snap toggles ON
   - Test with uppercase (Shift+G)
   - Verify same behavior

10. **Grid spacing with zoom test**
    - Set grid to 1 cm
    - Zoom out significantly
    - Verify grid doesn't become too dense (performance check)
    - Set grid to 100 cm
    - Zoom in closely
    - Verify grid lines are appropriately spaced
    - Verify major/minor grid distinction (every 5th line darker)

11. **Snap indicator visibility test**
    - With snap ON, use any drawing tool
    - Move mouse slowly around canvas
    - Verify snap indicator appears/disappears cleanly
    - Verify indicator always shows at grid intersections
    - Zoom in/out
    - Verify indicator scales appropriately (always visible)

12. **Multiple grid spacing workflow test**
    - Draw rough layout with 100 cm grid
    - Switch to 10 cm grid for detailed placement
    - Switch to 5 cm for fine adjustments
    - Verify all objects remain at their positions
    - Verify new objects snap to current grid setting

## Acceptance Criteria

- [ ] Grid spacing dropdown displays options: 1, 5, 10, 50, 100 cm
- [ ] Changing grid spacing re-renders grid immediately
- [ ] Snap toggle button enables/disables snapping
- [ ] Snap button shows visual state (green when ON)
- [ ] Status bar displays current snap state and grid spacing
- [ ] Orange crosshair snap indicator appears when snapping
- [ ] Point tool snaps to grid when enabled
- [ ] Line tool snaps start and end points to grid
- [ ] Circle tool snaps center point to grid
- [ ] Select/move tool snaps object positions to grid
- [ ] Snap indicator disappears when snap is OFF
- [ ] No snapping occurs when snap is disabled
- [ ] Keyboard shortcut 'G' toggles snap on/off
- [ ] Console logs show "[SNAPPED]" notation when appropriate
- [ ] Snapped coordinates are exact multiples of grid spacing
- [ ] Grid visually distinguishes major/minor lines
- [ ] Snap indicator scales properly at all zoom levels
- [ ] No performance degradation with fine grids (1 cm)
- [ ] No TypeScript compilation errors

## Deliverables

1. **src/snapping/SnapManager.ts** - Centralized snapping logic
2. **src/snapping/SnapIndicator.ts** - Visual snap feedback (orange crosshair)
3. **Updated src/viewport/Grid.ts** - Configurable spacing with major/minor lines
4. **Updated src/viewport/Viewport.ts** - Snap system integration
5. **Updated src/tools/PointTool.ts** - Snap support
6. **Updated src/tools/LineTool.ts** - Snap support for start/end points
7. **Updated src/tools/CircleTool.ts** - Snap support for center
8. **Updated src/tools/SelectTool.ts** - Snap support during move
9. **Updated src/main.ts** - Snap UI controls (dropdown, toggle, status)
10. **Working snap system** - Visual feedback, configurable spacing, keyboard shortcut

---

**Estimated effort**: 2-3 hours  
**Dependencies**: Slice 5 (drawing tools)  
**Risk**: Low - straightforward rounding logic, visual feedback implementation
