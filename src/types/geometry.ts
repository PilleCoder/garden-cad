export interface Point {
  x: number; // centimeters
  y: number; // centimeters
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
  rotation: number; // degrees, 0 = north-up
}
