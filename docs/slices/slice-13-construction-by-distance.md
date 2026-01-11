# Slice 13: Construction-by-Distance Tool

## User Value

As a user, I need to position objects precisely by specifying their distances to two existing reference objects (surveyor's resection method), so that I can accurately reconstruct real-world measurements and maintain measurement provenance for verification.

## Slice Features

1. **Distance-based positioning tool** - Place point at intersection of two distance constraints
2. **Reference object selection** - Click two existing objects as distance references
3. **Distance input fields** - Enter measured distances to each reference
4. **Solution preview** - Show candidate positions (up to 2 solutions)
5. **Solution selection** - Click preferred solution or use keyboard (1/2)
6. **Provenance metadata** - Store reference objects and distances in point metadata
7. **Visual reference lines** - Show dashed lines from point to references with distances
8. **Reference validation** - Warn if distances impossible to satisfy
9. **Unit conversion** - Accept cm/m input with auto-conversion
10. **Measurement verification** - Display distances to verify placement
11. **Update on reference move** - Show warning if reference objects moved

## Technical Implementation Sketch

### File Structure

```
src/
├── tools/
│   ├── ConstructByDistanceTool.ts  # Main tool implementation
│   └── Tool.ts                      # Already exists
├── geometry/
│   ├── GeometryMath.ts              # Add trilateration solver
│   └── types.ts                     # Add provenance metadata
├── ui/
│   └── DistanceInputPanel.ts       # UI for distance entry
└── main.ts                          # Updated with new tool
```

### Core Concepts

**Trilateration**:
- Given two reference points and two distances, find intersection points
- Usually yields 0, 1, or 2 solutions
- 0 solutions: distances incompatible (too short or too long)
- 1 solution: distances exactly match (tangent circles)
- 2 solutions: distances create two intersection points

**Workflow**:
1. Activate tool
2. Click first reference object (stores as ref1)
3. Click second reference object (stores as ref2)
4. Panel appears with distance input fields
5. Enter distance to ref1 and distance to ref2
6. Preview shows candidate positions
7. Click or press 1/2 to select solution
8. Point created with provenance metadata

**Provenance Storage**:
```json
{
  "constructionMethod": "distance-to-two",
  "ref1Id": "line-123",
  "ref1Distance": 245.5,
  "ref2Id": "point-456",
  "ref2Distance": 180.0,
  "timestamp": "2026-01-11T10:30:00Z"
}
```

**Reference Point Extraction**:
- Point: use point location
- Line: use midpoint (or closest point)
- Circle: use center
- Polyline: use endpoint or midpoint of segment near click
- Polygon: use nearest vertex

### src/geometry/types.ts (additions)

```typescript
export interface ConstructionProvenance {
  method: 'distance-to-two' | 'manual' | 'snap';
  ref1Id?: string;
  ref1Distance?: number;
  ref2Id?: string;
  ref2Distance?: number;
  timestamp: string;
}

// Add to GeometryObject metadata
export interface Metadata {
  name?: string;
  description?: string;
  provenance?: ConstructionProvenance;
  // ... existing fields
}
```

### src/geometry/GeometryMath.ts (additions)

```typescript
/**
 * Find point(s) at given distances from two reference points (trilateration).
 * Returns 0, 1, or 2 solutions.
 */
export function solveDistanceToTwo(
  ref1: Point,
  dist1: number,
  ref2: Point,
  dist2: number
): Point[] {
  const dx = ref2.x - ref1.x;
  const dy = ref2.y - ref1.y;
  const d = Math.sqrt(dx * dx + dy * dy);

  // Check if solution is possible
  if (d > dist1 + dist2) {
    // References too far apart
    return [];
  }
  if (d < Math.abs(dist1 - dist2)) {
    // One distance completely contains the other
    return [];
  }
  if (d < 0.01) {
    // References coincident
    return [];
  }

  // Calculate position along line from ref1 to ref2
  const a = (dist1 * dist1 - dist2 * dist2 + d * d) / (2 * d);
  
  // Calculate perpendicular distance from line
  const h2 = dist1 * dist1 - a * a;
  
  if (h2 < 0) {
    // Rounding error case - distances just barely don't reach
    return [];
  }
  
  const h = Math.sqrt(h2);

  // Point on line between references
  const px = ref1.x + (a / d) * dx;
  const py = ref1.y + (a / d) * dy;

  // One solution (tangent)
  if (h < 0.01) {
    return [{ x: px, y: py }];
  }

  // Two solutions (perpendicular offsets)
  const ox = -(dy / d) * h;
  const oy = (dx / d) * h;

  return [
    { x: px + ox, y: py + oy },
    { x: px - ox, y: py - oy }
  ];
}

/**
 * Extract reference point from a geometry object.
 * For lines/polylines/polygons, uses the point nearest to clickPos.
 */
export function extractReferencePoint(
  obj: GeometryObject,
  clickPos?: Point
): Point {
  const geom = obj.geometry;

  switch (geom.type) {
    case GeometryType.POINT:
      return (geom as PointGeometry).point;

    case GeometryType.LINE:
      const lineGeom = geom as LineGeometry;
      // Use midpoint by default, or closest point if click provided
      if (clickPos) {
        const projected = GeometryMath.projectPointOntoLine(
          clickPos,
          lineGeom.start,
          lineGeom.end
        );
        if (projected) {
          const t = calculateProjectionParameter(clickPos, lineGeom.start, lineGeom.end);
          if (t < 0.25) return lineGeom.start;
          if (t > 0.75) return lineGeom.end;
          return projected;
        }
      }
      return {
        x: (lineGeom.start.x + lineGeom.end.x) / 2,
        y: (lineGeom.start.y + lineGeom.end.y) / 2
      };

    case GeometryType.CIRCLE:
      return (geom as CircleGeometry).center;

    case GeometryType.POLYLINE:
    case GeometryType.POLYGON:
      const points = (geom as any).points;
      if (!clickPos) return points[0];
      
      // Find nearest vertex
      let nearest = points[0];
      let minDist = Infinity;
      for (const pt of points) {
        const dist = Math.sqrt((pt.x - clickPos.x) ** 2 + (pt.y - clickPos.y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          nearest = pt;
        }
      }
      return nearest;

    default:
      return { x: 0, y: 0 };
  }
}

function calculateProjectionParameter(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 0.0001) return 0;
  return ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
}
```

### src/ui/DistanceInputPanel.ts

```typescript
export class DistanceInputPanel {
  private container: HTMLElement;
  private ref1Label: HTMLElement;
  private ref2Label: HTMLElement;
  private dist1Input: HTMLInputElement;
  private dist2Input: HTMLInputElement;
  private calculateBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private statusDiv: HTMLElement;
  private onCalculate: (dist1: number, dist2: number) => void;
  private onCancel: () => void;

  constructor(
    ref1Name: string,
    ref2Name: string,
    onCalculate: (dist1: number, dist2: number) => void,
    onCancel: () => void
  ) {
    this.onCalculate = onCalculate;
    this.onCancel = onCancel;
    this.container = this.createPanel(ref1Name, ref2Name);
  }

  private createPanel(ref1Name: string, ref2Name: string): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'distance-input-panel';
    panel.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 2px solid #0066ff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 1000;
      min-width: 320px;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'Position by Distance';
    title.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #333;';
    panel.appendChild(title);

    // Reference 1
    this.ref1Label = document.createElement('div');
    this.ref1Label.textContent = `Distance to ${ref1Name}:`;
    this.ref1Label.style.cssText = 'margin-bottom: 6px; color: #666; font-weight: 500;';
    panel.appendChild(this.ref1Label);

    this.dist1Input = document.createElement('input');
    this.dist1Input.type = 'number';
    this.dist1Input.step = '0.1';
    this.dist1Input.placeholder = 'cm or m (e.g., 245.5 or 2.45m)';
    this.dist1Input.style.cssText = `
      width: 100%;
      padding: 8px;
      margin-bottom: 16px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    `;
    this.dist1Input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleCalculate();
    });
    panel.appendChild(this.dist1Input);

    // Reference 2
    this.ref2Label = document.createElement('div');
    this.ref2Label.textContent = `Distance to ${ref2Name}:`;
    this.ref2Label.style.cssText = 'margin-bottom: 6px; color: #666; font-weight: 500;';
    panel.appendChild(this.ref2Label);

    this.dist2Input = document.createElement('input');
    this.dist2Input.type = 'number';
    this.dist2Input.step = '0.1';
    this.dist2Input.placeholder = 'cm or m (e.g., 180 or 1.8m)';
    this.dist2Input.style.cssText = `
      width: 100%;
      padding: 8px;
      margin-bottom: 16px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    `;
    this.dist2Input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleCalculate();
    });
    panel.appendChild(this.dist2Input);

    // Status/error message
    this.statusDiv = document.createElement('div');
    this.statusDiv.style.cssText = `
      margin-bottom: 16px;
      padding: 8px;
      border-radius: 4px;
      font-size: 13px;
      display: none;
    `;
    panel.appendChild(this.statusDiv);

    // Buttons
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

    this.cancelBtn = document.createElement('button');
    this.cancelBtn.textContent = 'Cancel';
    this.cancelBtn.style.cssText = `
      padding: 8px 16px;
      background: #ccc;
      color: #333;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    this.cancelBtn.addEventListener('click', () => this.onCancel());
    buttonRow.appendChild(this.cancelBtn);

    this.calculateBtn = document.createElement('button');
    this.calculateBtn.textContent = 'Calculate';
    this.calculateBtn.style.cssText = `
      padding: 8px 16px;
      background: #0066ff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    this.calculateBtn.addEventListener('click', () => this.handleCalculate());
    buttonRow.appendChild(this.calculateBtn);

    panel.appendChild(buttonRow);

    // Focus first input
    setTimeout(() => this.dist1Input.focus(), 100);

    return panel;
  }

  private handleCalculate(): void {
    const dist1 = this.parseDistance(this.dist1Input.value);
    const dist2 = this.parseDistance(this.dist2Input.value);

    if (dist1 === null || dist1 <= 0) {
      this.showError('Invalid distance to first reference');
      return;
    }

    if (dist2 === null || dist2 <= 0) {
      this.showError('Invalid distance to second reference');
      return;
    }

    this.hideError();
    this.onCalculate(dist1, dist2);
  }

  private parseDistance(input: string): number | null {
    input = input.trim().toLowerCase();
    
    if (input.endsWith('m')) {
      // Meters to centimeters
      const value = parseFloat(input.slice(0, -1));
      return isNaN(value) ? null : value * 100;
    } else if (input.endsWith('cm')) {
      const value = parseFloat(input.slice(0, -2));
      return isNaN(value) ? null : value;
    } else {
      // Assume centimeters by default
      const value = parseFloat(input);
      return isNaN(value) ? null : value;
    }
  }

  private showError(message: string): void {
    this.statusDiv.textContent = message;
    this.statusDiv.style.display = 'block';
    this.statusDiv.style.background = '#ffe6e6';
    this.statusDiv.style.border = '1px solid #ff0000';
    this.statusDiv.style.color = '#cc0000';
  }

  private hideError(): void {
    this.statusDiv.style.display = 'none';
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  unmount(): void {
    this.container.remove();
  }

  updateReferences(ref1Name: string, ref2Name: string): void {
    this.ref1Label.textContent = `Distance to ${ref1Name}:`;
    this.ref2Label.textContent = `Distance to ${ref2Name}:`;
  }
}
```

### src/tools/ConstructByDistanceTool.ts

```typescript
import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point } from '../geometry/types';
import { LayerManager } from '../model/LayerManager';
import { GeometryMath } from '../geometry/GeometryMath';
import { DistanceInputPanel } from '../ui/DistanceInputPanel';

enum ToolState {
  SELECT_REF1,
  SELECT_REF2,
  ENTER_DISTANCES,
  SELECT_SOLUTION
}

export class ConstructByDistanceTool implements Tool {
  readonly name = 'construct-by-distance';

  private project: Project;
  private previewGroup: SVGGElement;
  private layerManager: LayerManager;
  private onUpdate: () => void;
  
  private state: ToolState = ToolState.SELECT_REF1;
  private ref1: GeometryObject | null = null;
  private ref2: GeometryObject | null = null;
  private ref1Point: Point | null = null;
  private ref2Point: Point | null = null;
  private solutions: Point[] = [];
  private hoveredSolution: number = -1;
  private inputPanel: DistanceInputPanel | null = null;

  constructor(
    project: Project,
    previewGroup: SVGGElement,
    layerManager: LayerManager,
    onUpdate: () => void
  ) {
    this.project = project;
    this.previewGroup = previewGroup;
    this.layerManager = layerManager;
    this.onUpdate = onUpdate;
  }

  onActivate(): void {
    this.reset();
    console.log('Construction-by-distance tool activated');
    console.log('Step 1: Click first reference object');
  }

  onDeactivate(): void {
    this.reset();
  }

  onMouseDown(event: ToolMouseEvent): void {
    // Not used
  }

  onMouseMove(event: ToolMouseEvent): void {
    if (this.state === ToolState.SELECT_SOLUTION && this.solutions.length > 0) {
      // Find closest solution to cursor
      let closest = 0;
      let minDist = Infinity;
      
      for (let i = 0; i < this.solutions.length; i++) {
        const dx = this.solutions[i].x - event.worldPos.x;
        const dy = this.solutions[i].y - event.worldPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }
      
      // Highlight if within reasonable distance (50cm)
      this.hoveredSolution = minDist < 50 ? closest : -1;
      this.renderPreview();
    }
  }

  onMouseUp(event: ToolMouseEvent): void {
    // Not used
  }

  onMouseClick(event: ToolMouseEvent): void {
    switch (this.state) {
      case ToolState.SELECT_REF1:
        this.handleSelectRef1(event.worldPos);
        break;
      
      case ToolState.SELECT_REF2:
        this.handleSelectRef2(event.worldPos);
        break;
      
      case ToolState.SELECT_SOLUTION:
        if (this.hoveredSolution >= 0) {
          this.createPoint(this.solutions[this.hoveredSolution], this.hoveredSolution);
        }
        break;
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      if (this.inputPanel) {
        this.inputPanel.unmount();
        this.inputPanel = null;
      }
      this.reset();
    } else if (key === '1' && this.state === ToolState.SELECT_SOLUTION && this.solutions.length >= 1) {
      this.createPoint(this.solutions[0], 0);
    } else if (key === '2' && this.state === ToolState.SELECT_SOLUTION && this.solutions.length >= 2) {
      this.createPoint(this.solutions[1], 1);
    }
  }

  private handleSelectRef1(worldPos: Point): void {
    const obj = this.findObjectAt(worldPos);
    
    if (!obj) {
      console.log('No object found - click directly on an object');
      return;
    }

    this.ref1 = obj;
    this.ref1Point = GeometryMath.extractReferencePoint(obj, worldPos);
    this.state = ToolState.SELECT_REF2;
    
    console.log(`Reference 1: ${obj.metadata.name || obj.id} at (${this.ref1Point.x.toFixed(1)}, ${this.ref1Point.y.toFixed(1)})`);
    console.log('Step 2: Click second reference object');
    
    this.renderPreview();
  }

  private handleSelectRef2(worldPos: Point): void {
    const obj = this.findObjectAt(worldPos);
    
    if (!obj) {
      console.log('No object found - click directly on an object');
      return;
    }

    if (obj === this.ref1) {
      console.log('Cannot use same object twice - select different object');
      return;
    }

    this.ref2 = obj;
    this.ref2Point = GeometryMath.extractReferencePoint(obj, worldPos);
    this.state = ToolState.ENTER_DISTANCES;
    
    console.log(`Reference 2: ${obj.metadata.name || obj.id} at (${this.ref2Point.x.toFixed(1)}, ${this.ref2Point.y.toFixed(1)})`);
    console.log('Step 3: Enter distances');
    
    this.renderPreview();
    this.showInputPanel();
  }

  private showInputPanel(): void {
    if (!this.ref1 || !this.ref2) return;

    const ref1Name = this.ref1.metadata.name || this.ref1.id;
    const ref2Name = this.ref2.metadata.name || this.ref2.id;

    this.inputPanel = new DistanceInputPanel(
      ref1Name,
      ref2Name,
      (dist1, dist2) => this.handleDistancesEntered(dist1, dist2),
      () => this.handleCancel()
    );

    this.inputPanel.mount(document.body);
  }

  private handleDistancesEntered(dist1: number, dist2: number): void {
    if (!this.ref1Point || !this.ref2Point) return;

    this.solutions = GeometryMath.solveDistanceToTwo(
      this.ref1Point,
      dist1,
      this.ref2Point,
      dist2
    );

    if (this.solutions.length === 0) {
      console.log('No solution found - distances incompatible');
      console.log(`  Distance between references: ${this.calculateDistance(this.ref1Point, this.ref2Point).toFixed(1)} cm`);
      console.log(`  Sum of distances: ${(dist1 + dist2).toFixed(1)} cm`);
      console.log(`  Difference of distances: ${Math.abs(dist1 - dist2).toFixed(1)} cm`);
      return;
    }

    if (this.inputPanel) {
      this.inputPanel.unmount();
      this.inputPanel = null;
    }

    this.state = ToolState.SELECT_SOLUTION;
    console.log(`Found ${this.solutions.length} solution(s)`);
    this.solutions.forEach((sol, i) => {
      console.log(`  Solution ${i + 1}: (${sol.x.toFixed(1)}, ${sol.y.toFixed(1)})`);
    });
    
    if (this.solutions.length === 1) {
      console.log('Press 1 or click to select solution');
    } else {
      console.log('Press 1 or 2, or click to select solution');
    }

    this.renderPreview();
  }

  private handleCancel(): void {
    if (this.inputPanel) {
      this.inputPanel.unmount();
      this.inputPanel = null;
    }
    this.reset();
  }

  private createPoint(position: Point, solutionIndex: number): void {
    if (!this.ref1 || !this.ref2 || !this.ref1Point || !this.ref2Point) return;

    const activeLayerId = this.layerManager.getActiveLayerId() || 'default';
    const id = this.generateId('point');

    const dist1 = this.calculateDistance(position, this.ref1Point);
    const dist2 = this.calculateDistance(position, this.ref2Point);

    const point = new GeometryObject(
      id,
      activeLayerId,
      {
        type: GeometryType.POINT,
        point: position
      },
      { stroke: '#0066ff', strokeWidth: 3 },
      {
        name: `Constructed Point ${id}`,
        provenance: {
          method: 'distance-to-two',
          ref1Id: this.ref1.id,
          ref1Distance: dist1,
          ref2Id: this.ref2.id,
          ref2Distance: dist2,
          timestamp: new Date().toISOString()
        }
      }
    );

    this.project.addObject(point);
    this.onUpdate();

    console.log(`Created point at (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
    console.log(`  Solution ${solutionIndex + 1} of ${this.solutions.length}`);
    console.log(`  Distance to ref1: ${dist1.toFixed(1)} cm`);
    console.log(`  Distance to ref2: ${dist2.toFixed(1)} cm`);

    this.reset();
  }

  private findObjectAt(worldPos: Point): GeometryObject | null {
    const tolerance = 10; // cm
    const objects = this.project.getObjects();

    for (const obj of objects) {
      if (!obj.visible) continue;
      
      // Use hit testing logic (simplified)
      const geom = obj.geometry;
      
      switch (geom.type) {
        case GeometryType.POINT: {
          const pt = (geom as any).point;
          const dist = this.calculateDistance(worldPos, pt);
          if (dist <= tolerance) return obj;
          break;
        }
        
        case GeometryType.LINE: {
          const line = geom as any;
          const dist = GeometryMath.distanceToLineSegment(worldPos, line.start, line.end);
          if (dist <= tolerance) return obj;
          break;
        }
        
        case GeometryType.CIRCLE: {
          const circle = geom as any;
          const dist = this.calculateDistance(worldPos, circle.center);
          if (Math.abs(dist - circle.radius) <= tolerance) return obj;
          break;
        }
        
        // Add polyline/polygon support as needed
      }
    }

    return null;
  }

  private renderPreview(): void {
    this.clearPreview();

    // Show reference 1
    if (this.ref1Point) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.ref1Point.x.toString());
      circle.setAttribute('cy', this.ref1Point.y.toString());
      circle.setAttribute('r', '10');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', '#0066ff');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('pointer-events', 'none');
      this.previewGroup.appendChild(circle);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', (this.ref1Point.x + 15).toString());
      label.setAttribute('y', (this.ref1Point.y - 10).toString());
      label.setAttribute('fill', '#0066ff');
      label.setAttribute('font-size', '14');
      label.setAttribute('font-weight', 'bold');
      label.textContent = 'Ref 1';
      this.previewGroup.appendChild(label);
    }

    // Show reference 2
    if (this.ref2Point) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.ref2Point.x.toString());
      circle.setAttribute('cy', this.ref2Point.y.toString());
      circle.setAttribute('r', '10');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', '#00cc00');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('pointer-events', 'none');
      this.previewGroup.appendChild(circle);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', (this.ref2Point.x + 15).toString());
      label.setAttribute('y', (this.ref2Point.y - 10).toString());
      label.setAttribute('fill', '#00cc00');
      label.setAttribute('font-size', '14');
      label.setAttribute('font-weight', 'bold');
      label.textContent = 'Ref 2';
      this.previewGroup.appendChild(label);
    }

    // Show solutions
    if (this.state === ToolState.SELECT_SOLUTION) {
      this.solutions.forEach((sol, i) => {
        const isHovered = i === this.hoveredSolution;
        
        // Solution point
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', sol.x.toString());
        circle.setAttribute('cy', sol.y.toString());
        circle.setAttribute('r', isHovered ? '12' : '8');
        circle.setAttribute('fill', isHovered ? '#ff6600' : '#ffcc00');
        circle.setAttribute('stroke', '#333');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('pointer-events', 'none');
        this.previewGroup.appendChild(circle);

        // Solution label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', (sol.x + 15).toString());
        label.setAttribute('y', (sol.y + 5).toString());
        label.setAttribute('fill', '#333');
        label.setAttribute('font-size', isHovered ? '16' : '14');
        label.setAttribute('font-weight', 'bold');
        label.textContent = `${i + 1}`;
        this.previewGroup.appendChild(label);

        // Distance lines
        if (this.ref1Point) {
          const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line1.setAttribute('x1', sol.x.toString());
          line1.setAttribute('y1', sol.y.toString());
          line1.setAttribute('x2', this.ref1Point.x.toString());
          line1.setAttribute('y2', this.ref1Point.y.toString());
          line1.setAttribute('stroke', '#0066ff');
          line1.setAttribute('stroke-width', '1');
          line1.setAttribute('stroke-dasharray', '5 5');
          line1.setAttribute('opacity', '0.7');
          this.previewGroup.appendChild(line1);
        }

        if (this.ref2Point) {
          const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line2.setAttribute('x1', sol.x.toString());
          line2.setAttribute('y1', sol.y.toString());
          line2.setAttribute('x2', this.ref2Point.x.toString());
          line2.setAttribute('y2', this.ref2Point.y.toString());
          line2.setAttribute('stroke', '#00cc00');
          line2.setAttribute('stroke-width', '1');
          line2.setAttribute('stroke-dasharray', '5 5');
          line2.setAttribute('opacity', '0.7');
          this.previewGroup.appendChild(line2);
        }
      });
    }
  }

  private clearPreview(): void {
    while (this.previewGroup.firstChild) {
      this.previewGroup.removeChild(this.previewGroup.firstChild);
    }
  }

  private reset(): void {
    this.state = ToolState.SELECT_REF1;
    this.ref1 = null;
    this.ref2 = null;
    this.ref1Point = null;
    this.ref2Point = null;
    this.solutions = [];
    this.hoveredSolution = -1;
    this.clearPreview();
    
    if (this.inputPanel) {
      this.inputPanel.unmount();
      this.inputPanel = null;
    }
    
    console.log('Step 1: Click first reference object');
  }

  private calculateDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private generateId(type: string): string {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }
}
```

### src/main.ts (integration)

```typescript
import { ConstructByDistanceTool } from './tools/ConstructByDistanceTool';

// Add button to toolbar
<button id="tool-construct-by-distance" class="tool-btn" title="Position by Distance">📐</button>

// Initialize tool
const constructByDistanceTool = new ConstructByDistanceTool(
  project,
  viewport.getPreviewGroup(),
  layerManager,
  originalOnUpdate
);

// Add to tools object
const tools = {
  // ... existing tools ...
  constructByDistance: constructByDistanceTool
};

// Wire up button
document.getElementById('tool-construct-by-distance')?.addEventListener('click', () => {
  setTool('constructByDistance');
});

// Update status messages
const messages: Record<string, string> = {
  // ... existing messages ...
  constructByDistance: 'Construction-by-distance tool - click two reference objects'
};

// Keyboard shortcut (Shift+D for "distance")
document.addEventListener('keydown', (e) => {
  // ... existing shortcuts ...
  if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
    setTool('constructByDistance');
  }
});

console.log('Construction-by-distance tool loaded. Shortcut: Shift+D');
```

## Test Plan

### Manual Testing Steps

1. **Tool activation test**
   - Click construction-by-distance button (📐)
   - Verify status shows "click two reference objects"
   - Verify cursor changes to crosshair

2. **Two-point reference test**
   - Create point A at (0, 0)
   - Create point B at (300, 0)
   - Activate tool
   - Click point A (ref 1)
   - Verify blue circle highlights ref 1
   - Click point B (ref 2)
   - Verify green circle highlights ref 2
   - Verify distance input panel appears

3. **Distance input test**
   - With refs selected, panel shows
   - Enter 200 for distance to ref 1
   - Enter 200 for distance to ref 2
   - Click Calculate
   - Verify two solutions appear (equilateral-ish triangle)
   - Verify solutions marked with yellow dots

4. **Solution selection test**
   - With solutions visible
   - Move cursor near solution 1
   - Verify it highlights (orange, larger)
   - Press "1" key
   - Verify point created at solution 1
   - Verify tool resets to select ref 1

5. **Single solution test**
   - Create ref 1 at (0, 0)
   - Create ref 2 at (500, 0)
   - Use tool, select both refs
   - Enter dist1 = 300, dist2 = 200
   - Verify exactly 1 solution appears
   - Click solution
   - Verify point created at (300, 0)

6. **No solution test (too far)**
   - Create ref 1 at (0, 0)
   - Create ref 2 at (100, 0)
   - Use tool, select both refs
   - Enter dist1 = 30, dist2 = 30
   - Click Calculate
   - Verify console shows "No solution found"
   - Verify explanation: sum < distance between refs

7. **No solution test (too close)**
   - Create ref 1 at (0, 0)
   - Create ref 2 at (500, 0)
   - Use tool, select both refs
   - Enter dist1 = 100, dist2 = 100
   - Verify no solution (distances don't reach each other)

8. **Unit conversion test**
   - Enter "2.5m" in distance field
   - Verify converts to 250 cm internally
   - Enter "150cm" in distance field
   - Verify accepts as 150 cm
   - Enter "180" (no unit)
   - Verify assumes cm

9. **Line reference test**
   - Create line from (0, 0) to (500, 0)
   - Create point at (0, 300)
   - Use tool, click line (near midpoint)
   - Verify ref extracted at line midpoint (250, 0)
   - Click point
   - Enter distances
   - Verify solutions calculated correctly

10. **Circle reference test**
    - Create circle center (200, 200) radius 100
    - Create point at (500, 200)
    - Use tool, click circle
    - Verify ref extracted at center (200, 200)
    - Continue with distances
    - Verify solutions based on center

11. **Provenance storage test**
    - Complete construction (create point)
    - Use object inspector or save project
    - Verify metadata.provenance contains:
      * method: 'distance-to-two'
      * ref1Id, ref1Distance
      * ref2Id, ref2Distance
      * timestamp

12. **Visual reference lines test**
    - Create construction with 2 solutions
    - Verify dashed lines from each solution to ref 1 (blue)
    - Verify dashed lines from each solution to ref 2 (green)
    - Verify lines help visualize distance constraints

13. **Keyboard navigation test**
    - Set up construction with 2 solutions
    - Press "1"
    - Verify solution 1 selected and point created
    - Repeat with new construction
    - Press "2"
    - Verify solution 2 selected

14. **Cancel workflow test**
    - Start tool, select ref 1
    - Press ESC
    - Verify resets to beginning
    - Start again, select both refs
    - In distance panel, click Cancel
    - Verify panel closes and tool resets

15. **Same reference prevention test**
    - Create point at (0, 0)
    - Start tool, click point (ref 1)
    - Click same point again
    - Verify console shows "Cannot use same object twice"
    - Verify stays in SELECT_REF2 state

## Acceptance Criteria

- [ ] Construction-by-distance tool in toolbar (📐 icon)
- [ ] Three-step workflow: ref 1 → ref 2 → distances
- [ ] Visual highlights for reference objects (blue/green circles)
- [ ] Distance input panel with two fields
- [ ] Unit conversion: cm, m, automatic detection
- [ ] Trilateration solver (0, 1, or 2 solutions)
- [ ] Visual preview of candidate solutions
- [ ] Solution selection by click or keyboard (1/2)
- [ ] Provenance metadata stored in created points
- [ ] Reference lines from solutions to refs (dashed)
- [ ] Error handling: distances incompatible
- [ ] Error messages explain why no solution
- [ ] Works with point references
- [ ] Works with line references (midpoint/endpoints)
- [ ] Works with circle references (center)
- [ ] ESC cancels at any stage
- [ ] Cancel button in input panel
- [ ] Keyboard shortcut: Shift+D
- [ ] Console logs for each step
- [ ] Solution hover highlights (orange, larger)
- [ ] Tool resets after point creation
- [ ] No TypeScript compilation errors

## Deliverables

1. **Updated src/geometry/types.ts** - ConstructionProvenance interface
2. **Updated src/geometry/GeometryMath.ts** - Trilateration solver, reference point extraction
3. **src/ui/DistanceInputPanel.ts** - Distance entry UI with validation
4. **src/tools/ConstructByDistanceTool.ts** - Multi-stage construction workflow
5. **Updated src/main.ts** - Tool integration, keyboard shortcut
6. **Working construction-by-distance tool** - Full workflow from refs to point creation
7. **Provenance tracking** - Metadata storage and retrieval

---

**Estimated effort**: 4-5 hours  
**Dependencies**: Slice 4 (selection/hit-testing), Slice 11 (GeometryMath foundation)  
**Risk**: Medium - trilateration math requires testing, UI workflow has multiple states
