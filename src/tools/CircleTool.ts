import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point } from '../geometry/types';

enum CircleToolState {
  WAITING_FOR_CENTER,
  WAITING_FOR_RADIUS
}

export class CircleTool implements Tool {
  readonly name = 'circle';

  private project: Project;
  private onUpdate: () => void;
  private previewGroup: SVGGElement;
  private state: CircleToolState = CircleToolState.WAITING_FOR_CENTER;
  private centerPoint: Point | null = null;
  private currentPoint: Point | null = null;

  constructor(project: Project, previewGroup: SVGGElement, onUpdate: () => void) {
    this.project = project;
    this.previewGroup = previewGroup;
    this.onUpdate = onUpdate;
  }

  onActivate(): void {
    this.reset();
    console.log('Circle tool activated - click center point');
  }

  onDeactivate(): void {
    this.reset();
  }

  onMouseDown(_event: ToolMouseEvent): void {
    // Not used
  }

  onMouseMove(event: ToolMouseEvent): void {
    this.currentPoint = event.worldPos;
    this.renderPreview();
  }

  onMouseUp(_event: ToolMouseEvent): void {
    // Not used
  }

  onMouseClick(event: ToolMouseEvent): void {
    if (this.state === CircleToolState.WAITING_FOR_CENTER) {
      this.centerPoint = { x: event.worldPos.x, y: event.worldPos.y };
      this.state = CircleToolState.WAITING_FOR_RADIUS;
      console.log(`Center set at (${event.worldPos.x.toFixed(1)}, ${event.worldPos.y.toFixed(1)}) - click to set radius`);
    } else if (this.state === CircleToolState.WAITING_FOR_RADIUS && this.centerPoint) {
      const radius = this.calculateDistance(this.centerPoint, event.worldPos);
      
      if (radius < 1) {
        console.log('Radius too small, try again');
        return;
      }

      // Create circle
      const id = this.generateId('circle');
      const circle = new GeometryObject(
        id,
        'default',
        {
          type: GeometryType.CIRCLE,
          center: this.centerPoint,
          radius: radius
        },
        { stroke: '#228B22', strokeWidth: 2, fill: '#90EE90', opacity: 0.3 },
        { name: `Circle ${id}`, category: 'vegetation' }
      );

      this.project.addObject(circle);
      this.onUpdate();
      console.log(`Created circle, radius: ${radius.toFixed(1)} cm`);
      
      this.reset();
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      console.log('Circle drawing cancelled');
      this.reset();
    }
  }

  private renderPreview(): void {
    this.clearPreview();

    if (this.state === CircleToolState.WAITING_FOR_CENTER && this.currentPoint) {
      // Show center preview
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.currentPoint.x.toString());
      circle.setAttribute('cy', this.currentPoint.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#666');
      circle.setAttribute('opacity', '0.5');
      this.previewGroup.appendChild(circle);
    } else if (this.state === CircleToolState.WAITING_FOR_RADIUS && this.centerPoint && this.currentPoint) {
      const radius = this.calculateDistance(this.centerPoint, this.currentPoint);

      // Show center point
      const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      centerCircle.setAttribute('cx', this.centerPoint.x.toString());
      centerCircle.setAttribute('cy', this.centerPoint.y.toString());
      centerCircle.setAttribute('r', '4');
      centerCircle.setAttribute('fill', '#0066ff');
      this.previewGroup.appendChild(centerCircle);

      // Show preview circle
      const previewCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      previewCircle.setAttribute('cx', this.centerPoint.x.toString());
      previewCircle.setAttribute('cy', this.centerPoint.y.toString());
      previewCircle.setAttribute('r', radius.toString());
      previewCircle.setAttribute('stroke', '#666');
      previewCircle.setAttribute('stroke-width', '2');
      previewCircle.setAttribute('stroke-dasharray', '5 5');
      previewCircle.setAttribute('fill', 'none');
      previewCircle.setAttribute('opacity', '0.7');
      previewCircle.setAttribute('pointer-events', 'none');
      this.previewGroup.appendChild(previewCircle);

      // Show radius line
      const radiusLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      radiusLine.setAttribute('x1', this.centerPoint.x.toString());
      radiusLine.setAttribute('y1', this.centerPoint.y.toString());
      radiusLine.setAttribute('x2', this.currentPoint.x.toString());
      radiusLine.setAttribute('y2', this.currentPoint.y.toString());
      radiusLine.setAttribute('stroke', '#0066ff');
      radiusLine.setAttribute('stroke-width', '1');
      radiusLine.setAttribute('pointer-events', 'none');
      this.previewGroup.appendChild(radiusLine);

      // Show radius label
      const midX = (this.centerPoint.x + this.currentPoint.x) / 2;
      const midY = (this.centerPoint.y + this.currentPoint.y) / 2;
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midX.toString());
      text.setAttribute('y', (midY - 10).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#0066ff');
      text.setAttribute('font-size', '14');
      text.setAttribute('font-family', 'monospace');
      text.textContent = `r: ${radius.toFixed(1)} cm`;
      this.previewGroup.appendChild(text);
    }
  }

  private clearPreview(): void {
    while (this.previewGroup.firstChild) {
      this.previewGroup.removeChild(this.previewGroup.firstChild);
    }
  }

  private reset(): void {
    this.state = CircleToolState.WAITING_FOR_CENTER;
    this.centerPoint = null;
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
