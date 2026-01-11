import { Measurement, MeasurementType } from './Measurement';
import { Point } from '../types/geometry';

export type MeasurementChangeListener = () => void;

export class MeasurementManager {
  private measurements: Map<string, Measurement> = new Map();
  private listeners: MeasurementChangeListener[] = [];

  addMeasurement(type: MeasurementType, points: Point[], value: number): Measurement {
    const id = `meas-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const measurement = new Measurement(id, type, points, value);
    this.measurements.set(id, measurement);
    this.notifyListeners();
    return measurement;
  }

  removeMeasurement(id: string): boolean {
    const removed = this.measurements.delete(id);
    if (removed) {
      this.notifyListeners();
    }
    return removed;
  }

  clearAll(): void {
    this.measurements.clear();
    this.notifyListeners();
  }

  getMeasurement(id: string): Measurement | undefined {
    return this.measurements.get(id);
  }

  getAllMeasurements(): Measurement[] {
    return Array.from(this.measurements.values());
  }

  onChange(listener: MeasurementChangeListener): void {
    this.listeners.push(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
