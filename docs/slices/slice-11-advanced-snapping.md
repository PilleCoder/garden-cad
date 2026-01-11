# Slice 11: Advanced Snapping

## User Value

As a user, I need intelligent snapping to existing geometry (endpoints, midpoints, intersections) so that I can precisely align new objects with existing features without manual calculations, improving accuracy and workflow speed.

## Slice Features

1. **Endpoint snapping** - Snap to start/end of lines, polylines, polygon vertices
2. **Midpoint snapping** - Snap to middle of line segments
3. **Intersection snapping** - Snap to where lines/circles cross
4. **Center snapping** - Snap to circle/arc centers
5. **Perpendicular snapping** - Snap to perpendicular point on line from cursor
6. **Tangent snapping** - Snap to tangent points on circles
7. **Snap priority system** - Closest snap wins within search radius
8. **Visual snap indicators** - Different colors/shapes per snap type
9. **Snap type labels** - Show "Endpoint", "Midpoint", etc. near cursor
10. **Configurable snap radius** - User can adjust search distance
11. **Enable/disable specific snap types** - Toggle checkboxes in settings
12. **Keyboard toggle** - Temporarily disable all snapping

## Technical Implementation Sketch

### File Structure

```
src/
├── snapping/
│   ├── SnapManager.ts          # Already exists - enhance with new types
│   ├── SnapProvider.ts         # Interface for snap point sources
│   ├── GeometrySnapProvider.ts # Generate snap points from geometry
│   ├── SnapResult.ts           # Enhanced with snap type and label
│   ├── SnapIndicator.ts        # Already exists - enhance visuals
│   └── SnapSettings.ts         # Configuration panel
├── geometry/
│   ├── GeometryMath.ts         # Intersection calculations, projections
│   └── types.ts                # Already defined
└── main.ts                     # Updated with snap settings panel
```

### Core Concepts

**Snap Types**:
- `GRID`: Existing grid snapping (orange square)
- `ENDPOINT`: Line/polyline/polygon vertices (cyan circle)
- `MIDPOINT`: Midpoint of segments (yellow diamond)
- `CENTER`: Circle centers (magenta cross)
- `INTERSECTION`: Line/circle intersections (green X)
- `PERPENDICULAR`: Closest point on line (blue square)
- `TANGENT`: Circle tangent points (red triangle)

**Snap Priority**:
1. If multiple snaps within radius, choose closest to cursor
2. User can configure priority order
3. Default: Endpoint > Intersection > Midpoint > Center > Grid

**Search Radius**:
- Default 20px screen space
- Adjustable 10-50px
- Convert to world coordinates based on zoom

### src/snapping/SnapResult.ts (enhanced)

```typescript
export enum SnapType {
  NONE = 'none',
  GRID = 'grid',
  ENDPOINT = 'endpoint',
  MIDPOINT = 'midpoint',
  CENTER = 'center',
  INTERSECTION = 'intersection',
  PERPENDICULAR = 'perpendicular',
  TANGENT = 'tangent'
}

export interface SnapResult {
  point: Point;
  type: SnapType;
  label: string;
  distance: number; // Distance from cursor (screen pixels)
}
```

### src/snapping/SnapProvider.ts

```typescript
import { Point } from '../geometry/types';
import { SnapResult, SnapType } from './SnapResult';
import { Project } from '../model/Project';

export interface SnapProvider {
  name: string;
  enabled: boolean;
  
  /**
   * Generate snap points for given cursor position and search radius.
   * @param cursorWorld - Cursor position in world coordinates
   * @param searchRadiusWorld - Search radius in world coordinates
   * @param project - Current project with geometry
   * @returns Array of snap results
   */
  generateSnapPoints(
    cursorWorld: Point,
    searchRadiusWorld: number,
    project: Project
  ): SnapResult[];
}
```

### src/snapping/GeometrySnapProvider.ts

```typescript
import { SnapProvider } from './SnapProvider';
import { SnapResult, SnapType } from './SnapResult';
import { Point, GeometryType } from '../geometry/types';
import { Project } from '../model/Project';
import { GeometryMath } from '../geometry/GeometryMath';

export class GeometrySnapProvider implements SnapProvider {
  name = 'geometry';
  enabled = true;

  private enabledTypes: Set<SnapType> = new Set([
    SnapType.ENDPOINT,
    SnapType.MIDPOINT,
    SnapType.CENTER,
    SnapType.INTERSECTION
  ]);

  setEnabledTypes(types: SnapType[]): void {
    this.enabledTypes = new Set(types);
  }

  isTypeEnabled(type: SnapType): boolean {
    return this.enabledTypes.has(type);
  }

  generateSnapPoints(
    cursorWorld: Point,
    searchRadiusWorld: number,
    project: Project
  ): SnapResult[] {
    const results: SnapResult[] = [];
    const objects = project.getObjects();

    // Collect snap points from each object
    for (const obj of objects) {
      if (!obj.visible) continue;

      switch (obj.geometry.type) {
        case GeometryType.POINT:
          if (this.isTypeEnabled(SnapType.ENDPOINT)) {
            const pt = (obj.geometry as any).point;
            results.push(...this.createSnapIfInRange(
              pt, 
              cursorWorld, 
              searchRadiusWorld, 
              SnapType.ENDPOINT, 
              'Point'
            ));
          }
          break;

        case GeometryType.LINE:
          results.push(...this.getLineSnaps(obj, cursorWorld, searchRadiusWorld));
          break;

        case GeometryType.CIRCLE:
          results.push(...this.getCircleSnaps(obj, cursorWorld, searchRadiusWorld));
          break;

        case GeometryType.POLYLINE:
          results.push(...this.getPolylineSnaps(obj, cursorWorld, searchRadiusWorld));
          break;

        case GeometryType.POLYGON:
          results.push(...this.getPolygonSnaps(obj, cursorWorld, searchRadiusWorld));
          break;
      }
    }

    // Calculate intersections (expensive - only if enabled)
    if (this.isTypeEnabled(SnapType.INTERSECTION)) {
      results.push(...this.getIntersectionSnaps(objects, cursorWorld, searchRadiusWorld));
    }

    return results;
  }

  private getLineSnaps(
    obj: any,
    cursor: Point,
    radius: number
  ): SnapResult[] {
    const results: SnapResult[] = [];
    const geom = obj.geometry;
    const { start, end } = geom;

    // Endpoints
    if (this.isTypeEnabled(SnapType.ENDPOINT)) {
      results.push(...this.createSnapIfInRange(start, cursor, radius, SnapType.ENDPOINT, 'Endpoint'));
      results.push(...this.createSnapIfInRange(end, cursor, radius, SnapType.ENDPOINT, 'Endpoint'));
    }

    // Midpoint
    if (this.isTypeEnabled(SnapType.MIDPOINT)) {
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      results.push(...this.createSnapIfInRange(mid, cursor, radius, SnapType.MIDPOINT, 'Midpoint'));
    }

    // Perpendicular
    if (this.isTypeEnabled(SnapType.PERPENDICULAR)) {
      const perp = GeometryMath.projectPointOntoLine(cursor, start, end);
      if (perp && this.isPointBetween(perp, start, end)) {
        results.push(...this.createSnapIfInRange(perp, cursor, radius, SnapType.PERPENDICULAR, 'Perpendicular'));
      }
    }

    return results;
  }

  private getCircleSnaps(
    obj: any,
    cursor: Point,
    radius: number
  ): SnapResult[] {
    const results: SnapResult[] = [];
    const geom = obj.geometry;
    const { center, radius: circleRadius } = geom;

    // Center
    if (this.isTypeEnabled(SnapType.CENTER)) {
      results.push(...this.createSnapIfInRange(center, cursor, radius, SnapType.CENTER, 'Center'));
    }

    // Tangent (point on circle closest to cursor)
    if (this.isTypeEnabled(SnapType.TANGENT)) {
      const angle = Math.atan2(cursor.y - center.y, cursor.x - center.x);
      const tangent = {
        x: center.x + circleRadius * Math.cos(angle),
        y: center.y + circleRadius * Math.sin(angle)
      };
      results.push(...this.createSnapIfInRange(tangent, cursor, radius, SnapType.TANGENT, 'Tangent'));
    }

    return results;
  }

  private getPolylineSnaps(
    obj: any,
    cursor: Point,
    radius: number
  ): SnapResult[] {
    const results: SnapResult[] = [];
    const geom = obj.geometry;
    const points = geom.points;

    // Endpoints
    if (this.isTypeEnabled(SnapType.ENDPOINT)) {
      for (const pt of points) {
        results.push(...this.createSnapIfInRange(pt, cursor, radius, SnapType.ENDPOINT, 'Endpoint'));
      }
    }

    // Midpoints of segments
    if (this.isTypeEnabled(SnapType.MIDPOINT)) {
      for (let i = 0; i < points.length - 1; i++) {
        const mid = {
          x: (points[i].x + points[i + 1].x) / 2,
          y: (points[i].y + points[i + 1].y) / 2
        };
        results.push(...this.createSnapIfInRange(mid, cursor, radius, SnapType.MIDPOINT, 'Midpoint'));
      }
    }

    // Perpendicular to segments
    if (this.isTypeEnabled(SnapType.PERPENDICULAR)) {
      for (let i = 0; i < points.length - 1; i++) {
        const perp = GeometryMath.projectPointOntoLine(cursor, points[i], points[i + 1]);
        if (perp && this.isPointBetween(perp, points[i], points[i + 1])) {
          results.push(...this.createSnapIfInRange(perp, cursor, radius, SnapType.PERPENDICULAR, 'Perpendicular'));
        }
      }
    }

    return results;
  }

  private getPolygonSnaps(
    obj: any,
    cursor: Point,
    radius: number
  ): SnapResult[] {
    const results: SnapResult[] = [];
    const geom = obj.geometry;
    const points = geom.points;

    // Vertices
    if (this.isTypeEnabled(SnapType.ENDPOINT)) {
      for (const pt of points) {
        results.push(...this.createSnapIfInRange(pt, cursor, radius, SnapType.ENDPOINT, 'Vertex'));
      }
    }

    // Midpoints of edges (including closing edge)
    if (this.isTypeEnabled(SnapType.MIDPOINT)) {
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        const mid = {
          x: (points[i].x + points[j].x) / 2,
          y: (points[i].y + points[j].y) / 2
        };
        results.push(...this.createSnapIfInRange(mid, cursor, radius, SnapType.MIDPOINT, 'Midpoint'));
      }
    }

    return results;
  }

  private getIntersectionSnaps(
    objects: any[],
    cursor: Point,
    radius: number
  ): SnapResult[] {
    const results: SnapResult[] = [];
    
    // Check all pairs of objects for intersections
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const intersections = GeometryMath.findIntersections(
          objects[i].geometry,
          objects[j].geometry
        );
        
        for (const pt of intersections) {
          results.push(...this.createSnapIfInRange(pt, cursor, radius, SnapType.INTERSECTION, 'Intersection'));
        }
      }
    }

    return results;
  }

  private createSnapIfInRange(
    point: Point,
    cursor: Point,
    radius: number,
    type: SnapType,
    label: string
  ): SnapResult[] {
    const dx = point.x - cursor.x;
    const dy = point.y - cursor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= radius) {
      return [{
        point,
        type,
        label,
        distance: dist
      }];
    }

    return [];
  }

  private isPointBetween(point: Point, start: Point, end: Point): boolean {
    const epsilon = 0.01;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    
    if (lengthSq < epsilon) return false;
    
    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
    return t >= -epsilon && t <= 1 + epsilon;
  }
}
```

### src/geometry/GeometryMath.ts

```typescript
import { Point, Geometry, GeometryType } from './types';

export class GeometryMath {
  /**
   * Project a point onto a line segment.
   * Returns the closest point on the line to the given point.
   */
  static projectPointOntoLine(point: Point, lineStart: Point, lineEnd: Point): Point | null {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq < 0.0001) {
      return null; // Line is too short
    }

    // Parameter t represents position along line (0 = start, 1 = end)
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;

    return {
      x: lineStart.x + t * dx,
      y: lineStart.y + t * dy
    };
  }

  /**
   * Find intersection points between two geometries.
   */
  static findIntersections(geom1: Geometry, geom2: Geometry): Point[] {
    // Line-Line intersection
    if (geom1.type === GeometryType.LINE && geom2.type === GeometryType.LINE) {
      return this.lineLineIntersection(geom1 as any, geom2 as any);
    }

    // Line-Circle intersection
    if (geom1.type === GeometryType.LINE && geom2.type === GeometryType.CIRCLE) {
      return this.lineCircleIntersection(geom1 as any, geom2 as any);
    }
    if (geom1.type === GeometryType.CIRCLE && geom2.type === GeometryType.LINE) {
      return this.lineCircleIntersection(geom2 as any, geom1 as any);
    }

    // Circle-Circle intersection
    if (geom1.type === GeometryType.CIRCLE && geom2.type === GeometryType.CIRCLE) {
      return this.circleCircleIntersection(geom1 as any, geom2 as any);
    }

    // TODO: Polyline/Polygon intersections (more complex)
    return [];
  }

  private static lineLineIntersection(line1: any, line2: any): Point[] {
    const { start: p1, end: p2 } = line1;
    const { start: p3, end: p4 } = line2;

    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (Math.abs(denom) < 0.0001) {
      return []; // Parallel or coincident
    }

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return [{
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
      }];
    }

    return [];
  }

  private static lineCircleIntersection(line: any, circle: any): Point[] {
    const { start, end } = line;
    const { center, radius } = circle;

    // Vector from start to end
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // Vector from start to center
    const fx = start.x - center.x;
    const fy = start.y - center.y;

    // Quadratic equation coefficients
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;

    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
      return []; // No intersection
    }

    const sqrtDiscriminant = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDiscriminant) / (2 * a);
    const t2 = (-b + sqrtDiscriminant) / (2 * a);

    const results: Point[] = [];

    if (t1 >= 0 && t1 <= 1) {
      results.push({
        x: start.x + t1 * dx,
        y: start.y + t1 * dy
      });
    }

    if (t2 >= 0 && t2 <= 1 && Math.abs(t1 - t2) > 0.0001) {
      results.push({
        x: start.x + t2 * dx,
        y: start.y + t2 * dy
      });
    }

    return results;
  }

  private static circleCircleIntersection(circle1: any, circle2: any): Point[] {
    const { center: c1, radius: r1 } = circle1;
    const { center: c2, radius: r2 } = circle2;

    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // No intersection cases
    if (dist > r1 + r2) return []; // Too far apart
    if (dist < Math.abs(r1 - r2)) return []; // One inside the other
    if (dist < 0.0001 && Math.abs(r1 - r2) < 0.0001) return []; // Coincident

    // Distance to radical line
    const a = (r1 * r1 - r2 * r2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(r1 * r1 - a * a);

    // Point on line between centers
    const px = c1.x + a * (dx / dist);
    const py = c1.y + a * (dy / dist);

    // One intersection (tangent)
    if (Math.abs(h) < 0.0001) {
      return [{ x: px, y: py }];
    }

    // Two intersections
    const hx = h * (-dy / dist);
    const hy = h * (dx / dist);

    return [
      { x: px + hx, y: py + hy },
      { x: px - hx, y: py - hy }
    ];
  }

  /**
   * Calculate distance from point to line segment.
   */
  static distanceToLineSegment(point: Point, lineStart: Point, lineEnd: Point): number {
    const projection = this.projectPointOntoLine(point, lineStart, lineEnd);
    
    if (!projection) {
      return Infinity;
    }

    // Check if projection is within segment
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSq = dx * dx + dy * dy;
    
    if (lengthSq < 0.0001) {
      const dpx = point.x - lineStart.x;
      const dpy = point.y - lineStart.y;
      return Math.sqrt(dpx * dpx + dpy * dpy);
    }

    const t = ((projection.x - lineStart.x) * dx + (projection.y - lineStart.y) * dy) / lengthSq;

    let closestPoint: Point;
    if (t < 0) {
      closestPoint = lineStart;
    } else if (t > 1) {
      closestPoint = lineEnd;
    } else {
      closestPoint = projection;
    }

    const dpx = point.x - closestPoint.x;
    const dpy = point.y - closestPoint.y;
    return Math.sqrt(dpx * dpx + dpy * dpy);
  }
}
```

### src/snapping/SnapManager.ts (enhanced)

```typescript
import { Point } from '../geometry/types';
import { SnapResult, SnapType } from './SnapResult';
import { SnapProvider } from './SnapProvider';
import { GeometrySnapProvider } from './GeometrySnapProvider';
import { Project } from '../model/Project';
import { ViewportTransform } from '../viewport/ViewportTransform';

export class SnapManager {
  private enabled: boolean = true;
  private gridSpacing: number = 10; // cm
  private searchRadiusPixels: number = 20;
  private providers: SnapProvider[] = [];
  private project: Project;
  private transform: ViewportTransform;

  constructor(project: Project, transform: ViewportTransform) {
    this.project = project;
    this.transform = transform;
    
    // Register default providers
    this.providers.push(new GeometrySnapProvider());
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setGridSpacing(spacing: number): void {
    this.gridSpacing = spacing;
  }

  getGridSpacing(): number {
    return this.gridSpacing;
  }

  setSearchRadius(pixels: number): void {
    this.searchRadiusPixels = pixels;
  }

  getSearchRadius(): number {
    return this.searchRadiusPixels;
  }

  getGeometrySnapProvider(): GeometrySnapProvider {
    return this.providers[0] as GeometrySnapProvider;
  }

  /**
   * Snap a point to nearby features.
   * Returns the best snap result or the original point if no snap found.
   */
  snap(worldPos: Point): SnapResult {
    if (!this.enabled) {
      return {
        point: worldPos,
        type: SnapType.NONE,
        label: '',
        distance: 0
      };
    }

    const candidates: SnapResult[] = [];

    // Convert search radius to world coordinates
    const zoom = this.transform.getZoom();
    const searchRadiusWorld = this.searchRadiusPixels / zoom;

    // Collect snap points from all providers
    for (const provider of this.providers) {
      if (provider.enabled) {
        const snaps = provider.generateSnapPoints(worldPos, searchRadiusWorld, this.project);
        candidates.push(...snaps);
      }
    }

    // Grid snapping (always available)
    const gridSnap = this.snapToGrid(worldPos);
    const gridDist = Math.sqrt(
      (gridSnap.x - worldPos.x) ** 2 + (gridSnap.y - worldPos.y) ** 2
    );
    if (gridDist <= searchRadiusWorld) {
      candidates.push({
        point: gridSnap,
        type: SnapType.GRID,
        label: 'Grid',
        distance: gridDist * zoom // Convert to screen pixels for comparison
      });
    }

    // No snaps found
    if (candidates.length === 0) {
      return {
        point: worldPos,
        type: SnapType.NONE,
        label: '',
        distance: 0
      };
    }

    // Find closest snap (already in screen pixels for non-grid)
    let bestSnap = candidates[0];
    for (const candidate of candidates) {
      // For geometry snaps, distance is already calculated
      // For grid, we calculated it above
      if (candidate.distance < bestSnap.distance) {
        bestSnap = candidate;
      }
    }

    return bestSnap;
  }

  private snapToGrid(point: Point): Point {
    return {
      x: Math.round(point.x / this.gridSpacing) * this.gridSpacing,
      y: Math.round(point.y / this.gridSpacing) * this.gridSpacing
    };
  }
}
```

### src/snapping/SnapIndicator.ts (enhanced)

```typescript
import { SnapResult, SnapType } from './SnapResult';

export class SnapIndicator {
  private group: SVGGElement;

  constructor(previewGroup: SVGGElement) {
    this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.group.setAttribute('id', 'snap-indicator');
    previewGroup.appendChild(this.group);
  }

  show(snap: SnapResult): void {
    this.clear();

    if (snap.type === SnapType.NONE) {
      return;
    }

    const { point, type, label } = snap;

    // Create indicator based on type
    let indicator: SVGElement;

    switch (type) {
      case SnapType.GRID:
        indicator = this.createSquare(point, '#ff8800', 8);
        break;
      case SnapType.ENDPOINT:
        indicator = this.createCircle(point, '#00ccff', 8);
        break;
      case SnapType.MIDPOINT:
        indicator = this.createDiamond(point, '#ffff00', 8);
        break;
      case SnapType.CENTER:
        indicator = this.createCross(point, '#ff00ff', 12);
        break;
      case SnapType.INTERSECTION:
        indicator = this.createX(point, '#00ff00', 12);
        break;
      case SnapType.PERPENDICULAR:
        indicator = this.createSquare(point, '#0066ff', 7);
        break;
      case SnapType.TANGENT:
        indicator = this.createTriangle(point, '#ff0000', 9);
        break;
      default:
        indicator = this.createCircle(point, '#888888', 6);
    }

    this.group.appendChild(indicator);

    // Add label
    if (label) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', (point.x + 12).toString());
      text.setAttribute('y', (point.y - 8).toString());
      text.setAttribute('fill', this.getColorForType(type));
      text.setAttribute('font-size', '12');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('pointer-events', 'none');
      text.textContent = label;
      this.group.appendChild(text);
    }
  }

  clear(): void {
    while (this.group.firstChild) {
      this.group.removeChild(this.group.firstChild);
    }
  }

  private createCircle(center: Point, color: string, radius: number): SVGCircleElement {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', center.x.toString());
    circle.setAttribute('cy', center.y.toString());
    circle.setAttribute('r', radius.toString());
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('pointer-events', 'none');
    return circle;
  }

  private createSquare(center: Point, color: string, size: number): SVGRectElement {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', (center.x - size / 2).toString());
    rect.setAttribute('y', (center.y - size / 2).toString());
    rect.setAttribute('width', size.toString());
    rect.setAttribute('height', size.toString());
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('pointer-events', 'none');
    return rect;
  }

  private createDiamond(center: Point, color: string, size: number): SVGPolygonElement {
    const half = size / 2;
    const points = `${center.x},${center.y - half} ${center.x + half},${center.y} ${center.x},${center.y + half} ${center.x - half},${center.y}`;
    
    const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    diamond.setAttribute('points', points);
    diamond.setAttribute('fill', 'none');
    diamond.setAttribute('stroke', color);
    diamond.setAttribute('stroke-width', '2');
    diamond.setAttribute('pointer-events', 'none');
    return diamond;
  }

  private createCross(center: Point, color: string, size: number): SVGGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', (center.x - size / 2).toString());
    line1.setAttribute('y1', center.y.toString());
    line1.setAttribute('x2', (center.x + size / 2).toString());
    line1.setAttribute('y2', center.y.toString());
    line1.setAttribute('stroke', color);
    line1.setAttribute('stroke-width', '2');
    
    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', center.x.toString());
    line2.setAttribute('y1', (center.y - size / 2).toString());
    line2.setAttribute('x2', center.x.toString());
    line2.setAttribute('y2', (center.y + size / 2).toString());
    line2.setAttribute('stroke', color);
    line2.setAttribute('stroke-width', '2');
    
    group.appendChild(line1);
    group.appendChild(line2);
    group.setAttribute('pointer-events', 'none');
    return group;
  }

  private createX(center: Point, color: string, size: number): SVGGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const half = size / 2;
    
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', (center.x - half).toString());
    line1.setAttribute('y1', (center.y - half).toString());
    line1.setAttribute('x2', (center.x + half).toString());
    line1.setAttribute('y2', (center.y + half).toString());
    line1.setAttribute('stroke', color);
    line1.setAttribute('stroke-width', '2');
    
    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', (center.x - half).toString());
    line2.setAttribute('y1', (center.y + half).toString());
    line2.setAttribute('x2', (center.x + half).toString());
    line2.setAttribute('y2', (center.y - half).toString());
    line2.setAttribute('stroke', color);
    line2.setAttribute('stroke-width', '2');
    
    group.appendChild(line1);
    group.appendChild(line2);
    group.setAttribute('pointer-events', 'none');
    return group;
  }

  private createTriangle(center: Point, color: string, size: number): SVGPolygonElement {
    const height = size * 0.866; // Equilateral triangle height
    const points = `${center.x},${center.y - height / 2} ${center.x + size / 2},${center.y + height / 2} ${center.x - size / 2},${center.y + height / 2}`;
    
    const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    triangle.setAttribute('points', points);
    triangle.setAttribute('fill', 'none');
    triangle.setAttribute('stroke', color);
    triangle.setAttribute('stroke-width', '2');
    triangle.setAttribute('pointer-events', 'none');
    return triangle;
  }

  private getColorForType(type: SnapType): string {
    switch (type) {
      case SnapType.GRID: return '#ff8800';
      case SnapType.ENDPOINT: return '#00ccff';
      case SnapType.MIDPOINT: return '#ffff00';
      case SnapType.CENTER: return '#ff00ff';
      case SnapType.INTERSECTION: return '#00ff00';
      case SnapType.PERPENDICULAR: return '#0066ff';
      case SnapType.TANGENT: return '#ff0000';
      default: return '#888888';
    }
  }
}
```

### src/snapping/SnapSettings.ts

```typescript
import { SnapManager } from './SnapManager';
import { SnapType } from './SnapResult';

export class SnapSettings {
  private container: HTMLElement;
  private snapManager: SnapManager;

  constructor(snapManager: SnapManager) {
    this.snapManager = snapManager;
    this.container = this.createPanel();
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'snap-settings';
    panel.style.cssText = `
      position: absolute;
      top: 120px;
      right: 10px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-family: Arial, sans-serif;
      font-size: 13px;
      min-width: 200px;
      z-index: 100;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'Snap Settings';
    title.style.cssText = 'font-weight: bold; margin-bottom: 10px; font-size: 14px;';
    panel.appendChild(title);

    // Search radius slider
    const radiusLabel = document.createElement('div');
    radiusLabel.textContent = `Search Radius: ${this.snapManager.getSearchRadius()}px`;
    radiusLabel.style.marginBottom = '5px';
    panel.appendChild(radiusLabel);

    const radiusSlider = document.createElement('input');
    radiusSlider.type = 'range';
    radiusSlider.min = '10';
    radiusSlider.max = '50';
    radiusSlider.value = this.snapManager.getSearchRadius().toString();
    radiusSlider.style.width = '100%';
    radiusSlider.style.marginBottom = '12px';
    radiusSlider.addEventListener('input', () => {
      const value = parseInt(radiusSlider.value);
      this.snapManager.setSearchRadius(value);
      radiusLabel.textContent = `Search Radius: ${value}px`;
    });
    panel.appendChild(radiusSlider);

    // Snap type checkboxes
    const typesTitle = document.createElement('div');
    typesTitle.textContent = 'Snap Types:';
    typesTitle.style.cssText = 'font-weight: bold; margin-bottom: 8px;';
    panel.appendChild(typesTitle);

    const snapTypes = [
      { type: SnapType.GRID, label: 'Grid', color: '#ff8800' },
      { type: SnapType.ENDPOINT, label: 'Endpoint', color: '#00ccff' },
      { type: SnapType.MIDPOINT, label: 'Midpoint', color: '#ffff00' },
      { type: SnapType.CENTER, label: 'Center', color: '#ff00ff' },
      { type: SnapType.INTERSECTION, label: 'Intersection', color: '#00ff00' },
      { type: SnapType.PERPENDICULAR, label: 'Perpendicular', color: '#0066ff' },
      { type: SnapType.TANGENT, label: 'Tangent', color: '#ff0000' }
    ];

    const provider = this.snapManager.getGeometrySnapProvider();
    const enabledTypes: SnapType[] = [];

    snapTypes.forEach(({ type, label, color }) => {
      if (type === SnapType.GRID) {
        // Grid is always on, just show it
        const item = document.createElement('div');
        item.style.cssText = 'margin-bottom: 6px; color: #666;';
        item.innerHTML = `<span style="color: ${color}; font-weight: bold;">■</span> ${label} (always on)`;
        panel.appendChild(item);
      } else {
        const item = document.createElement('label');
        item.style.cssText = 'display: block; margin-bottom: 6px; cursor: pointer;';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = provider.isTypeEnabled(type);
        checkbox.style.marginRight = '8px';
        
        if (checkbox.checked) {
          enabledTypes.push(type);
        }

        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            enabledTypes.push(type);
          } else {
            const index = enabledTypes.indexOf(type);
            if (index > -1) enabledTypes.splice(index, 1);
          }
          provider.setEnabledTypes(enabledTypes);
          console.log(`${label} snap ${checkbox.checked ? 'enabled' : 'disabled'}`);
        });
        
        item.appendChild(checkbox);
        
        const colorSquare = document.createElement('span');
        colorSquare.textContent = '■';
        colorSquare.style.cssText = `color: ${color}; font-weight: bold; margin-right: 4px;`;
        item.appendChild(colorSquare);
        
        const labelText = document.createTextNode(label);
        item.appendChild(labelText);
        
        panel.appendChild(item);
      }
    });

    return panel;
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  unmount(): void {
    this.container.remove();
  }
}
```

### src/main.ts (integration)

```typescript
import { SnapSettings } from './snapping/SnapSettings';

// After creating SnapManager:
const snapSettings = new SnapSettings(snapManager);
snapSettings.mount(document.body);

// Update snap indicator on mouse move (in viewport event handlers):
viewport.onMouseMove((worldPos) => {
  if (activeTool) {
    const snapResult = snapManager.snap(worldPos);
    snapIndicator.show(snapResult);
    // Pass to active tool...
  }
});

console.log('Advanced snapping enabled: endpoint, midpoint, center, intersection, perpendicular, tangent');
```

## Test Plan

### Manual Testing Steps

1. **Endpoint snap test**
   - Create a line from (0,0) to (500,0)
   - Use Line tool, move cursor near (0,0)
   - Verify cyan circle appears at line start
   - Verify "Endpoint" label displays
   - Click to confirm snap works

2. **Midpoint snap test**
   - With same line, move cursor to ~(250, 0)
   - Verify yellow diamond appears at exact midpoint
   - Verify "Midpoint" label displays
   - Create new line from midpoint
   - Verify it starts exactly at (250, 0)

3. **Center snap test**
   - Create circle at (300, 300) radius 100
   - Use Point tool, move cursor near (300, 300)
   - Verify magenta cross appears at center
   - Verify "Center" label displays

4. **Intersection snap test**
   - Create line 1: (0, 0) to (500, 500)
   - Create line 2: (0, 500) to (500, 0)
   - Move cursor near intersection (~250, 250)
   - Verify green X appears at exact intersection
   - Verify "Intersection" label displays
   - Create point at intersection
   - Verify point exactly at (250, 250)

5. **Perpendicular snap test**
   - Create horizontal line (0, 0) to (500, 0)
   - Use Point tool, move cursor above line at ~(300, 200)
   - Verify blue square appears on line directly below cursor
   - Verify snaps to (300, 0) - perpendicular foot

6. **Tangent snap test**
   - Create circle center (0, 0) radius 200
   - Use Line tool, move cursor near (200, 0) - right side
   - Verify red triangle appears at tangent point on circle
   - Verify snaps to circle perimeter closest to cursor

7. **Line-circle intersection test**
   - Create circle center (0, 0) radius 200
   - Create line (-300, 0) to (300, 0) - crosses circle
   - Move cursor near (-200, 0)
   - Verify intersection snap appears (green X)
   - Move cursor near (200, 0)
   - Verify second intersection snap appears

8. **Circle-circle intersection test**
   - Create circle 1: center (0, 0) radius 200
   - Create circle 2: center (300, 0) radius 200
   - Move cursor where circles overlap (~150, 0 region)
   - Verify green X appears at intersection point(s)

9. **Snap priority test**
   - Create objects with overlapping snap points
   - Move cursor near cluster
   - Verify closest snap wins
   - Verify indicator switches as cursor moves

10. **Search radius test**
    - Open Snap Settings panel
    - Set radius to 10px (minimum)
    - Try snapping from farther away - verify requires precise cursor position
    - Set radius to 50px (maximum)
    - Verify snapping works from farther away

11. **Enable/disable snap types test**
    - Open Snap Settings panel
    - Uncheck "Endpoint"
    - Move cursor to line endpoint - verify no endpoint snap
    - Verify midpoint still works
    - Re-check "Endpoint" - verify it works again
    - Test each checkbox

12. **Polyline snap test**
    - Create polyline with 5 vertices
    - Verify endpoint snaps on all vertices
    - Verify midpoint snaps on all segments
    - Verify perpendicular snaps on segments

13. **Polygon snap test**
    - Create pentagon
    - Verify vertex snaps (5 points)
    - Verify midpoint snaps on all edges (including closing edge)

14. **Visual indicator variety test**
    - Create diverse scene (lines, circles, polylines)
    - Move cursor around
    - Verify each snap type shows correct shape and color:
      * Grid = orange square
      * Endpoint = cyan circle
      * Midpoint = yellow diamond
      * Center = magenta cross
      * Intersection = green X
      * Perpendicular = blue square
      * Tangent = red triangle

15. **Label display test**
    - Move between different snap types
    - Verify label text updates correctly
    - Verify label positioned near cursor
    - Verify label color matches snap type

## Acceptance Criteria

- [ ] Endpoint snapping works for lines, polylines, polygons
- [ ] Midpoint snapping works for all segment types
- [ ] Center snapping works for circles
- [ ] Intersection snapping: line-line intersections
- [ ] Intersection snapping: line-circle intersections (2 points)
- [ ] Intersection snapping: circle-circle intersections (2 points)
- [ ] Perpendicular snapping to line segments
- [ ] Tangent snapping to circles
- [ ] Snap priority: closest snap wins
- [ ] Search radius configurable (10-50px)
- [ ] Visual indicators: 7 distinct shapes/colors per snap type
- [ ] Snap type labels display near cursor
- [ ] Snap Settings panel accessible
- [ ] Enable/disable individual snap types via checkboxes
- [ ] Grid snap always available (shown as "always on")
- [ ] GeometryMath.ts with intersection calculations
- [ ] Line-line intersection algorithm
- [ ] Line-circle intersection algorithm
- [ ] Circle-circle intersection algorithm
- [ ] Point projection onto line segment
- [ ] All tools integrate with advanced snapping
- [ ] Console logs when snap types toggled
- [ ] No TypeScript compilation errors
- [ ] Smooth performance with 50+ objects

## Deliverables

1. **src/snapping/SnapResult.ts** - SnapType enum and SnapResult interface
2. **src/snapping/SnapProvider.ts** - Provider interface
3. **src/snapping/GeometrySnapProvider.ts** - Geometry-based snap generation
4. **src/geometry/GeometryMath.ts** - Intersection and projection utilities
5. **Updated src/snapping/SnapManager.ts** - Enhanced with providers
6. **Updated src/snapping/SnapIndicator.ts** - Visual variety per type
7. **src/snapping/SnapSettings.ts** - Configuration panel UI
8. **Updated src/main.ts** - Settings panel integration
9. **Working advanced snapping** - All 7 snap types functional

---

**Estimated effort**: 4-5 hours  
**Dependencies**: Slice 6 (basic snapping), Slice 10 (polyline/polygon)  
**Risk**: Medium - intersection algorithms require testing, performance with many objects

