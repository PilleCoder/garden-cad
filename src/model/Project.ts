import { GeometryObject } from '../geometry/GeometryObject';

export class Project {
  readonly schemaVersion: string = '1.0';
  readonly units: string = 'cm';
  private objects: Map<string, GeometryObject> = new Map();
  private layerIds: Set<string> = new Set(['default']);

  constructor() {
    // Initialize with default layer
  }

  // Object management
  addObject(obj: GeometryObject): void {
    this.objects.set(obj.id, obj);
    this.layerIds.add(obj.layerId);
  }

  removeObject(id: string): void {
    this.objects.delete(id);
  }

  getObject(id: string): GeometryObject | undefined {
    return this.objects.get(id);
  }

  getAllObjects(): GeometryObject[] {
    return Array.from(this.objects.values());
  }

  getObjectsByLayer(layerId: string): GeometryObject[] {
    return this.getAllObjects().filter(obj => obj.layerId === layerId);
  }

  // Layer management (simplified for single-layer slice)
  getLayers(): string[] {
    return Array.from(this.layerIds);
  }

  hasLayer(layerId: string): boolean {
    return this.layerIds.has(layerId);
  }
}
