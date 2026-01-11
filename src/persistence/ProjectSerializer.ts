import { Project } from '../model/Project';
import { LayerManager } from '../model/LayerManager';
import { MeasurementManager } from '../measurement/MeasurementManager';
import { GeometryObject } from '../geometry/GeometryObject';

/**
 * Project JSON format
 */
export interface ProjectJSON {
  schemaVersion: string;
  projectId: string;
  metadata: {
    name: string;
    created: string;
    modified: string;
    description?: string;
  };
  units: string;
  layers: any[];
  objects: any[];
  measurements?: any[];
}

/**
 * Handles serialization and deserialization of projects to/from JSON
 */
export class ProjectSerializer {
  private static CURRENT_VERSION = '1.0';

  /**
   * Serialize project to JSON format
   */
  static serialize(
    projectId: string,
    projectName: string,
    project: Project,
    layerManager: LayerManager,
    measurementManager?: MeasurementManager,
    metadata?: any
  ): ProjectJSON {
    const now = new Date().toISOString();
    
    return {
      schemaVersion: this.CURRENT_VERSION,
      projectId,
      metadata: {
        name: projectName,
        created: metadata?.created || now,
        modified: now,
        description: metadata?.description
      },
      units: 'cm',
      layers: layerManager.getAllLayers().map(layer => ({
        id: layer.id,
        name: layer.getName(),
        visible: layer.isVisible(),
        locked: layer.isLocked(),
        opacity: layer.getOpacity(),
        order: layer.getOrder()
      })),
      objects: project.getAllObjects().map(obj => ({
        id: obj.id,
        layerId: obj.layerId,
        type: obj.geometry.type,
        geometry: obj.geometry,
        style: obj.style,
        metadata: obj.metadata
      })),
      measurements: measurementManager?.getAllMeasurements().map(m => m.getData()) || []
    };
  }

  /**
   * Deserialize project from JSON format
   */
  static deserialize(
    json: ProjectJSON,
    project: Project,
    layerManager: LayerManager,
    measurementManager?: MeasurementManager
  ): void {
    // Version check and migration
    const version = json.schemaVersion || '1.0';
    let data = json;
    
    if (version !== this.CURRENT_VERSION) {
      console.warn(`Loading project version ${version}, current version is ${this.CURRENT_VERSION}`);
      data = this.migrate(json, version, this.CURRENT_VERSION);
    }

    // Clear existing data
    const objectsToRemove = project.getAllObjects();
    objectsToRemove.forEach(obj => project.removeObject(obj.id));
    
    // Restore layers (if present, otherwise use defaults)
    if (data.layers && data.layers.length > 0) {
      // Get existing layers and try to match them up with saved layers
      const existingLayers = layerManager.getAllLayers();
      const savedLayerIds = new Set(data.layers.map((l: any) => l.id));
      
      // Remove layers that don't exist in saved data
      existingLayers.forEach(layer => {
        if (!savedLayerIds.has(layer.id)) {
          try {
            layerManager.removeLayer(layer.id);
          } catch (e) {
            // Can't remove default layer
          }
        }
      });

      // Add or update layers from saved data
      data.layers.forEach((layerData: any) => {
        const existingLayer = layerManager.getLayer(layerData.id);
        
        if (!existingLayer) {
          // Layer doesn't exist, create it
          try {
            layerManager.addLayer(layerData.id, layerData.name);
          } catch (e) {
            console.warn(`Could not create layer ${layerData.id}:`, e);
          }
        }
        
        // Update layer properties
        try {
          layerManager.updateLayer(layerData.id, {
            name: layerData.name,
            visible: layerData.visible !== false,
            locked: layerData.locked === true,
            opacity: layerData.opacity ?? 1.0
          });
        } catch (e) {
          console.warn(`Could not update layer ${layerData.id}:`, e);
        }
      });

      // Set active layer
      if (data.layers.length > 0) {
        const firstVisibleLayer = data.layers.find((l: any) => l.visible !== false);
        if (firstVisibleLayer) {
          layerManager.setActiveLayer(firstVisibleLayer.id);
        }
      }
    }

    // Restore objects
    data.objects.forEach((objData: any) => {
      const obj = new GeometryObject(
        objData.id,
        objData.layerId || 'default',
        objData.geometry,
        objData.style || {},
        objData.metadata || {}
      );
      project.addObject(obj);
    });

    // Restore measurements
    if (measurementManager && data.measurements) {
      measurementManager.clearAll();
      data.measurements.forEach((measData: any) => {
        measurementManager.addMeasurement(
          measData.type as any,
          measData.points,
          measData.value
        );
      });
    }

    console.log(`Loaded project: ${data.metadata.name}`);
    console.log(`  - ${data.objects.length} objects`);
    console.log(`  - ${data.layers.length} layers`);
    console.log(`  - ${data.measurements?.length || 0} measurements`);
  }

  /**
   * Migrate project data between versions
   */
  private static migrate(data: ProjectJSON, fromVersion: string, toVersion: string): ProjectJSON {
    console.log(`Migrating project from version ${fromVersion} to ${toVersion}`);
    
    // Version-specific migrations
    let migrated = { ...data };
    
    // Example: if migrating from 0.9 to 1.0, add default fields
    if (fromVersion < '1.0') {
      migrated.measurements = migrated.measurements || [];
      migrated.layers = migrated.layers || [];
    }

    migrated.schemaVersion = toVersion;
    return migrated;
  }

  /**
   * Validate project JSON structure
   */
  static validate(json: any): boolean {
    if (!json.schemaVersion) return false;
    if (!json.projectId) return false;
    if (!json.metadata) return false;
    if (!Array.isArray(json.objects)) return false;
    return true;
  }
}
