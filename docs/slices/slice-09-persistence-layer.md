# Slice 9: Persistence Layer

## User Value

As a user, I need to save my garden plan and reload it later so that I can work on my design over time, back up my work, and ensure my planning data is never lost.

## Slice Features

1. **JSON serialization** - Export entire project to JSON format
2. **IndexedDB storage** - Browser-based local storage for offline use
3. **Auto-save** - Automatic periodic saving to IndexedDB
4. **Manual save** - Save button to persist current state
5. **Load from storage** - Restore saved project on application start
6. **Export to file** - Download project as .json file
7. **Import from file** - Load project from uploaded .json file
8. **Schema versioning** - Forward-compatible project format
9. **Save indicator** - Visual feedback showing save status
10. **Multiple project slots** - Save and load different garden plans

## Technical Implementation Sketch

### File Structure

```
src/
├── persistence/
│   ├── ProjectSerializer.ts   # JSON serialization/deserialization
│   ├── StorageAdapter.ts      # Abstract storage interface
│   ├── IndexedDBAdapter.ts    # IndexedDB implementation
│   └── FileAdapter.ts         # File import/export
├── ui/
│   └── SaveIndicator.ts       # Save status UI component
└── main.ts                    # Updated with save/load UI
```

### Core Concepts

**Serialization Format**:
```json
{
  "schemaVersion": "1.0",
  "projectId": "garden-main",
  "metadata": {
    "name": "My Garden Plan",
    "created": "2026-01-11T10:00:00Z",
    "modified": "2026-01-11T14:30:00Z"
  },
  "units": "cm",
  "layers": [...],
  "objects": [...],
  "measurements": [...]
}
```

**Storage Strategy**:
- IndexedDB for primary storage (offline-capable)
- Auto-save every 30 seconds when changes detected
- Manual save on demand
- File export/import for backup and sharing

**Version Migration**:
- Each project has schemaVersion field
- Migration functions upgrade older formats
- Graceful degradation for unknown versions

### src/persistence/ProjectSerializer.ts

```typescript
import { Project } from '../model/Project';
import { Layer } from '../model/Layer';
import { LayerManager } from '../model/LayerManager';
import { MeasurementManager } from '../measurement/MeasurementManager';

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

export class ProjectSerializer {
  private static CURRENT_VERSION = '1.0';

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
    project.getAllObjects().forEach(obj => project.removeObject(obj.id));
    
    // Restore layers (if present, otherwise use defaults)
    if (data.layers && data.layers.length > 0) {
      // Clear default layers and create from saved data
      const existingLayers = layerManager.getAllLayers();
      existingLayers.forEach(layer => {
        try {
          layerManager.removeLayer(layer.id);
        } catch (e) {
          // Can't remove default layer, update it instead
        }
      });

      data.layers.forEach((layerData: any) => {
        try {
          const layer = layerManager.addLayer(layerData.id, layerData.name);
          layerManager.updateLayer(layerData.id, {
            visible: layerData.visible !== false,
            locked: layerData.locked === true,
            opacity: layerData.opacity ?? 1.0
          });
        } catch (e) {
          // Layer might already exist, update it
          layerManager.updateLayer(layerData.id, {
            name: layerData.name,
            visible: layerData.visible !== false,
            locked: layerData.locked === true,
            opacity: layerData.opacity ?? 1.0
          });
        }
      });

      // Set active layer
      if (data.layers.length > 0) {
        layerManager.setActiveLayer(data.layers[0].id);
      }
    }

    // Restore objects
    const { GeometryObject } = require('../geometry/GeometryObject');
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
      const { MeasurementType } = require('../measurement/Measurement');
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

  static validate(json: any): boolean {
    if (!json.schemaVersion) return false;
    if (!json.projectId) return false;
    if (!json.metadata) return false;
    if (!Array.isArray(json.objects)) return false;
    return true;
  }
}
```

### src/persistence/StorageAdapter.ts

```typescript
export interface StorageAdapter {
  save(projectId: string, data: any): Promise<void>;
  load(projectId: string): Promise<any | null>;
  list(): Promise<string[]>;
  delete(projectId: string): Promise<void>;
  exists(projectId: string): Promise<boolean>;
}
```

### src/persistence/IndexedDBAdapter.ts

```typescript
import { StorageAdapter } from './StorageAdapter';

export class IndexedDBAdapter implements StorageAdapter {
  private dbName: string = 'GardenCAD';
  private storeName: string = 'projects';
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'projectId' });
        }
      };
    });
  }

  async save(projectId: string, data: any): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const record = {
        projectId,
        data,
        savedAt: new Date().toISOString()
      };

      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async load(projectId: string): Promise<any | null> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(projectId);

      request.onsuccess = () => {
        const record = request.result;
        resolve(record ? record.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async list(): Promise<string[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(projectId: string): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(projectId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async exists(projectId: string): Promise<boolean> {
    const data = await this.load(projectId);
    return data !== null;
  }
}
```

### src/persistence/FileAdapter.ts

```typescript
export class FileAdapter {
  static exportToFile(data: any, filename: string): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static importFromFile(): Promise<any> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const json = JSON.parse(event.target?.result as string);
            resolve(json);
          } catch (error) {
            reject(new Error('Invalid JSON file'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      };

      input.click();
    });
  }
}
```

### src/ui/SaveIndicator.ts

```typescript
export class SaveIndicator {
  private element: HTMLElement;
  private timeoutId: number | null = null;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'save-indicator';
    this.element.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      padding: 8px 16px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      font-size: 13px;
      font-family: system-ui, sans-serif;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      z-index: 1000;
    `;
    container.appendChild(this.element);
  }

  showSaving(): void {
    this.show('💾 Saving...', '#0066ff');
  }

  showSaved(): void {
    this.show('✓ Saved', '#22c55e');
    this.autoHide(2000);
  }

  showError(message: string = 'Save failed'): void {
    this.show(`⚠ ${message}`, '#ef4444');
    this.autoHide(3000);
  }

  private show(text: string, color: string): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.element.textContent = text;
    this.element.style.color = color;
    this.element.style.opacity = '1';
  }

  private autoHide(delay: number): void {
    this.timeoutId = window.setTimeout(() => {
      this.element.style.opacity = '0';
      this.timeoutId = null;
    }, delay);
  }
}
```

### src/main.ts (add persistence UI and logic)

```typescript
import { ProjectSerializer } from './persistence/ProjectSerializer';
import { IndexedDBAdapter } from './persistence/IndexedDBAdapter';
import { FileAdapter } from './persistence/FileAdapter';
import { SaveIndicator } from './ui/SaveIndicator';

// Update toolbar with save/load buttons:
<button id="save-btn" title="Save project (Ctrl+S)">💾 Save</button>
<button id="export-btn" title="Export to file">📥 Export</button>
<button id="import-btn" title="Import from file">📤 Import</button>

// Initialize persistence
const storage = new IndexedDBAdapter();
const saveIndicator = new SaveIndicator(document.body);
let currentProjectId = 'garden-main';
let currentProjectName = 'My Garden Plan';
let hasUnsavedChanges = false;
let autoSaveTimer: number | null = null;

// Initialize storage
storage.initialize().then(() => {
  console.log('Storage initialized');
  loadProject();
}).catch(err => {
  console.error('Storage initialization failed:', err);
});

// Mark project as modified (call this after any change)
function markModified(): void {
  hasUnsavedChanges = true;
  
  // Reset auto-save timer
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  
  // Auto-save after 30 seconds of inactivity
  autoSaveTimer = window.setTimeout(() => {
    if (hasUnsavedChanges) {
      saveProject(true);
    }
  }, 30000);
}

// Save project
async function saveProject(isAutoSave: boolean = false): Promise<void> {
  try {
    if (!isAutoSave) {
      saveIndicator.showSaving();
    }

    const projectJSON = ProjectSerializer.serialize(
      currentProjectId,
      currentProjectName,
      project,
      layerManager,
      measurementManager
    );

    await storage.save(currentProjectId, projectJSON);
    
    hasUnsavedChanges = false;
    
    if (isAutoSave) {
      console.log('Auto-saved');
    } else {
      saveIndicator.showSaved();
      console.log('Project saved');
    }
  } catch (error) {
    console.error('Save failed:', error);
    saveIndicator.showError('Save failed');
  }
}

// Load project
async function loadProject(): Promise<void> {
  try {
    const exists = await storage.exists(currentProjectId);
    
    if (!exists) {
      console.log('No saved project found, starting fresh');
      return;
    }

    const projectJSON = await storage.load(currentProjectId);
    
    if (!projectJSON) {
      console.log('No saved project data');
      return;
    }

    if (!ProjectSerializer.validate(projectJSON)) {
      console.error('Invalid project data');
      return;
    }

    ProjectSerializer.deserialize(
      projectJSON,
      project,
      layerManager,
      measurementManager
    );

    currentProjectName = projectJSON.metadata.name;
    hasUnsavedChanges = false;
    viewport.render();
    
    console.log(`Project loaded: ${currentProjectName}`);
  } catch (error) {
    console.error('Load failed:', error);
  }
}

// Export to file
async function exportToFile(): Promise<void> {
  try {
    const projectJSON = ProjectSerializer.serialize(
      currentProjectId,
      currentProjectName,
      project,
      layerManager,
      measurementManager
    );

    const filename = `${currentProjectName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    FileAdapter.exportToFile(projectJSON, filename);
    
    console.log(`Exported to ${filename}`);
  } catch (error) {
    console.error('Export failed:', error);
  }
}

// Import from file
async function importFromFile(): Promise<void> {
  try {
    const projectJSON = await FileAdapter.importFromFile();
    
    if (!ProjectSerializer.validate(projectJSON)) {
      alert('Invalid project file');
      return;
    }

    const confirmImport = confirm(
      `Import project "${projectJSON.metadata.name}"?\nThis will replace your current work.`
    );
    
    if (!confirmImport) return;

    ProjectSerializer.deserialize(
      projectJSON,
      project,
      layerManager,
      measurementManager
    );

    currentProjectId = projectJSON.projectId;
    currentProjectName = projectJSON.metadata.name;
    hasUnsavedChanges = true;
    viewport.render();
    
    console.log(`Imported project: ${currentProjectName}`);
    
    // Save imported project
    await saveProject();
  } catch (error) {
    console.error('Import failed:', error);
    if (error instanceof Error) {
      alert(`Import failed: ${error.message}`);
    }
  }
}

// Wire up save/load buttons
document.getElementById('save-btn')?.addEventListener('click', () => saveProject(false));
document.getElementById('export-btn')?.addEventListener('click', exportToFile);
document.getElementById('import-btn')?.addEventListener('click', importFromFile);

// Keyboard shortcut for save (Ctrl+S)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveProject(false);
  }
});

// Mark as modified when changes occur
// Update all tools to call markModified after creating/editing objects:
const originalOnUpdate = () => {
  viewport.render();
  markModified();
};

// Pass originalOnUpdate instead of () => viewport.render() to all tools

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    return e.returnValue;
  }
});

console.log('Persistence system loaded. Press Ctrl+S to save.');
```

## Test Plan

### Manual Testing Steps

1. **Save button test**
   - Make changes (draw objects)
   - Click "💾 Save" button
   - Verify save indicator shows "💾 Saving..."
   - Verify indicator changes to "✓ Saved"
   - Verify console shows "Project saved"

2. **Auto-save test**
   - Draw several objects
   - Wait 30 seconds without making changes
   - Verify console shows "Auto-saved"
   - No UI notification for auto-save

3. **Load on startup test**
   - Draw objects and save
   - Refresh browser (F5)
   - Verify objects reappear after page load
   - Verify console shows "Project loaded: My Garden Plan"
   - Verify object count matches

4. **Export to file test**
   - Click "📥 Export" button
   - Verify file download dialog appears
   - Verify filename format: `My_Garden_Plan_[timestamp].json`
   - Open downloaded file in text editor
   - Verify JSON structure is valid
   - Verify objects, layers, measurements present

5. **Import from file test**
   - Click "📤 Import" button
   - Select previously exported .json file
   - Verify confirmation dialog appears
   - Click OK
   - Verify project loads from file
   - Verify all objects, layers, measurements restored
   - Verify console shows "Imported project: [name]"

6. **Layer persistence test**
   - Hide a layer (e.g., Vegetation)
   - Lock a layer (e.g., Property)
   - Set layer opacity to 50%
   - Save project
   - Refresh page
   - Verify layer visibility states restored
   - Verify layer lock states restored
   - Verify layer opacity restored

7. **Measurement persistence test**
   - Create distance measurement
   - Create area measurement
   - Save project
   - Refresh page
   - Verify measurements reappear
   - Verify measurement values correct

8. **Schema version test**
   - Export project to file
   - Open file, verify "schemaVersion": "1.0"
   - Manually change version to "0.9"
   - Import modified file
   - Verify warning in console about version mismatch
   - Verify project still loads (migration)

9. **Validation test**
   - Create invalid JSON file (missing required fields)
   - Try to import
   - Verify error message: "Invalid project file"
   - Verify current project unchanged

10. **Keyboard shortcut test**
    - Draw objects
    - Press Ctrl+S (or Cmd+S on Mac)
    - Verify save occurs
    - Verify save indicator appears

11. **Unsaved changes warning test**
    - Draw objects (don't save)
    - Try to close browser tab/window
    - Verify browser shows warning dialog
    - "You have unsaved changes..."
    - Click Stay
    - Save project
    - Try to close tab again
    - Verify no warning (saved)

12. **Multiple save cycles test**
    - Draw objects, save
    - Draw more objects, save
    - Draw more objects, save
    - Refresh page
    - Verify all objects from all saves present
    - Verify no duplicates

13. **IndexedDB inspection test**
    - Open browser DevTools → Application → IndexedDB
    - Verify "GardenCAD" database exists
    - Verify "projects" object store
    - Verify "garden-main" key
    - Inspect saved data structure

14. **Large project test**
    - Create 100+ objects
    - Add multiple measurements
    - Save project
    - Verify save completes without errors
    - Refresh and verify all objects load
    - Check performance (should be fast)

## Acceptance Criteria

- [ ] Save button persists project to IndexedDB
- [ ] Save indicator shows visual feedback (saving → saved)
- [ ] Auto-save triggers after 30 seconds of inactivity
- [ ] Project loads automatically on application start
- [ ] Export button downloads .json file with timestamp
- [ ] Import button loads project from .json file
- [ ] Import shows confirmation dialog before replacing
- [ ] All objects serialize and deserialize correctly
- [ ] All layers serialize with visibility/lock/opacity state
- [ ] Measurements serialize and deserialize correctly
- [ ] Schema version field included in JSON
- [ ] Validation rejects invalid JSON files
- [ ] Ctrl+S keyboard shortcut saves project
- [ ] Browser warns before leaving with unsaved changes
- [ ] Auto-save resets on each modification
- [ ] No data loss after save/load cycle
- [ ] Multiple projects can be stored in IndexedDB
- [ ] Export filename includes project name and timestamp
- [ ] Console logs save/load operations
- [ ] Save indicator auto-hides after 2 seconds
- [ ] No TypeScript compilation errors

## Deliverables

1. **src/persistence/ProjectSerializer.ts** - JSON serialization with versioning
2. **src/persistence/StorageAdapter.ts** - Abstract storage interface
3. **src/persistence/IndexedDBAdapter.ts** - IndexedDB implementation
4. **src/persistence/FileAdapter.ts** - File export/import utilities
5. **src/ui/SaveIndicator.ts** - Save status UI component
6. **Updated src/main.ts** - Persistence integration, auto-save, save/load UI
7. **Working persistence system** - Save, load, export, import with auto-save

---

**Estimated effort**: 3-4 hours  
**Dependencies**: Slices 1-8 (all features to persist)  
**Risk**: Medium - IndexedDB API requires careful error handling, serialization must be complete
