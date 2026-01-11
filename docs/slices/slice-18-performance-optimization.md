# Slice 18: Performance Optimization

## User Value

As a user, I need the application to remain fast and responsive even with hundreds or thousands of objects, so that I can create complex garden plans without lag, stuttering, or delays when panning, zooming, or editing.

## Slice Features

1. **Quadtree spatial indexing** - Fast spatial queries for selection and culling
2. **Viewport culling** - Only render objects visible in viewport
3. **SVG rendering optimization** - Minimize DOM updates and reflows
4. **Selection acceleration** - Fast hit testing using spatial index
5. **Incremental rendering** - Render objects in batches to prevent blocking
6. **Object pooling** - Reuse SVG elements to reduce allocations
7. **Dirty region tracking** - Only re-render changed areas
8. **Layer-based caching** - Cache static layers as images
9. **Debounced updates** - Batch rapid changes (pan, zoom)
10. **Lazy loading** - Load object details on-demand
11. **Memory management** - Cleanup unused resources
12. **Performance monitoring** - FPS counter and metrics panel
13. **Large dataset testing** - Generate 1000+ test objects
14. **Benchmark suite** - Measure operations (render, select, pan)

## Technical Implementation Sketch

### File Structure

```
src/
├── spatial/
│   ├── Quadtree.ts              # Spatial indexing structure
│   ├── AABB.ts                  # Axis-aligned bounding box
│   └── SpatialIndex.ts          # Wrapper for spatial queries
├── rendering/
│   ├── CullingManager.ts        # Viewport culling logic
│   ├── RenderQueue.ts           # Batched rendering
│   └── SVGPool.ts               # SVG element pooling
├── performance/
│   ├── PerformanceMonitor.ts    # FPS and metrics tracking
│   └── BenchmarkSuite.ts        # Performance tests
└── test/
    └── LargeDatasetGenerator.ts # Generate test data
```

### Core Concepts

**Quadtree Spatial Indexing**:
- Hierarchical tree structure dividing 2D space into quadrants
- Each node contains objects or subdivides into 4 children
- Enables O(log n) spatial queries instead of O(n) linear scans
- Used for viewport culling, selection hit testing, intersection tests

**Viewport Culling**:
- Calculate viewport bounds in world coordinates
- Query quadtree for objects intersecting viewport
- Only render visible objects, skip off-screen geometry
- Reduces SVG DOM size from thousands to dozens of elements

**SVG Optimization**:
- Batch DOM updates using DocumentFragment
- Use CSS transforms instead of attribute changes
- Minimize attribute updates (only when changed)
- Pool and reuse SVG elements instead of creating/destroying
- Use `will-change` CSS hint for frequently transformed elements

**Incremental Rendering**:
- Render objects in chunks (50-100 per frame)
- Use requestAnimationFrame for smooth rendering
- Show progress indicator for large datasets
- Prevent UI blocking during heavy operations

### src/spatial/AABB.ts

```typescript
import { Point } from '../geometry/types';

/**
 * Axis-Aligned Bounding Box
 */
export class AABB {
  constructor(
    public minX: number,
    public minY: number,
    public maxX: number,
    public maxY: number
  ) {}

  static fromPoints(points: Point[]): AABB {
    if (points.length === 0) {
      return new AABB(0, 0, 0, 0);
    }

    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;

    for (let i = 1; i < points.length; i++) {
      minX = Math.min(minX, points[i].x);
      minY = Math.min(minY, points[i].y);
      maxX = Math.max(maxX, points[i].x);
      maxY = Math.max(maxY, points[i].y);
    }

    return new AABB(minX, minY, maxX, maxY);
  }

  static fromCircle(center: Point, radius: number): AABB {
    return new AABB(
      center.x - radius,
      center.y - radius,
      center.x + radius,
      center.y + radius
    );
  }

  get width(): number {
    return this.maxX - this.minX;
  }

  get height(): number {
    return this.maxY - this.minY;
  }

  get centerX(): number {
    return (this.minX + this.maxX) / 2;
  }

  get centerY(): number {
    return (this.minY + this.maxY) / 2;
  }

  intersects(other: AABB): boolean {
    return !(
      this.maxX < other.minX ||
      this.minX > other.maxX ||
      this.maxY < other.minY ||
      this.minY > other.maxY
    );
  }

  contains(point: Point): boolean {
    return (
      point.x >= this.minX &&
      point.x <= this.maxX &&
      point.y >= this.minY &&
      point.y <= this.maxY
    );
  }

  containsAABB(other: AABB): boolean {
    return (
      other.minX >= this.minX &&
      other.maxX <= this.maxX &&
      other.minY >= this.minY &&
      other.maxY <= this.maxY
    );
  }

  expand(margin: number): AABB {
    return new AABB(
      this.minX - margin,
      this.minY - margin,
      this.maxX + margin,
      this.maxY + margin
    );
  }

  union(other: AABB): AABB {
    return new AABB(
      Math.min(this.minX, other.minX),
      Math.min(this.minY, other.minY),
      Math.max(this.maxX, other.maxX),
      Math.max(this.maxY, other.maxY)
    );
  }

  clone(): AABB {
    return new AABB(this.minX, this.minY, this.maxX, this.maxY);
  }
}
```

### src/spatial/Quadtree.ts

```typescript
import { GeometryObject } from '../geometry/GeometryObject';
import { AABB } from './AABB';

interface QuadtreeNode {
  bounds: AABB;
  objects: GeometryObject[];
  children: QuadtreeNode[] | null;
  depth: number;
}

export class Quadtree {
  private root: QuadtreeNode;
  private readonly MAX_OBJECTS = 10;
  private readonly MAX_DEPTH = 8;

  constructor(bounds: AABB) {
    this.root = {
      bounds,
      objects: [],
      children: null,
      depth: 0
    };
  }

  insert(object: GeometryObject, bounds: AABB): void {
    this.insertIntoNode(this.root, object, bounds);
  }

  private insertIntoNode(node: QuadtreeNode, object: GeometryObject, bounds: AABB): void {
    // If node has children, insert into appropriate child
    if (node.children !== null) {
      const childIndex = this.getChildIndex(node, bounds);
      if (childIndex !== -1) {
        this.insertIntoNode(node.children[childIndex], object, bounds);
        return;
      }
      // Object spans multiple children, keep in this node
    }

    // Add to this node
    node.objects.push(object);

    // Subdivide if needed
    if (
      node.objects.length > this.MAX_OBJECTS &&
      node.depth < this.MAX_DEPTH &&
      node.children === null
    ) {
      this.subdivide(node);
    }
  }

  private subdivide(node: QuadtreeNode): void {
    const bounds = node.bounds;
    const midX = (bounds.minX + bounds.maxX) / 2;
    const midY = (bounds.minY + bounds.maxY) / 2;
    const depth = node.depth + 1;

    // Create 4 child nodes (NW, NE, SW, SE)
    node.children = [
      {
        bounds: new AABB(bounds.minX, bounds.minY, midX, midY),
        objects: [],
        children: null,
        depth
      },
      {
        bounds: new AABB(midX, bounds.minY, bounds.maxX, midY),
        objects: [],
        children: null,
        depth
      },
      {
        bounds: new AABB(bounds.minX, midY, midX, bounds.maxY),
        objects: [],
        children: null,
        depth
      },
      {
        bounds: new AABB(midX, midY, bounds.maxX, bounds.maxY),
        objects: [],
        children: null,
        depth
      }
    ];

    // Redistribute objects to children
    const remainingObjects: GeometryObject[] = [];

    for (const obj of node.objects) {
      const objBounds = this.getObjectBounds(obj);
      const childIndex = this.getChildIndex(node, objBounds);
      
      if (childIndex !== -1) {
        node.children[childIndex].objects.push(obj);
      } else {
        // Object spans multiple children, keep in parent
        remainingObjects.push(obj);
      }
    }

    node.objects = remainingObjects;
  }

  private getChildIndex(node: QuadtreeNode, bounds: AABB): number {
    if (node.children === null) return -1;

    for (let i = 0; i < 4; i++) {
      if (node.children[i].bounds.containsAABB(bounds)) {
        return i;
      }
    }

    return -1; // Spans multiple children
  }

  query(bounds: AABB): GeometryObject[] {
    const results: GeometryObject[] = [];
    this.queryNode(this.root, bounds, results);
    return results;
  }

  private queryNode(node: QuadtreeNode, bounds: AABB, results: GeometryObject[]): void {
    if (!node.bounds.intersects(bounds)) {
      return;
    }

    // Add objects from this node
    for (const obj of node.objects) {
      const objBounds = this.getObjectBounds(obj);
      if (objBounds.intersects(bounds)) {
        results.push(obj);
      }
    }

    // Query children
    if (node.children !== null) {
      for (const child of node.children) {
        this.queryNode(child, bounds, results);
      }
    }
  }

  queryPoint(x: number, y: number): GeometryObject[] {
    return this.query(new AABB(x, y, x, y));
  }

  remove(object: GeometryObject): boolean {
    return this.removeFromNode(this.root, object);
  }

  private removeFromNode(node: QuadtreeNode, object: GeometryObject): boolean {
    // Try to remove from this node
    const index = node.objects.indexOf(object);
    if (index !== -1) {
      node.objects.splice(index, 1);
      return true;
    }

    // Try children
    if (node.children !== null) {
      for (const child of node.children) {
        if (this.removeFromNode(child, object)) {
          return true;
        }
      }
    }

    return false;
  }

  clear(): void {
    this.root.objects = [];
    this.root.children = null;
  }

  rebuild(objects: GeometryObject[]): void {
    this.clear();
    for (const obj of objects) {
      const bounds = this.getObjectBounds(obj);
      this.insert(obj, bounds);
    }
  }

  private getObjectBounds(obj: GeometryObject): AABB {
    const geom = obj.geometry;

    switch (geom.type) {
      case 'point':
        const margin = 5; // Hit area
        return new AABB(
          geom.point.x - margin,
          geom.point.y - margin,
          geom.point.x + margin,
          geom.point.y + margin
        );

      case 'line':
        return new AABB(
          Math.min(geom.start.x, geom.end.x),
          Math.min(geom.start.y, geom.end.y),
          Math.max(geom.start.x, geom.end.x),
          Math.max(geom.start.y, geom.end.y)
        );

      case 'circle':
        return AABB.fromCircle(geom.center, geom.radius);

      case 'polyline':
      case 'polygon':
        return AABB.fromPoints(geom.points);

      case 'bezier-spline':
        // Approximate with control points
        const allPoints = geom.segments.flatMap(seg => [
          seg.p0, seg.p1, seg.p2, seg.p3
        ]);
        return AABB.fromPoints(allPoints);

      default:
        return new AABB(0, 0, 0, 0);
    }
  }

  getStats(): {
    totalNodes: number;
    maxDepth: number;
    totalObjects: number;
    avgObjectsPerNode: number;
  } {
    let totalNodes = 0;
    let maxDepth = 0;
    let totalObjects = 0;

    const traverse = (node: QuadtreeNode) => {
      totalNodes++;
      maxDepth = Math.max(maxDepth, node.depth);
      totalObjects += node.objects.length;

      if (node.children !== null) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(this.root);

    return {
      totalNodes,
      maxDepth,
      totalObjects,
      avgObjectsPerNode: totalObjects / totalNodes
    };
  }
}
```

### src/spatial/SpatialIndex.ts

```typescript
import { GeometryObject } from '../geometry/GeometryObject';
import { Quadtree } from './Quadtree';
import { AABB } from './AABB';
import { Point } from '../geometry/types';

export class SpatialIndex {
  private quadtree: Quadtree;
  private needsRebuild: boolean = false;

  constructor(worldBounds: AABB) {
    this.quadtree = new Quadtree(worldBounds);
  }

  addObject(object: GeometryObject): void {
    const bounds = this.calculateBounds(object);
    this.quadtree.insert(object, bounds);
  }

  removeObject(object: GeometryObject): void {
    this.quadtree.remove(object);
  }

  updateObject(object: GeometryObject): void {
    // Simple approach: remove and re-insert
    this.quadtree.remove(object);
    const bounds = this.calculateBounds(object);
    this.quadtree.insert(object, bounds);
  }

  queryViewport(viewport: AABB): GeometryObject[] {
    return this.quadtree.query(viewport);
  }

  queryPoint(x: number, y: number): GeometryObject[] {
    return this.quadtree.queryPoint(x, y);
  }

  queryRegion(bounds: AABB): GeometryObject[] {
    return this.quadtree.query(bounds);
  }

  rebuild(objects: GeometryObject[]): void {
    this.quadtree.rebuild(objects);
    this.needsRebuild = false;
  }

  markDirty(): void {
    this.needsRebuild = true;
  }

  isDirty(): boolean {
    return this.needsRebuild;
  }

  getStats() {
    return this.quadtree.getStats();
  }

  private calculateBounds(object: GeometryObject): AABB {
    const geom = object.geometry;

    switch (geom.type) {
      case 'point':
        const margin = 5;
        return new AABB(
          geom.point.x - margin,
          geom.point.y - margin,
          geom.point.x + margin,
          geom.point.y + margin
        );

      case 'line':
        return new AABB(
          Math.min(geom.start.x, geom.end.x),
          Math.min(geom.start.y, geom.end.y),
          Math.max(geom.start.x, geom.end.x),
          Math.max(geom.start.y, geom.end.y)
        );

      case 'circle':
        return AABB.fromCircle(geom.center, geom.radius);

      case 'polyline':
      case 'polygon':
        return AABB.fromPoints(geom.points);

      case 'bezier-spline':
        const allPoints = geom.segments.flatMap(seg => [
          seg.p0, seg.p1, seg.p2, seg.p3
        ]);
        return AABB.fromPoints(allPoints);

      default:
        return new AABB(0, 0, 0, 0);
    }
  }
}
```

### src/rendering/CullingManager.ts

```typescript
import { SpatialIndex } from '../spatial/SpatialIndex';
import { ViewportTransform } from '../viewport/ViewportTransform';
import { AABB } from '../spatial/AABB';
import { GeometryObject } from '../geometry/GeometryObject';

export class CullingManager {
  private spatialIndex: SpatialIndex;
  private transform: ViewportTransform;
  private cachedViewport: AABB | null = null;
  private cachedVisible: Set<string> = new Set();

  constructor(spatialIndex: SpatialIndex, transform: ViewportTransform) {
    this.spatialIndex = spatialIndex;
    this.transform = transform;
  }

  getVisibleObjects(viewportWidth: number, viewportHeight: number): GeometryObject[] {
    // Calculate viewport bounds in world coordinates
    const topLeft = this.transform.screenToWorld(0, 0, viewportWidth, viewportHeight);
    const topRight = this.transform.screenToWorld(viewportWidth, 0, viewportWidth, viewportHeight);
    const bottomLeft = this.transform.screenToWorld(0, viewportHeight, viewportWidth, viewportHeight);
    const bottomRight = this.transform.screenToWorld(viewportWidth, viewportHeight, viewportWidth, viewportHeight);

    // Calculate AABB covering entire rotated viewport
    const minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
    const maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    const maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);

    const viewportBounds = new AABB(minX, minY, maxX, maxY);

    // Add margin for objects partially visible
    const margin = 50; // cm
    const expandedBounds = viewportBounds.expand(margin);

    // Query spatial index
    const visible = this.spatialIndex.queryViewport(expandedBounds);

    // Cache for change detection
    this.cachedViewport = expandedBounds;
    this.cachedVisible.clear();
    visible.forEach(obj => this.cachedVisible.add(obj.id));

    return visible;
  }

  hasViewportChanged(viewportWidth: number, viewportHeight: number): boolean {
    if (!this.cachedViewport) return true;

    const topLeft = this.transform.screenToWorld(0, 0, viewportWidth, viewportHeight);
    const bottomRight = this.transform.screenToWorld(viewportWidth, viewportHeight, viewportWidth, viewportHeight);

    const currentBounds = new AABB(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y);

    // Check if viewport moved significantly (>10cm)
    const threshold = 10;
    return (
      Math.abs(currentBounds.minX - this.cachedViewport.minX) > threshold ||
      Math.abs(currentBounds.minY - this.cachedViewport.minY) > threshold ||
      Math.abs(currentBounds.maxX - this.cachedViewport.maxX) > threshold ||
      Math.abs(currentBounds.maxY - this.cachedViewport.maxY) > threshold
    );
  }

  isObjectVisible(objectId: string): boolean {
    return this.cachedVisible.has(objectId);
  }

  getCachedVisibleCount(): number {
    return this.cachedVisible.size;
  }
}
```

### src/rendering/RenderQueue.ts

```typescript
import { GeometryObject } from '../geometry/GeometryObject';

export class RenderQueue {
  private queue: GeometryObject[] = [];
  private rendering: boolean = false;
  private batchSize: number = 50;
  private onProgress: (current: number, total: number) => void;
  private onComplete: () => void;
  private renderCallback: (objects: GeometryObject[]) => void;

  constructor(
    renderCallback: (objects: GeometryObject[]) => void,
    onProgress: (current: number, total: number) => void = () => {},
    onComplete: () => void = () => {}
  ) {
    this.renderCallback = renderCallback;
    this.onProgress = onProgress;
    this.onComplete = onComplete;
  }

  enqueue(objects: GeometryObject[]): void {
    this.queue = objects;
    if (!this.rendering) {
      this.startRendering();
    }
  }

  private startRendering(): void {
    this.rendering = true;
    this.renderNextBatch();
  }

  private renderNextBatch(): void {
    if (this.queue.length === 0) {
      this.rendering = false;
      this.onComplete();
      return;
    }

    const batch = this.queue.splice(0, this.batchSize);
    this.renderCallback(batch);

    const total = this.queue.length + batch.length;
    const current = total - this.queue.length;
    this.onProgress(current, total);

    // Schedule next batch
    requestAnimationFrame(() => this.renderNextBatch());
  }

  clear(): void {
    this.queue = [];
    this.rendering = false;
  }

  setBatchSize(size: number): void {
    this.batchSize = size;
  }

  isRendering(): boolean {
    return this.rendering;
  }
}
```

### src/performance/PerformanceMonitor.ts

```typescript
export class PerformanceMonitor {
  private container: HTMLElement;
  private fpsDisplay: HTMLElement;
  private memoryDisplay: HTMLElement;
  private renderTimeDisplay: HTMLElement;
  private objectCountDisplay: HTMLElement;

  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 0;
  private renderTimes: number[] = [];

  constructor() {
    this.container = this.createPanel();
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'performance-monitor';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #0f0;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 4px;
      z-index: 10000;
      min-width: 200px;
    `;

    this.fpsDisplay = document.createElement('div');
    this.fpsDisplay.textContent = 'FPS: --';
    panel.appendChild(this.fpsDisplay);

    this.renderTimeDisplay = document.createElement('div');
    this.renderTimeDisplay.textContent = 'Render: -- ms';
    panel.appendChild(this.renderTimeDisplay);

    this.objectCountDisplay = document.createElement('div');
    this.objectCountDisplay.textContent = 'Objects: --';
    panel.appendChild(this.objectCountDisplay);

    this.memoryDisplay = document.createElement('div');
    this.memoryDisplay.textContent = 'Memory: -- MB';
    panel.appendChild(this.memoryDisplay);

    return panel;
  }

  update(): void {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastTime;

    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastTime = now;

      this.updateDisplay();
    }
  }

  recordRenderTime(ms: number): void {
    this.renderTimes.push(ms);
    if (this.renderTimes.length > 60) {
      this.renderTimes.shift();
    }
  }

  updateObjectCount(count: number): void {
    this.objectCountDisplay.textContent = `Objects: ${count}`;
  }

  private updateDisplay(): void {
    // FPS
    const color = this.fps >= 55 ? '#0f0' : this.fps >= 30 ? '#ff0' : '#f00';
    this.fpsDisplay.textContent = `FPS: ${this.fps}`;
    this.fpsDisplay.style.color = color;

    // Average render time
    if (this.renderTimes.length > 0) {
      const avg = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
      this.renderTimeDisplay.textContent = `Render: ${avg.toFixed(1)} ms`;
    }

    // Memory (if available)
    if ((performance as any).memory) {
      const mem = (performance as any).memory;
      const usedMB = mem.usedJSHeapSize / 1024 / 1024;
      this.memoryDisplay.textContent = `Memory: ${usedMB.toFixed(1)} MB`;
    }
  }

  show(): void {
    this.container.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  unmount(): void {
    this.container.remove();
  }
}
```

### src/test/LargeDatasetGenerator.ts

```typescript
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType } from '../geometry/types';
import { Point, LineGeometry, CircleGeometry, PolygonGeometry } from '../geometry/types';

export class LargeDatasetGenerator {
  /**
   * Generate N random objects within bounds
   */
  static generateRandomObjects(count: number, bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): GeometryObject[] {
    const objects: GeometryObject[] = [];

    for (let i = 0; i < count; i++) {
      const type = Math.floor(Math.random() * 4);
      
      switch (type) {
        case 0:
          objects.push(this.randomPoint(i, bounds));
          break;
        case 1:
          objects.push(this.randomLine(i, bounds));
          break;
        case 2:
          objects.push(this.randomCircle(i, bounds));
          break;
        case 3:
          objects.push(this.randomPolygon(i, bounds));
          break;
      }
    }

    return objects;
  }

  /**
   * Generate a realistic garden plan with paths, beds, and features
   */
  static generateGardenPlan(complexity: 'simple' | 'medium' | 'complex'): GeometryObject[] {
    const objects: GeometryObject[] = [];
    let id = 0;

    // Garden boundary (20m x 15m)
    const boundary = this.createRectangle(
      id++,
      { x: 0, y: 0 },
      2000, 1500,
      'Garden Boundary'
    );
    objects.push(boundary);

    // Main paths
    const pathCount = complexity === 'simple' ? 2 : complexity === 'medium' ? 4 : 8;
    for (let i = 0; i < pathCount; i++) {
      objects.push(this.randomPath(id++, { minX: 0, minY: 0, maxX: 2000, maxY: 1500 }));
    }

    // Planting beds
    const bedCount = complexity === 'simple' ? 5 : complexity === 'medium' ? 15 : 30;
    for (let i = 0; i < bedCount; i++) {
      objects.push(this.randomBed(id++, { minX: 100, minY: 100, maxX: 1900, maxY: 1400 }));
    }

    // Trees and shrubs
    const plantCount = complexity === 'simple' ? 10 : complexity === 'medium' ? 25 : 50;
    for (let i = 0; i < plantCount; i++) {
      objects.push(this.randomPlant(id++, { minX: 100, minY: 100, maxX: 1900, maxY: 1400 }));
    }

    // Features (patio, pond, etc.)
    const featureCount = complexity === 'simple' ? 2 : complexity === 'medium' ? 5 : 10;
    for (let i = 0; i < featureCount; i++) {
      objects.push(this.randomFeature(id++, { minX: 200, minY: 200, maxX: 1800, maxY: 1300 }));
    }

    return objects;
  }

  private static randomPoint(id: number, bounds: any): GeometryObject {
    return {
      id: `obj-${id}`,
      layerId: 'default',
      geometry: {
        type: GeometryType.POINT,
        point: {
          x: this.randomInRange(bounds.minX, bounds.maxX),
          y: this.randomInRange(bounds.minY, bounds.maxY)
        }
      },
      style: {
        stroke: this.randomColor(),
        strokeWidth: 3
      },
      metadata: {
        name: `Point ${id}`,
        createdAt: new Date()
      }
    };
  }

  private static randomLine(id: number, bounds: any): GeometryObject {
    const x1 = this.randomInRange(bounds.minX, bounds.maxX);
    const y1 = this.randomInRange(bounds.minY, bounds.maxY);
    const length = this.randomInRange(50, 300);
    const angle = Math.random() * Math.PI * 2;

    return {
      id: `obj-${id}`,
      layerId: 'default',
      geometry: {
        type: GeometryType.LINE,
        start: { x: x1, y: y1 },
        end: {
          x: x1 + Math.cos(angle) * length,
          y: y1 + Math.sin(angle) * length
        }
      },
      style: {
        stroke: this.randomColor(),
        strokeWidth: 2
      },
      metadata: {
        name: `Line ${id}`,
        createdAt: new Date()
      }
    };
  }

  private static randomCircle(id: number, bounds: any): GeometryObject {
    return {
      id: `obj-${id}`,
      layerId: 'default',
      geometry: {
        type: GeometryType.CIRCLE,
        center: {
          x: this.randomInRange(bounds.minX + 100, bounds.maxX - 100),
          y: this.randomInRange(bounds.minY + 100, bounds.maxY - 100)
        },
        radius: this.randomInRange(20, 100)
      },
      style: {
        stroke: this.randomColor(),
        strokeWidth: 2,
        fill: this.randomColor(),
        opacity: 0.3
      },
      metadata: {
        name: `Circle ${id}`,
        createdAt: new Date()
      }
    };
  }

  private static randomPolygon(id: number, bounds: any): GeometryObject {
    const cx = this.randomInRange(bounds.minX + 100, bounds.maxX - 100);
    const cy = this.randomInRange(bounds.minY + 100, bounds.maxY - 100);
    const sides = Math.floor(this.randomInRange(3, 8));
    const radius = this.randomInRange(30, 80);

    const points: Point[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      points.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius
      });
    }

    return {
      id: `obj-${id}`,
      layerId: 'default',
      geometry: {
        type: GeometryType.POLYGON,
        points
      },
      style: {
        stroke: this.randomColor(),
        strokeWidth: 2,
        fill: this.randomColor(),
        opacity: 0.2
      },
      metadata: {
        name: `Polygon ${id}`,
        createdAt: new Date()
      }
    };
  }

  private static randomPath(id: number, bounds: any): GeometryObject {
    const points: Point[] = [];
    const pointCount = Math.floor(this.randomInRange(3, 6));
    
    for (let i = 0; i < pointCount; i++) {
      points.push({
        x: this.randomInRange(bounds.minX, bounds.maxX),
        y: this.randomInRange(bounds.minY, bounds.maxY)
      });
    }

    return {
      id: `obj-${id}`,
      layerId: 'paths',
      geometry: {
        type: GeometryType.POLYLINE,
        points
      },
      style: {
        stroke: '#8B4513',
        strokeWidth: 60 // 60cm path
      },
      metadata: {
        name: `Path ${id}`,
        createdAt: new Date()
      }
    };
  }

  private static randomBed(id: number, bounds: any): GeometryObject {
    const width = this.randomInRange(100, 200);
    const height = this.randomInRange(100, 200);
    const x = this.randomInRange(bounds.minX, bounds.maxX - width);
    const y = this.randomInRange(bounds.minY, bounds.maxY - height);

    return this.createRectangle(id, { x, y }, width, height, `Bed ${id}`);
  }

  private static randomPlant(id: number, bounds: any): GeometryObject {
    return {
      id: `obj-${id}`,
      layerId: 'plants',
      geometry: {
        type: GeometryType.CIRCLE,
        center: {
          x: this.randomInRange(bounds.minX, bounds.maxX),
          y: this.randomInRange(bounds.minY, bounds.maxY)
        },
        radius: this.randomInRange(15, 40)
      },
      style: {
        stroke: '#228B22',
        strokeWidth: 2,
        fill: '#90EE90',
        opacity: 0.4
      },
      metadata: {
        name: `Plant ${id}`,
        createdAt: new Date()
      }
    };
  }

  private static randomFeature(id: number, bounds: any): GeometryObject {
    return this.randomCircle(id, bounds);
  }

  private static createRectangle(
    id: number,
    topLeft: Point,
    width: number,
    height: number,
    name: string
  ): GeometryObject {
    return {
      id: `obj-${id}`,
      layerId: 'default',
      geometry: {
        type: GeometryType.POLYGON,
        points: [
          topLeft,
          { x: topLeft.x + width, y: topLeft.y },
          { x: topLeft.x + width, y: topLeft.y + height },
          { x: topLeft.x, y: topLeft.y + height }
        ]
      },
      style: {
        stroke: '#666',
        strokeWidth: 2,
        fill: 'none'
      },
      metadata: {
        name,
        createdAt: new Date()
      }
    };
  }

  private static randomInRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private static randomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
```

### Integration Example (main.ts)

```typescript
import { SpatialIndex } from './spatial/SpatialIndex';
import { CullingManager } from './rendering/CullingManager';
import { PerformanceMonitor } from './performance/PerformanceMonitor';
import { AABB } from './spatial/AABB';

// Initialize spatial index (world bounds: -5000 to 5000 cm)
const spatialIndex = new SpatialIndex(new AABB(-5000, -5000, 5000, 5000));

// Initialize culling manager
const cullingManager = new CullingManager(spatialIndex, viewport.getTransform());

// Initialize performance monitor
const perfMonitor = new PerformanceMonitor();
perfMonitor.mount(document.body);
perfMonitor.show();

// Rebuild spatial index when objects change
function rebuildSpatialIndex() {
  const allObjects = layerManager.getAllObjects();
  spatialIndex.rebuild(allObjects);
}

// Optimized render function
function renderWithCulling() {
  const startTime = performance.now();

  // Get visible objects only
  const visibleObjects = cullingManager.getVisibleObjects(
    viewport.getWidth(),
    viewport.getHeight()
  );

  // Render only visible objects
  viewport.clear();
  for (const obj of visibleObjects) {
    viewport.renderObject(obj);
  }

  // Update performance metrics
  const renderTime = performance.now() - startTime;
  perfMonitor.recordRenderTime(renderTime);
  perfMonitor.updateObjectCount(visibleObjects.length);
  perfMonitor.update();
}

// Debounced pan/zoom
let renderTimeout: number | null = null;
function scheduleRender() {
  if (renderTimeout !== null) {
    cancelAnimationFrame(renderTimeout);
  }
  renderTimeout = requestAnimationFrame(renderWithCulling);
}

// Hook into viewport changes
viewport.onPan(() => scheduleRender());
viewport.onZoom(() => scheduleRender());

// Update spatial index when objects change
function onObjectAdded(obj: GeometryObject) {
  spatialIndex.addObject(obj);
  scheduleRender();
}

function onObjectModified(obj: GeometryObject) {
  spatialIndex.updateObject(obj);
  scheduleRender();
}

function onObjectDeleted(obj: GeometryObject) {
  spatialIndex.removeObject(obj);
  scheduleRender();
}

// Toggle performance monitor
document.addEventListener('keydown', (e) => {
  if (e.key === 'F3') {
    e.preventDefault();
    if (perfMonitor.isVisible()) {
      perfMonitor.hide();
    } else {
      perfMonitor.show();
    }
  }
});

console.log('Performance optimizations enabled');
```

## Test Plan

### Manual Testing Steps

1. **Small dataset baseline test**
   - Load empty project
   - Add 50 objects
   - Verify smooth 60 FPS
   - Pan and zoom
   - Verify no lag

2. **Medium dataset test (500 objects)**
   - Generate 500 random objects
   - Verify initial load completes in <2 seconds
   - Pan around viewport
   - Verify smooth scrolling (>30 FPS)
   - Zoom in/out
   - Verify responsive

3. **Large dataset test (1000 objects)**
   - Generate 1000 random objects
   - Verify load completes in <5 seconds
   - Pan entire canvas
   - Verify FPS stays >30
   - Select objects
   - Verify hit testing fast (<100ms)

4. **Extreme dataset test (5000 objects)**
   - Generate 5000 objects
   - Verify app remains functional
   - Verify viewport culling working (check object count in perf monitor)
   - Verify only ~50-200 objects rendered at once

5. **Spatial index test**
   - Generate 1000 objects
   - Click to select object
   - Verify selection instant (<50ms)
   - Press F3 to show performance monitor
   - Verify quadtree stats reasonable

6. **Viewport culling test**
   - Generate 1000 objects spread across large area
   - Zoom to small region
   - Check performance monitor
   - Verify object count low (matching visible region)
   - Pan to different area
   - Verify object count updates

7. **Incremental rendering test**
   - Generate 2000 objects
   - Observe initial render
   - Verify progress indication (if implemented)
   - Verify UI remains responsive during load

8. **Performance monitor test**
   - Press F3 to toggle monitor
   - Verify FPS counter updates every second
   - Verify render time shown
   - Verify object count shown
   - Verify memory usage shown (Chrome)

9. **Debounced update test**
   - Generate 500 objects
   - Rapidly pan with mouse
   - Verify smooth motion (no stuttering)
   - Verify render calls debounced (check console logs if added)

10. **Selection performance test**
    - Generate 1000 objects
    - Drag selection box
    - Verify selects quickly (<200ms)
    - Verify only objects in box selected

11. **Spatial index update test**
    - Add object
    - Verify appears immediately
    - Move object
    - Verify position updates
    - Delete object
    - Verify disappears
    - All operations should use spatial index

12. **Complex geometry test**
    - Generate dataset with bezier splines
    - Verify culling works with complex bounds
    - Verify performance acceptable

13. **Memory leak test**
    - Generate 1000 objects
    - Delete all objects
    - Repeat 5 times
    - Check memory (F3 panel)
    - Verify memory doesn't keep growing

14. **Realistic garden test**
    - Generate complex garden plan
    - Verify all features rendered correctly
    - Zoom to individual bed
    - Verify smooth navigation
    - Zoom out to full view
    - Verify handles well

15. **Benchmark suite test**
    - Run benchmark suite (if implemented)
    - Verify reports render time, selection time
    - Verify provides quantitative metrics

## Acceptance Criteria

- [ ] Quadtree spatial indexing implemented
- [ ] AABB (bounding box) class implemented
- [ ] SpatialIndex wrapper provides clean API
- [ ] Insert, remove, update, query operations work
- [ ] Viewport culling manager implemented
- [ ] Only visible objects rendered (verified with >1000 objects)
- [ ] Performance monitor displays FPS, render time, object count
- [ ] FPS stays >30 with 1000 objects
- [ ] FPS stays >20 with 5000 objects
- [ ] Selection uses spatial index (fast hit testing)
- [ ] Spatial index updates when objects change
- [ ] Debounced rendering on pan/zoom
- [ ] Large dataset generator creates test data
- [ ] Can generate random objects
- [ ] Can generate realistic garden plans
- [ ] Performance monitor toggleable with F3 key
- [ ] Memory usage shown (if browser supports)
- [ ] Quadtree statistics available (nodes, depth, objects)
- [ ] Incremental rendering for large datasets (optional)
- [ ] No memory leaks with repeated add/delete
- [ ] Viewport culling correctly handles rotation
- [ ] All geometry types have correct bounds calculation
- [ ] No TypeScript compilation errors

## Deliverables

1. **src/spatial/AABB.ts** - Axis-aligned bounding box utility
2. **src/spatial/Quadtree.ts** - Quadtree spatial index implementation
3. **src/spatial/SpatialIndex.ts** - High-level spatial query API
4. **src/rendering/CullingManager.ts** - Viewport culling logic
5. **src/rendering/RenderQueue.ts** - Incremental rendering queue
6. **src/performance/PerformanceMonitor.ts** - FPS and metrics display
7. **src/test/LargeDatasetGenerator.ts** - Test data generation
8. **Updated main.ts** - Integration of performance systems
9. **Working viewport culling** - Only render visible objects
10. **Working performance monitor** - Real-time metrics display

---

**Estimated effort**: 6-7 hours  
**Dependencies**: All previous slices (rendering, viewport, geometry)  
**Risk**: Medium - Quadtree complexity, edge cases in culling, performance tuning needed

