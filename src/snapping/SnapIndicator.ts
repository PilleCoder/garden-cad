import { SnapResult } from './SnapManager';

export class SnapIndicator {
  private indicatorGroup: SVGGElement;
  private currentIndicator: SVGElement | null = null;

  constructor(worldGroup: SVGGElement) {
    this.indicatorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.indicatorGroup.id = 'snap-indicator';
    worldGroup.appendChild(this.indicatorGroup);
  }

  // Show snap indicator at position
  show(snapResult: SnapResult, zoom: number): void {
    this.clear();

    if (!snapResult.snapped) {
      return;
    }

    // Create crosshair indicator
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const size = 8 / zoom; // 8px in screen space

    // Horizontal line
    const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hLine.setAttribute('x1', (snapResult.point.x - size).toString());
    hLine.setAttribute('y1', snapResult.point.y.toString());
    hLine.setAttribute('x2', (snapResult.point.x + size).toString());
    hLine.setAttribute('y2', snapResult.point.y.toString());
    hLine.setAttribute('stroke', '#ff6600');
    hLine.setAttribute('stroke-width', (2 / zoom).toString());
    group.appendChild(hLine);

    // Vertical line
    const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    vLine.setAttribute('x1', snapResult.point.x.toString());
    vLine.setAttribute('y1', (snapResult.point.y - size).toString());
    vLine.setAttribute('x2', snapResult.point.x.toString());
    vLine.setAttribute('y2', (snapResult.point.y + size).toString());
    vLine.setAttribute('stroke', '#ff6600');
    vLine.setAttribute('stroke-width', (2 / zoom).toString());
    group.appendChild(vLine);

    // Center circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', snapResult.point.x.toString());
    circle.setAttribute('cy', snapResult.point.y.toString());
    circle.setAttribute('r', (3 / zoom).toString());
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', '#ff6600');
    circle.setAttribute('stroke-width', (2 / zoom).toString());
    group.appendChild(circle);

    this.currentIndicator = group;
    this.indicatorGroup.appendChild(group);
  }

  clear(): void {
    if (this.currentIndicator) {
      this.indicatorGroup.removeChild(this.currentIndicator);
      this.currentIndicator = null;
    }
  }

  hide(): void {
    this.clear();
  }
}
