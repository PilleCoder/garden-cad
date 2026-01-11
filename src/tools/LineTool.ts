import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point } from '../geometry/types';
import { SnapManager } from '../snapping/SnapManager';
import { SnapIndicator } from '../snapping/SnapIndicator';
import { LayerManager } from '../model/LayerManager';

enum LineToolState {
  WAITING_FOR_START,
  WAITING_FOR_END
}

export class LineTool implements Tool {
  readonly name = 'line';

  private project: Project;
  private onUpdate: () => void;
  private previewGroup: SVGGElement;
  private state: LineToolState = LineToolState.WAITING_FOR_START;
  private startPoint: Point | null = null;
  private currentPoint: Point | null = null;
  private snapManager: SnapManager;
  private snapIndicator: SnapIndicator;
  private layerManager: LayerManager;
  private currentZoom: number = 1.0;

  constructor(
    project: Project,
    previewGroup: SVGGElement,
    snapManager: SnapManager,
    snapIndicator: SnapIndicator,
    layerManager: LayerManager,
    onUpdate: () => void
  ) {
    this.project = project;
    this.previewGroup = previewGroup;
    this.snapManager = snapManager;
    this.snapIndicator = snapIndicator;
    this.layerManager = layerManager;
    this.onUpdate = onUpdate;
  }

  setZoom(zoom: number): void {
    this.currentZoom = zoom;
  }

  onActivate(): void {
    this.reset();
    console.log('Line tool activated - click start point');
  }

  onDeactivate(): void {
    this.reset();
    this.snapIndicator.hide();
  }

  onMouseDown(_event: ToolMouseEvent): void {
    // Not used
  }

  onMouseMove(event: ToolMouseEvent): void {
    // Apply snapping
    const snapResult = this.snapManager.snap(event.worldPos);
    this.currentPoint = snapResult.point;
    
    // Show snap indicator
    this.snapIndicator.show(snapResult, this.currentZoom);
    
    this.renderPreview();
  }

  onMouseUp(_event: ToolMouseEvent): void {
    // Not used
  }

  onMouseClick(event: ToolMouseEvent): void {
    // Apply snapping
    const snapResult = this.snapManager.snap(event.worldPos);
    
    if (this.state === LineToolState.WAITING_FOR_START) {
      this.startPoint = snapResult.point;
      this.state = LineToolState.WAITING_FOR_END;
      
      if (snapResult.snapped) {
        console.log(`Start point set at (${snapResult.point.x}, ${snapResult.point.y}) [SNAPPED] - click end point`);
      } else {
        console.log(`Start point set at (${snapResult.point.x.toFixed(1)}, ${snapResult.point.y.toFixed(1)}) - click end point`);
      }
    } else if (this.state === LineToolState.WAITING_FOR_END && this.startPoint) {
      // Create line
      const activeLayerId = this.layerManager.getActiveLayerId() || 'default';
      const id = this.generateId('line');
      const line = new GeometryObject(
        id,
        activeLayerId,
        {
          type: GeometryType.LINE,
          start: this.startPoint,
          end: snapResult.point
        },
        { stroke: '#333333', strokeWidth: 2 },
        { name: `Line ${id}` }
      );

      this.project.addObject(line);
      this.onUpdate();
      
      const length = this.calculateDistance(this.startPoint, snapResult.point);
      if (snapResult.snapped) {
        console.log(`Created line, length: ${length.toFixed(1)} cm [END SNAPPED]`);
      } else {
        console.log(`Created line, length: ${length.toFixed(1)} cm`);
      }
      
      this.reset();
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      console.log('Line drawing cancelled');
      this.reset();
    }
  }

  private renderPreview(): void {
    this.clearPreview();

    if (this.state === LineToolState.WAITING_FOR_START && this.currentPoint) {
      // Show point preview
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.currentPoint.x.toString());
      circle.setAttribute('cy', this.currentPoint.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#666');
      circle.setAttribute('opacity', '0.5');
      this.previewGroup.appendChild(circle);
    } else if (this.state === LineToolState.WAITING_FOR_END && this.startPoint && this.currentPoint) {
      // Show start point
      const startCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      startCircle.setAttribute('cx', this.startPoint.x.toString());
      startCircle.setAttribute('cy', this.startPoint.y.toString());
      startCircle.setAttribute('r', '4');
      startCircle.setAttribute('fill', '#0066ff');
      this.previewGroup.appendChild(startCircle);

      // Show preview line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', this.startPoint.x.toString());
      line.setAttribute('y1', this.startPoint.y.toString());
      line.setAttribute('x2', this.currentPoint.x.toString());
      line.setAttribute('y2', this.currentPoint.y.toString());
      line.setAttribute('stroke', '#666');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '5 5');
      line.setAttribute('opacity', '0.7');
      line.setAttribute('pointer-events', 'none');
      this.previewGroup.appendChild(line);

      // Show length label
      const midX = (this.startPoint.x + this.currentPoint.x) / 2;
      const midY = (this.startPoint.y + this.currentPoint.y) / 2;
      const length = this.calculateDistance(this.startPoint, this.currentPoint);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midX.toString());
      text.setAttribute('y', (midY - 10).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#0066ff');
      text.setAttribute('font-size', '14');
      text.setAttribute('font-family', 'monospace');
      text.textContent = `${length.toFixed(1)} cm`;
      this.previewGroup.appendChild(text);
    }
  }

  private clearPreview(): void {
    while (this.previewGroup.firstChild) {
      this.previewGroup.removeChild(this.previewGroup.firstChild);
    }
  }

  private reset(): void {
    this.state = LineToolState.WAITING_FOR_START;
    this.startPoint = null;
    this.currentPoint = null;
    this.clearPreview();
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
