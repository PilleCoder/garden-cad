import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point } from '../geometry/types';
import { SnapManager } from '../snapping/SnapManager';
import { SnapIndicator } from '../snapping/SnapIndicator';

export class PointTool implements Tool {
  readonly name = 'point';

  private project: Project;
  private onUpdate: () => void;
  private previewPoint: Point | null = null;
  private previewGroup: SVGGElement;
  private snapManager: SnapManager;
  private snapIndicator: SnapIndicator;
  private currentZoom: number = 1.0;

  constructor(
    project: Project,
    previewGroup: SVGGElement,
    snapManager: SnapManager,
    snapIndicator: SnapIndicator,
    onUpdate: () => void
  ) {
    this.project = project;
    this.previewGroup = previewGroup;
    this.snapManager = snapManager;
    this.snapIndicator = snapIndicator;
    this.onUpdate = onUpdate;
  }

  setZoom(zoom: number): void {
    this.currentZoom = zoom;
  }

  onActivate(): void {
    console.log('Point tool activated - click to place point');
  }

  onDeactivate(): void {
    this.clearPreview();
    this.snapIndicator.hide();
  }

  onMouseDown(_event: ToolMouseEvent): void {
    // Not used for point tool
  }

  onMouseMove(event: ToolMouseEvent): void {
    // Apply snapping
    const snapResult = this.snapManager.snap(event.worldPos);
    this.previewPoint = snapResult.point;
    
    // Show snap indicator
    this.snapIndicator.show(snapResult, this.currentZoom);
    
    this.renderPreview();
  }

  onMouseUp(_event: ToolMouseEvent): void {
    // Not used for point tool
  }

  onMouseClick(event: ToolMouseEvent): void {
    // Apply snapping to final position
    const snapResult = this.snapManager.snap(event.worldPos);
    
    const id = this.generateId('point');
    const point = new GeometryObject(
      id,
      'default',
      {
        type: GeometryType.POINT,
        position: snapResult.point
      },
      { stroke: '#333333', strokeWidth: 2 },
      { name: `Point ${id}`, category: 'reference' }
    );

    this.project.addObject(point);
    this.onUpdate();
    
    if (snapResult.snapped) {
      console.log(`Created point at (${snapResult.point.x}, ${snapResult.point.y}) [SNAPPED]`);
    } else {
      console.log(`Created point at (${snapResult.point.x.toFixed(1)}, ${snapResult.point.y.toFixed(1)})`);
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  private renderPreview(): void {
    this.clearPreview();
    
    if (!this.previewPoint) return;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', this.previewPoint.x.toString());
    circle.setAttribute('cy', this.previewPoint.y.toString());
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', '#666');
    circle.setAttribute('opacity', '0.5');
    circle.setAttribute('pointer-events', 'none');
    
    this.previewGroup.appendChild(circle);
  }

  private clearPreview(): void {
    while (this.previewGroup.firstChild) {
      this.previewGroup.removeChild(this.previewGroup.firstChild);
    }
  }

  private generateId(type: string): string {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }
}
