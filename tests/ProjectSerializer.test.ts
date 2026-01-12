import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectSerializer, ProjectJSON } from '../src/persistence/ProjectSerializer';
import { Project } from '../src/model/Project';
import { LayerManager } from '../src/model/LayerManager';
import { MeasurementManager } from '../src/measurement/MeasurementManager';
import { GeometryObject } from '../src/geometry/GeometryObject';
import { GeometryType } from '../src/geometry/types';
import { MeasurementType } from '../src/measurement/Measurement';

describe('ProjectSerializer', () => {
  let project: Project;
  let layerManager: LayerManager;
  let measurementManager: MeasurementManager;

  beforeEach(() => {
    project = new Project();
    layerManager = new LayerManager();
    measurementManager = new MeasurementManager();
  });

  it('should serialize an empty project', () => {
    const json = ProjectSerializer.serialize(
      'test-project',
      'Test Project',
      project,
      layerManager,
      measurementManager
    );

    expect(json.schemaVersion).toBe('1.0');
    expect(json.projectId).toBe('test-project');
    expect(json.metadata.name).toBe('Test Project');
    expect(json.units).toBe('cm');
    expect(Array.isArray(json.layers)).toBe(true);
    expect(Array.isArray(json.objects)).toBe(true);
    expect(Array.isArray(json.measurements)).toBe(true);
  });

  it('should serialize and deserialize objects', () => {
    // Add test objects
    const point = new GeometryObject(
      'point-1',
      'default',
      { type: GeometryType.POINT, position: { x: 100, y: 200 } },
      { stroke: '#ff0000' }
    );
    
    const line = new GeometryObject(
      'line-1',
      'default',
      { type: GeometryType.LINE, start: { x: 0, y: 0 }, end: { x: 100, y: 100 } },
      { stroke: '#00ff00' }
    );

    project.addObject(point);
    project.addObject(line);

    // Serialize
    const json = ProjectSerializer.serialize(
      'test-project',
      'Test Project',
      project,
      layerManager,
      measurementManager
    );

    expect(json.objects.length).toBe(2);

    // Deserialize into new project
    const newProject = new Project();
    const newLayerManager = new LayerManager();
    const newMeasurementManager = new MeasurementManager();

    ProjectSerializer.deserialize(
      json,
      newProject,
      newLayerManager,
      newMeasurementManager
    );

    const objects = newProject.getAllObjects();
    expect(objects.length).toBe(2);
    expect(objects[0].id).toBe('point-1');
    expect(objects[0].geometry.type).toBe(GeometryType.POINT);
    expect(objects[1].id).toBe('line-1');
    expect(objects[1].geometry.type).toBe(GeometryType.LINE);
  });

  it('should serialize and deserialize layers', () => {
    // Add custom layer
    layerManager.addLayer('custom-layer', 'Custom Layer');
    layerManager.updateLayer('custom-layer', {
      visible: false,
      locked: true,
      opacity: 0.5
    });

    // Serialize
    const json = ProjectSerializer.serialize(
      'test-project',
      'Test Project',
      project,
      layerManager,
      measurementManager
    );

    expect(json.layers.length).toBeGreaterThan(0);
    const customLayer = json.layers.find((l: any) => l.id === 'custom-layer');
    expect(customLayer).toBeDefined();
    expect(customLayer?.visible).toBe(false);
    expect(customLayer?.locked).toBe(true);
    expect(customLayer?.opacity).toBe(0.5);

    // Deserialize
    const newProject = new Project();
    const newLayerManager = new LayerManager();
    const newMeasurementManager = new MeasurementManager();

    ProjectSerializer.deserialize(
      json,
      newProject,
      newLayerManager,
      newMeasurementManager
    );

    const layer = newLayerManager.getLayer('custom-layer');
    expect(layer).toBeDefined();
    expect(layer?.isVisible()).toBe(false);
    expect(layer?.isLocked()).toBe(true);
    expect(layer?.getOpacity()).toBe(0.5);
  });

  it('should serialize and deserialize measurements', () => {
    // Add measurements
    measurementManager.addMeasurement(
      MeasurementType.DISTANCE,
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      100
    );

    measurementManager.addMeasurement(
      MeasurementType.AREA,
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
      10000
    );

    // Serialize
    const json = ProjectSerializer.serialize(
      'test-project',
      'Test Project',
      project,
      layerManager,
      measurementManager
    );

    expect(json.measurements?.length).toBe(2);

    // Deserialize
    const newProject = new Project();
    const newLayerManager = new LayerManager();
    const newMeasurementManager = new MeasurementManager();

    ProjectSerializer.deserialize(
      json,
      newProject,
      newLayerManager,
      newMeasurementManager
    );

    const measurements = newMeasurementManager.getAllMeasurements();
    expect(measurements.length).toBe(2);
    expect(measurements[0].type).toBe(MeasurementType.DISTANCE);
    expect(measurements[1].type).toBe(MeasurementType.AREA);
  });

  it('should validate project JSON structure', () => {
    const validJson = {
      schemaVersion: '1.0',
      projectId: 'test',
      metadata: { name: 'Test', created: '', modified: '' },
      units: 'cm',
      layers: [],
      objects: [],
      measurements: []
    };

    expect(ProjectSerializer.validate(validJson)).toBe(true);

    // Missing schemaVersion
    expect(ProjectSerializer.validate({ ...validJson, schemaVersion: undefined })).toBe(false);

    // Missing projectId
    expect(ProjectSerializer.validate({ ...validJson, projectId: undefined })).toBe(false);

    // Missing metadata
    expect(ProjectSerializer.validate({ ...validJson, metadata: undefined })).toBe(false);

    // Invalid objects (not array)
    expect(ProjectSerializer.validate({ ...validJson, objects: 'invalid' })).toBe(false);
  });

  it('should include metadata timestamps', () => {
    const json = ProjectSerializer.serialize(
      'test-project',
      'Test Project',
      project,
      layerManager,
      measurementManager
    );

    expect(json.metadata.created).toBeDefined();
    expect(json.metadata.modified).toBeDefined();
    expect(new Date(json.metadata.created).getTime()).toBeGreaterThan(0);
    expect(new Date(json.metadata.modified).getTime()).toBeGreaterThan(0);
  });

  it('should handle project with custom metadata', () => {
    const customMetadata = {
      created: '2026-01-01T00:00:00Z',
      description: 'My garden plan'
    };

    const json = ProjectSerializer.serialize(
      'test-project',
      'Test Project',
      project,
      layerManager,
      measurementManager,
      customMetadata
    );

    expect(json.metadata.created).toBe('2026-01-01T00:00:00Z');
    expect(json.metadata.description).toBe('My garden plan');
  });
});
