import { Point } from '../types/geometry';

export enum MeasurementType {
  DISTANCE = 'distance',
  PATH = 'path',
  AREA = 'area'
}

export interface MeasurementData {
  id: string;
  type: MeasurementType;
  points: Point[];
  value: number; // cm or cm²
  timestamp: number;
}

export class Measurement {
  readonly id: string;
  readonly type: MeasurementType;
  readonly points: Point[];
  readonly value: number;
  readonly timestamp: number;

  constructor(id: string, type: MeasurementType, points: Point[], value: number) {
    this.id = id;
    this.type = type;
    this.points = [...points];
    this.value = value;
    this.timestamp = Date.now();
  }

  // Format value for display
  getFormattedValue(): string {
    switch (this.type) {
      case MeasurementType.DISTANCE:
      case MeasurementType.PATH:
        return this.formatDistance(this.value);
      case MeasurementType.AREA:
        return this.formatArea(this.value);
      default:
        return this.value.toFixed(1);
    }
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
      return `${cm2.toFixed(0)} cm²`;
    } else {
      return `${(cm2 / 10000).toFixed(2)} m²`;
    }
  }

  getData(): MeasurementData {
    return {
      id: this.id,
      type: this.type,
      points: [...this.points],
      value: this.value,
      timestamp: this.timestamp
    };
  }
}
