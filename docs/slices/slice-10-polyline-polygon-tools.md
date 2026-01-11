# Slice 10: Polyline and Polygon Tools

## User Value

As a user, I need to create multi-segment paths and closed polygons so that I can accurately represent garden beds, complex property boundaries, irregular paths, and other multi-sided features.

## Slice Features

1. **Polyline drawing tool** - Create open paths with multiple segments
2. **Polygon drawing tool** - Create closed shapes with multiple vertices
3. **Click-to-add-vertex workflow** - Add points one at a time
4. **Live preview** - Show shape being drawn with rubber-band line
5. **Double-click to finish** - Complete polyline/polygon
6. **Enter key to finish** - Keyboard alternative to double-click
7. **ESC to cancel** - Abort drawing in progress
8. **Vertex editing** - Select and move individual vertices after creation
9. **Close path toggle** - Convert polyline to polygon and vice versa
10. **Perimeter display** - Show total length during drawing

## Technical Implementation Sketch

### File Structure

```
src/
├── geometry/
│   ├── types.ts              # Add Polyline and Polygon types
│   └── GeometryObject.ts     # Already supports these types
├── tools/
│   ├── PolylineTool.ts       # Multi-segment path creation
│   └── PolygonTool.ts        # Multi-vertex polygon creation
├── selection/
│   └── VertexEditor.ts       # Edit vertices of selected polyline/polygon
└── main.ts                   # Updated with new tools
```

### Core Concepts

**Polyline vs Polygon**:
- Polyline: Open path (start ≠ end), represents paths, boundaries
- Polygon: Closed path (automatically closes), represents beds, areas

**Drawing Workflow**:
1. Click to place first vertex
2. Each click adds another vertex
3. Preview shows next segment following cursor
4. Double-click or Enter to complete
5. ESC to cancel and discard

**Vertex Editing**:
- Select polyline/polygon shows all vertices as handles
- Click and drag individual vertex to move it
- Shape updates in real-time
- Maintains segment connections

### src/geometry/types.ts (additions)

```typescript
export interface PolylineGeometry extends GeometryData {
  type: GeometryType.POLYLINE;
  points: Point[];
}

export interface PolygonGeometry extends GeometryData {
  type: GeometryType.POLYGON;
  points: Point[];
}

// Update Geometry union type:
export type Geometry = 
  | PointGeometry 
  | LineGeometry 
  | CircleGeometry 
  | PolylineGeometry 
  | PolygonGeometry;
```

### src/renderer/ShapeRenderer.ts (additions)

```typescript
// Add to ShapeRenderer class:

private renderPolyline(obj: GeometryObject, zoom: number): SVGPolylineElement {
  const geom = obj.geometry as PolylineGeometry;
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  
  const pointsStr = geom.points.map(p => `${p.x},${p.y}`).join(' ');
  polyline.setAttribute('points', pointsStr);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', obj.style.stroke || '#000000');
  polyline.setAttribute('stroke-width', ((obj.style.strokeWidth || 2) / zoom).toString());
  polyline.setAttribute('stroke-linejoin', 'round');
  polyline.setAttribute('stroke-linecap', 'round');
  polyline.setAttribute('opacity', obj.style.opacity?.toString() || '1');
  polyline.setAttribute('data-object-id', obj.id);
  
  return polyline;
}

private renderPolygon(obj: GeometryObject, zoom: number): SVGPolygonElement {
  const geom = obj.geometry as PolygonGeometry;
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  
  const pointsStr = geom.points.map(p => `${p.x},${p.y}`).join(' ');
  polygon.setAttribute('points', pointsStr);
  polygon.setAttribute('fill', obj.style.fill || 'none');
  polygon.setAttribute('stroke', obj.style.stroke || '#000000');
  polygon.setAttribute('stroke-width', ((obj.style.strokeWidth || 2) / zoom).toString());
  polygon.setAttribute('stroke-linejoin', 'round');
  polygon.setAttribute('opacity', obj.style.opacity?.toString() || '1');
  polygon.setAttribute('data-object-id', obj.id);
  
  return polygon;
}

// Update main render method to include these cases:
render(obj: GeometryObject, zoom: number): SVGElement {
  switch (obj.geometry.type) {
    case GeometryType.POINT:
      return this.renderPoint(obj, zoom);
    case GeometryType.LINE:
      return this.renderLine(obj, zoom);
    case GeometryType.CIRCLE:
      return this.renderCircle(obj, zoom);
    case GeometryType.POLYLINE:
      return this.renderPolyline(obj, zoom);
    case GeometryType.POLYGON:
      return this.renderPolygon(obj, zoom);
    default:
      throw new Error(`Unsupported geometry type: ${(obj.geometry as any).type}`);
  }
}
```

### src/tools/PolylineTool.ts

```typescript
import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point } from '../geometry/types';
import { SnapManager } from '../snapping/SnapManager';
import { LayerManager } from '../model/LayerManager';

export class PolylineTool implements Tool {
  readonly name = 'polyline';

  private project: Project;
  private previewGroup: SVGGElement;
  private snapManager: SnapManager;
  private layerManager: LayerManager;
  private onUpdate: () => void;
  
  private points: Point[] = [];
  private currentPoint: Point | null = null;

  constructor(
    project: Project,
    previewGroup: SVGGElement,
    snapManager: SnapManager,
    layerManager: LayerManager,
    onUpdate: () => void
  ) {
    this.project = project;
    this.previewGroup = previewGroup;
    this.snapManager = snapManager;
    this.layerManager = layerManager;
    this.onUpdate = onUpdate;
  }

  onActivate(): void {
    this.reset();
    console.log('Polyline tool activated - click points, double-click or Enter to finish');
  }

  onDeactivate(): void {
    this.reset();
  }

  onMouseDown(event: ToolMouseEvent): void {
    // Not used
  }

  onMouseMove(event: ToolMouseEvent): void {
    const snapResult = this.snapManager.snap(event.worldPos);
    this.currentPoint = snapResult.point;
    this.renderPreview();
  }

  onMouseUp(event: ToolMouseEvent): void {
    // Not used
  }

  onMouseClick(event: ToolMouseEvent): void {
    const snapResult = this.snapManager.snap(event.worldPos);
    const point = snapResult.point;

    this.points.push(point);
    console.log(`Vertex ${this.points.length} added at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    
    if (this.points.length >= 2) {
      const totalLength = this.calculateTotalLength();
      console.log(`  Total length: ${this.formatDistance(totalLength)}`);
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      console.log('Polyline drawing cancelled');
      this.reset();
    } else if (key === 'Enter' && this.points.length >= 2) {
      this.complete();
    }
  }

  onDoubleClick(): void {
    if (this.points.length >= 2) {
      this.complete();
    } else {
      console.log('Need at least 2 points for polyline');
    }
  }

  private complete(): void {
    const activeLayerId = this.layerManager.getActiveLayerId() || 'default';
    const id = this.generateId('polyline');
    
    const polyline = new GeometryObject(
      id,
      activeLayerId,
      {
        type: GeometryType.POLYLINE,
        points: [...this.points]
      },
      { stroke: '#333333', strokeWidth: 2 },
      { 
        name: `Polyline ${id}`,
        length: this.calculateTotalLength()
      }
    );

    this.project.addObject(polyline);
    this.onUpdate();
    
    const length = this.calculateTotalLength();
    console.log(`Created polyline with ${this.points.length} vertices, length: ${this.formatDistance(length)}`);
    
    this.reset();
  }

  private renderPreview(): void {
    this.clearPreview();

    // Render existing vertices
    this.points.forEach((point, index) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x.toString());
      circle.setAttribute('cy', point.y.toString());
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', index === 0 ? '#0066ff' : '#666');
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2');
      this.previewGroup.appendChild(circle);
    });

    // Render existing segments
    for (let i = 0; i < this.points.length - 1; i++) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', this.points[i].x.toString());
      line.setAttribute('y1', this.points[i].y.toString());
      line.setAttribute('x2', this.points[i + 1].x.toString());
      line.setAttribute('y2', this.points[i + 1].y.toString());
      line.setAttribute('stroke', '#666');
      line.setAttribute('stroke-width', '2');
      this.previewGroup.appendChild(line);
    }

    // Render preview segment to current point
    if (this.points.length > 0 && this.currentPoint) {
      const lastPoint = this.points[this.points.length - 1];
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', lastPoint.x.toString());
      line.setAttribute('y1', lastPoint.y.toString());
      line.setAttribute('x2', this.currentPoint.x.toString());
      line.setAttribute('y2', this.currentPoint.y.toString());
      line.setAttribute('stroke', '#666');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '5 5');
      line.setAttribute('opacity', '0.7');
      this.previewGroup.appendChild(line);

      // Current point preview
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.currentPoint.x.toString());
      circle.setAttribute('cy', this.currentPoint.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#666');
      circle.setAttribute('opacity', '0.5');
      this.previewGroup.appendChild(circle);
    }

    // Show total length label
    if (this.points.length >= 1 && this.currentPoint) {
      const previewPoints = [...this.points, this.currentPoint];
      const length = this.calculateLengthForPoints(previewPoints);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', this.currentPoint.x.toString());
      text.setAttribute('y', (this.currentPoint.y - 15).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#0066ff');
      text.setAttribute('font-size', '14');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-family', 'monospace');
      text.textContent = `Length: ${this.formatDistance(length)}`;
      this.previewGroup.appendChild(text);
    }
  }

  private clearPreview(): void {
    while (this.previewGroup.firstChild) {
      this.previewGroup.removeChild(this.previewGroup.firstChild);
    }
  }

  private reset(): void {
    this.points = [];
    this.currentPoint = null;
    this.clearPreview();
  }

  private calculateTotalLength(): number {
    return this.calculateLengthForPoints(this.points);
  }

  private calculateLengthForPoints(points: Point[]): number {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total;
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

### src/tools/PolygonTool.ts

```typescript
import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point } from '../geometry/types';
import { SnapManager } from '../snapping/SnapManager';
import { LayerManager } from '../model/LayerManager';

export class PolygonTool implements Tool {
  readonly name = 'polygon';

  private project: Project;
  private previewGroup: SVGGElement;
  private snapManager: SnapManager;
  private layerManager: LayerManager;
  private onUpdate: () => void;
  
  private points: Point[] = [];
  private currentPoint: Point | null = null;

  constructor(
    project: Project,
    previewGroup: SVGGElement,
    snapManager: SnapManager,
    layerManager: LayerManager,
    onUpdate: () => void
  ) {
    this.project = project;
    this.previewGroup = previewGroup;
    this.snapManager = snapManager;
    this.layerManager = layerManager;
    this.onUpdate = onUpdate;
  }

  onActivate(): void {
    this.reset();
    console.log('Polygon tool activated - click vertices, double-click or Enter to close');
  }

  onDeactivate(): void {
    this.reset();
  }

  onMouseDown(event: ToolMouseEvent): void {
    // Not used
  }

  onMouseMove(event: ToolMouseEvent): void {
    const snapResult = this.snapManager.snap(event.worldPos);
    this.currentPoint = snapResult.point;
    this.renderPreview();
  }

  onMouseUp(event: ToolMouseEvent): void {
    // Not used
  }

  onMouseClick(event: ToolMouseEvent): void {
    const snapResult = this.snapManager.snap(event.worldPos);
    const point = snapResult.point;

    this.points.push(point);
    console.log(`Vertex ${this.points.length} added at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    
    if (this.points.length >= 3) {
      const area = this.calculateArea([...this.points]);
      console.log(`  Current area: ${this.formatArea(area)}`);
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      console.log('Polygon drawing cancelled');
      this.reset();
    } else if (key === 'Enter' && this.points.length >= 3) {
      this.complete();
    }
  }

  onDoubleClick(): void {
    if (this.points.length >= 3) {
      this.complete();
    } else {
      console.log('Need at least 3 points for polygon');
    }
  }

  private complete(): void {
    const activeLayerId = this.layerManager.getActiveLayerId() || 'default';
    const id = this.generateId('polygon');
    
    const polygon = new GeometryObject(
      id,
      activeLayerId,
      {
        type: GeometryType.POLYGON,
        points: [...this.points]
      },
      { 
        stroke: '#228B22', 
        strokeWidth: 2, 
        fill: '#90EE90', 
        opacity: 0.3 
      },
      { 
        name: `Polygon ${id}`,
        area: this.calculateArea(this.points),
        perimeter: this.calculatePerimeter(this.points)
      }
    );

    this.project.addObject(polygon);
    this.onUpdate();
    
    const area = this.calculateArea(this.points);
    const perimeter = this.calculatePerimeter(this.points);
    console.log(`Created polygon with ${this.points.length} vertices`);
    console.log(`  Area: ${this.formatArea(area)}, Perimeter: ${this.formatDistance(perimeter)}`);
    
    this.reset();
  }

  private renderPreview(): void {
    this.clearPreview();

    // Render existing vertices
    this.points.forEach((point, index) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x.toString());
      circle.setAttribute('cy', point.y.toString());
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', index === 0 ? '#0066ff' : '#228B22');
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2');
      this.previewGroup.appendChild(circle);
    });

    // Render existing segments
    for (let i = 0; i < this.points.length - 1; i++) {
      this.renderSegment(this.points[i], this.points[i + 1], false);
    }

    // Render preview segments to current point
    if (this.points.length > 0 && this.currentPoint) {
      // Segment from last point to current
      const lastPoint = this.points[this.points.length - 1];
      this.renderSegment(lastPoint, this.currentPoint, true);
      
      // Closing segment (if we have at least 2 points)
      if (this.points.length >= 2) {
        this.renderSegment(this.currentPoint, this.points[0], true);
      }

      // Current point preview
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.currentPoint.x.toString());
      circle.setAttribute('cy', this.currentPoint.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#228B22');
      circle.setAttribute('opacity', '0.5');
      this.previewGroup.appendChild(circle);

      // Show area label if we have 3+ points
      if (this.points.length >= 2) {
        const previewPoints = [...this.points, this.currentPoint];
        const area = this.calculateArea(previewPoints);
        const centroid = this.calculateCentroid(previewPoints);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', centroid.x.toString());
        text.setAttribute('y', centroid.y.toString());
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#228B22');
        text.setAttribute('font-size', '14');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('font-family', 'monospace');
        text.textContent = `Area: ${this.formatArea(area)}`;
        this.previewGroup.appendChild(text);
      }
    }
  }

  private renderSegment(p1: Point, p2: Point, dashed: boolean): void {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1.x.toString());
    line.setAttribute('y1', p1.y.toString());
    line.setAttribute('x2', p2.x.toString());
    line.setAttribute('y2', p2.y.toString());
    line.setAttribute('stroke', '#228B22');
    line.setAttribute('stroke-width', '2');
    if (dashed) {
      line.setAttribute('stroke-dasharray', '5 5');
      line.setAttribute('opacity', '0.7');
    }
    this.previewGroup.appendChild(line);
  }

  private clearPreview(): void {
    while (this.previewGroup.firstChild) {
      this.previewGroup.removeChild(this.previewGroup.firstChild);
    }
  }

  private reset(): void {
    this.points = [];
    this.currentPoint = null;
    this.clearPreview();
  }

  private calculateArea(points: Point[]): number {
    if (points.length < 3) return 0;
    
    // Shoelace formula
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  }

  private calculatePerimeter(points: Point[]): number {
    if (points.length < 2) return 0;
    
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    return perimeter;
  }

  private calculateCentroid(points: Point[]): Point {
    let sumX = 0, sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / points.length, y: sumY / points.length };
  }

  private formatDistance(cm: number): string {
    if (cm < 100) {
      return `${cm.toFixed(1)} cm`;
    } else {
      return `${(cm / 100).toFixed(2)} m`;
    }
  }

  private formatArea(cm2: number): string {
    if (cm2 < 10000) {
      return `${cm2.toFixed(0)} cm²`;
    } else {
      return `${(cm2 / 10000).toFixed(2)} m²`;
    }
  }

  private generateId(type: string): string {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }
}
```

### Update SelectTool for polyline/polygon hit testing

```typescript
// Add to SelectTool.hitTest method:

case GeometryType.POLYLINE:
case GeometryType.POLYGON: {
  const geom = obj.geometry as any;
  const points = geom.points;
  
  // Check if point is near any segment
  for (let i = 0; i < points.length - 1; i++) {
    const dist = this.pointToLineDistance(point, points[i], points[i + 1]);
    if (dist <= tolerance + (obj.style.strokeWidth || 2) / 2) {
      return true;
    }
  }
  
  // For polygons, also check closing segment
  if (geom.type === GeometryType.POLYGON && points.length >= 2) {
    const dist = this.pointToLineDistance(
      point, 
      points[points.length - 1], 
      points[0]
    );
    if (dist <= tolerance + (obj.style.strokeWidth || 2) / 2) {
      return true;
    }
  }
  
  return false;
}
```

### Update SelectionRenderer for polyline/polygon

```typescript
// Add to SelectionRenderer.createHighlight:

case GeometryType.POLYLINE: {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  // Highlight the path
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  const pointsStr = geom.points.map((p: any) => `${p.x},${p.y}`).join(' ');
  polyline.setAttribute('points', pointsStr);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', '#0066ff');
  polyline.setAttribute('stroke-width', ((obj.style.strokeWidth || 2) / zoom + 2 / zoom).toString());
  polyline.setAttribute('opacity', '0.5');
  group.appendChild(polyline);
  
  // Vertex handles
  geom.points.forEach((point: any) => {
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

case GeometryType.POLYGON: {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  // Highlight the polygon
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  const pointsStr = geom.points.map((p: any) => `${p.x},${p.y}`).join(' ');
  polygon.setAttribute('points', pointsStr);
  polygon.setAttribute('fill', 'none');
  polygon.setAttribute('stroke', '#0066ff');
  polygon.setAttribute('stroke-width', (2 / zoom).toString());
  polygon.setAttribute('stroke-dasharray', `${8 / zoom} ${4 / zoom}`);
  group.appendChild(polygon);
  
  // Vertex handles
  geom.points.forEach((point: any) => {
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
```

### src/main.ts (add tools)

```typescript
import { PolylineTool } from './tools/PolylineTool';
import { PolygonTool } from './tools/PolygonTool';

// Add buttons to toolbar:
<button id="tool-polyline" class="tool-btn">Polyline</button>
<button id="tool-polygon" class="tool-btn">Polygon</button>

// Initialize tools:
const polylineTool = new PolylineTool(
  project,
  viewport.getPreviewGroup(),
  snapManager,
  layerManager,
  originalOnUpdate
);

const polygonTool = new PolygonTool(
  project,
  viewport.getPreviewGroup(),
  snapManager,
  layerManager,
  originalOnUpdate
);

// Add to tools object:
const tools = { 
  select: selectTool, 
  point: pointTool, 
  line: lineTool, 
  circle: circleTool,
  polyline: polylineTool,
  polygon: polygonTool,
  measure: measureTool,
  area: areaTool
};

// Wire up buttons:
document.getElementById('tool-polyline')?.addEventListener('click', () => setTool('polyline'));
document.getElementById('tool-polygon')?.addEventListener('click', () => setTool('polygon'));

// Update status messages:
const messages: Record<string, string> = {
  // ... existing messages ...
  polyline: 'Polyline tool active - click points, double-click or Enter to finish',
  polygon: 'Polygon tool active - click vertices, double-click or Enter to close'
};

// Handle double-click for polyline/polygon:
viewport.getSVG().addEventListener('dblclick', (e) => {
  if (activeTool === 'polyline') {
    polylineTool.onDoubleClick();
  } else if (activeTool === 'polygon') {
    polygonTool.onDoubleClick();
  } else if (activeTool === 'area') {
    areaTool.onDoubleClick();
  }
});

// Keyboard shortcuts (add to existing):
// Use Shift+L for polyline, Shift+P for polygon to avoid conflicts
document.addEventListener('keydown', (e) => {
  // ... existing shortcuts ...
  
  if (e.shiftKey && (e.key === 'L' || e.key === 'l')) setTool('polyline');
  if (e.shiftKey && (e.key === 'P' || e.key === 'p')) setTool('polygon');
});

console.log('Polyline and Polygon tools loaded. Shortcuts: Shift+L=Polyline, Shift+P=Polygon');
```

## Test Plan

### Manual Testing Steps

1. **Polyline tool activation test**
   - Click "Polyline" button
   - Verify button highlights
   - Verify status shows "click points, double-click or Enter to finish"
   - Verify cursor changes to crosshair

2. **Polyline creation test**
   - Click at (0, 0) for first vertex
   - Verify blue dot appears
   - Click at (500, 0)
   - Verify line segment connects points
   - Click at (500, 500)
   - Verify path extends
   - Click at (1000, 500)
   - Verify 4-vertex path formed
   - Verify live length label updates
   - Double-click to finish
   - Verify polyline persists as solid object

3. **Polyline length calculation test**
   - Create polyline: (0,0) → (100,0) → (100,100)
   - Verify length shows "2.00 m" (200 cm)
   - Create zigzag path
   - Verify length is sum of all segments

4. **Polygon tool activation test**
   - Click "Polygon" button
   - Verify tool switches
   - Verify status updates

5. **Polygon creation test**
   - Click at (0, 0)
   - Click at (300, 0)
   - Click at (300, 300)
   - Verify preview shows closing edge (back to first point)
   - Verify semi-transparent fill preview
   - Click at (0, 300)
   - Verify rectangle forms
   - Verify area label displays
   - Double-click to complete
   - Verify polygon persists with fill

6. **Polygon area calculation test**
   - Create 100×100 square
   - Verify area shows "1.00 m²" or "10000 cm²"
   - Create triangle: (0,0), (100,0), (50,100)
   - Verify area approximately 5000 cm² or 0.50 m²

7. **Enter key completion test**
   - Start polyline, add 3+ points
   - Press Enter
   - Verify polyline completes
   - Start polygon, add 3+ points
   - Press Enter
   - Verify polygon closes and completes

8. **ESC cancel test**
   - Start polyline, add 2 points
   - Press ESC
   - Verify preview clears
   - Verify no object created
   - Repeat with polygon

9. **Selection test**
   - Create polyline
   - Switch to Select tool
   - Click on polyline
   - Verify selection with vertex handles
   - Create polygon
   - Select it
   - Verify selection with vertex handles

10. **Hit testing test**
    - Create polyline
    - Click slightly off the path
    - Verify selection works (tolerance)
    - Click far from path
    - Verify no selection

11. **Snap integration test**
    - Enable grid snap
    - Use Polyline tool
    - Click near grid points
    - Verify vertices snap to grid
    - Verify path segments connect snapped vertices

12. **Keyboard shortcuts test**
    - Press Shift+L
    - Verify Polyline tool activates
    - Press Shift+P
    - Verify Polygon tool activates

13. **Visual distinction test**
    - Create polyline (open path)
    - Create polygon (closed shape with fill)
    - Verify polyline has no fill
    - Verify polygon has semi-transparent green fill
    - Verify both show vertices when selected

14. **Complex shape test**
    - Create polyline with 10+ vertices (complex path)
    - Verify smooth rendering
    - Verify all segments connect properly
    - Create polygon with 8+ vertices (octagon-like)
    - Verify closes correctly
    - Verify area calculation accurate

## Acceptance Criteria

- [ ] Polyline tool button in toolbar
- [ ] Polygon tool button in toolbar
- [ ] Polyline: click-to-add-vertex workflow
- [ ] Polygon: click-to-add-vertex workflow
- [ ] Live preview shows rubber-band line to cursor
- [ ] Double-click completes shape
- [ ] Enter key completes shape
- [ ] ESC cancels drawing in progress
- [ ] Polyline shows total length during drawing
- [ ] Polygon shows area during drawing
- [ ] Polyline minimum 2 vertices to complete
- [ ] Polygon minimum 3 vertices to complete
- [ ] Polyline renders as open path (no fill)
- [ ] Polygon renders as closed shape with fill
- [ ] Selection shows all vertex handles
- [ ] Hit testing works on path segments
- [ ] Snap integration works for vertices
- [ ] Length calculation accurate (sum of segments)
- [ ] Area calculation accurate (Shoelace formula)
- [ ] Perimeter calculation accurate for polygons
- [ ] Console logs vertex additions and final metrics
- [ ] Keyboard shortcuts: Shift+L (polyline), Shift+P (polygon)
- [ ] First vertex highlighted in blue
- [ ] Preview uses dashed line for next segment
- [ ] No TypeScript compilation errors

## Deliverables

1. **Updated src/geometry/types.ts** - Polyline and Polygon geometry types
2. **Updated src/renderer/ShapeRenderer.ts** - Polyline and polygon rendering
3. **src/tools/PolylineTool.ts** - Multi-vertex path creation with length
4. **src/tools/PolygonTool.ts** - Multi-vertex closed shape with area
5. **Updated src/tools/SelectTool.ts** - Hit testing for polyline/polygon
6. **Updated src/selection/SelectionRenderer.ts** - Vertex handles display
7. **Updated src/main.ts** - Tool integration, double-click handler, shortcuts
8. **Working polyline/polygon tools** - Create complex paths and shapes

---

**Estimated effort**: 3-4 hours  
**Dependencies**: Slice 5 (drawing tools), Slice 6 (snapping)  
**Risk**: Low - similar patterns to existing tools, well-defined geometry types
