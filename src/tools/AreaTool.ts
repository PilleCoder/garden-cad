import { Tool, ToolMouseEvent } from './Tool';
import { Point } from '../types/geometry';
import { MeasurementManager } from '../measurement/MeasurementManager';
import { MeasurementType } from '../measurement/Measurement';
import { SnapManager } from '../snapping/SnapManager';

export class AreaTool implements Tool {
  readonly name = 'area';

  private manager: MeasurementManager;
  private snapManager: SnapManager;
  private previewGroup: SVGGElement;
  private points: Point[] = [];
  private currentPoint: Point | null = null;

  constructor(
    manager: MeasurementManager,
    snapManager: SnapManager,
    previewGroup: SVGGElement
  ) {
    this.manager = manager;
    this.snapManager = snapManager;
    this.previewGroup = previewGroup;
  }

  onActivate(): void {
    this.reset();
    console.log('Area tool activated - click points to define polygon, double-click to complete');
  }

  onDeactivate(): void {
    this.reset();
  }

  onMouseDown(_event: ToolMouseEvent): void {
    // Not used
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
    console.log(`Point ${this.points.length} added at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
  }

  // Handle double-click to complete
  onDoubleClick(): void {
    if (this.points.length >= 3) {
      const area = this.calculateArea(this.points);
      const measurement = this.manager.addMeasurement(
        MeasurementType.AREA,
        this.points,
        area
      );
      console.log(`Area measured: ${measurement.getFormattedValue()}`);
      this.reset();
    } else {
      console.log('Need at least 3 points to measure area');
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      console.log('Area measurement cancelled');
      this.reset();
    } else if (key === 'Enter' && this.points.length >= 3) {
      this.onDoubleClick();
    }
  }

  private renderPreview(): void {
    this.clearPreview();

    // Render existing points
    this.points.forEach(point => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x.toString());
      circle.setAttribute('cy', point.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#ff6600');
      this.previewGroup.appendChild(circle);
    });

    // Render lines between points
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      if (p1 && p2) {
        this.renderLine(p1, p2);
      }
    }

    // Render preview line to current point
    if (this.points.length > 0 && this.currentPoint) {
      const lastPoint = this.points[this.points.length - 1];
      if (lastPoint) {
        this.renderLine(lastPoint, this.currentPoint, true);
      }
      
      // Render closing line if we have 3+ points
      if (this.points.length >= 2) {
        const firstPoint = this.points[0];
        if (firstPoint) {
          this.renderLine(this.currentPoint, firstPoint, true);
        }
      }
    }

    // Current point preview
    if (this.currentPoint) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.currentPoint.x.toString());
      circle.setAttribute('cy', this.currentPoint.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#ff6600');
      circle.setAttribute('opacity', '0.5');
      this.previewGroup.appendChild(circle);
    }

    // Show area if we have enough points
    if (this.points.length >= 3 && this.currentPoint) {
      const previewPoints = [...this.points, this.currentPoint];
      const area = this.calculateArea(previewPoints);
      const centroid = this.calculateCentroid(previewPoints);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', centroid.x.toString());
      text.setAttribute('y', centroid.y.toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#ff6600');
      text.setAttribute('font-size', '14');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-family', 'monospace');
      text.textContent = this.formatArea(area);
      this.previewGroup.appendChild(text);
    }
  }

  private renderLine(p1: Point, p2: Point, dashed: boolean = false): void {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1.x.toString());
    line.setAttribute('y1', p1.y.toString());
    line.setAttribute('x2', p2.x.toString());
    line.setAttribute('y2', p2.y.toString());
    line.setAttribute('stroke', '#ff6600');
    line.setAttribute('stroke-width', '2');
    if (dashed) {
      line.setAttribute('stroke-dasharray', '5 5');
      line.setAttribute('opacity', '0.7');
    }
    this.previewGroup.appendChild(line);
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

  private calculateArea(points: Point[]): number {
    if (points.length < 3) return 0;

    // Shoelace formula
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      const pi = points[i];
      const pj = points[j];
      if (pi && pj) {
        area += pi.x * pj.y;
        area -= pj.x * pi.y;
      }
    }
    return Math.abs(area / 2);
  }

  private calculateCentroid(points: Point[]): Point {
    let sumX = 0, sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / points.length, y: sumY / points.length };
  }

  private formatArea(cm2: number): string {
    if (cm2 < 10000) {
      return `${cm2.toFixed(0)} cm²`;
    } else {
      return `${(cm2 / 10000).toFixed(2)} m²`;
    }
  }
}
