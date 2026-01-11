# Slice 3: Single-Layer Geometry Rendering

## User Value

As a user, I need to see geometric shapes (points, lines, circles) rendered on the canvas so that I can visualize my garden plan with accurate placement and measurements.

## Slice Features

1. **Geometry data model** for basic shapes (Point, Line, Circle)
2. **Object storage** with unique IDs and metadata
3. **SVG shape rendering** that respects world coordinates
4. **Hardcoded test shapes** to prove rendering accuracy
5. **Visual differentiation** with colors and stroke styles
6. **Coordinate accuracy validation** - shapes stay at fixed world positions during pan/zoom
7. **Layer assignment** (single layer for now, multi-layer in later slice)
8. **Scale-independent rendering** - stroke widths and point sizes adjust with zoom

## Technical Implementation Sketch

### File Structure

```
src/
├── geometry/
│   ├── types.ts              # Geometry type definitions
│   ├── GeometryObject.ts     # Base geometry object class
│   └── shapes/
│       ├── PointShape.ts     # Point implementation
│       ├── LineShape.ts      # Line segment implementation
│       └── CircleShape.ts    # Circle implementation
├── renderer/
│   ├── Renderer.ts           # Main rendering coordinator
│   └── ShapeRenderer.ts      # SVG shape rendering utilities
├── model/
│   └── Project.ts            # Project data model with objects collection
└── main.ts                   # Updated to create test geometry
```

### src/geometry/types.ts

```typescript
export interface Point {
  x: number; // centimeters
  y: number; // centimeters
}

export enum GeometryType {
  POINT = 'point',
  LINE = 'line',
  CIRCLE = 'circle',
  POLYLINE = 'polyline',
  POLYGON = 'polygon',
  SPLINE = 'spline'
}

// Base geometry definition
export interface GeometryData {
  type: GeometryType;
}

export interface PointGeometry extends GeometryData {
  type: GeometryType.POINT;
  position: Point;
}

export interface LineGeometry extends GeometryData {
  type: GeometryType.LINE;
  start: Point;
  end: Point;
}

export interface CircleGeometry extends GeometryData {
  type: GeometryType.CIRCLE;
  center: Point;
  radius: number; // centimeters
}

export type Geometry = PointGeometry | LineGeometry | CircleGeometry;

// Style information
export interface Style {
  stroke?: string;
  strokeWidth?: number; // in cm
  fill?: string;
  opacity?: number;
}

// Object metadata
export interface ObjectMetadata {
  name?: string;
  category?: string;
  notes?: string;
  [key: string]: any;
}
```

### src/geometry/GeometryObject.ts

```typescript
import { Geometry, Style, ObjectMetadata } from './types';

export class GeometryObject {
  readonly id: string;
  readonly layerId: string;
  readonly geometry: Geometry;
  readonly style: Style;
  readonly metadata: ObjectMetadata;

  constructor(
    id: string,
    layerId: string,
    geometry: Geometry,
    style: Style = {},
    metadata: ObjectMetadata = {}
  ) {
    this.id = id;
    this.layerId = layerId;
    this.geometry = geometry;
    this.style = {
      stroke: style.stroke || '#000000',
      strokeWidth: style.strokeWidth || 2,
      fill: style.fill || 'none',
      opacity: style.opacity || 1.0
    };
    this.metadata = metadata;
  }

  // Clone with modifications
  clone(overrides: Partial<GeometryObject> = {}): GeometryObject {
    return new GeometryObject(
      overrides.id || this.id,
      overrides.layerId || this.layerId,
      overrides.geometry || this.geometry,
      overrides.style || this.style,
      overrides.metadata || this.metadata
    );
  }
}
```

### src/model/Project.ts

```typescript
import { GeometryObject } from '../geometry/GeometryObject';

export class Project {
  readonly schemaVersion: string = '1.0';
  readonly units: string = 'cm';
  private objects: Map<string, GeometryObject> = new Map();
  private layerIds: Set<string> = new Set(['default']);

  constructor() {
    // Initialize with default layer
  }

  // Object management
  addObject(obj: GeometryObject): void {
    this.objects.set(obj.id, obj);
    this.layerIds.add(obj.layerId);
  }

  removeObject(id: string): void {
    this.objects.delete(id);
  }

  getObject(id: string): GeometryObject | undefined {
    return this.objects.get(id);
  }

  getAllObjects(): GeometryObject[] {
    return Array.from(this.objects.values());
  }

  getObjectsByLayer(layerId: string): GeometryObject[] {
    return this.getAllObjects().filter(obj => obj.layerId === layerId);
  }

  // Layer management (simplified for single-layer slice)
  getLayers(): string[] {
    return Array.from(this.layerIds);
  }

  hasLayer(layerId: string): boolean {
    return this.layerIds.has(layerId);
  }
}
```

### src/renderer/ShapeRenderer.ts

```typescript
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, PointGeometry, LineGeometry, CircleGeometry } from '../geometry/types';

export class ShapeRenderer {
  
  // Render a geometry object to SVG element
  render(obj: GeometryObject, zoom: number): SVGElement {
    switch (obj.geometry.type) {
      case GeometryType.POINT:
        return this.renderPoint(obj, zoom);
      case GeometryType.LINE:
        return this.renderLine(obj, zoom);
      case GeometryType.CIRCLE:
        return this.renderCircle(obj, zoom);
      default:
        throw new Error(`Unsupported geometry type: ${obj.geometry.type}`);
    }
  }

  private renderPoint(obj: GeometryObject, zoom: number): SVGCircleElement {
    const geom = obj.geometry as PointGeometry;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    
    circle.setAttribute('cx', geom.position.x.toString());
    circle.setAttribute('cy', geom.position.y.toString());
    circle.setAttribute('r', (4 / zoom).toString()); // 4px radius in screen space
    circle.setAttribute('fill', obj.style.stroke || '#000000');
    circle.setAttribute('opacity', obj.style.opacity?.toString() || '1');
    circle.setAttribute('data-object-id', obj.id);
    
    return circle;
  }

  private renderLine(obj: GeometryObject, zoom: number): SVGLineElement {
    const geom = obj.geometry as LineGeometry;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    
    line.setAttribute('x1', geom.start.x.toString());
    line.setAttribute('y1', geom.start.y.toString());
    line.setAttribute('x2', geom.end.x.toString());
    line.setAttribute('y2', geom.end.y.toString());
    line.setAttribute('stroke', obj.style.stroke || '#000000');
    line.setAttribute('stroke-width', ((obj.style.strokeWidth || 2) / zoom).toString());
    line.setAttribute('opacity', obj.style.opacity?.toString() || '1');
    line.setAttribute('data-object-id', obj.id);
    
    return line;
  }

  private renderCircle(obj: GeometryObject, zoom: number): SVGCircleElement {
    const geom = obj.geometry as CircleGeometry;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    
    circle.setAttribute('cx', geom.center.x.toString());
    circle.setAttribute('cy', geom.center.y.toString());
    circle.setAttribute('r', geom.radius.toString());
    circle.setAttribute('fill', obj.style.fill || 'none');
    circle.setAttribute('stroke', obj.style.stroke || '#000000');
    circle.setAttribute('stroke-width', ((obj.style.strokeWidth || 2) / zoom).toString());
    circle.setAttribute('opacity', obj.style.opacity?.toString() || '1');
    circle.setAttribute('data-object-id', obj.id);
    
    return circle;
  }
}
```

### src/renderer/Renderer.ts

```typescript
import { Project } from '../model/Project';
import { ShapeRenderer } from './ShapeRenderer';

export class Renderer {
  private shapeRenderer: ShapeRenderer;
  private objectsGroup: SVGGElement;

  constructor(worldGroup: SVGGElement) {
    this.shapeRenderer = new ShapeRenderer();
    
    // Create dedicated group for objects (after grid)
    this.objectsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.objectsGroup.id = 'objects';
    worldGroup.appendChild(this.objectsGroup);
  }

  // Render all objects from project
  render(project: Project, zoom: number): void {
    // Clear existing objects
    while (this.objectsGroup.firstChild) {
      this.objectsGroup.removeChild(this.objectsGroup.firstChild);
    }

    // Render all objects
    const objects = project.getAllObjects();
    for (const obj of objects) {
      const svgElement = this.shapeRenderer.render(obj, zoom);
      this.objectsGroup.appendChild(svgElement);
    }
  }

  // Get objects group for direct manipulation (selection, etc.)
  getObjectsGroup(): SVGGElement {
    return this.objectsGroup;
  }
}
```

### src/viewport/Viewport.ts (update render method)

```typescript
// Add to Viewport class:
import { Renderer } from '../renderer/Renderer';
import { Project } from '../model/Project';

export class Viewport {
  // ... existing properties ...
  private renderer?: Renderer;
  private project?: Project;

  constructor(container: HTMLElement) {
    // ... existing constructor code ...
  }

  // New method: set project and initialize renderer
  setProject(project: Project): void {
    this.project = project;
    this.renderer = new Renderer(this.worldGroup);
    this.render();
  }

  private render(): void {
    // Apply transform to world group
    this.worldGroup.setAttribute('transform', this.transform.toSVGTransform());

    // Render grid in world coordinates
    this.grid.render(this.worldGroup, this.transform.getState());

    // Render geometry objects
    if (this.renderer && this.project) {
      this.renderer.render(this.project, this.transform.getState().zoom);
    }
  }

  // ... rest of class ...
}
```

### src/main.ts (updated with test geometry)

```typescript
import { Viewport } from './viewport/Viewport';
import { Project } from './model/Project';
import { GeometryObject } from './geometry/GeometryObject';
import { GeometryType } from './geometry/types';

console.log('GardenCAD v0.3 - Geometry Rendering');

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
      <span style="margin-left: auto; font-size: 12px;">Pan: Shift+Drag | Zoom: Wheel</span>
    </div>
    <div id="viewport-container" style="flex: 1; position: relative;"></div>
  </div>
`;

const container = document.getElementById('viewport-container');
if (!container) {
  throw new Error('Viewport container not found');
}

// Create project with test geometry
const project = new Project();

// Add test objects to demonstrate rendering and coordinate accuracy

// Origin marker (0,0)
project.addObject(new GeometryObject(
  'origin',
  'default',
  { type: GeometryType.POINT, position: { x: 0, y: 0 } },
  { stroke: '#ff0000', strokeWidth: 3 },
  { name: 'Origin', category: 'reference' }
));

// Property boundary (rectangle as lines)
project.addObject(new GeometryObject(
  'boundary-north',
  'default',
  { type: GeometryType.LINE, start: { x: 0, y: 0 }, end: { x: 2000, y: 0 } },
  { stroke: '#333333', strokeWidth: 3 },
  { name: 'North Boundary' }
));

project.addObject(new GeometryObject(
  'boundary-east',
  'default',
  { type: GeometryType.LINE, start: { x: 2000, y: 0 }, end: { x: 2000, y: 1500 } },
  { stroke: '#333333', strokeWidth: 3 },
  { name: 'East Boundary' }
));

project.addObject(new GeometryObject(
  'boundary-south',
  'default',
  { type: GeometryType.LINE, start: { x: 2000, y: 1500 }, end: { x: 0, y: 1500 } },
  { stroke: '#333333', strokeWidth: 3 },
  { name: 'South Boundary' }
));

project.addObject(new GeometryObject(
  'boundary-west',
  'default',
  { type: GeometryType.LINE, start: { x: 0, y: 1500 }, end: { x: 0, y: 0 } },
  { stroke: '#333333', strokeWidth: 3 },
  { name: 'West Boundary' }
));

// Apple tree (circle)
project.addObject(new GeometryObject(
  'tree-apple-1',
  'default',
  { type: GeometryType.CIRCLE, center: { x: 500, y: 400 }, radius: 150 },
  { stroke: '#228B22', strokeWidth: 2, fill: '#90EE90', opacity: 0.3 },
  { name: 'Apple Tree', category: 'vegetation' }
));

// Cherry tree
project.addObject(new GeometryObject(
  'tree-cherry-1',
  'default',
  { type: GeometryType.CIRCLE, center: { x: 1200, y: 600 }, radius: 120 },
  { stroke: '#8B4513', strokeWidth: 2, fill: '#FFB6C1', opacity: 0.3 },
  { name: 'Cherry Tree', category: 'vegetation' }
));

// Path (line)
project.addObject(new GeometryObject(
  'path-main',
  'default',
  { type: GeometryType.LINE, start: { x: 100, y: 100 }, end: { x: 1800, y: 1400 } },
  { stroke: '#A0826D', strokeWidth: 80 },
  { name: 'Main Path', category: 'hardscape' }
));

// Well (point)
project.addObject(new GeometryObject(
  'well-1',
  'default',
  { type: GeometryType.POINT, position: { x: 1600, y: 300 } },
  { stroke: '#4169E1', strokeWidth: 5 },
  { name: 'Well', category: 'utility' }
));

// Grid reference points (every 500cm)
for (let x = 0; x <= 2000; x += 500) {
  for (let y = 0; y <= 1500; y += 500) {
    if (x === 0 && y === 0) continue; // Skip origin (already added)
    project.addObject(new GeometryObject(
      `ref-${x}-${y}`,
      'default',
      { type: GeometryType.POINT, position: { x, y } },
      { stroke: '#999999', strokeWidth: 1 },
      { name: `Reference (${x}, ${y})` }
    ));
  }
}

// Initialize viewport
const viewport = new Viewport(container);
viewport.setProject(project);

document.getElementById('reset-view')?.addEventListener('click', () => {
  viewport.reset();
});

console.log(`Loaded ${project.getAllObjects().length} objects`);
```

## Test Plan

### Manual Testing Steps

1. **Initial render test**
   - Start dev server
   - Open browser
   - Verify test geometry appears:
     - Red origin point at (0,0)
     - Black property boundary rectangle
     - Two tree circles (green apple, pink cherry)
     - Brown diagonal path
     - Blue well point
     - Gray reference points at grid intersections

2. **Coordinate accuracy test**
   - Hover mouse over origin point
   - Verify coordinate display shows ~(0, 0)
   - Hover over corner of boundary rectangle
   - Verify coordinates show (2000, 0), (2000, 1500), (0, 1500)
   - Hover over tree centers
   - Verify apple tree at ~(500, 400)
   - Verify cherry tree at ~(1200, 600)

3. **Pan coordinate stability test**
   - Note position of origin marker relative to grid
   - Pan viewport in multiple directions
   - Verify origin marker stays at same grid position
   - Verify all shapes maintain relative positions
   - Reset view
   - Verify all objects return to original positions

4. **Zoom coordinate stability test**
   - Zoom in on apple tree (center cursor on it)
   - Verify tree center stays under cursor
   - Verify tree circle radius appears larger but stays proportional
   - Zoom out significantly
   - Verify tree becomes smaller but stays at same world position
   - Verify stroke widths adjust (stay visible at all zoom levels)

5. **Scale-independent rendering test**
   - Zoom in to 500%
   - Verify point markers remain visible (don't become huge)
   - Verify line strokes remain visible (don't become too thick)
   - Zoom out to 20%
   - Verify points remain visible (don't disappear)
   - Verify strokes remain visible

6. **Visual differentiation test**
   - Verify different objects have different colors
   - Verify tree circles show semi-transparent fill
   - Verify path has thick stroke (~80cm width)
   - Verify boundaries have thicker stroke than trees
   - Verify origin marker is distinctly red

7. **Object count validation**
   - Check browser console
   - Verify log shows correct number of objects loaded
   - Expected: 1 origin + 4 boundaries + 2 trees + 1 path + 1 well + 15 reference points = 24 objects

8. **Performance test**
   - Pan and zoom with geometry visible
   - Verify smooth 60fps rendering
   - Verify no lag or frame drops
   - Check browser DevTools Performance tab if needed

## Acceptance Criteria

- [ ] GeometryObject model supports Point, Line, and Circle types
- [ ] Project model stores and retrieves geometry objects
- [ ] ShapeRenderer converts geometry to SVG elements correctly
- [ ] All test objects render at correct world coordinates
- [ ] Origin marker appears at (0, 0)
- [ ] Property boundary forms 2000×1500 cm rectangle
- [ ] Tree circles render with correct centers and radii
- [ ] Path line renders with correct thickness (80 cm)
- [ ] Reference points appear at 500cm grid intervals
- [ ] Objects maintain fixed world positions during pan
- [ ] Objects maintain fixed world positions during zoom
- [ ] Stroke widths scale inversely with zoom (remain visible)
- [ ] Point sizes scale inversely with zoom (remain visible)
- [ ] Object IDs stored in SVG data attributes
- [ ] Console logs correct object count on load
- [ ] No TypeScript compilation errors
- [ ] Rendering performance remains smooth with 24+ objects

## Deliverables

1. **src/geometry/types.ts** - Complete geometry type definitions
2. **src/geometry/GeometryObject.ts** - Geometry object class with metadata
3. **src/model/Project.ts** - Project model with object collection
4. **src/renderer/ShapeRenderer.ts** - SVG shape rendering with scale-independence
5. **src/renderer/Renderer.ts** - Main rendering coordinator
6. **Updated src/viewport/Viewport.ts** - Integration with renderer
7. **Updated src/main.ts** - Test geometry creation and visualization
8. **Visual proof** - Working canvas with diverse test shapes at accurate coordinates

---

**Estimated effort**: 2-3 hours  
**Dependencies**: Slice 2 (SVG viewport)  
**Risk**: Low - straightforward SVG rendering, well-defined geometry types
