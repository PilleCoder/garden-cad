import { ViewportState } from '../types/geometry';

export class Grid {
  private gridSpacing: number = 100; // 100 cm = 1 meter default

  setSpacing(spacingCm: number): void {
    this.gridSpacing = spacingCm;
  }

  // Generate grid SVG elements based on visible bounds
  render(worldGroup: SVGGElement, viewportState: ViewportState, svgRect: DOMRect): void {
    const existingGrid = worldGroup.querySelector('#grid');
    if (existingGrid) {
      existingGrid.remove();
    }

    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridGroup.id = 'grid';

    // Calculate visible world bounds
    const topLeft = this.screenToWorldSimple(0, 0, viewportState);
    const bottomRight = this.screenToWorldSimple(svgRect.width, svgRect.height, viewportState);

    const minX = Math.floor(topLeft.x / this.gridSpacing) * this.gridSpacing;
    const maxX = Math.ceil(bottomRight.x / this.gridSpacing) * this.gridSpacing;
    const minY = Math.floor(topLeft.y / this.gridSpacing) * this.gridSpacing;
    const maxY = Math.ceil(bottomRight.y / this.gridSpacing) * this.gridSpacing;

    // Vertical lines
    for (let x = minX; x <= maxX; x += this.gridSpacing) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x.toString());
      line.setAttribute('y1', minY.toString());
      line.setAttribute('x2', x.toString());
      line.setAttribute('y2', maxY.toString());
      line.setAttribute('stroke', '#ddd');
      line.setAttribute('stroke-width', (1 / viewportState.zoom).toString());
      gridGroup.appendChild(line);
    }

    // Horizontal lines
    for (let y = minY; y <= maxY; y += this.gridSpacing) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', minX.toString());
      line.setAttribute('y1', y.toString());
      line.setAttribute('x2', maxX.toString());
      line.setAttribute('y2', y.toString());
      line.setAttribute('stroke', '#ddd');
      line.setAttribute('stroke-width', (1 / viewportState.zoom).toString());
      gridGroup.appendChild(line);
    }

    worldGroup.appendChild(gridGroup);
  }

  private screenToWorldSimple(screenX: number, screenY: number, state: ViewportState) {
    return {
      x: (screenX - state.panX) / state.zoom,
      y: (screenY - state.panY) / state.zoom
    };
  }
}
