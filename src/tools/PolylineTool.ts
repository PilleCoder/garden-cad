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

  onMouseDown(_event: ToolMouseEvent): void {
    // Not used - we handle clicks in onMouseClick
  }

  onMouseMove(event: ToolMouseEvent): void {
    const snapResult = this.snapManager.snap(event.worldPos);
    this.currentPoint = snapResult.point;
    this.renderPreview();
  }

  onMouseUp(_event: ToolMouseEvent): void {
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
      line.setAttribute('x1', this.points[i]!.x.toString());
      line.setAttribute('y1', this.points[i]!.y.toString());
      line.setAttribute('x2', this.points[i + 1]!.x.toString());
      line.setAttribute('y2', this.points[i + 1]!.y.toString());
      line.setAttribute('stroke', '#666');
      line.setAttribute('stroke-width', '2');
      this.previewGroup.appendChild(line);
    }

    // Render preview segment to current point
    if (this.points.length > 0 && this.currentPoint) {
      const lastPoint = this.points[this.points.length - 1]!;
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
      const dx = points[i + 1]!.x - points[i]!.x;
      const dy = points[i + 1]!.y - points[i]!.y;
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
