import { Point } from '../types/geometry';

export enum SnapMode {
  NONE = 'none',
  GRID = 'grid'
}

export interface SnapResult {
  point: Point;
  snapped: boolean;
  snapType?: SnapMode;
}

export class SnapManager {
  private enabled: boolean = true;
  private gridSpacing: number = 100; // cm
  private mode: SnapMode = SnapMode.GRID;
  private listeners: Array<() => void> = [];

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.notifyListeners();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setGridSpacing(spacing: number): void {
    this.gridSpacing = spacing;
    this.notifyListeners();
  }

  getGridSpacing(): number {
    return this.gridSpacing;
  }

  setMode(mode: SnapMode): void {
    this.mode = mode;
    this.notifyListeners();
  }

  getMode(): SnapMode {
    return this.mode;
  }

  // Snap a point according to current settings
  snap(point: Point): SnapResult {
    if (!this.enabled) {
      return { point, snapped: false };
    }

    switch (this.mode) {
      case SnapMode.GRID:
        return this.snapToGrid(point);
      default:
        return { point, snapped: false };
    }
  }

  private snapToGrid(point: Point): SnapResult {
    const snappedX = Math.round(point.x / this.gridSpacing) * this.gridSpacing;
    const snappedY = Math.round(point.y / this.gridSpacing) * this.gridSpacing;

    const snapped = snappedX !== point.x || snappedY !== point.y;

    return {
      point: { x: snappedX, y: snappedY },
      snapped,
      snapType: SnapMode.GRID
    };
  }

  // Listen to snap setting changes
  onChange(listener: () => void): void {
    this.listeners.push(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // Toggle snap on/off
  toggle(): boolean {
    this.enabled = !this.enabled;
    this.notifyListeners();
    return this.enabled;
  }
}
