import { Point, ViewportState } from '../types/geometry';

export class ViewportTransform {
  private state: ViewportState;

  constructor() {
    this.state = { panX: 0, panY: 0, zoom: 1.0, rotation: 0 };
  }

  // Convert screen pixel coordinates to world coordinates (cm)
  screenToWorld(screenX: number, screenY: number): Point {
    return {
      x: (screenX - this.state.panX) / this.state.zoom,
      y: (screenY - this.state.panY) / this.state.zoom
    };
  }

  // Convert world coordinates (cm) to screen pixels
  worldToScreen(worldX: number, worldY: number): Point {
    return {
      x: worldX * this.state.zoom + this.state.panX,
      y: worldY * this.state.zoom + this.state.panY
    };
  }

  // Apply pan offset
  pan(deltaX: number, deltaY: number): void {
    this.state.panX += deltaX;
    this.state.panY += deltaY;
  }

  // Apply zoom centered on a screen point
  zoomAt(screenX: number, screenY: number, zoomDelta: number): void {
    const worldBefore = this.screenToWorld(screenX, screenY);
    this.state.zoom *= zoomDelta;
    this.state.zoom = Math.max(0.1, Math.min(100, this.state.zoom));
    const worldAfter = this.screenToWorld(screenX, screenY);
    
    // Adjust pan to keep world point under cursor
    this.state.panX += (worldAfter.x - worldBefore.x) * this.state.zoom;
    this.state.panY += (worldAfter.y - worldBefore.y) * this.state.zoom;
  }

  // Reset to origin
  reset(): void {
    this.state = { panX: 0, panY: 0, zoom: 1.0, rotation: 0 };
  }

  // Get current state for rendering
  getState(): ViewportState {
    return { ...this.state };
  }

  // Get SVG transform string
  toSVGTransform(): string {
    return `translate(${this.state.panX}, ${this.state.panY}) scale(${this.state.zoom})`;
  }
}
