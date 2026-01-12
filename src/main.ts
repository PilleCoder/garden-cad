import { Viewport } from './viewport/Viewport';
import { Project } from './model/Project';
import { GeometryObject } from './geometry/GeometryObject';
import { GeometryType } from './geometry/types';
import { SelectTool } from './tools/SelectTool';
import { PointTool } from './tools/PointTool';
import { LineTool } from './tools/LineTool';
import { CircleTool } from './tools/CircleTool';
import { MeasureTool } from './tools/MeasureTool';
import { AreaTool } from './tools/AreaTool';
import { LayerManager } from './model/LayerManager';
import { LayerPanel } from './ui/LayerPanel';
import { MeasurementManager } from './measurement/MeasurementManager';
import { MeasurementRenderer } from './measurement/MeasurementRenderer';
import { ProjectSerializer } from './persistence/ProjectSerializer';
import { IndexedDBAdapter } from './persistence/IndexedDBAdapter';
import { FileAdapter } from './persistence/FileAdapter';
import { SaveIndicator } from './ui/SaveIndicator';
import { ContextMenu } from './ui/ContextMenu';

console.log('GardenCAD v0.9 - Persistence Layer');

const app = document.getElementById('app');
if (!app) {
  throw new Error('App container not found');
}

// Create UI structure
app.innerHTML = `
  <div style="display: flex; flex-direction: column; width: 100%; height: 100vh;">
    <div style="padding: 10px; background: #333; color: white; display: flex; gap: 10px; align-items: center;">
      <h1 style="margin: 0; font-size: 18px;">GardenCAD</h1>
      <div style="display: flex; gap: 5px; margin-left: 20px;" id="toolbar">
        <button id="tool-select" class="tool-btn active">Select</button>
        <button id="tool-point" class="tool-btn">Point</button>
        <button id="tool-line" class="tool-btn">Line</button>
        <button id="tool-circle" class="tool-btn">Circle</button>
        <button id="tool-measure" class="tool-btn">Measure</button>
        <button id="tool-area" class="tool-btn">Area</button>
      </div>
      <div style="display: flex; gap: 10px; align-items: center; margin-left: 20px; border-left: 1px solid #555; padding-left: 20px;">
        <label style="font-size: 13px;">Grid:</label>
        <select id="grid-spacing" style="padding: 4px 8px; background: #444; color: white; border: 1px solid #555; border-radius: 4px;">
          <option value="1">1 cm</option>
          <option value="5">5 cm</option>
          <option value="10" selected>10 cm</option>
          <option value="50">50 cm</option>
          <option value="100">100 cm</option>
        </select>
        <button id="snap-toggle" class="snap-btn active" title="Toggle snap (G)">
          <span id="snap-icon">🧲</span> Snap
        </button>
      </div>
      <div style="display: flex; gap: 5px; align-items: center; margin-left: 20px; border-left: 1px solid #555; padding-left: 20px;">
        <button id="save-btn" title="Save project (Ctrl+S)">💾 Save</button>
        <button id="export-btn" title="Export to file">📥 Export</button>
        <button id="import-btn" title="Import from file">📤 Import</button>
      </div>
      <button id="clear-measurements" style="margin-left: 10px;">Clear Measurements</button>
      <button id="reset-view" style="margin-left: auto;">Reset View</button>
    </div>
    <div style="display: flex; flex: 1; overflow: hidden;">
      <div id="layer-panel" style="width: 250px; background: white; border-right: 1px solid #ccc; overflow-y: auto;">
      </div>
      <div id="viewport-container" style="flex: 1; position: relative;"></div>
    </div>
    <div style="padding: 8px; background: #f0f0f0; font-size: 12px; font-family: monospace; display: flex; justify-content: space-between;" id="status-bar">
      <span id="status-text">Select tool active - click to select, drag to move</span>
      <span id="snap-status" style="color: #0066ff; font-weight: bold;">SNAP: ON (10 cm)</span>
    </div>
  </div>
`;

// Add CSS for tool buttons
const style = document.createElement('style');
style.textContent = `
  .tool-btn {
    padding: 6px 12px;
    border: 1px solid #555;
    background: #444;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }
  .tool-btn:hover {
    background: #555;
  }
  .tool-btn.active {
    background: #0066ff;
    border-color: #0066ff;
  }
  .snap-btn {
    padding: 6px 12px;
    border: 1px solid #555;
    background: #444;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .snap-btn:hover {
    background: #555;
  }
  .snap-btn.active {
    background: #228B22;
    border-color: #228B22;
  }
`;
document.head.appendChild(style);

const container = document.getElementById('viewport-container');
if (!container) {
  throw new Error('Viewport container not found');
}

// Create project (test geometry will be added after checking for saved data)
const project = new Project();

// Initialize viewport
const viewport = new Viewport(container);
viewport.setProject(project);

// Initialize layer system
const layerManager = new LayerManager();

// Forward declaration for persistence (will be defined later)
let markModified: () => void;

// Set layer manager on renderer
const renderer = viewport.getRenderer();
if (renderer) {
  renderer.setLayerManager(layerManager);
}

// Initialize layer panel
const layerPanelContainer = document.getElementById('layer-panel');
if (layerPanelContainer) {
  new LayerPanel(layerPanelContainer, layerManager, () => {
    viewport.render();
    markModified();
  });
}

// Get snap manager and indicator
const snapManager = viewport.getSnapManager();
const snapIndicator = viewport.getSnapIndicator()!;

// Create context menu
const contextMenu = new ContextMenu(document.body);

// Initialize measurement system
const measurementManager = new MeasurementManager();
const measurementRenderer = new MeasurementRenderer(
  viewport.getWorldGroup(),
  measurementManager
);

// Set layer manager on measurement renderer
measurementRenderer.setLayerManager(layerManager);

// Listen to measurement changes to update renderer
measurementManager.onChange(() => {
  measurementRenderer.render(viewport.getZoom());
  markModified();
});

// Listen to layer changes to update measurement visibility
layerManager.onChange(() => {
  measurementRenderer.render(viewport.getZoom());
  markModified();
});

// Initialize all tools with snap support and layer manager
const selectTool = new SelectTool(
  project,
  viewport.getSelection()!,
  snapManager,
  snapIndicator,
  () => {
    viewport.refresh();
    markModified();
  }
);
selectTool.setLayerManager(layerManager);
selectTool.setContextMenu(contextMenu);

const pointTool = new PointTool(
  project,
  viewport.getPreviewGroup(),
  snapManager,
  snapIndicator,
  layerManager,
  () => {
    viewport.refresh();
    markModified();
  }
);

const lineTool = new LineTool(
  project,
  viewport.getPreviewGroup(),
  snapManager,
  snapIndicator,
  layerManager,
  () => {
    viewport.refresh();
    markModified();
  }
);

const circleTool = new CircleTool(
  project,
  viewport.getPreviewGroup(),
  snapManager,
  snapIndicator,
  layerManager,
  () => {
    viewport.refresh();
    markModified();
  }
);

const measureTool = new MeasureTool(
  measurementManager,
  snapManager,
  viewport.getPreviewGroup()
);

const areaTool = new AreaTool(
  measurementManager,
  snapManager,
  viewport.getPreviewGroup()
);

// Tool switching
const tools = { select: selectTool, point: pointTool, line: lineTool, circle: circleTool, measure: measureTool, area: areaTool };
let activeTool: string = 'select';

function setTool(toolName: string): void {
  activeTool = toolName;
  viewport.setTool(tools[toolName as keyof typeof tools]);
  
  // Update button states
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tool-${toolName}`)?.classList.add('active');
  
  // Update status bar
  const messages: Record<string, string> = {
    select: 'Select tool active - click to select, drag to move',
    point: 'Point tool active - click to place point',
    line: 'Line tool active - click start point, then end point',
    circle: 'Circle tool active - click center, then click to set radius',
    measure: 'Measure tool active - click two points to measure distance',
    area: 'Area tool active - click points to define polygon, double-click or Enter to complete'
  };
  const statusText = document.getElementById('status-text');
  if (statusText) statusText.textContent = messages[toolName] || 'Tool active';
}

// Update snap status display
function updateSnapStatus(): void {
  const statusEl = document.getElementById('snap-status');
  if (statusEl) {
    if (snapManager.isEnabled()) {
      statusEl.textContent = `SNAP: ON (${snapManager.getGridSpacing()} cm)`;
      statusEl.style.color = '#0066ff';
    } else {
      statusEl.textContent = 'SNAP: OFF';
      statusEl.style.color = '#999';
    }
  }
}

// Attach toolbar button handlers
document.getElementById('tool-select')?.addEventListener('click', () => setTool('select'));
document.getElementById('tool-point')?.addEventListener('click', () => setTool('point'));
document.getElementById('tool-line')?.addEventListener('click', () => setTool('line'));
document.getElementById('tool-circle')?.addEventListener('click', () => setTool('circle'));
document.getElementById('tool-measure')?.addEventListener('click', () => setTool('measure'));
document.getElementById('tool-area')?.addEventListener('click', () => setTool('area'));

// Grid spacing control
document.getElementById('grid-spacing')?.addEventListener('change', (e) => {
  const spacing = parseInt((e.target as HTMLSelectElement).value);
  snapManager.setGridSpacing(spacing);
  updateSnapStatus();
  console.log(`Grid spacing set to ${spacing} cm`);
});

// Snap toggle button
document.getElementById('snap-toggle')?.addEventListener('click', () => {
  const enabled = snapManager.toggle();
  const btn = document.getElementById('snap-toggle');
  if (btn) {
    if (enabled) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  updateSnapStatus();
  console.log(`Snap ${enabled ? 'enabled' : 'disabled'}`);
});

viewport.setTool(selectTool);

// Clear measurements button
document.getElementById('clear-measurements')?.addEventListener('click', () => {
  measurementManager.clearAll();
  console.log('All measurements cleared');
});

// Handle double-click for area tool
viewport.getSVG().addEventListener('dblclick', () => {
  if (activeTool === 'area') {
    areaTool.onDoubleClick();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl+S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveProject(false);
    return;
  }
  
  // ESC key handling
  if (e.key === 'Escape') {
    if (activeTool === 'line') {
      (lineTool as any).onKeyDown?.('Escape');
    } else if (activeTool === 'circle') {
      (circleTool as any).onKeyDown?.('Escape');
    } else if (activeTool === 'measure') {
      measureTool.onKeyDown('Escape');
    } else if (activeTool === 'area') {
      areaTool.onKeyDown('Escape');
    }
  }
  
  // Enter key for area tool
  if (e.key === 'Enter' && activeTool === 'area') {
    areaTool.onKeyDown('Enter');
  }
  
  // Tool shortcuts
  if (e.key === 'v' || e.key === 'V') setTool('select');
  if (e.key === 'p' || e.key === 'P') setTool('point');
  if (e.key === 'l' || e.key === 'L') setTool('line');
  if (e.key === 'c' || e.key === 'C') setTool('circle');
  if (e.key === 'm' || e.key === 'M') setTool('measure');
  if (e.key === 'a' || e.key === 'A') setTool('area');
  
  // Toggle snap with 'G' key
  if (e.key === 'g' || e.key === 'G') {
    const enabled = snapManager.toggle();
    const btn = document.getElementById('snap-toggle');
    if (btn) {
      if (enabled) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
    updateSnapStatus();
  }
});

console.log('All drawing and measurement tools loaded. Shortcuts: V=Select, P=Point, L=Line, C=Circle, M=Measure, A=Area, G=Toggle Snap');
console.log('Layer system initialized with 7 default layers (including Measurements)');
console.log('Measurement tools ready: Distance and Area measurement available - click measurements to delete');

document.getElementById('reset-view')?.addEventListener('click', () => {
  viewport.reset();
});

console.log(`Loaded ${project.getAllObjects().length} objects across ${layerManager.getAllLayers().length} layers`);

// ============================================================
// PERSISTENCE SYSTEM
// ============================================================

const storage = new IndexedDBAdapter();
const saveIndicator = new SaveIndicator(document.body);
let currentProjectId = 'garden-main';
let currentProjectName = 'My Garden Plan';
let hasUnsavedChanges = false;
let autoSaveTimer: number | null = null;

/**
 * Mark project as modified and schedule auto-save
 */
markModified = function(): void {
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

/**
 * Add test geometry for demo purposes
 */
function addTestGeometry(): void {
  console.log('Adding test geometry (no saved project found)');
  
  // Origin marker (0,0)
  project.addObject(new GeometryObject(
    'origin',
    'reference',
    { type: GeometryType.POINT, position: { x: 0, y: 0 } },
    { stroke: '#ff0000', strokeWidth: 3 },
    { name: 'Origin', category: 'reference' }
  ));

  // Property boundary (rectangle as lines) - 2000cm x 1500cm (20m x 15m)
  project.addObject(new GeometryObject(
    'boundary-north',
    'property',
    { type: GeometryType.LINE, start: { x: 0, y: 0 }, end: { x: 2000, y: 0 } },
    { stroke: '#333333', strokeWidth: 3 },
    { name: 'North Boundary' }
  ));

  project.addObject(new GeometryObject(
    'boundary-east',
    'property',
    { type: GeometryType.LINE, start: { x: 2000, y: 0 }, end: { x: 2000, y: 1500 } },
    { stroke: '#333333', strokeWidth: 3 },
    { name: 'East Boundary' }
  ));

  project.addObject(new GeometryObject(
    'boundary-south',
    'property',
    { type: GeometryType.LINE, start: { x: 2000, y: 1500 }, end: { x: 0, y: 1500 } },
    { stroke: '#333333', strokeWidth: 3 },
    { name: 'South Boundary' }
  ));

  project.addObject(new GeometryObject(
    'boundary-west',
    'property',
    { type: GeometryType.LINE, start: { x: 0, y: 1500 }, end: { x: 0, y: 0 } },
    { stroke: '#333333', strokeWidth: 3 },
    { name: 'West Boundary' }
  ));

  // Apple tree (circle) - 150cm radius (3m diameter)
  project.addObject(new GeometryObject(
    'tree-apple-1',
    'vegetation',
    { type: GeometryType.CIRCLE, center: { x: 500, y: 400 }, radius: 150 },
    { stroke: '#228B22', strokeWidth: 2, fill: '#90EE90', opacity: 0.3 },
    { name: 'Apple Tree', category: 'vegetation' }
  ));

  // Cherry tree - 120cm radius
  project.addObject(new GeometryObject(
    'tree-cherry-1',
    'vegetation',
    { type: GeometryType.CIRCLE, center: { x: 1200, y: 600 }, radius: 120 },
    { stroke: '#8B4513', strokeWidth: 2, fill: '#FFB6C1', opacity: 0.3 },
    { name: 'Cherry Tree', category: 'vegetation' }
  ));

  // Path (line) - 80cm wide
  project.addObject(new GeometryObject(
    'path-main',
    'hardscape',
    { type: GeometryType.LINE, start: { x: 100, y: 100 }, end: { x: 1800, y: 1400 } },
    { stroke: '#A0826D', strokeWidth: 80 },
    { name: 'Main Path', category: 'hardscape' }
  ));

  // Well (point)
  project.addObject(new GeometryObject(
    'well-1',
    'utilities',
    { type: GeometryType.POINT, position: { x: 1600, y: 300 } },
    { stroke: '#4169E1', strokeWidth: 5 },
    { name: 'Well', category: 'utility' }
  ));

  // Grid reference points (every 500cm)
  for (let x = 0; x <= 2000; x += 500) {
    for (let y = 0; y <= 1500; y += 500) {
      if (x === 0 && y === 0) continue; // Skip origin (already added)
      project.addObject(new GeometryObject(
        `ref-${x}-${y}`,
        'reference',
        { type: GeometryType.POINT, position: { x, y } },
        { stroke: '#999999', strokeWidth: 1 },
        { name: `Reference (${x}, ${y})` }
      ));
    }
  }
  
  viewport.refresh();
}

/**
 * Save project to IndexedDB
 */
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

/**
 * Load project from IndexedDB
 */
async function loadProject(): Promise<void> {
  try {
    const exists = await storage.exists(currentProjectId);
    
    if (!exists) {
      console.log('No saved project found, starting fresh');
      addTestGeometry();
      return;
    }

    const projectJSON = await storage.load(currentProjectId);
    
    if (!projectJSON) {
      console.log('No saved project data');
      addTestGeometry();
      return;
    }

    if (!ProjectSerializer.validate(projectJSON)) {
      console.error('Invalid project data');
      addTestGeometry();
      return;
    }

    // Clear selection before load
    if (viewport.getSelection()) {
      viewport.getSelection()!.deselect();
    }

    ProjectSerializer.deserialize(
      projectJSON,
      project,
      layerManager,
      measurementManager
    );

    currentProjectName = projectJSON.metadata.name;
    hasUnsavedChanges = false;
    
    // Force complete refresh
    viewport.refresh();
    measurementRenderer.render(viewport.getZoom());
    
    console.log(`Project loaded: ${currentProjectName}`);
    console.log(`Active objects: ${project.getAllObjects().length}`);
  } catch (error) {
    console.error('Load failed:', error);
    addTestGeometry();
  }
}

/**
 * Export project to downloadable JSON file
 */
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

/**
 * Import project from user-selected JSON file
 */
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

    // Clear selection before import
    if (viewport.getSelection()) {
      viewport.getSelection()!.deselect();
    }

    // Deserialize the imported project
    ProjectSerializer.deserialize(
      projectJSON,
      project,
      layerManager,
      measurementManager
    );

    currentProjectId = projectJSON.projectId;
    currentProjectName = projectJSON.metadata.name;
    hasUnsavedChanges = true;
    
    // Force complete refresh
    viewport.refresh();
    measurementRenderer.render(viewport.getZoom());
    
    console.log(`Imported project: ${currentProjectName}`);
    console.log(`Active objects: ${project.getAllObjects().length}`);
    
    // Save imported project
    await saveProject();
  } catch (error) {
    console.error('Import failed:', error);
    if (error instanceof Error) {
      alert(`Import failed: ${error.message}`);
    }
  }
}

// Initialize storage and load saved project
storage.initialize().then(() => {
  console.log('Storage initialized');
  loadProject();
}).catch(err => {
  console.error('Storage initialization failed:', err);
});

// Wire up save/load buttons
document.getElementById('save-btn')?.addEventListener('click', () => saveProject(false));
document.getElementById('export-btn')?.addEventListener('click', exportToFile);
document.getElementById('import-btn')?.addEventListener('click', importFromFile);

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    return e.returnValue;
  }
});

console.log('Persistence system loaded. Press Ctrl+S to save.');
