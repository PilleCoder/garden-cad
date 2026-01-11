export interface Point {
  x: number; // centimeters
  y: number; // centimeters
}

export enum GeometryType {
  POINT = 'point',
  LINE = 'line',
  CIRCLE = 'circle',
  POLYLINE = 'polyline',
  POLYGON = 'polygon',
  SPLINE = 'spline'
}

// Base geometry definition
export interface GeometryData {
  type: GeometryType;
}

export interface PointGeometry extends GeometryData {
  type: GeometryType.POINT;
  position: Point;
}

export interface LineGeometry extends GeometryData {
  type: GeometryType.LINE;
  start: Point;
  end: Point;
}

export interface CircleGeometry extends GeometryData {
  type: GeometryType.CIRCLE;
  center: Point;
  radius: number; // centimeters
}

export type Geometry = PointGeometry | LineGeometry | CircleGeometry;

// Style information
export interface Style {
  stroke?: string;
  strokeWidth?: number; // in cm
  fill?: string;
  opacity?: number;
}

// Object metadata
export interface ObjectMetadata {
  name?: string;
  category?: string;
  notes?: string;
  [key: string]: any;
}
