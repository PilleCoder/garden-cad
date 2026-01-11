import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point } from '../geometry/types';

export class PointTool implements Tool {
  readonly name = 'point';

  private project: Project;
  private onUpdate: () => void;
  private previewPoint: Point | null = null;
  private previewGroup: SVGGElement;

  constructor(project: Project, previewGroup: SVGGElement, onUpdate: () => void) {
    this.project = project;
    this.previewGroup = previewGroup;
    this.onUpdate = onUpdate;
  }

  onActivate(): void {
    console.log('Point tool activated - click to place point');
  }

  onDeactivate(): void {
    this.clearPreview();
  }

  onMouseDown(_event: ToolMouseEvent): void {
    // Not used for point tool
  }

  onMouseMove(event: ToolMouseEvent): void {
    // Update preview
    this.previewPoint = event.worldPos;
    this.renderPreview();
  }

  onMouseUp(_event: ToolMouseEvent): void {
    // Not used for point tool
  }

  onMouseClick(event: ToolMouseEvent): void {
    // Create point at click location
    const id = this.generateId('point');
    const point = new GeometryObject(
      id,
      'default',
      {
        type: GeometryType.POINT,
        position: { x: event.worldPos.x, y: event.worldPos.y }
      },
      { stroke: '#333333', strokeWidth: 2 },
      { name: `Point ${id}`, category: 'reference' }
    );

    this.project.addObject(point);
    this.onUpdate();
    console.log(`Created point at (${event.worldPos.x.toFixed(1)}, ${event.worldPos.y.toFixed(1)})`);
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
