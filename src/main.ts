import { Viewport } from './viewport/Viewport';
import { Project } from './model/Project';
import { GeometryObject } from './geometry/GeometryObject';
import { GeometryType } from './geometry/types';
import { SelectTool } from './tools/SelectTool';
import { PointTool } from './tools/PointTool';
import { LineTool } from './tools/LineTool';
import { CircleTool } from './tools/CircleTool';
import { LayerManager } from './model/LayerManager';
import { LayerPanel } from './ui/LayerPanel';

console.log('GardenCAD v0.7 - Layer System');

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

// Create project with test geometry
const project = new Project();

// Add test objects to demonstrate rendering and coordinate accuracy

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

// Initialize viewport
const viewport = new Viewport(container);
viewport.setProject(project);

// Initialize layer system
const layerManager = new LayerManager();

// Set layer manager on renderer
const renderer = viewport.getRenderer();
if (renderer) {
  renderer.setLayerManager(layerManager);
}

// Initialize layer panel
const layerPanelContainer = document.getElementById('layer-panel');
if (layerPanelContainer) {
  new LayerPanel(layerPanelContainer, layerManager, () => viewport.render());
}

// Get snap manager and indicator
const snapManager = viewport.getSnapManager();
const snapIndicator = viewport.getSnapIndicator()!;

// Initialize all tools with snap support and layer manager
const selectTool = new SelectTool(
  project,
  viewport.getSelection()!,
  snapManager,
  snapIndicator,
  () => viewport.refresh()
);
selectTool.setLayerManager(layerManager);

const pointTool = new PointTool(
  project,
  viewport.getPreviewGroup(),
  snapManager,
  snapIndicator,
  layerManager,
  () => viewport.refresh()
);

const lineTool = new LineTool(
  project,
  viewport.getPreviewGroup(),
  snapManager,
  snapIndicator,
  layerManager,
  () => viewport.refresh()
);

const circleTool = new CircleTool(
  project,
  viewport.getPreviewGroup(),
  snapManager,
  snapIndicator,
  layerManager,
  () => viewport.refresh()
);

// Tool switching
const tools = { select: selectTool, point: pointTool, line: lineTool, circle: circleTool };
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
    circle: 'Circle tool active - click center, then click to set radius'
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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // ESC key handling
  if (e.key === 'Escape') {
    if (activeTool === 'line') {
      (lineTool as any).onKeyDown?.('Escape');
    } else if (activeTool === 'circle') {
      (circleTool as any).onKeyDown?.('Escape');
    }
  }
  
  // Tool shortcuts
  if (e.key === 'v' || e.key === 'V') setTool('select');
  if (e.key === 'p' || e.key === 'P') setTool('point');
  if (e.key === 'l' || e.key === 'L') setTool('line');
  if (e.key === 'c' || e.key === 'C') setTool('circle');
  
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

console.log('All drawing tools loaded. Shortcuts: V=Select, P=Point, L=Line, C=Circle, G=Toggle Snap');
console.log('Layer system initialized with 6 default layers');

document.getElementById('reset-view')?.addEventListener('click', () => {
  viewport.reset();
});

console.log(`Loaded ${project.getAllObjects().length} objects across ${layerManager.getAllLayers().length} layers`);