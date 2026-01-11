import { Tool, ToolMouseEvent } from './Tool';
import { Point } from '../types/geometry';
import { MeasurementManager } from '../measurement/MeasurementManager';
import { MeasurementType } from '../measurement/Measurement';
import { SnapManager } from '../snapping/SnapManager';

enum MeasureToolState {
  IDLE,
  FIRST_POINT_SET,
  MEASURING
}

export class MeasureTool implements Tool {
  readonly name = 'measure';

  private manager: MeasurementManager;
  private snapManager: SnapManager;
  private previewGroup: SVGGElement;
  private state: MeasureToolState = MeasureToolState.IDLE;
  private startPoint: Point | null = null;
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
    console.log('Measure tool activated - click two points to measure distance');
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

    if (this.state === MeasureToolState.IDLE) {
      this.startPoint = point;
      this.state = MeasureToolState.FIRST_POINT_SET;
      console.log(`First point set at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    } else if (this.state === MeasureToolState.FIRST_POINT_SET && this.startPoint) {
      // Calculate distance
      const distance = this.calculateDistance(this.startPoint, point);
      
      // Create measurement
      const measurement = this.manager.addMeasurement(
        MeasurementType.DISTANCE,
        [this.startPoint, point],
        distance
      );

      console.log(`Distance measured: ${measurement.getFormattedValue()}`);
      this.reset();
    }
  }

  getCursor(): string {
    return 'crosshair';
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      console.log('Measurement cancelled');
      this.reset();
    }
  }

  private renderPreview(): void {
    this.clearPreview();

    if (this.state === MeasureToolState.IDLE && this.currentPoint) {
      // Show point preview
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.currentPoint.x.toString());
      circle.setAttribute('cy', this.currentPoint.y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#ff6600');
      circle.setAttribute('opacity', '0.5');
      this.previewGroup.appendChild(circle);
    } else if (this.state === MeasureToolState.FIRST_POINT_SET && this.startPoint && this.currentPoint) {
      // Show start point
      const startCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      startCircle.setAttribute('cx', this.startPoint.x.toString());
      startCircle.setAttribute('cy', this.startPoint.y.toString());
      startCircle.setAttribute('r', '4');
      startCircle.setAttribute('fill', '#ff6600');
      this.previewGroup.appendChild(startCircle);

      // Show preview line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', this.startPoint.x.toString());
      line.setAttribute('y1', this.startPoint.y.toString());
      line.setAttribute('x2', this.currentPoint.x.toString());
      line.setAttribute('y2', this.currentPoint.y.toString());
      line.setAttribute('stroke', '#ff6600');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '5 5');
      line.setAttribute('opacity', '0.7');
      this.previewGroup.appendChild(line);

      // Show distance label
      const distance = this.calculateDistance(this.startPoint, this.currentPoint);
      const midX = (this.startPoint.x + this.currentPoint.x) / 2;
      const midY = (this.startPoint.y + this.currentPoint.y) / 2;
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midX.toString());
      text.setAttribute('y', (midY - 10).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#ff6600');
      text.setAttribute('font-size', '14');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-family', 'monospace');
      text.textContent = this.formatDistance(distance);
      this.previewGroup.appendChild(text);
    }
  }

  private clearPreview(): void {
    while (this.previewGroup.firstChild) {
      this.previewGroup.removeChild(this.previewGroup.firstChild);
    }
  }

  private reset(): void {
    this.state = MeasureToolState.IDLE;
    this.startPoint = null;
    this.currentPoint = null;
    this.clearPreview();
  }

  private calculateDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private formatDistance(cm: number): string {
    if (cm < 100) {
      return `${cm.toFixed(1)} cm`;
    } else {
      return `${(cm / 100).toFixed(2)} m`;
    }
  }
}
