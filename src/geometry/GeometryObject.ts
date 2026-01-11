import { Geometry, Style, ObjectMetadata } from './types';

export class GeometryObject {
  readonly id: string;
  readonly layerId: string;
  readonly geometry: Geometry;
  readonly style: Style;
  readonly metadata: ObjectMetadata;

  constructor(
    id: string,
    layerId: string,
    geometry: Geometry,
    style: Style = {},
    metadata: ObjectMetadata = {}
  ) {
    this.id = id;
    this.layerId = layerId;
    this.geometry = geometry;
    this.style = {
      stroke: style.stroke || '#000000',
      strokeWidth: style.strokeWidth || 2,
      fill: style.fill || 'none',
      opacity: style.opacity || 1.0
    };
    this.metadata = metadata;
  }

  // Clone with modifications
  clone(overrides: Partial<GeometryObject> = {}): GeometryObject {
    return new GeometryObject(
      overrides.id || this.id,
      overrides.layerId || this.layerId,
      overrides.geometry || this.geometry,
      overrides.style || this.style,
      overrides.metadata || this.metadata
    );
  }
}
