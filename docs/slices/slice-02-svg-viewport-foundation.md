# Slice 2: SVG Viewport Foundation

## User Value

As a user, I need a zoomable and pannable 2D canvas with a visible grid so that I can navigate a large garden plan and understand the scale and coordinate system (where 1 SVG unit = 1 cm real-world).

## Slice Features

1. **SVG canvas rendering** with infinite 2D plane
2. **Coordinate system** where 1 SVG unit = 1 centimeter
3. **Pan interaction** using mouse drag (middle button or Shift+drag)
4. **Zoom interaction** using mouse wheel with cursor-centered zoom
5. **Visual grid** with configurable spacing (default 10 cm)
6. **Coordinate display** showing current mouse position in cm
7. **Reset view button** to return to origin (0,0) at 1:1 zoom
8. **Coordinate stability** - geometry coordinates never change when viewport transforms

## Technical Implementation Sketch

### File Structure

```
src/
├── main.ts                    # Initialize viewport and UI
├── viewport/
│   ├── Viewport.ts           # Core viewport class
│   ├── ViewportTransform.ts  # Pan/zoom transform management
│   └── Grid.ts               # Grid rendering
├── types/
│   └── geometry.ts           # Basic geometry types (Point, Bounds)
└── utils/
    └── svg.ts                # SVG utility functions
```

### Core Concepts

**Separation of Concerns**:
- **World coordinates**: Immutable geometry data stored in centimeters
- **Viewport transform**: Mutable pan/zoom state applied to SVG `<g>` element
- **Screen coordinates**: Mouse events in pixel space, converted to world space

**Transform Model**:
```typescript
interface ViewportTransform {
  x: number;        // Pan offset X (in SVG units)
  y: number;        // Pan offset Y (in SVG units)
  scale: number;    // Zoom level (1.0 = 1 SVG unit = 1 screen pixel)
  rotation: number; // Z-axis rotation in degrees (0 = north-up) - for later
}
```

### src/types/geometry.ts

```typescript
export interface Point {
  x: number; // centimeters
  y: number; // centimeters
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
  rotation: number; // degrees, 0 = north-up
}
```

### src/viewport/ViewportTransform.ts

```typescript
import { Point, ViewportState } from '../types/geometry';

export class ViewportTransform {
  private state: ViewportState;

  constructor() {
    this.state = { panX: 0, panY: 0, zoom: 1.0, rotation: 0 };
  }

  // Convert screen pixel coordinates to world coordinates (cm)
  screenToWorld(screenX: number, screenY: number): Point {
    return {
      x: (screenX - this.state.panX) / this.state.zoom,
      y: (screenY - this.state.panY) / this.state.zoom
    };
  }

  // Convert world coordinates (cm) to screen pixels
  worldToScreen(worldX: number, worldY: number): Point {
    return {
      x: worldX * this.state.zoom + this.state.panX,
      y: worldY * this.state.zoom + this.state.panY
    };
  }

  // Apply pan offset
  pan(deltaX: number, deltaY: number): void {
    this.state.panX += deltaX;
    this.state.panY += deltaY;
  }

  // Apply zoom centered on a screen point
  zoomAt(screenX: number, screenY: number, zoomDelta: number): void {
    const worldBefore = this.screenToWorld(screenX, screenY);
    this.state.zoom *= zoomDelta;
    this.state.zoom = Math.max(0.1, Math.min(100, this.state.zoom));
    const worldAfter = this.screenToWorld(screenX, screenY);
    
    // Adjust pan to keep world point under cursor
    this.state.panX += (worldAfter.x - worldBefore.x) * this.state.zoom;
    this.state.panY += (worldAfter.y - worldBefore.y) * this.state.zoom;
  }

  // Reset to origin
  reset(): void {
    this.state = { panX: 0, panY: 0, zoom: 1.0, rotation: 0 };
  }

  // Get current state for rendering
  getState(): ViewportState {
    return { ...this.state };
  }

  // Get SVG transform string
  toSVGTransform(): string {
    return `translate(${this.state.panX}, ${this.state.panY}) scale(${this.state.zoom})`;
  }
}
```

### src/viewport/Grid.ts

```typescript
import { ViewportState } from '../types/geometry';

export class Grid {
  private gridSpacing: number = 100; // 100 cm = 1 meter default

  setSpacing(spacingCm: number): void {
    this.gridSpacing = spacingCm;
  }

  // Generate grid SVG elements based on visible bounds
  render(svg: SVGSVGElement, viewportState: ViewportState): void {
    const existingGrid = svg.querySelector('#grid');
    if (existingGrid) {
      existingGrid.remove();
    }

    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridGroup.id = 'grid';

    // Calculate visible world bounds
    const svgRect = svg.getBoundingClientRect();
    const transform = new ViewportTransform();
    // Reconstruct transform from state (simplified for grid)
    const topLeft = this.screenToWorldSimple(0, 0, viewportState);
    const bottomRight = this.screenToWorldSimple(svgRect.width, svgRect.height, viewportState);

    const minX = Math.floor(topLeft.x / this.gridSpacing) * this.gridSpacing;
    const maxX = Math.ceil(bottomRight.x / this.gridSpacing) * this.gridSpacing;
    const minY = Math.floor(topLeft.y / this.gridSpacing) * this.gridSpacing;
    const maxY = Math.ceil(bottomRight.y / this.gridSpacing) * this.gridSpacing;

    // Vertical lines
    for (let x = minX; x <= maxX; x += this.gridSpacing) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x.toString());
      line.setAttribute('y1', minY.toString());
      line.setAttribute('x2', x.toString());
      line.setAttribute('y2', maxY.toString());
      line.setAttribute('stroke', '#ddd');
      line.setAttribute('stroke-width', (1 / viewportState.zoom).toString());
      gridGroup.appendChild(line);
    }

    // Horizontal lines
    for (let y = minY; y <= maxY; y += this.gridSpacing) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', minX.toString());
      line.setAttribute('y1', y.toString());
      line.setAttribute('x2', maxX.toString());
      line.setAttribute('y2', y.toString());
      line.setAttribute('stroke', '#ddd');
      line.setAttribute('stroke-width', (1 / viewportState.zoom).toString());
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

### src/viewport/Viewport.ts

```typescript
import { ViewportTransform } from './ViewportTransform';
import { Grid } from './Grid';
import { Point } from '../types/geometry';

export class Viewport {
  private svg: SVGSVGElement;
  private worldGroup: SVGGElement;
  private transform: ViewportTransform;
  private grid: Grid;
  private isPanning: boolean = false;
  private lastMousePos: Point = { x: 0, y: 0 };
  private coordinateDisplay: HTMLElement;

  constructor(container: HTMLElement) {
    this.transform = new ViewportTransform();
    this.grid = new Grid();

    // Create SVG
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';
    this.svg.style.background = '#f8f8f8';

    // Create world coordinate group
    this.worldGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.worldGroup.id = 'world';
    this.svg.appendChild(this.worldGroup);

    container.appendChild(this.svg);

    // Create coordinate display overlay
    this.coordinateDisplay = document.createElement('div');
    this.coordinateDisplay.style.position = 'absolute';
    this.coordinateDisplay.style.bottom = '10px';
    this.coordinateDisplay.style.right = '10px';
    this.coordinateDisplay.style.background = 'rgba(0,0,0,0.7)';
    this.coordinateDisplay.style.color = 'white';
    this.coordinateDisplay.style.padding = '8px 12px';
    this.coordinateDisplay.style.fontFamily = 'monospace';
    this.coordinateDisplay.style.fontSize = '12px';
    this.coordinateDisplay.style.borderRadius = '4px';
    this.coordinateDisplay.style.pointerEvents = 'none';
    container.appendChild(this.coordinateDisplay);

    this.attachEventListeners();
    this.render();
  }

  private attachEventListeners(): void {
    // Pan on middle mouse or Shift+drag
    this.svg.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        this.isPanning = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;
        this.transform.pan(dx, dy);
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this.render();
      }

      // Update coordinate display
      const rect = this.svg.getBoundingClientRect();
      const worldPos = this.transform.screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top
      );
      this.coordinateDisplay.textContent = 
        `X: ${worldPos.x.toFixed(1)} cm  Y: ${worldPos.y.toFixed(1)} cm  Zoom: ${(this.transform.getState().zoom * 100).toFixed(0)}%`;
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
    });

    // Zoom on wheel
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.svg.getBoundingClientRect();
      const zoomDelta = e.deltaY < 0 ? 1.1 : 0.9;
      this.transform.zoomAt(e.clientX - rect.left, e.clientY - rect.top, zoomDelta);
      this.render();
    });
  }

  private render(): void {
    // Apply transform to world group
    this.worldGroup.setAttribute('transform', this.transform.toSVGTransform());

    // Render grid in world coordinates
    this.grid.render(this.worldGroup, this.transform.getState());
  }

  reset(): void {
    this.transform.reset();
    this.render();
  }

  getWorldGroup(): SVGGElement {
    return this.worldGroup;
  }
}
```

### src/main.ts

```typescript
import { Viewport } from './viewport/Viewport';

console.log('GardenCAD v0.2 - SVG Viewport');

const app = document.getElementById('app');
if (!app) {
  throw new Error('App container not found');
}

// Create UI structure
app.innerHTML = `
  <div style="display: flex; flex-direction: column; width: 100%; height: 100vh;">
    <div style="padding: 10px; background: #333; color: white; display: flex; gap: 10px; align-items: center;">
      <h1 style="margin: 0; font-size: 18px;">GardenCAD</h1>
      <button id="reset-view">Reset View</button>
      <span style="margin-left: auto; font-size: 12px;">Pan: Shift+Drag or Middle Mouse | Zoom: Mouse Wheel</span>
    </div>
    <div id="viewport-container" style="flex: 1; position: relative;"></div>
  </div>
`;

const container = document.getElementById('viewport-container');
if (!container) {
  throw new Error('Viewport container not found');
}

const viewport = new Viewport(container);

document.getElementById('reset-view')?.addEventListener('click', () => {
  viewport.reset();
});
```

### Update index.html styles

```html
<style>
  body { 
    margin: 0; 
    padding: 0; 
    font-family: system-ui, sans-serif;
    overflow: hidden;
  }
  #app { 
    width: 100vw; 
    height: 100vh; 
  }
  button {
    padding: 6px 12px;
    border: none;
    background: #555;
    color: white;
    border-radius: 4px;
    cursor: pointer;
  }
  button:hover {
    background: #666;
  }
</style>
```

## Test Plan

### Manual Testing Steps

1. **Viewport initialization test**
   - Start dev server (`npm run dev`)
   - Open browser
   - Verify SVG canvas fills viewport below header
   - Verify grid is visible with light gray lines
   - Verify coordinate display shows in bottom-right corner

2. **Coordinate system test**
   - Hover mouse over canvas
   - Verify coordinates update in bottom-right
   - Hover at different positions
   - Verify coordinates change appropriately (cm units)
   - Place mouse at canvas center - note coordinates

3. **Pan test**
   - Hold Shift and drag mouse
   - Verify canvas pans smoothly
   - Verify grid moves with pan
   - Verify coordinate display updates to show world position
   - Release and verify pan stops
   - Try middle mouse button drag (if available)
   - Verify same behavior

4. **Zoom test**
   - Scroll mouse wheel up (zoom in)
   - Verify grid appears larger
   - Verify zoom percentage increases in coordinate display
   - Scroll mouse wheel down (zoom out)
   - Verify grid appears smaller
   - Verify zoom percentage decreases
   - Verify zoom centers on cursor position (point under cursor stays fixed)

5. **Cursor-centered zoom test**
   - Hover over specific grid intersection
   - Zoom in several times
   - Verify that grid intersection stays under cursor
   - Zoom out
   - Verify same stability

6. **Reset view test**
   - Pan and zoom to arbitrary position
   - Click "Reset View" button
   - Verify view returns to origin (0,0)
   - Verify zoom returns to 100%
   - Verify coordinate display shows ~0,0 at center

7. **Coordinate stability test**
   - Note a specific grid intersection position
   - Pan and zoom to different views
   - Return to original view (or reset)
   - Verify grid intersection is at same position
   - Grid lines should remain at fixed world coordinates (multiples of 100 cm)

8. **Performance test**
   - Zoom in and out rapidly
   - Pan around extensively
   - Verify no lag or stuttering
   - Verify smooth interactions at various zoom levels

## Acceptance Criteria

- [ ] SVG canvas fills viewport container and displays grid
- [ ] Grid lines represent fixed world coordinates (default 100 cm spacing)
- [ ] Mouse coordinate display shows position in centimeters
- [ ] Shift+drag pans the viewport smoothly
- [ ] Middle mouse drag pans the viewport (if available)
- [ ] Mouse wheel zooms in/out centered on cursor position
- [ ] Zoom level displays as percentage in coordinate display
- [ ] Reset View button returns to origin at 100% zoom
- [ ] Grid coordinates never change when viewport transforms
- [ ] Coordinate display updates in real-time on mouse move
- [ ] No TypeScript compilation errors
- [ ] Smooth 60fps interaction during pan and zoom

## Deliverables

1. **src/types/geometry.ts** - Basic geometry types (Point, Bounds, ViewportState)
2. **src/viewport/ViewportTransform.ts** - Transform management with screen↔world conversion
3. **src/viewport/Grid.ts** - Grid rendering based on viewport state
4. **src/viewport/Viewport.ts** - Main viewport class with pan/zoom interaction
5. **src/utils/svg.ts** - SVG utility functions (if needed)
6. **Updated src/main.ts** - Initialize viewport with UI controls
7. **Updated index.html** - Enhanced styles for viewport UI
8. **Working interactive viewport** - Pan, zoom, grid, coordinate display

---

**Estimated effort**: 2-3 hours  
**Dependencies**: Slice 1 (dev environment)  
**Risk**: Medium - transform math must be precise for coordinate stability
