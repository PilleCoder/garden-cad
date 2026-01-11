import { Viewport } from './viewport/Viewport';
import { Project } from './model/Project';
import { GeometryObject } from './geometry/GeometryObject';
import { GeometryType } from './geometry/types';
import { SelectTool } from './tools/SelectTool';
import { PointTool } from './tools/PointTool';
import { LineTool } from './tools/LineTool';
import { CircleTool } from './tools/CircleTool';

console.log('GardenCAD v0.5 - Drawing Tools');

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
      <button id="reset-view" style="margin-left: auto;">Reset View</button>
    </div>
    <div id="viewport-container" style="flex: 1; position: relative;"></div>
    <div style="padding: 8px; background: #f0f0f0; font-size: 12px; font-family: monospace;" id="status-bar">
      Select tool active - click to select, drag to move
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
  'default',
  { type: GeometryType.POINT, position: { x: 0, y: 0 } },
  { stroke: '#ff0000', strokeWidth: 3 },
  { name: 'Origin', category: 'reference' }
));

// Property boundary (rectangle as lines) - 2000cm x 1500cm (20m x 15m)
project.addObject(new GeometryObject(
  'boundary-north',
  'default',
  { type: GeometryType.LINE, start: { x: 0, y: 0 }, end: { x: 2000, y: 0 } },
  { stroke: '#333333', strokeWidth: 3 },
  { name: 'North Boundary' }
));

project.addObject(new GeometryObject(
  'boundary-east',
  'default',
  { type: GeometryType.LINE, start: { x: 2000, y: 0 }, end: { x: 2000, y: 1500 } },
  { stroke: '#333333', strokeWidth: 3 },
  { name: 'East Boundary' }
));

project.addObject(new GeometryObject(
  'boundary-south',
  'default',
  { type: GeometryType.LINE, start: { x: 2000, y: 1500 }, end: { x: 0, y: 1500 } },
  { stroke: '#333333', strokeWidth: 3 },
  { name: 'South Boundary' }
));

project.addObject(new GeometryObject(
  'boundary-west',
  'default',
  { type: GeometryType.LINE, start: { x: 0, y: 1500 }, end: { x: 0, y: 0 } },
  { stroke: '#333333', strokeWidth: 3 },
  { name: 'West Boundary' }
));

// Apple tree (circle) - 150cm radius (3m diameter)
project.addObject(new GeometryObject(
  'tree-apple-1',
  'default',
  { type: GeometryType.CIRCLE, center: { x: 500, y: 400 }, radius: 150 },
  { stroke: '#228B22', strokeWidth: 2, fill: '#90EE90', opacity: 0.3 },
  { name: 'Apple Tree', category: 'vegetation' }
));

// Cherry tree - 120cm radius
project.addObject(new GeometryObject(
  'tree-cherry-1',
  'default',
  { type: GeometryType.CIRCLE, center: { x: 1200, y: 600 }, radius: 120 },
  { stroke: '#8B4513', strokeWidth: 2, fill: '#FFB6C1', opacity: 0.3 },
  { name: 'Cherry Tree', category: 'vegetation' }
));

// Path (line) - 80cm wide
project.addObject(new GeometryObject(
  'path-main',
  'default',
  { type: GeometryType.LINE, start: { x: 100, y: 100 }, end: { x: 1800, y: 1400 } },
  { stroke: '#A0826D', strokeWidth: 80 },
  { name: 'Main Path', category: 'hardscape' }
));

// Well (point)
project.addObject(new GeometryObject(
  'well-1',
  'default',
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
      'default',
      { type: GeometryType.POINT, position: { x, y } },
      { stroke: '#999999', strokeWidth: 1 },
      { name: `Reference (${x}, ${y})` }
    ));
  }
}

// Initialize viewport
const viewport = new Viewport(container);
viewport.setProject(project);

// Initialize all tools
const selectTool = new SelectTool(
  project,
  viewport.getSelection()!,
  () => viewport.refresh()
);

const pointTool = new PointTool(
  project,
  viewport.getPreviewGroup(),
  () => viewport.refresh()
);

const lineTool = new LineTool(
  project,
  viewport.getPreviewGroup(),
  () => viewport.refresh()
);

const circleTool = new CircleTool(
  project,
  viewport.getPreviewGroup(),
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
  const statusBar = document.getElementById('status-bar');
  if (statusBar) statusBar.textContent = messages[toolName] || 'Tool active';
}

// Attach toolbar button handlers
document.getElementById('tool-select')?.addEventListener('click', () => setTool('select'));
document.getElementById('tool-point')?.addEventListener('click', () => setTool('point'));
document.getElementById('tool-line')?.addEventListener('click', () => setTool('line'));
document.getElementById('tool-circle')?.addEventListener('click', () => setTool('circle'));

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
});

console.log('All drawing tools loaded. Shortcuts: V=Select, P=Point, L=Line, C=Circle');

document.getElementById('reset-view')?.addEventListener('click', () => {
  viewport.reset();
});

console.log(`Loaded ${project.getAllObjects().length} objects`);