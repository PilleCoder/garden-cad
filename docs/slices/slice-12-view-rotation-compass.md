# Slice 12: View Rotation and Compass

## User Value

As a user, I need to rotate the viewport to align with different viewing angles (especially aligning with property boundaries or solar orientation) and see a compass indicating north, so that I can plan gardens with respect to cardinal directions for sun exposure and spatial orientation.

## Slice Features

1. **Viewport rotation** - Rotate entire view around center point
2. **Rotation controls** - Mouse drag to rotate (Alt+drag or dedicated mode)
3. **Rotation angle display** - Show current rotation in degrees
4. **North-up button** - Reset rotation to 0° (north up)
5. **Compass overlay** - Visual compass rose showing cardinal directions
6. **Azimuth labels** - N, E, S, W markers that stay oriented
7. **Rotation angle input** - Text field to set exact angle
8. **Rotation preserved** - Save/load maintains viewport rotation
9. **Grid rotates with view** - Grid aligns with rotated viewport
10. **Coordinate system independence** - World coordinates unchanged by rotation

## Technical Implementation Sketch

### File Structure

```
src/
├── viewport/
│   ├── ViewportTransform.ts    # Add rotation support
│   ├── Compass.ts               # Compass overlay UI
│   └── Grid.ts                  # Update to support rotation
├── tools/
│   └── RotateTool.ts            # Dedicated rotation interaction
└── main.ts                      # Updated with rotation controls
```

### Core Concepts

**Rotation Model**:
- Rotation angle stored in radians (0 = north up)
- Positive rotation = clockwise
- Rotation applied via SVG transform after pan/zoom
- Transform order: translate → scale → rotate

**Coordinate Transformation**:
```
World → Screen: point → pan → zoom → rotate → screen
Screen → World: screen → inverse-rotate → inverse-zoom → inverse-pan → world
```

**Compass Design**:
- Fixed position overlay (top-left corner)
- Shows N/E/S/W regardless of view rotation
- Red arrow for north, subtle for other directions
- Rotates opposite to view (stays world-aligned)

**Grid Rotation**:
- Grid lines rotate with viewport
- Major/minor lines maintain spacing
- Grid origin stays at world (0, 0)

### src/viewport/ViewportTransform.ts (enhanced)

```typescript
export class ViewportTransform {
  private panX: number = 0;
  private panY: number = 0;
  private zoom: number = 1.0;
  private rotation: number = 0; // radians, 0 = north up

  // ... existing pan/zoom methods ...

  setRotation(radians: number): void {
    this.rotation = radians;
  }

  getRotation(): number {
    return this.rotation;
  }

  getRotationDegrees(): number {
    return this.rotation * 180 / Math.PI;
  }

  setRotationDegrees(degrees: number): void {
    this.rotation = degrees * Math.PI / 180;
  }

  rotate(deltaRadians: number): void {
    this.rotation += deltaRadians;
    // Normalize to [0, 2π)
    this.rotation = ((this.rotation % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
  }

  /**
   * Convert screen coordinates to world coordinates with rotation.
   */
  screenToWorld(screenX: number, screenY: number, viewportWidth: number, viewportHeight: number): Point {
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    // Translate to origin
    let x = screenX - centerX;
    let y = screenY - centerY;

    // Inverse rotate
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const xRot = x * cos - y * sin;
    const yRot = x * sin + y * cos;

    // Inverse zoom
    const xZoom = xRot / this.zoom;
    const yZoom = yRot / this.zoom;

    // Inverse pan
    const worldX = xZoom - this.panX;
    const worldY = yZoom - this.panY;

    return { x: worldX, y: worldY };
  }

  /**
   * Convert world coordinates to screen coordinates with rotation.
   */
  worldToScreen(worldX: number, worldY: number, viewportWidth: number, viewportHeight: number): Point {
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    // Apply pan
    let x = worldX + this.panX;
    let y = worldY + this.panY;

    // Apply zoom
    x *= this.zoom;
    y *= this.zoom;

    // Apply rotation
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const xRot = x * cos - y * sin;
    const yRot = x * sin + y * cos;

    // Translate from origin
    return {
      x: xRot + centerX,
      y: yRot + centerY
    };
  }

  /**
   * Get SVG transform string including rotation.
   */
  toSVGTransform(viewportWidth: number, viewportHeight: number): string {
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    const degrees = this.getRotationDegrees();
    
    // Transform order: translate to center → rotate → scale → translate for pan
    return `translate(${centerX}, ${centerY}) rotate(${degrees}) scale(${this.zoom}) translate(${this.panX}, ${this.panY})`;
  }

  /**
   * Reset rotation to north-up.
   */
  resetRotation(): void {
    this.rotation = 0;
  }

  /**
   * Serialize transform state.
   */
  toJSON(): any {
    return {
      panX: this.panX,
      panY: this.panY,
      zoom: this.zoom,
      rotation: this.rotation
    };
  }

  /**
   * Restore transform state.
   */
  fromJSON(data: any): void {
    this.panX = data.panX || 0;
    this.panY = data.panY || 0;
    this.zoom = data.zoom || 1.0;
    this.rotation = data.rotation || 0;
  }
}
```

### src/viewport/Compass.ts

```typescript
import { ViewportTransform } from './ViewportTransform';

export class Compass {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size: number = 80;
  private transform: ViewportTransform;

  constructor(transform: ViewportTransform) {
    this.transform = transform;
    this.container = this.createContainer();
    this.canvas = this.createCanvas();
    this.ctx = this.canvas.getContext('2d')!;
    this.container.appendChild(this.canvas);
  }

  private createContainer(): HTMLElement {
    const div = document.createElement('div');
    div.id = 'compass';
    div.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      width: ${this.size}px;
      height: ${this.size}px;
      background: rgba(255, 255, 255, 0.9);
      border: 2px solid #333;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      z-index: 100;
    `;
    return div;
  }

  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.size;
    canvas.height = this.size;
    canvas.style.cssText = 'display: block;';
    return canvas;
  }

  render(): void {
    const ctx = this.ctx;
    const center = this.size / 2;
    const radius = center - 10;

    // Clear
    ctx.clearRect(0, 0, this.size, this.size);

    // Get current rotation (in opposite direction for compass)
    const rotation = -this.transform.getRotation();

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(rotation);

    // Draw outer circle
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw cardinal directions
    this.drawCardinalMarker(ctx, 0, 'N', '#cc0000', radius, true); // North - red, prominent
    this.drawCardinalMarker(ctx, Math.PI / 2, 'E', '#666', radius, false); // East
    this.drawCardinalMarker(ctx, Math.PI, 'S', '#666', radius, false); // South
    this.drawCardinalMarker(ctx, 3 * Math.PI / 2, 'W', '#666', radius, false); // West

    // Draw north arrow
    this.drawNorthArrow(ctx, radius);

    // Draw tick marks every 30 degrees
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30) * Math.PI / 180;
      const isCardinal = i % 3 === 0;
      const tickLength = isCardinal ? 8 : 5;
      const tickWidth = isCardinal ? 2 : 1;
      
      ctx.strokeStyle = '#666';
      ctx.lineWidth = tickWidth;
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.lineTo(0, -radius + tickLength);
      ctx.stroke();
      
      ctx.rotate(30 * Math.PI / 180);
    }

    ctx.restore();
  }

  private drawCardinalMarker(
    ctx: CanvasRenderingContext2D,
    angle: number,
    label: string,
    color: string,
    radius: number,
    prominent: boolean
  ): void {
    ctx.save();
    ctx.rotate(angle);
    
    // Label
    ctx.fillStyle = color;
    ctx.font = prominent ? 'bold 16px Arial' : '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, -radius + (prominent ? 18 : 20));
    
    ctx.restore();
  }

  private drawNorthArrow(ctx: CanvasRenderingContext2D, radius: number): void {
    ctx.fillStyle = '#cc0000';
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 2;

    // Arrow pointing up (north)
    ctx.beginPath();
    ctx.moveTo(0, -radius + 8); // Tip
    ctx.lineTo(-6, -radius + 20); // Left base
    ctx.lineTo(0, -radius + 16); // Center notch
    ctx.lineTo(6, -radius + 20); // Right base
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  unmount(): void {
    this.container.remove();
  }

  update(): void {
    this.render();
  }
}
```

### src/tools/RotateTool.ts

```typescript
import { Tool, ToolMouseEvent } from './Tool';
import { ViewportTransform } from '../viewport/ViewportTransform';

export class RotateTool implements Tool {
  readonly name = 'rotate';

  private transform: ViewportTransform;
  private onUpdate: () => void;
  private isDragging: boolean = false;
  private lastAngle: number = 0;
  private centerX: number = 0;
  private centerY: number = 0;

  constructor(transform: ViewportTransform, onUpdate: () => void) {
    this.transform = transform;
    this.onUpdate = onUpdate;
  }

  onActivate(): void {
    console.log('Rotate tool activated - drag to rotate view');
  }

  onDeactivate(): void {
    this.isDragging = false;
  }

  onMouseDown(event: ToolMouseEvent): void {
    this.isDragging = true;
    this.centerX = event.screenPos.x;
    this.centerY = event.screenPos.y;
    this.lastAngle = this.calculateAngle(event.screenPos.x, event.screenPos.y);
  }

  onMouseMove(event: ToolMouseEvent): void {
    if (!this.isDragging) return;

    const currentAngle = this.calculateAngle(event.screenPos.x, event.screenPos.y);
    const deltaAngle = currentAngle - this.lastAngle;
    
    this.transform.rotate(deltaAngle);
    this.lastAngle = currentAngle;
    this.onUpdate();
  }

  onMouseUp(event: ToolMouseEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      const degrees = this.transform.getRotationDegrees();
      console.log(`View rotated to ${degrees.toFixed(1)}°`);
    }
  }

  onMouseClick(event: ToolMouseEvent): void {
    // Not used
  }

  getCursor(): string {
    return this.isDragging ? 'grabbing' : 'grab';
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      this.isDragging = false;
    }
  }

  private calculateAngle(x: number, y: number): number {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    return Math.atan2(dy, dx);
  }
}
```

### src/viewport/Grid.ts (update for rotation)

```typescript
// Update renderGrid method to account for rotation:

renderGrid(
  group: SVGGElement, 
  viewportWidth: number, 
  viewportHeight: number, 
  transform: ViewportTransform
): void {
  this.clearGrid(group);

  if (!this.visible) return;

  const zoom = transform.getZoom();
  const rotation = transform.getRotation();
  
  // Apply transform to grid group
  const svgTransform = transform.toSVGTransform(viewportWidth, viewportHeight);
  group.setAttribute('transform', svgTransform);

  // Calculate grid bounds in world space
  const corners = [
    transform.screenToWorld(0, 0, viewportWidth, viewportHeight),
    transform.screenToWorld(viewportWidth, 0, viewportWidth, viewportHeight),
    transform.screenToWorld(0, viewportHeight, viewportWidth, viewportHeight),
    transform.screenToWorld(viewportWidth, viewportHeight, viewportWidth, viewportHeight)
  ];

  const minX = Math.min(...corners.map(c => c.x));
  const maxX = Math.max(...corners.map(c => c.x));
  const minY = Math.min(...corners.map(c => c.y));
  const maxY = Math.max(...corners.map(c => c.y));

  // Expand bounds to account for rotation
  const expansion = Math.max(viewportWidth, viewportHeight) / zoom;
  const worldMinX = Math.floor((minX - expansion) / this.spacing) * this.spacing;
  const worldMaxX = Math.ceil((maxX + expansion) / this.spacing) * this.spacing;
  const worldMinY = Math.floor((minY - expansion) / this.spacing) * this.spacing;
  const worldMaxY = Math.ceil((maxY + expansion) / this.spacing) * this.spacing;

  // Draw vertical lines
  for (let x = worldMinX; x <= worldMaxX; x += this.spacing) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const isMajor = Math.abs(x % (this.spacing * this.majorEvery)) < 0.01;
    
    line.setAttribute('x1', x.toString());
    line.setAttribute('y1', (worldMinY - expansion).toString());
    line.setAttribute('x2', x.toString());
    line.setAttribute('y2', (worldMaxY + expansion).toString());
    line.setAttribute('stroke', isMajor ? this.majorColor : this.minorColor);
    line.setAttribute('stroke-width', (isMajor ? 1.5 / zoom : 0.5 / zoom).toString());
    line.setAttribute('opacity', isMajor ? '0.4' : '0.2');
    line.setAttribute('pointer-events', 'none');
    
    group.appendChild(line);
  }

  // Draw horizontal lines
  for (let y = worldMinY; y <= worldMaxY; y += this.spacing) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const isMajor = Math.abs(y % (this.spacing * this.majorEvery)) < 0.01;
    
    line.setAttribute('x1', (worldMinX - expansion).toString());
    line.setAttribute('y1', y.toString());
    line.setAttribute('x2', (worldMaxX + expansion).toString());
    line.setAttribute('y2', y.toString());
    line.setAttribute('stroke', isMajor ? this.majorColor : this.minorColor);
    line.setAttribute('stroke-width', (isMajor ? 1.5 / zoom : 0.5 / zoom).toString());
    line.setAttribute('opacity', isMajor ? '0.4' : '0.2');
    line.setAttribute('pointer-events', 'none');
    
    group.appendChild(line);
  }

  // Draw origin marker (more visible)
  const originSize = 20 / zoom;
  const originMarker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  hLine.setAttribute('x1', (-originSize).toString());
  hLine.setAttribute('y1', '0');
  hLine.setAttribute('x2', originSize.toString());
  hLine.setAttribute('y2', '0');
  hLine.setAttribute('stroke', '#cc0000');
  hLine.setAttribute('stroke-width', (2 / zoom).toString());
  
  const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  vLine.setAttribute('x1', '0');
  vLine.setAttribute('y1', (-originSize).toString());
  vLine.setAttribute('x2', '0');
  vLine.setAttribute('y2', originSize.toString());
  vLine.setAttribute('stroke', '#cc0000');
  vLine.setAttribute('stroke-width', (2 / zoom).toString());
  
  originMarker.appendChild(hLine);
  originMarker.appendChild(vLine);
  group.appendChild(originMarker);
}
```

### src/main.ts (rotation controls)

```typescript
import { RotateTool } from './tools/RotateTool';
import { Compass } from './viewport/Compass';

// Create compass
const compass = new Compass(viewport.getTransform());
compass.mount(document.body);

// Create rotation controls panel
const rotationPanel = document.createElement('div');
rotationPanel.id = 'rotation-panel';
rotationPanel.style.cssText = `
  position: absolute;
  top: 110px;
  left: 20px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  font-family: Arial, sans-serif;
  font-size: 13px;
  z-index: 100;
`;

const rotationLabel = document.createElement('div');
rotationLabel.textContent = 'Rotation: 0.0°';
rotationLabel.style.cssText = 'margin-bottom: 8px; font-weight: bold;';
rotationPanel.appendChild(rotationLabel);

// Angle input
const angleInput = document.createElement('input');
angleInput.type = 'number';
angleInput.min = '0';
angleInput.max = '360';
angleInput.step = '1';
angleInput.value = '0';
angleInput.style.cssText = 'width: 60px; margin-right: 8px;';
angleInput.addEventListener('change', () => {
  const degrees = parseFloat(angleInput.value) % 360;
  viewport.getTransform().setRotationDegrees(degrees);
  updateView();
  console.log(`View rotation set to ${degrees.toFixed(1)}°`);
});
rotationPanel.appendChild(angleInput);

// North-up button
const northUpBtn = document.createElement('button');
northUpBtn.textContent = 'North ↑';
northUpBtn.style.cssText = `
  padding: 4px 10px;
  background: #0066ff;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
`;
northUpBtn.addEventListener('click', () => {
  viewport.getTransform().resetRotation();
  angleInput.value = '0';
  updateView();
  console.log('View reset to north-up');
});
rotationPanel.appendChild(northUpBtn);

document.body.appendChild(rotationPanel);

// Create rotate tool
const rotateTool = new RotateTool(viewport.getTransform(), updateView);

// Add to toolbar
const rotateToolBtn = document.createElement('button');
rotateToolBtn.id = 'tool-rotate';
rotateToolBtn.className = 'tool-btn';
rotateToolBtn.textContent = 'Rotate View';
document.querySelector('.toolbar')?.appendChild(rotateToolBtn);

// Add to tools object
const tools = {
  // ... existing tools ...
  rotate: rotateTool
};

rotateToolBtn.addEventListener('click', () => setTool('rotate'));

// Alternative: Alt+drag for rotation (without switching tools)
let altPressed = false;
let rotateStartAngle = 0;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt') {
    altPressed = true;
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'Alt') {
    altPressed = false;
  }
});

// Modify viewport mouse handlers for Alt+drag rotation
let isRotating = false;
let rotateCenterX = 0;
let rotateCenterY = 0;

viewport.getSVG().addEventListener('mousedown', (e) => {
  if (altPressed && activeTool === 'select') {
    isRotating = true;
    rotateCenterX = e.clientX;
    rotateCenterY = e.clientY;
    rotateStartAngle = Math.atan2(e.clientY - rotateCenterY, e.clientX - rotateCenterX);
    e.preventDefault();
    return;
  }
  // ... existing mouse down logic ...
});

viewport.getSVG().addEventListener('mousemove', (e) => {
  if (isRotating) {
    const currentAngle = Math.atan2(e.clientY - rotateCenterY, e.clientX - rotateCenterX);
    const deltaAngle = currentAngle - rotateStartAngle;
    viewport.getTransform().rotate(deltaAngle);
    rotateStartAngle = currentAngle;
    updateView();
    return;
  }
  // ... existing mouse move logic ...
});

viewport.getSVG().addEventListener('mouseup', (e) => {
  if (isRotating) {
    isRotating = false;
    const degrees = viewport.getTransform().getRotationDegrees();
    console.log(`View rotated to ${degrees.toFixed(1)}° (Alt+drag)`);
    return;
  }
  // ... existing mouse up logic ...
});

// Update rotation display on every render
function updateView() {
  const transform = viewport.getTransform();
  const degrees = transform.getRotationDegrees();
  
  rotationLabel.textContent = `Rotation: ${degrees.toFixed(1)}°`;
  angleInput.value = degrees.toFixed(1);
  
  compass.update();
  
  // ... existing render logic ...
}

// Keyboard shortcut for rotate tool
document.addEventListener('keydown', (e) => {
  // ... existing shortcuts ...
  if (e.key === 'R' || e.key === 'r') {
    setTool('rotate');
  }
});

// Update persistence to include rotation
function saveProject() {
  const projectData = {
    version: '1.0',
    objects: project.getObjects().map(obj => obj.toJSON()),
    layers: layerManager.getLayers().map(layer => layer.toJSON()),
    viewport: viewport.getTransform().toJSON(), // Includes rotation
    timestamp: new Date().toISOString()
  };
  
  // ... save logic ...
}

function loadProject(data: any) {
  // ... existing load logic ...
  
  if (data.viewport) {
    viewport.getTransform().fromJSON(data.viewport);
    updateView();
  }
}

console.log('Rotation enabled: R key or Alt+drag to rotate view');
```

### HTML styles for rotation UI

```html
<style>
  #compass {
    transition: opacity 0.2s;
  }
  
  #compass:hover {
    opacity: 0.7;
  }
  
  #rotation-panel button:hover {
    background: #0052cc;
  }
  
  #rotation-panel button:active {
    background: #003d99;
  }
  
  #rotation-panel input:focus {
    outline: 2px solid #0066ff;
  }
</style>
```

## Test Plan

### Manual Testing Steps

1. **Basic rotation test**
   - Create a horizontal line
   - Click "Rotate View" button
   - Drag mouse in circular motion
   - Verify view rotates smoothly
   - Verify line appears rotated on screen

2. **Compass display test**
   - Verify compass appears in top-left corner
   - Verify compass shows N, E, S, W labels
   - Verify red north arrow pointing up
   - Verify compass is circular with border

3. **Compass rotation test**
   - Rotate view 90° clockwise
   - Verify compass rotates counter-clockwise
   - Verify north arrow still points to world north
   - Rotate view 180°
   - Verify south (S) label now at top

4. **Rotation angle display test**
   - Rotate view
   - Verify "Rotation: X.X°" updates in real-time
   - Verify angle input field updates
   - Verify precision to 0.1°

5. **North-up button test**
   - Rotate view to arbitrary angle (e.g., 135°)
   - Click "North ↑" button
   - Verify view instantly resets to 0°
   - Verify rotation display shows 0.0°
   - Verify compass north points up

6. **Angle input test**
   - Type "45" in angle input field
   - Press Enter
   - Verify view rotates to exactly 45°
   - Try "90", "180", "270"
   - Verify each rotates correctly

7. **Alt+drag rotation test**
   - Switch to Select tool
   - Hold Alt key
   - Click and drag on viewport
   - Verify view rotates
   - Release Alt
   - Verify normal panning works

8. **Keyboard shortcut test**
   - Press R key
   - Verify Rotate tool activates
   - Verify cursor changes to grab/grabbing
   - Drag to rotate
   - Press ESC
   - Verify rotation stops

9. **Grid rotation test**
   - Enable grid
   - Set rotation to 45°
   - Verify grid lines rotate with view
   - Verify grid spacing unchanged
   - Verify origin marker rotates

10. **Coordinate independence test**
    - Create point at (100, 0)
    - Note world coordinates in status bar
    - Rotate view 90°
    - Click same point
    - Verify world coordinates still (100, 0)
    - Verify screen appearance changed but data unchanged

11. **Drawing tool rotation test**
    - Rotate view 30°
    - Use Line tool to draw horizontal line (screen-aligned)
    - Verify line created is world-aligned (not screen-aligned)
    - Verify snapping works correctly in rotated view

12. **Save/load rotation test**
    - Rotate view to 67.5°
    - Save project
    - Reset rotation to 0°
    - Load project
    - Verify rotation restored to 67.5°
    - Verify compass reflects loaded rotation

13. **Multi-rotation test**
    - Rotate view 45° clockwise
    - Then rotate 30° more
    - Verify total rotation is 75°
    - Rotate -45° (counter-clockwise)
    - Verify rotation now 30°

14. **Rotation wraparound test**
    - Set rotation to 350°
    - Rotate 20° more
    - Verify wraps to 10° (not 370°)
    - Set rotation to 10°
    - Rotate -20°
    - Verify wraps to 350° (not -10°)

15. **Complex scene rotation test**
    - Create diverse scene: points, lines, circles, polylines
    - Rotate view
    - Verify all objects rotate together
    - Verify selection still works
    - Verify tools work in rotated view

## Acceptance Criteria

- [ ] ViewportTransform stores rotation in radians
- [ ] Rotation applies to view, not world coordinates
- [ ] screenToWorld and worldToScreen handle rotation
- [ ] Compass overlay in top-left corner
- [ ] Compass shows N, E, S, W labels
- [ ] Compass north arrow (red, prominent)
- [ ] Compass rotates opposite to view (stays world-aligned)
- [ ] Rotation angle display updates in real-time
- [ ] Rotation angle display shows degrees to 0.1° precision
- [ ] North-up button resets rotation to 0°
- [ ] Angle input field sets exact rotation
- [ ] Rotate tool with drag-to-rotate
- [ ] Alt+drag rotates view (without tool switch)
- [ ] R key activates Rotate tool
- [ ] ESC cancels rotation drag
- [ ] Grid rotates with view
- [ ] Origin marker visible in rotated view
- [ ] World coordinates unchanged by rotation
- [ ] Drawing tools work correctly in rotated view
- [ ] Selection works in rotated view
- [ ] Snapping works in rotated view
- [ ] Rotation persisted in project save
- [ ] Rotation restored on project load
- [ ] Rotation normalizes to [0°, 360°)
- [ ] Smooth performance during rotation
- [ ] No TypeScript compilation errors

## Deliverables

1. **Updated src/viewport/ViewportTransform.ts** - Rotation support, rotated transforms
2. **src/viewport/Compass.ts** - Compass overlay with canvas rendering
3. **src/tools/RotateTool.ts** - Dedicated rotation tool
4. **Updated src/viewport/Grid.ts** - Grid rotation support
5. **Updated src/main.ts** - Rotation UI, Alt+drag, keyboard shortcuts
6. **Rotation controls panel** - Angle input, north-up button
7. **Updated save/load** - Persist viewport rotation
8. **Working rotation system** - Smooth view rotation with world coordinate preservation

---

**Estimated effort**: 3-4 hours  
**Dependencies**: Slice 2 (viewport foundation), Slice 6 (grid)  
**Risk**: Low-Medium - coordinate math requires careful testing, canvas rendering straightforward
