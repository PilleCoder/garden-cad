import { MeasurementManager } from './MeasurementManager';
import { MeasurementType } from './Measurement';
import { Point } from '../types/geometry';
import { LayerManager } from '../model/LayerManager';

export class MeasurementRenderer {
  private measurementGroup: SVGGElement;
  private manager: MeasurementManager;
  private layerManager?: LayerManager;

  constructor(worldGroup: SVGGElement, manager: MeasurementManager) {
    this.manager = manager;
    this.measurementGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.measurementGroup.id = 'measurements';
    worldGroup.appendChild(this.measurementGroup);

    this.manager.onChange(() => this.render(1.0));
  }

  setLayerManager(layerManager: LayerManager): void {
    this.layerManager = layerManager;
  }

  render(zoom: number): void {
    // Clear existing
    while (this.measurementGroup.firstChild) {
      this.measurementGroup.removeChild(this.measurementGroup.firstChild);
    }

    // Check if measurements layer is visible
    if (this.layerManager) {
      const measurementLayer = this.layerManager.getLayer('measurements');
      if (measurementLayer && !measurementLayer.isVisible()) {
        return; // Don't render if layer is hidden
      }
    }

    const measurements = this.manager.getAllMeasurements();
    for (const measurement of measurements) {
      const group = this.renderMeasurement(measurement, zoom);
      if (group) {
        this.measurementGroup.appendChild(group);
      }
    }
  }

  private renderMeasurement(measurement: any, zoom: number): SVGGElement | null {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-measurement-id', measurement.id);
    group.style.cursor = 'pointer';

    // Add hover effect
    group.addEventListener('mouseenter', () => {
      group.setAttribute('opacity', '0.7');
    });
    group.addEventListener('mouseleave', () => {
      group.setAttribute('opacity', '1.0');
    });

    // Add click handler to delete measurement
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.manager.removeMeasurement(measurement.id);
      console.log(`Measurement deleted: ${measurement.getFormattedValue()}`);
    });

    switch (measurement.type) {
      case MeasurementType.DISTANCE:
        this.renderDistance(group, measurement, zoom);
        break;
      case MeasurementType.PATH:
        this.renderPath(group, measurement, zoom);
        break;
      case MeasurementType.AREA:
        this.renderArea(group, measurement, zoom);
        break;
    }

    return group;
  }

  private renderDistance(group: SVGGElement, measurement: any, zoom: number): void {
    if (measurement.points.length < 2) return;

    const [p1, p2] = measurement.points;

    // Line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1.x.toString());
    line.setAttribute('y1', p1.y.toString());
    line.setAttribute('x2', p2.x.toString());
    line.setAttribute('y2', p2.y.toString());
    line.setAttribute('stroke', '#ff6600');
    line.setAttribute('stroke-width', (2 / zoom).toString());
    line.setAttribute('stroke-dasharray', `${10 / zoom} ${5 / zoom}`);
    group.appendChild(line);

    // Endpoints
    [p1, p2].forEach(point => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x.toString());
      circle.setAttribute('cy', point.y.toString());
      circle.setAttribute('r', (4 / zoom).toString());
      circle.setAttribute('fill', '#ff6600');
      group.appendChild(circle);
    });

    // Label
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    this.renderLabel(group, midX, midY, measurement.getFormattedValue(), zoom);
  }

  private renderPath(group: SVGGElement, measurement: any, zoom: number): void {
    if (measurement.points.length < 2) return;

    // Draw segments
    for (let i = 0; i < measurement.points.length - 1; i++) {
      const p1 = measurement.points[i];
      const p2 = measurement.points[i + 1];

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p1.x.toString());
      line.setAttribute('y1', p1.y.toString());
      line.setAttribute('x2', p2.x.toString());
      line.setAttribute('y2', p2.y.toString());
      line.setAttribute('stroke', '#ff6600');
      line.setAttribute('stroke-width', (2 / zoom).toString());
      line.setAttribute('stroke-dasharray', `${10 / zoom} ${5 / zoom}`);
      group.appendChild(line);
    }

    // Points
    measurement.points.forEach((point: any) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x.toString());
      circle.setAttribute('cy', point.y.toString());
      circle.setAttribute('r', (4 / zoom).toString());
      circle.setAttribute('fill', '#ff6600');
      group.appendChild(circle);
    });

    // Label at last point
    const lastPoint = measurement.points[measurement.points.length - 1];
    this.renderLabel(group, lastPoint.x, lastPoint.y - 20 / zoom, measurement.getFormattedValue(), zoom);
  }

  private renderArea(group: SVGGElement, measurement: any, zoom: number): void {
    if (measurement.points.length < 3) return;

    // Polygon
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const pointsStr = measurement.points.map((p: any) => `${p.x},${p.y}`).join(' ');
    polygon.setAttribute('points', pointsStr);
    polygon.setAttribute('fill', '#ff6600');
    polygon.setAttribute('fill-opacity', '0.2');
    polygon.setAttribute('stroke', '#ff6600');
    polygon.setAttribute('stroke-width', (2 / zoom).toString());
    polygon.setAttribute('stroke-dasharray', `${10 / zoom} ${5 / zoom}`);
    group.appendChild(polygon);

    // Vertices
    measurement.points.forEach((point: any) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x.toString());
      circle.setAttribute('cy', point.y.toString());
      circle.setAttribute('r', (4 / zoom).toString());
      circle.setAttribute('fill', '#ff6600');
      group.appendChild(circle);
    });

    // Label at centroid
    const centroid = this.calculateCentroid(measurement.points);
    this.renderLabel(group, centroid.x, centroid.y, measurement.getFormattedValue(), zoom);
  }

  private renderLabel(group: SVGGElement, x: number, y: number, text: string, zoom: number): void {
    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const padding = 4 / zoom;
    const textWidth = text.length * 7 / zoom; // Approximate
    const textHeight = 14 / zoom;
    
    bg.setAttribute('x', (x - textWidth / 2 - padding).toString());
    bg.setAttribute('y', (y - textHeight / 2 - padding).toString());
    bg.setAttribute('width', (textWidth + padding * 2).toString());
    bg.setAttribute('height', (textHeight + padding * 2).toString());
    bg.setAttribute('fill', 'white');
    bg.setAttribute('stroke', '#ff6600');
    bg.setAttribute('stroke-width', (1 / zoom).toString());
    bg.setAttribute('rx', (2 / zoom).toString());
    group.appendChild(bg);

    // Text
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', x.toString());
    textEl.setAttribute('y', y.toString());
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'middle');
    textEl.setAttribute('fill', '#ff6600');
    textEl.setAttribute('font-size', (12 / zoom).toString());
    textEl.setAttribute('font-weight', 'bold');
    textEl.setAttribute('font-family', 'monospace');
    textEl.textContent = text;
    group.appendChild(textEl);
  }

  private calculateCentroid(points: Point[]): Point {
    let sumX = 0, sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / points.length, y: sumY / points.length };
  }
}
