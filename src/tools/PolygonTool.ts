import { Tool, ToolMouseEvent } from './Tool';
import { Project } from '../model/Project';
import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, Point } from '../geometry/types';
import { SnapManager } from '../snapping/SnapManager';
import { LayerManager } from '../model/LayerManager';

export class PolygonTool implements Tool {
  readonly name = 'polygon';

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
    console.log('Polygon tool activated - click points, double-click or Enter to finish');
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
    
    if (this.points.length >= 3) {
      const perimeter = this.calculatePerimeter();
      const area = this.calculateArea();
      console.log(`  Perimeter: ${this.formatDistance(perimeter)}, Area: ${this.formatArea(area)}`);
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      console.log('Polygon drawing cancelled');
      this.reset();
    } else if (key === 'Enter' && this.points.length >= 3) {
      this.complete();
    }
  }

  onDoubleClick(): void {
    if (this.points.length >= 3) {
      this.complete();
    } else {
      console.log('Need at least 3 points for polygon');
    }
  }

  private complete(): void {
    const activeLayerId = this.layerManager.getActiveLayerId() || 'default';
    const id = this.generateId('polygon');
    
    const polygon = new GeometryObject(
      id,
      activeLayerId,
      {
        type: GeometryType.POLYGON,
        points: [...this.points]
      },
      { stroke: '#333333', strokeWidth: 2, fill: 'rgba(100, 149, 237, 0.2)' },
      { 
        name: `Polygon ${id}`,
        perimeter: this.calculatePerimeter(),
        area: this.calculateArea()
      }
    );

    this.project.addObject(polygon);
    this.onUpdate();
    
    const perimeter = this.calculatePerimeter();
    const area = this.calculateArea();
    console.log(`Created polygon with ${this.points.length} vertices, perimeter: ${this.formatDistance(perimeter)}, area: ${this.formatArea(area)}`);
    
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

      // Closing segment back to first point
      if (this.points.length >= 2) {
        const closingLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        closingLine.setAttribute('x1', this.currentPoint.x.toString());
        closingLine.setAttribute('y1', this.currentPoint.y.toString());
        closingLine.setAttribute('x2', this.points[0]!.x.toString());
        closingLine.setAttribute('y2', this.points[0]!.y.toString());
        closingLine.setAttribute('stroke', '#666');
        closingLine.setAttribute('stroke-width', '2');
        closingLine.setAttribute('stroke-dasharray', '5 5');
        closingLine.setAttribute('opacity', '0.5');
        this.previewGroup.appendChild(closingLine);
      }

      // Current point preview
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.currentPoint.x.toString());
      circle.setAttribute('cy', this.currentPoint.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#666');
      circle.setAttribute('opacity', '0.5');
      this.previewGroup.appendChild(circle);
    }

    // Show perimeter and area label
    if (this.points.length >= 2 && this.currentPoint) {
      const previewPoints = [...this.points, this.currentPoint];
      const perimeter = this.calculatePerimeterForPoints(previewPoints);
      const area = this.calculateAreaForPoints(previewPoints);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', this.currentPoint.x.toString());
      text.setAttribute('y', (this.currentPoint.y - 15).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#0066ff');
      text.setAttribute('font-size', '14');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-family', 'monospace');
      text.textContent = `Perimeter: ${this.formatDistance(perimeter)}`;
      this.previewGroup.appendChild(text);

      if (this.points.length >= 2) {
        const areaText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        areaText.setAttribute('x', this.currentPoint.x.toString());
        areaText.setAttribute('y', (this.currentPoint.y + 5).toString());
        areaText.setAttribute('text-anchor', 'middle');
        areaText.setAttribute('fill', '#0066ff');
        areaText.setAttribute('font-size', '14');
        areaText.setAttribute('font-weight', 'bold');
        areaText.setAttribute('font-family', 'monospace');
        areaText.textContent = `Area: ${this.formatArea(area)}`;
        this.previewGroup.appendChild(areaText);
      }
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

  private calculatePerimeter(): number {
    return this.calculatePerimeterForPoints(this.points);
  }

  private calculatePerimeterForPoints(points: Point[]): number {
    if (points.length < 2) return 0;
    
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1]!.x - points[i]!.x;
      const dy = points[i + 1]!.y - points[i]!.y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    
    // Add closing segment
    const dx = points[0]!.x - points[points.length - 1]!.x;
    const dy = points[0]!.y - points[points.length - 1]!.y;
    total += Math.sqrt(dx * dx + dy * dy);
    
    return total;
  }

  private calculateArea(): number {
    return this.calculateAreaForPoints(this.points);
  }

  private calculateAreaForPoints(points: Point[]): number {
    if (points.length < 3) return 0;
    
    // Shoelace formula for polygon area
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i]!.x * points[j]!.y;
      area -= points[j]!.x * points[i]!.y;
    }
    
    return Math.abs(area) / 2;
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
      return `${cm2.toFixed(1)} cm²`;
    } else {
      return `${(cm2 / 10000).toFixed(2)} m²`;
    }
  }

  private generateId(type: string): string {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }
}
