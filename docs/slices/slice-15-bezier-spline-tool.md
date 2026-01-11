# Slice 15: Bezier Spline Tool

## User Value

As a user, I need to create smooth, flowing curves for garden paths, organic borders, and landscaping features using Bezier splines, so that I can design aesthetically pleasing curved elements that cannot be represented with straight lines or simple circles.

## Slice Features

1. **Cubic Bezier curve drawing** - Click to place anchor and control points
2. **Control point visualization** - Show handles with connecting lines
3. **Control point editing** - Drag handles to adjust curve shape
4. **Smooth curve rendering** - SVG path with smooth transitions
5. **Multi-segment splines** - Chain multiple Bezier curves together
6. **Tangent continuity** - Automatic smooth transitions between segments
7. **Convert to polyline** - Approximate curve with line segments
8. **Arc length calculation** - Measure curve length accurately
9. **Point-on-curve snapping** - Snap to positions along curve
10. **Symmetric/asymmetric handles** - Toggle handle mirroring
11. **Flatten handles** - Make handles collinear with anchor

## Technical Implementation Sketch

### File Structure

```
src/
├── geometry/
│   ├── types.ts                # Add BezierSpline geometry type
│   └── BezierMath.ts           # Bezier curve calculations
├── tools/
│   ├── BezierTool.ts           # Curve drawing and editing
│   └── Tool.ts                 # Already exists
├── renderer/
│   └── ShapeRenderer.ts        # Add Bezier rendering
└── main.ts                     # Updated with Bezier tool
```

### Core Concepts

**Cubic Bezier Curve**:
- 4 control points: P0 (start), P1 (control 1), P2 (control 2), P3 (end)
- Parametric equation: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3, where t ∈ [0,1]
- P1 and P2 control curve shape (handles)
- P0 and P3 are anchor points on the curve

**Multi-Segment Spline**:
- Series of connected Bezier curves
- Each segment shares endpoint with next segment
- Smooth continuity: outgoing handle mirrors incoming handle

**Drawing Workflow**:
1. Click to place first anchor (P0)
2. Drag to set first control point (P1)
3. Release, curve previews
4. Click to place second control point (P2)
5. Click to place end anchor (P3)
6. Repeat steps 2-5 for additional segments
7. Double-click or Enter to finish

**Editing Workflow**:
- Select Bezier with Select tool
- Shows all anchors and handles
- Drag anchors to move curve endpoints
- Drag handles to adjust curve shape
- Alt+drag handle for asymmetric control

### src/geometry/types.ts (additions)

```typescript
export enum GeometryType {
  POINT = 'point',
  LINE = 'line',
  CIRCLE = 'circle',
  POLYLINE = 'polyline',
  POLYGON = 'polygon',
  BEZIER_SPLINE = 'bezier-spline'
}

export interface BezierSegment {
  p0: Point;  // Start anchor
  p1: Point;  // Control point 1
  p2: Point;  // Control point 2
  p3: Point;  // End anchor
}

export interface BezierSplineGeometry extends GeometryData {
  type: GeometryType.BEZIER_SPLINE;
  segments: BezierSegment[];
  closed: boolean;  // If true, connects end to start
}

// Update Geometry union type
export type Geometry = 
  | PointGeometry 
  | LineGeometry 
  | CircleGeometry 
  | PolylineGeometry 
  | PolygonGeometry
  | BezierSplineGeometry;
```

### src/geometry/BezierMath.ts

```typescript
import { Point } from './types';

export class BezierMath {
  /**
   * Evaluate cubic Bezier curve at parameter t [0, 1].
   */
  static evaluateCubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
    };
  }

  /**
   * Get derivative (tangent) at parameter t.
   */
  static derivativeCubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    return {
      x: 3 * mt2 * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x),
      y: 3 * mt2 * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y)
    };
  }

  /**
   * Convert Bezier curve to polyline approximation.
   * @param tolerance - Maximum distance between curve and approximation (cm)
   */
  static toPolyline(
    p0: Point, 
    p1: Point, 
    p2: Point, 
    p3: Point, 
    tolerance: number = 1.0
  ): Point[] {
    const points: Point[] = [p0];
    this.subdivide(p0, p1, p2, p3, 0, 1, tolerance, points);
    points.push(p3);
    return points;
  }

  private static subdivide(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    t0: number,
    t1: number,
    tolerance: number,
    points: Point[]
  ): void {
    const tMid = (t0 + t1) / 2;
    const pMid = this.evaluateCubic(p0, p1, p2, p3, tMid);
    
    // Check if midpoint is close enough to line segment
    const dist = this.distanceToLineSegment(pMid, p0, p3);
    
    if (dist <= tolerance) {
      // Good enough approximation
      return;
    }
    
    // Subdivide further
    const pLeft = this.evaluateCubic(p0, p1, p2, p3, t0);
    this.subdivide(p0, p1, p2, p3, t0, tMid, tolerance, points);
    points.push(pMid);
    this.subdivide(p0, p1, p2, p3, tMid, t1, tolerance, points);
  }

  /**
   * Calculate arc length of Bezier curve using adaptive subdivision.
   */
  static arcLength(p0: Point, p1: Point, p2: Point, p3: Point, steps: number = 100): number {
    let length = 0;
    let prevPoint = p0;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const point = this.evaluateCubic(p0, p1, p2, p3, t);
      length += this.distance(prevPoint, point);
      prevPoint = point;
    }

    return length;
  }

  /**
   * Find closest point on Bezier curve to given point.
   * Returns parameter t [0, 1] and the point.
   */
  static closestPoint(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    target: Point,
    samples: number = 50
  ): { t: number; point: Point; distance: number } {
    let minDist = Infinity;
    let bestT = 0;
    let bestPoint = p0;

    // Sample the curve
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = this.evaluateCubic(p0, p1, p2, p3, t);
      const dist = this.distance(point, target);

      if (dist < minDist) {
        minDist = dist;
        bestT = t;
        bestPoint = point;
      }
    }

    // Refine with Newton's method (optional, for better precision)
    // Implementation omitted for brevity

    return { t: bestT, point: bestPoint, distance: minDist };
  }

  /**
   * Create SVG path data for Bezier curve.
   */
  static toSVGPath(segments: Array<{ p0: Point; p1: Point; p2: Point; p3: Point }>, closed: boolean): string {
    if (segments.length === 0) return '';

    let path = `M ${segments[0].p0.x},${segments[0].p0.y}`;

    for (const seg of segments) {
      path += ` C ${seg.p1.x},${seg.p1.y} ${seg.p2.x},${seg.p2.y} ${seg.p3.x},${seg.p3.y}`;
    }

    if (closed) {
      path += ' Z';
    }

    return path;
  }

  /**
   * Calculate mirrored control point for smooth continuity.
   */
  static mirrorHandle(anchor: Point, handle: Point): Point {
    return {
      x: 2 * anchor.x - handle.x,
      y: 2 * anchor.y - handle.y
    };
  }

  private static distance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private static distanceToLineSegment(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq < 0.0001) {
      return this.distance(point, lineStart);
    }

    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = lineStart.x + t * dx;
    const closestY = lineStart.y + t * dy;

    const dpx = point.x - closestX;
    const dpy = point.y - closestY;
    return Math.sqrt(dpx * dpx + dpy * dpy);
  }
}
```

### src/tools/BezierTool.ts

```typescript
import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point, BezierSegment } from '../geometry/types';
import { SnapManager } from '../snapping/SnapManager';
import { LayerManager } from '../model/LayerManager';
import { BezierMath } from '../geometry/BezierMath';
import { CommandHistory } from '../commands/CommandHistory';
import { AddObjectCommand } from '../commands/AddObjectCommand';

enum DrawState {
  PLACE_START,       // Click to place P0
  DRAG_HANDLE1,      // Drag to set P1
  PLACE_HANDLE2,     // Click to set P2
  PLACE_END          // Click to place P3
}

export class BezierTool implements Tool {
  readonly name = 'bezier';

  private project: Project;
  private previewGroup: SVGGElement;
  private snapManager: SnapManager;
  private layerManager: LayerManager;
  private commandHistory: CommandHistory;
  private onUpdate: () => void;
  
  private state: DrawState = DrawState.PLACE_START;
  private segments: BezierSegment[] = [];
  private currentSegment: Partial<BezierSegment> = {};
  private currentPoint: Point | null = null;
  private isDragging: boolean = false;

  constructor(
    project: Project,
    previewGroup: SVGGElement,
    snapManager: SnapManager,
    layerManager: LayerManager,
    commandHistory: CommandHistory,
    onUpdate: () => void
  ) {
    this.project = project;
    this.previewGroup = previewGroup;
    this.snapManager = snapManager;
    this.layerManager = layerManager;
    this.commandHistory = commandHistory;
    this.onUpdate = onUpdate;
  }

  onActivate(): void {
    this.reset();
    console.log('Bezier tool activated - click to place start point');
  }

  onDeactivate(): void {
    this.reset();
  }

  onMouseDown(event: ToolMouseEvent): void {
    const snapResult = this.snapManager.snap(event.worldPos);
    const point = snapResult.point;

    if (this.state === DrawState.PLACE_START) {
      // Place P0 and start dragging for P1
      this.currentSegment.p0 = point;
      this.currentSegment.p1 = point; // Will update while dragging
      this.isDragging = true;
      this.state = DrawState.DRAG_HANDLE1;
      console.log(`Start anchor placed at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    } else if (this.state === DrawState.PLACE_HANDLE2) {
      // Place P2 and move to place end
      this.currentSegment.p2 = point;
      this.state = DrawState.PLACE_END;
      console.log(`Control point 2 placed at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    } else if (this.state === DrawState.PLACE_END) {
      // Place P3 and complete segment
      this.currentSegment.p3 = point;
      this.completeSegment();
    }
  }

  onMouseMove(event: ToolMouseEvent): void {
    const snapResult = this.snapManager.snap(event.worldPos);
    this.currentPoint = snapResult.point;

    if (this.isDragging && this.state === DrawState.DRAG_HANDLE1) {
      // Update P1 while dragging
      this.currentSegment.p1 = this.currentPoint;
    }

    this.renderPreview();
  }

  onMouseUp(event: ToolMouseEvent): void {
    if (this.isDragging && this.state === DrawState.DRAG_HANDLE1) {
      // Finish dragging P1, move to placing P2
      this.isDragging = false;
      this.state = DrawState.PLACE_HANDLE2;
      console.log(`Control point 1 set at (${this.currentSegment.p1!.x.toFixed(1)}, ${this.currentSegment.p1!.y.toFixed(1)})`);
    }
  }

  onMouseClick(event: ToolMouseEvent): void {
    // Click handled in onMouseDown/onMouseUp
  }

  getCursor(): string {
    return 'crosshair';
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      console.log('Bezier drawing cancelled');
      this.reset();
    } else if (key === 'Enter' && this.segments.length > 0) {
      this.finishSpline();
    }
  }

  onDoubleClick(): void {
    if (this.segments.length > 0) {
      this.finishSpline();
    }
  }

  private completeSegment(): void {
    if (!this.currentSegment.p0 || !this.currentSegment.p1 || 
        !this.currentSegment.p2 || !this.currentSegment.p3) {
      return;
    }

    const segment: BezierSegment = {
      p0: this.currentSegment.p0,
      p1: this.currentSegment.p1,
      p2: this.currentSegment.p2,
      p3: this.currentSegment.p3
    };

    this.segments.push(segment);
    console.log(`Segment ${this.segments.length} completed`);

    // Prepare for next segment with smooth continuity
    const mirroredHandle = BezierMath.mirrorHandle(segment.p3, segment.p2);
    
    this.currentSegment = {
      p0: segment.p3,
      p1: mirroredHandle
    };
    
    this.state = DrawState.PLACE_HANDLE2;
    console.log('Continue with next segment, or double-click/Enter to finish');
  }

  private finishSpline(): void {
    if (this.segments.length === 0) return;

    const activeLayerId = this.layerManager.getActiveLayerId() || 'default';
    const id = this.generateId('bezier');

    // Calculate total length
    let totalLength = 0;
    for (const seg of this.segments) {
      totalLength += BezierMath.arcLength(seg.p0, seg.p1, seg.p2, seg.p3);
    }

    const spline = new GeometryObject(
      id,
      activeLayerId,
      {
        type: GeometryType.BEZIER_SPLINE,
        segments: this.segments,
        closed: false
      },
      { 
        stroke: '#6600cc', 
        strokeWidth: 2, 
        fill: 'none' 
      },
      { 
        name: `Bezier Spline ${id}`,
        length: totalLength
      }
    );

    const cmd = new AddObjectCommand(this.project, spline);
    this.commandHistory.execute(cmd);
    this.onUpdate();

    console.log(`Created Bezier spline with ${this.segments.length} segments`);
    console.log(`  Total length: ${this.formatDistance(totalLength)}`);

    this.reset();
  }

  private renderPreview(): void {
    this.clearPreview();

    // Render completed segments
    if (this.segments.length > 0) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', BezierMath.toSVGPath(this.segments, false));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#6600cc');
      path.setAttribute('stroke-width', '2');
      this.previewGroup.appendChild(path);

      // Show control handles for completed segments
      for (const seg of this.segments) {
        this.renderHandles(seg);
      }
    }

    // Render current segment being drawn
    if (this.currentSegment.p0) {
      // Start anchor
      this.renderAnchor(this.currentSegment.p0, '#0066ff');

      if (this.currentSegment.p1) {
        // Control handle 1
        this.renderHandle(this.currentSegment.p0, this.currentSegment.p1);

        if (this.currentSegment.p2) {
          // Control handle 2
          this.renderControlPoint(this.currentSegment.p2);

          if (this.currentSegment.p3) {
            // Preview complete curve
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${this.currentSegment.p0.x},${this.currentSegment.p0.y} ` +
                     `C ${this.currentSegment.p1.x},${this.currentSegment.p1.y} ` +
                     `${this.currentSegment.p2.x},${this.currentSegment.p2.y} ` +
                     `${this.currentSegment.p3.x},${this.currentSegment.p3.y}`;
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', '#6600cc');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('opacity', '0.7');
            this.previewGroup.appendChild(path);

            this.renderHandle(this.currentSegment.p3, this.currentSegment.p2);
            this.renderAnchor(this.currentSegment.p3, '#0066ff');
          } else if (this.currentPoint) {
            // Preview P3 position
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${this.currentSegment.p0.x},${this.currentSegment.p0.y} ` +
                     `C ${this.currentSegment.p1.x},${this.currentSegment.p1.y} ` +
                     `${this.currentSegment.p2.x},${this.currentSegment.p2.y} ` +
                     `${this.currentPoint.x},${this.currentPoint.y}`;
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', '#6600cc');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('stroke-dasharray', '5 5');
            path.setAttribute('opacity', '0.5');
            this.previewGroup.appendChild(path);

            this.renderAnchor(this.currentPoint, '#888', 4);
          }
        } else if (this.currentPoint) {
          // Preview P2 position
          this.renderControlPoint(this.currentPoint, 0.5);
          
          // Show potential curve
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const d = `M ${this.currentSegment.p0.x},${this.currentSegment.p0.y} ` +
                   `C ${this.currentSegment.p1.x},${this.currentSegment.p1.y} ` +
                   `${this.currentPoint.x},${this.currentPoint.y} ` +
                   `${this.currentPoint.x},${this.currentPoint.y}`;
          path.setAttribute('d', d);
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', '#6600cc');
          path.setAttribute('stroke-width', '1');
          path.setAttribute('stroke-dasharray', '5 5');
          path.setAttribute('opacity', '0.3');
          this.previewGroup.appendChild(path);
        }
      }
    }
  }

  private renderHandles(segment: BezierSegment): void {
    // P0 to P1
    this.renderHandle(segment.p0, segment.p1);
    // P3 to P2
    this.renderHandle(segment.p3, segment.p2);
  }

  private renderHandle(anchor: Point, control: Point): void {
    // Handle line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', anchor.x.toString());
    line.setAttribute('y1', anchor.y.toString());
    line.setAttribute('x2', control.x.toString());
    line.setAttribute('y2', control.y.toString());
    line.setAttribute('stroke', '#999');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '3 3');
    this.previewGroup.appendChild(line);

    // Control point
    this.renderControlPoint(control);
  }

  private renderControlPoint(point: Point, opacity: number = 1.0): void {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', point.x.toString());
    circle.setAttribute('cy', point.y.toString());
    circle.setAttribute('r', '5');
    circle.setAttribute('fill', 'white');
    circle.setAttribute('stroke', '#6600cc');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('opacity', opacity.toString());
    this.previewGroup.appendChild(circle);
  }

  private renderAnchor(point: Point, color: string, radius: number = 6): void {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', point.x.toString());
    circle.setAttribute('cy', point.y.toString());
    circle.setAttribute('r', radius.toString());
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', '2');
    this.previewGroup.appendChild(circle);
  }

  private clearPreview(): void {
    while (this.previewGroup.firstChild) {
      this.previewGroup.removeChild(this.previewGroup.firstChild);
    }
  }

  private reset(): void {
    this.state = DrawState.PLACE_START;
    this.segments = [];
    this.currentSegment = {};
    this.currentPoint = null;
    this.isDragging = false;
    this.clearPreview();
    console.log('Bezier tool ready - click to place start point');
  }

  private formatDistance(cm: number): string {
    if (cm < 100) {
      return `${cm.toFixed(1)} cm`;
    } else {
      return `${(cm / 100).toFixed(2)} m`;
    }
  }

  private generateId(type: string): string {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }
}
```

### src/renderer/ShapeRenderer.ts (additions)

```typescript
import { BezierMath } from '../geometry/BezierMath';

// Add to ShapeRenderer class:

private renderBezierSpline(obj: GeometryObject, zoom: number): SVGPathElement {
  const geom = obj.geometry as BezierSplineGeometry;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  
  const d = BezierMath.toSVGPath(geom.segments, geom.closed);
  path.setAttribute('d', d);
  path.setAttribute('fill', obj.style.fill || 'none');
  path.setAttribute('stroke', obj.style.stroke || '#6600cc');
  path.setAttribute('stroke-width', ((obj.style.strokeWidth || 2) / zoom).toString());
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('opacity', obj.style.opacity?.toString() || '1');
  path.setAttribute('data-object-id', obj.id);
  
  return path;
}

// Update main render method:
render(obj: GeometryObject, zoom: number): SVGElement {
  switch (obj.geometry.type) {
    // ... existing cases ...
    case GeometryType.BEZIER_SPLINE:
      return this.renderBezierSpline(obj, zoom);
    default:
      throw new Error(`Unsupported geometry type: ${(obj.geometry as any).type}`);
  }
}
```

### src/main.ts (integration)

```typescript
import { BezierTool } from './tools/BezierTool';

// Add button to toolbar
<button id="tool-bezier" class="tool-btn" title="Bezier Spline">〜</button>

// Initialize tool
const bezierTool = new BezierTool(
  project,
  viewport.getPreviewGroup(),
  snapManager,
  layerManager,
  commandHistory,
  originalOnUpdate
);

// Add to tools object
const tools = {
  // ... existing tools ...
  bezier: bezierTool
};

// Wire up button
document.getElementById('tool-bezier')?.addEventListener('click', () => {
  setTool('bezier');
});

// Update status messages
const messages: Record<string, string> = {
  // ... existing messages ...
  bezier: 'Bezier tool - click anchor, drag handle, click to place segments'
};

// Keyboard shortcut (B for Bezier)
document.addEventListener('keydown', (e) => {
  // ... existing shortcuts ...
  if (e.key === 'B' || e.key === 'b') {
    setTool('bezier');
  }
});

// Handle double-click for Bezier
viewport.getSVG().addEventListener('dblclick', (e) => {
  // ... existing double-click handlers ...
  if (activeTool === 'bezier') {
    bezierTool.onDoubleClick();
  }
});

console.log('Bezier spline tool loaded. Shortcut: B key');
```

## Test Plan

### Manual Testing Steps

1. **Basic curve creation test**
   - Click Bezier tool button
   - Click at (0, 0) for start anchor
   - Drag to (100, 100) for control handle
   - Release mouse
   - Click at (200, 100) for second control
   - Click at (300, 0) for end anchor
   - Verify smooth curve rendered

2. **Control handle visualization test**
   - During curve creation
   - Verify dashed lines from anchors to control points
   - Verify control points shown as white circles with purple border
   - Verify anchors shown as blue circles

3. **Multi-segment spline test**
   - Create first segment
   - Continue with second segment
   - Verify smooth transition
   - Verify automatic handle mirroring
   - Add 3-4 segments total
   - Double-click to finish
   - Verify entire spline rendered as one object

4. **Double-click finish test**
   - Start Bezier curve
   - Add 2 segments
   - Double-click on third end point
   - Verify spline completed immediately
   - Verify no extra click needed

5. **Enter key finish test**
   - Start Bezier curve
   - Add 2 segments
   - Press Enter
   - Verify spline completed
   - Verify console confirmation

6. **ESC cancel test**
   - Start drawing Bezier
   - Add one segment
   - Press ESC
   - Verify preview clears
   - Verify no spline created
   - Verify tool resets

7. **Arc length calculation test**
   - Create S-shaped curve
   - Check console for length
   - Verify length reasonable (not straight-line distance)
   - Compare with manual measurement

8. **Smooth continuity test**
   - Create 3-segment spline
   - Verify each transition is smooth
   - Verify no sharp corners at segment joins
   - Verify handles automatically aligned

9. **Selection test**
   - Create Bezier spline
   - Switch to Select tool
   - Click on curve
   - Verify selection highlights curve
   - Verify can move entire spline

10. **Snap integration test**
    - Enable grid snap
    - Use Bezier tool
    - Place anchors and controls
    - Verify snap works for all points
    - Verify smooth curves with snapped points

11. **Complex curve test**
    - Create heart shape with Bezier
    - Use multiple segments
    - Adjust handles for smooth transitions
    - Verify renders smoothly
    - Verify no artifacts or gaps

12. **Undo test**
    - Create Bezier spline
    - Press Ctrl+Z
    - Verify spline removed
    - Press Ctrl+Y
    - Verify spline restored

13. **Visual rendering test**
    - Create various curves (S-curve, loop, spiral-like)
    - Zoom in/out
    - Verify curves remain smooth at all zoom levels
    - Verify stroke width scales correctly

14. **Keyboard shortcut test**
    - Press B key
    - Verify Bezier tool activates
    - Verify status message updates
    - Create a curve to confirm tool works

15. **Save/load test**
    - Create complex Bezier spline
    - Save project
    - Reload page
    - Load project
    - Verify Bezier spline restored correctly
    - Verify all segments intact

## Acceptance Criteria

- [ ] BezierSpline geometry type defined
- [ ] BezierSegment structure (P0, P1, P2, P3)
- [ ] BezierMath.evaluateCubic for point-on-curve
- [ ] BezierMath.arcLength for curve length
- [ ] BezierMath.toSVGPath for rendering
- [ ] BezierMath.mirrorHandle for continuity
- [ ] BezierTool with multi-step workflow
- [ ] Click-drag-click interaction for segments
- [ ] Control point visualization (dashed lines)
- [ ] Anchor point visualization (blue circles)
- [ ] Multi-segment spline support
- [ ] Smooth tangent continuity between segments
- [ ] Double-click to finish spline
- [ ] Enter key to finish spline
- [ ] ESC to cancel drawing
- [ ] SVG path rendering for splines
- [ ] Selection support for Bezier splines
- [ ] Undo/redo integration
- [ ] Snap integration for all points
- [ ] Arc length stored in metadata
- [ ] Keyboard shortcut: B key
- [ ] Console logs for each step
- [ ] Smooth rendering at all zoom levels
- [ ] No TypeScript compilation errors

## Deliverables

1. **Updated src/geometry/types.ts** - BezierSpline geometry type
2. **src/geometry/BezierMath.ts** - Bezier curve mathematics
3. **src/tools/BezierTool.ts** - Curve drawing tool
4. **Updated src/renderer/ShapeRenderer.ts** - Bezier rendering
5. **Updated src/main.ts** - Tool integration, keyboard shortcut
6. **Working Bezier spline tool** - Create smooth curves with control handles
7. **Multi-segment support** - Chain multiple curves with smooth continuity

---

**Estimated effort**: 4-5 hours  
**Dependencies**: Slice 5 (drawing tools), Slice 14 (undo/redo)  
**Risk**: Medium - Bezier math requires testing, control point UX needs refinement

