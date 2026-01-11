# Slice 8: Measurement Tools

## User Value

As a user, I need to measure distances, perimeters, and areas on my garden plan so that I can accurately calculate spacing between elements, verify dimensions, and determine surface areas for planting beds, patios, and other features.

## Slice Features

1. **Distance measurement tool** - Measure straight-line distance between two points
2. **Multi-point distance tool** - Measure cumulative distance along multiple points (path length)
3. **Area measurement tool** - Measure area of polygon defined by clicked points
4. **Measurement overlay** - Visual measurement indicators on canvas
5. **Live measurement display** - Show measurements in cm, m, and m² as appropriate
6. **Measurement persistence** - Measurements remain visible until cleared or tool switched
7. **Multiple units display** - Show measurements in both cm and human-readable units (m)
8. **Measurement result panel** - Display detailed measurements in UI panel
9. **Clear measurements button** - Remove all measurement annotations
10. **ESC to cancel** - Cancel measurement in progress

## Technical Implementation Sketch

### File Structure

```
src/
├── tools/
│   ├── MeasureTool.ts        # Distance measurement
│   └── AreaTool.ts           # Area/perimeter measurement
├── measurement/
│   ├── Measurement.ts        # Measurement data model
│   ├── MeasurementManager.ts # Store and manage measurements
│   └── MeasurementRenderer.ts # Render measurement overlays
└── main.ts                   # Updated with measurement tools
```

### Core Concepts

**Measurement Types**:
- `DISTANCE`: Single straight-line distance
- `PATH`: Multi-segment distance (cumulative)
- `AREA`: Polygon area with perimeter

**Measurement Workflow**:
- User clicks points to define measurement
- Live preview shows current measurement
- Final click completes measurement
- Result stored and rendered persistently
- ESC cancels measurement in progress

**Unit Conversion**:
- Internal: centimeters
- Display: cm for small values (<100), meters for larger
- Area: cm² for small, m² for larger

### src/measurement/Measurement.ts

```typescript
import { Point } from '../types/geometry';

export enum MeasurementType {
  DISTANCE = 'distance',
  PATH = 'path',
  AREA = 'area'
}

export interface MeasurementData {
  id: string;
  type: MeasurementType;
  points: Point[];
  value: number; // cm or cm²
  timestamp: number;
}

export class Measurement {
  readonly id: string;
  readonly type: MeasurementType;
  readonly points: Point[];
  readonly value: number;
  readonly timestamp: number;

  constructor(id: string, type: MeasurementType, points: Point[], value: number) {
    this.id = id;
    this.type = type;
    this.points = [...points];
    this.value = value;
    this.timestamp = Date.now();
  }

  // Format value for display
  getFormattedValue(): string {
    switch (this.type) {
      case MeasurementType.DISTANCE:
      case MeasurementType.PATH:
        return this.formatDistance(this.value);
      case MeasurementType.AREA:
        return this.formatArea(this.value);
      default:
        return this.value.toFixed(1);
    }
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

  getData(): MeasurementData {
    return {
      id: this.id,
      type: this.type,
      points: [...this.points],
      value: this.value,
      timestamp: this.timestamp
    };
  }
}
```

### src/measurement/MeasurementManager.ts

```typescript
import { Measurement, MeasurementType } from './Measurement';
import { Point } from '../types/geometry';

export type MeasurementChangeListener = () => void;

export class MeasurementManager {
  private measurements: Map<string, Measurement> = new Map();
  private listeners: MeasurementChangeListener[] = [];

  addMeasurement(type: MeasurementType, points: Point[], value: number): Measurement {
    const id = `meas-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const measurement = new Measurement(id, type, points, value);
    this.measurements.set(id, measurement);
    this.notifyListeners();
    return measurement;
  }

  removeMeasurement(id: string): boolean {
    const removed = this.measurements.delete(id);
    if (removed) {
      this.notifyListeners();
    }
    return removed;
  }

  clearAll(): void {
    this.measurements.clear();
    this.notifyListeners();
  }

  getMeasurement(id: string): Measurement | undefined {
    return this.measurements.get(id);
  }

  getAllMeasurements(): Measurement[] {
    return Array.from(this.measurements.values());
  }

  onChange(listener: MeasurementChangeListener): void {
    this.listeners.push(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
```

### src/measurement/MeasurementRenderer.ts

```typescript
import { MeasurementManager } from './MeasurementManager';
import { MeasurementType } from './Measurement';

export class MeasurementRenderer {
  private measurementGroup: SVGGElement;
  private manager: MeasurementManager;

  constructor(worldGroup: SVGGElement, manager: MeasurementManager) {
    this.manager = manager;
    this.measurementGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.measurementGroup.id = 'measurements';
    worldGroup.appendChild(this.measurementGroup);

    this.manager.onChange(() => this.render(1.0));
  }

  render(zoom: number): void {
    // Clear existing
    while (this.measurementGroup.firstChild) {
      this.measurementGroup.removeChild(this.measurementGroup.firstChild);
    }

    const measurements = this.manager.getAllMeasurements();
    for (const measurement of measurements) {
      const group = this.renderMeasurement(measurement, zoom);
      if (group) {
        this.measurementGroup.appendChild(group);
      }
    }
  }

  private renderMeasurement(measurement: any, zoom: number): SVGGElement | null {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-measurement-id', measurement.id);

    switch (measurement.type) {
      case MeasurementType.DISTANCE:
        this.renderDistance(group, measurement, zoom);
        break;
      case MeasurementType.PATH:
        this.renderPath(group, measurement, zoom);
        break;
      case MeasurementType.AREA:
        this.renderArea(group, measurement, zoom);
        break;
    }

    return group;
  }

  private renderDistance(group: SVGGElement, measurement: any, zoom: number): void {
    if (measurement.points.length < 2) return;

    const [p1, p2] = measurement.points;

    // Line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1.x.toString());
    line.setAttribute('y1', p1.y.toString());
    line.setAttribute('x2', p2.x.toString());
    line.setAttribute('y2', p2.y.toString());
    line.setAttribute('stroke', '#ff6600');
    line.setAttribute('stroke-width', (2 / zoom).toString());
    line.setAttribute('stroke-dasharray', `${10 / zoom} ${5 / zoom}`);
    group.appendChild(line);

    // Endpoints
    [p1, p2].forEach(point => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x.toString());
      circle.setAttribute('cy', point.y.toString());
      circle.setAttribute('r', (4 / zoom).toString());
      circle.setAttribute('fill', '#ff6600');
      group.appendChild(circle);
    });

    // Label
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    this.renderLabel(group, midX, midY, measurement.getFormattedValue(), zoom);
  }

  private renderPath(group: SVGGElement, measurement: any, zoom: number): void {
    if (measurement.points.length < 2) return;

    // Draw segments
    for (let i = 0; i < measurement.points.length - 1; i++) {
      const p1 = measurement.points[i];
      const p2 = measurement.points[i + 1];

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p1.x.toString());
      line.setAttribute('y1', p1.y.toString());
      line.setAttribute('x2', p2.x.toString());
      line.setAttribute('y2', p2.y.toString());
      line.setAttribute('stroke', '#ff6600');
      line.setAttribute('stroke-width', (2 / zoom).toString());
      line.setAttribute('stroke-dasharray', `${10 / zoom} ${5 / zoom}`);
      group.appendChild(line);
    }

    // Points
    measurement.points.forEach((point: any) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x.toString());
      circle.setAttribute('cy', point.y.toString());
      circle.setAttribute('r', (4 / zoom).toString());
      circle.setAttribute('fill', '#ff6600');
      group.appendChild(circle);
    });

    // Label at last point
    const lastPoint = measurement.points[measurement.points.length - 1];
    this.renderLabel(group, lastPoint.x, lastPoint.y - 20 / zoom, measurement.getFormattedValue(), zoom);
  }

  private renderArea(group: SVGGElement, measurement: any, zoom: number): void {
    if (measurement.points.length < 3) return;

    // Polygon
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const pointsStr = measurement.points.map((p: any) => `${p.x},${p.y}`).join(' ');
    polygon.setAttribute('points', pointsStr);
    polygon.setAttribute('fill', '#ff6600');
    polygon.setAttribute('fill-opacity', '0.2');
    polygon.setAttribute('stroke', '#ff6600');
    polygon.setAttribute('stroke-width', (2 / zoom).toString());
    polygon.setAttribute('stroke-dasharray', `${10 / zoom} ${5 / zoom}`);
    group.appendChild(polygon);

    // Vertices
    measurement.points.forEach((point: any) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x.toString());
      circle.setAttribute('cy', point.y.toString());
      circle.setAttribute('r', (4 / zoom).toString());
      circle.setAttribute('fill', '#ff6600');
      group.appendChild(circle);
    });

    // Label at centroid
    const centroid = this.calculateCentroid(measurement.points);
    this.renderLabel(group, centroid.x, centroid.y, measurement.getFormattedValue(), zoom);
  }

  private renderLabel(group: SVGGElement, x: number, y: number, text: string, zoom: number): void {
    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const padding = 4 / zoom;
    const textWidth = text.length * 7 / zoom; // Approximate
    const textHeight = 14 / zoom;
    
    bg.setAttribute('x', (x - textWidth / 2 - padding).toString());
    bg.setAttribute('y', (y - textHeight / 2 - padding).toString());
    bg.setAttribute('width', (textWidth + padding * 2).toString());
    bg.setAttribute('height', (textHeight + padding * 2).toString());
    bg.setAttribute('fill', 'white');
    bg.setAttribute('stroke', '#ff6600');
    bg.setAttribute('stroke-width', (1 / zoom).toString());
    bg.setAttribute('rx', (2 / zoom).toString());
    group.appendChild(bg);

    // Text
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', x.toString());
    textEl.setAttribute('y', y.toString());
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'middle');
    textEl.setAttribute('fill', '#ff6600');
    textEl.setAttribute('font-size', (12 / zoom).toString());
    textEl.setAttribute('font-weight', 'bold');
    textEl.setAttribute('font-family', 'monospace');
    textEl.textContent = text;
    group.appendChild(textEl);
  }

  private calculateCentroid(points: any[]): { x: number; y: number } {
    let sumX = 0, sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / points.length, y: sumY / points.length };
  }
}
```

### src/tools/MeasureTool.ts

```typescript
import { Tool, ToolMouseEvent } from './Tool';
import { Point } from '../types/geometry';
import { MeasurementManager } from '../measurement/MeasurementManager';
import { MeasurementType } from '../measurement/Measurement';
import { SnapManager } from '../snapping/SnapManager';

enum MeasureToolState {
  IDLE,
  FIRST_POINT_SET,
  MEASURING
}

export class MeasureTool implements Tool {
  readonly name = 'measure';

  private manager: MeasurementManager;
  private snapManager: SnapManager;
  private previewGroup: SVGGElement;
  private state: MeasureToolState = MeasureToolState.IDLE;
  private startPoint: Point | null = null;
  private currentPoint: Point | null = null;

  constructor(
    manager: MeasurementManager,
    snapManager: SnapManager,
    previewGroup: SVGGElement
  ) {
    this.manager = manager;
    this.snapManager = snapManager;
    this.previewGroup = previewGroup;
  }

  onActivate(): void {
    this.reset();
    console.log('Measure tool activated - click two points to measure distance');
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

    if (this.state === MeasureToolState.IDLE) {
      this.startPoint = point;
      this.state = MeasureToolState.FIRST_POINT_SET;
      console.log(`First point set at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    } else if (this.state === MeasureToolState.FIRST_POINT_SET && this.startPoint) {
      // Calculate distance
      const distance = this.calculateDistance(this.startPoint, point);
      
      // Create measurement
      const measurement = this.manager.addMeasurement(
        MeasurementType.DISTANCE,
        [this.startPoint, point],
        distance
      );

      console.log(`Distance measured: ${measurement.getFormattedValue()}`);
      this.reset();
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      console.log('Measurement cancelled');
      this.reset();
    }
  }

  private renderPreview(): void {
    this.clearPreview();

    if (this.state === MeasureToolState.IDLE && this.currentPoint) {
      // Show point preview
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.currentPoint.x.toString());
      circle.setAttribute('cy', this.currentPoint.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#ff6600');
      circle.setAttribute('opacity', '0.5');
      this.previewGroup.appendChild(circle);
    } else if (this.state === MeasureToolState.FIRST_POINT_SET && this.startPoint && this.currentPoint) {
      // Show start point
      const startCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      startCircle.setAttribute('cx', this.startPoint.x.toString());
      startCircle.setAttribute('cy', this.startPoint.y.toString());
      startCircle.setAttribute('r', '4');
      startCircle.setAttribute('fill', '#ff6600');
      this.previewGroup.appendChild(startCircle);

      // Show preview line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', this.startPoint.x.toString());
      line.setAttribute('y1', this.startPoint.y.toString());
      line.setAttribute('x2', this.currentPoint.x.toString());
      line.setAttribute('y2', this.currentPoint.y.toString());
      line.setAttribute('stroke', '#ff6600');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '5 5');
      line.setAttribute('opacity', '0.7');
      this.previewGroup.appendChild(line);

      // Show distance label
      const distance = this.calculateDistance(this.startPoint, this.currentPoint);
      const midX = (this.startPoint.x + this.currentPoint.x) / 2;
      const midY = (this.startPoint.y + this.currentPoint.y) / 2;
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midX.toString());
      text.setAttribute('y', (midY - 10).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#ff6600');
      text.setAttribute('font-size', '14');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-family', 'monospace');
      text.textContent = this.formatDistance(distance);
      this.previewGroup.appendChild(text);
    }
  }

  private clearPreview(): void {
    while (this.previewGroup.firstChild) {
      this.previewGroup.removeChild(this.previewGroup.firstChild);
    }
  }

  private reset(): void {
    this.state = MeasureToolState.IDLE;
    this.startPoint = null;
    this.currentPoint = null;
    this.clearPreview();
  }

  private calculateDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private formatDistance(cm: number): string {
    if (cm < 100) {
      return `${cm.toFixed(1)} cm`;
    } else {
      return `${(cm / 100).toFixed(2)} m`;
    }
  }
}
```

### src/tools/AreaTool.ts

```typescript
import { Tool, ToolMouseEvent } from './Tool';
import { Point } from '../types/geometry';
import { MeasurementManager } from '../measurement/MeasurementManager';
import { MeasurementType } from '../measurement/Measurement';
import { SnapManager } from '../snapping/SnapManager';

export class AreaTool implements Tool {
  readonly name = 'area';

  private manager: MeasurementManager;
  private snapManager: SnapManager;
  private previewGroup: SVGGElement;
  private points: Point[] = [];
  private currentPoint: Point | null = null;

  constructor(
    manager: MeasurementManager,
    snapManager: SnapManager,
    previewGroup: SVGGElement
  ) {
    this.manager = manager;
    this.snapManager = snapManager;
    this.previewGroup = previewGroup;
  }

  onActivate(): void {
    this.reset();
    console.log('Area tool activated - click points to define polygon, double-click to complete');
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
    console.log(`Point ${this.points.length} added at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
  }

  // Handle double-click to complete
  onDoubleClick(): void {
    if (this.points.length >= 3) {
      const area = this.calculateArea(this.points);
      const measurement = this.manager.addMeasurement(
        MeasurementType.AREA,
        this.points,
        area
      );
      console.log(`Area measured: ${measurement.getFormattedValue()}`);
      this.reset();
    } else {
      console.log('Need at least 3 points to measure area');
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      console.log('Area measurement cancelled');
      this.reset();
    } else if (key === 'Enter' && this.points.length >= 3) {
      this.onDoubleClick();
    }
  }

  private renderPreview(): void {
    this.clearPreview();

    // Render existing points
    this.points.forEach(point => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x.toString());
      circle.setAttribute('cy', point.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#ff6600');
      this.previewGroup.appendChild(circle);
    });

    // Render lines between points
    for (let i = 0; i < this.points.length - 1; i++) {
      this.renderLine(this.points[i], this.points[i + 1]);
    }

    // Render preview line to current point
    if (this.points.length > 0 && this.currentPoint) {
      this.renderLine(this.points[this.points.length - 1], this.currentPoint, true);
      
      // Render closing line if we have 3+ points
      if (this.points.length >= 2) {
        this.renderLine(this.currentPoint, this.points[0], true);
      }
    }

    // Current point preview
    if (this.currentPoint) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.currentPoint.x.toString());
      circle.setAttribute('cy', this.currentPoint.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#ff6600');
      circle.setAttribute('opacity', '0.5');
      this.previewGroup.appendChild(circle);
    }

    // Show area if we have enough points
    if (this.points.length >= 3 && this.currentPoint) {
      const previewPoints = [...this.points, this.currentPoint];
      const area = this.calculateArea(previewPoints);
      const centroid = this.calculateCentroid(previewPoints);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', centroid.x.toString());
      text.setAttribute('y', centroid.y.toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#ff6600');
      text.setAttribute('font-size', '14');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-family', 'monospace');
      text.textContent = this.formatArea(area);
      this.previewGroup.appendChild(text);
    }
  }

  private renderLine(p1: Point, p2: Point, dashed: boolean = false): void {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1.x.toString());
    line.setAttribute('y1', p1.y.toString());
    line.setAttribute('x2', p2.x.toString());
    line.setAttribute('y2', p2.y.toString());
    line.setAttribute('stroke', '#ff6600');
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

  private calculateCentroid(points: Point[]): Point {
    let sumX = 0, sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / points.length, y: sumY / points.length };
  }

  private formatArea(cm2: number): string {
    if (cm2 < 10000) {
      return `${cm2.toFixed(0)} cm²`;
    } else {
      return `${(cm2 / 10000).toFixed(2)} m²`;
    }
  }
}
```

### src/main.ts (add measurement tools)

```typescript
import { MeasurementManager } from './measurement/MeasurementManager';
import { MeasurementRenderer } from './measurement/MeasurementRenderer';
import { MeasureTool } from './tools/MeasureTool';
import { AreaTool } from './tools/AreaTool';

// Update toolbar HTML:
<button id="tool-measure" class="tool-btn">Measure</button>
<button id="tool-area" class="tool-btn">Area</button>

// Add clear measurements button:
<button id="clear-measurements" style="margin-left: 10px;">Clear Measurements</button>

// Initialize measurement system:
const measurementManager = new MeasurementManager();
const measurementRenderer = new MeasurementRenderer(
  viewport.getWorldGroup(),
  measurementManager
);

// Listen to measurement changes to update renderer:
measurementManager.onChange(() => {
  measurementRenderer.render(viewport.getZoom());
});

// Initialize measurement tools:
const measureTool = new MeasureTool(
  measurementManager,
  snapManager,
  viewport.getPreviewGroup()
);

const areaTool = new AreaTool(
  measurementManager,
  snapManager,
  viewport.getPreviewGroup()
);

// Add to tools object:
const tools = { 
  select: selectTool, 
  point: pointTool, 
  line: lineTool, 
  circle: circleTool,
  measure: measureTool,
  area: areaTool
};

// Tool switching (update):
document.getElementById('tool-measure')?.addEventListener('click', () => setTool('measure'));
document.getElementById('tool-area')?.addEventListener('click', () => setTool('area'));

// Clear measurements button:
document.getElementById('clear-measurements')?.addEventListener('click', () => {
  measurementManager.clearAll();
  console.log('All measurements cleared');
});

// Update status messages:
const messages: Record<string, string> = {
  select: 'Select tool active - click to select, drag to move',
  point: 'Point tool active - click to place point',
  line: 'Line tool active - click start point, then end point',
  circle: 'Circle tool active - click center, then click to set radius',
  measure: 'Measure tool active - click two points to measure distance',
  area: 'Area tool active - click points to define polygon, double-click or Enter to complete'
};

// Keyboard shortcuts (add to existing handler):
if (e.key === 'm' || e.key === 'M') setTool('measure');
if (e.key === 'a' || e.key === 'A') setTool('area');

// Handle double-click for area tool:
viewport.getSVG().addEventListener('dblclick', (e) => {
  if (activeTool === 'area') {
    areaTool.onDoubleClick();
  }
});

console.log('Measurement tools loaded. Shortcuts: M=Measure, A=Area');
```

## Test Plan

### Manual Testing Steps

1. **Measure tool activation test**
   - Click "Measure" button
   - Verify button highlights
   - Verify status bar shows "click two points to measure distance"
   - Verify cursor changes to crosshair

2. **Distance measurement test**
   - With Measure tool active
   - Click at position (0, 0)
   - Verify first point marked with orange dot
   - Verify console shows "First point set at (0.0, 0.0)"
   - Move mouse to (1000, 0)
   - Verify orange dashed line follows cursor
   - Verify live distance label shows "10.00 m"
   - Click second point
   - Verify measurement persists on canvas
   - Verify console shows "Distance measured: 10.00 m"

3. **Multiple measurements test**
   - Measure distance (0,0) to (500, 0)
   - Verify first measurement remains visible
   - Measure distance (0, 500) to (0, 1000)
   - Verify both measurements visible
   - Verify measurements don't interfere with each other

4. **Unit display test**
   - Measure small distance: 50 cm
   - Verify displays as "50.0 cm"
   - Measure medium distance: 150 cm
   - Verify displays as "1.50 m"
   - Measure large distance: 2500 cm
   - Verify displays as "25.00 m"

5. **Area tool activation test**
   - Click "Area" button
   - Verify tool switches
   - Verify status shows "click points to define polygon, double-click to complete"

6. **Area measurement test**
   - Click point 1 at (0, 0)
   - Verify orange dot appears
   - Click point 2 at (1000, 0)
   - Verify line connects points
   - Click point 3 at (1000, 1000)
   - Verify triangle forms
   - Move mouse
   - Verify preview shows closing edge
   - Verify live area label shows value
   - Click point 4 at (0, 1000)
   - Verify rectangle forms
   - Double-click to complete
   - Verify measurement persists
   - Verify console shows "Area measured: 1.00 m²"

7. **Area calculation accuracy test**
   - Create 100cm × 100cm square (corners at 0,0 / 100,0 / 100,100 / 0,100)
   - Verify area shows "10000 cm²" or "1.00 m²"
   - Create 200cm × 300cm rectangle
   - Verify area shows "6.00 m²"

8. **ESC cancel test**
   - Start measuring distance (click first point)
   - Press ESC
   - Verify preview clears
   - Verify no measurement created
   - Start area measurement (click 2 points)
   - Press ESC
   - Verify preview clears

9. **Enter to complete area test**
   - Select Area tool
   - Click 3+ points
   - Press Enter key
   - Verify area measurement completes
   - Verify same result as double-click

10. **Clear measurements test**
    - Create several measurements (distance and area)
    - Verify all visible on canvas
    - Click "Clear Measurements" button
    - Verify all measurements disappear
    - Verify console shows "All measurements cleared"

11. **Measurement persistence test**
    - Create measurement
    - Pan viewport
    - Verify measurement moves with canvas
    - Zoom in/out
    - Verify measurement scales appropriately
    - Switch to different tool
    - Verify measurement remains visible

12. **Snap integration test**
    - Enable grid snap (10 cm)
    - Use Measure tool
    - Click near grid points
    - Verify points snap to grid
    - Verify measurements use snapped coordinates
    - Verify accurate distance calculation

13. **Keyboard shortcuts test**
    - Press 'M' key
    - Verify Measure tool activates
    - Press 'A' key
    - Verify Area tool activates
    - Test with uppercase (Shift+M, Shift+A)

14. **Visual clarity test**
    - Create measurements over geometry
    - Verify measurements visible (orange, dashed)
    - Verify labels readable (white background box)
    - Zoom in/out
    - Verify labels remain legible at all zoom levels

## Acceptance Criteria

- [ ] Measure tool button in toolbar
- [ ] Area tool button in toolbar
- [ ] Clear Measurements button in toolbar
- [ ] Distance measurement: click two points
- [ ] Distance shows live preview with dashed line and label
- [ ] Distance persists after completion
- [ ] Area measurement: click multiple points, double-click to complete
- [ ] Area shows live preview with polygon and label
- [ ] Area uses Shoelace formula for accurate calculation
- [ ] Area persists after completion
- [ ] Units auto-format: cm for small values, m/m² for large
- [ ] ESC cancels measurement in progress
- [ ] Enter key completes area measurement
- [ ] Clear button removes all measurements
- [ ] Multiple measurements can coexist
- [ ] Measurements persist during viewport operations
- [ ] Measurements scale with zoom
- [ ] Snap integration works correctly
- [ ] Keyboard shortcuts: M (measure), A (area)
- [ ] Console logs measurement creation with formatted values
- [ ] Labels have white background for readability
- [ ] Orange color distinguishes measurements from geometry
- [ ] No TypeScript compilation errors

## Deliverables

1. **src/measurement/Measurement.ts** - Measurement data model with formatting
2. **src/measurement/MeasurementManager.ts** - Store and manage measurements
3. **src/measurement/MeasurementRenderer.ts** - Render measurement overlays
4. **src/tools/MeasureTool.ts** - Distance measurement tool
5. **src/tools/AreaTool.ts** - Area/polygon measurement tool
6. **Updated src/main.ts** - Measurement system integration, tools, UI
7. **Working measurement system** - Distance and area tools with persistent visualization

---

**Estimated effort**: 3-4 hours  
**Dependencies**: Slice 6 (snapping), Slice 5 (tool infrastructure)  
**Risk**: Low - straightforward geometry calculations, similar patterns to drawing tools
