import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { Selection } from '../selection/Selection';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point, PointGeometry, LineGeometry, CircleGeometry } from '../geometry/types';
import { SnapManager } from '../snapping/SnapManager';
import { SnapIndicator } from '../snapping/SnapIndicator';

export class SelectTool implements Tool {
  readonly name = 'select';

  private project: Project;
  private selection: Selection;
  private isDragging: boolean = false;
  private dragStartWorld: Point | null = null;
  private draggedObject: GeometryObject | null = null;
  private dragOffset: Point = { x: 0, y: 0 };
  private onUpdate: () => void;
  private snapManager: SnapManager;
  private snapIndicator: SnapIndicator;
  private currentZoom: number = 1.0;

  constructor(
    project: Project,
    selection: Selection,
    snapManager: SnapManager,
    snapIndicator: SnapIndicator,
    onUpdate: () => void
  ) {
    this.project = project;
    this.selection = selection;
    this.snapManager = snapManager;
    this.snapIndicator = snapIndicator;
    this.onUpdate = onUpdate;
  }

  setZoom(zoom: number): void {
    this.currentZoom = zoom;
  }

  onActivate(): void {
    console.log('Select tool activated');
  }

  onDeactivate(): void {
    this.isDragging = false;
    this.draggedObject = null;
    this.snapIndicator.hide();
  }

  onMouseDown(event: ToolMouseEvent): void {
    // Check if clicking on selected object to start drag
    const selectedId = this.selection.getFirstSelected();
    if (selectedId) {
      const obj = this.project.getObject(selectedId);
      if (obj && this.hitTest(obj, event.worldPos)) {
        this.isDragging = true;
        this.dragStartWorld = event.worldPos;
        this.draggedObject = obj;
        this.dragOffset = this.getObjectPosition(obj);
        return;
      }
    }
  }

  onMouseMove(event: ToolMouseEvent): void {
    if (this.isDragging && this.dragStartWorld && this.draggedObject) {
      // Apply snapping to dragged position
      const snapResult = this.snapManager.snap(event.worldPos);
      const dx = snapResult.point.x - this.dragStartWorld.x;
      const dy = snapResult.point.y - this.dragStartWorld.y;
      
      // Show snap indicator
      this.snapIndicator.show(snapResult, this.currentZoom);
      
      // Calculate new position
      const newPos: Point = {
        x: this.dragOffset.x + dx,
        y: this.dragOffset.y + dy
      };

      // Update object geometry
      const updatedObj = this.moveObject(this.draggedObject, newPos);
      this.project.addObject(updatedObj); // Replace with updated
      this.onUpdate();
    }
  }

  onMouseUp(_event: ToolMouseEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.dragStartWorld = null;
      this.draggedObject = null;
      this.snapIndicator.hide();
      console.log('Move completed');
    }
  }

  onMouseClick(event: ToolMouseEvent): void {
    if (this.isDragging) return; // Was dragging, not a click

    // Hit test all objects
    const objects = this.project.getAllObjects();
    let hitObject: GeometryObject | null = null;

    // Reverse order to select topmost object
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (obj && this.hitTest(obj, event.worldPos)) {
        hitObject = obj;
        break;
      }
    }

    if (hitObject) {
      this.selection.select(hitObject.id);
      console.log(`Selected: ${hitObject.metadata.name || hitObject.id}`);
    } else {
      this.selection.deselect();
      console.log('Deselected');
    }
  }

  getCursor(): string {
    if (this.isDragging) {
      return 'grabbing';
    }
    
    // Check if hovering over selected object
    const selectedId = this.selection.getFirstSelected();
    if (selectedId) {
      return 'grab';
    }
    
    return 'default';
  }

  // Hit testing per geometry type
  private hitTest(obj: GeometryObject, point: Point): boolean {
    const tolerance = 5; // 5 cm tolerance

    switch (obj.geometry.type) {
      case GeometryType.POINT: {
        const geom = obj.geometry as PointGeometry;
        const dx = point.x - geom.position.x;
        const dy = point.y - geom.position.y;
        return Math.sqrt(dx * dx + dy * dy) <= tolerance;
      }

      case GeometryType.LINE: {
        const geom = obj.geometry as LineGeometry;
        const dist = this.pointToLineDistance(point, geom.start, geom.end);
        return dist <= tolerance + (obj.style.strokeWidth || 2) / 2;
      }

      case GeometryType.CIRCLE: {
        const geom = obj.geometry as CircleGeometry;
        const dx = point.x - geom.center.x;
        const dy = point.y - geom.center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Hit if near circumference or inside
        return dist <= geom.radius + tolerance;
      }

      default:
        return false;
    }
  }

  // Point to line segment distance
  private pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      const px = point.x - lineStart.x;
      const py = point.y - lineStart.y;
      return Math.sqrt(px * px + py * py);
    }

    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    const distX = point.x - projX;
    const distY = point.y - projY;

    return Math.sqrt(distX * distX + distY * distY);
  }

  // Get object position (varies by type)
  private getObjectPosition(obj: GeometryObject): Point {
    switch (obj.geometry.type) {
      case GeometryType.POINT:
        return { ...(obj.geometry as PointGeometry).position };
      case GeometryType.LINE:
        return { ...(obj.geometry as LineGeometry).start };
      case GeometryType.CIRCLE:
        return { ...(obj.geometry as CircleGeometry).center };
      default:
        return { x: 0, y: 0 };
    }
  }

  // Move object (returns new object with updated geometry)
  private moveObject(obj: GeometryObject, newPos: Point): GeometryObject {
    const oldPos = this.getObjectPosition(obj);
    const dx = newPos.x - oldPos.x;
    const dy = newPos.y - oldPos.y;

    let newGeometry: any;

    switch (obj.geometry.type) {
      case GeometryType.POINT:
        newGeometry = {
          ...obj.geometry,
          position: newPos
        };
        break;

      case GeometryType.LINE:
        const lineGeom = obj.geometry as LineGeometry;
        newGeometry = {
          ...obj.geometry,
          start: { x: lineGeom.start.x + dx, y: lineGeom.start.y + dy },
          end: { x: lineGeom.end.x + dx, y: lineGeom.end.y + dy }
        };
        break;

      case GeometryType.CIRCLE:
        newGeometry = {
          ...obj.geometry,
          center: newPos
        };
        break;

      default:
        return obj;
    }

    return obj.clone({ geometry: newGeometry });
  }
}
