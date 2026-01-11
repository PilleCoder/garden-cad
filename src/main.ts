import { Viewport } from './viewport/Viewport';
import { Project } from './model/Project';
import { GeometryObject } from './geometry/GeometryObject';
import { GeometryType } from './geometry/types';
import { SelectTool } from './tools/SelectTool';

console.log('GardenCAD v0.4 - Selection and Move Tool');

const app = document.getElementById('app');
if (!app) {
  throw new Error('App container not found');
}

// Create UI structure
app.innerHTML = `
  <div style="display: flex; flex-direction: column; width: 100%; height: 100vh;">
    <div style="padding: 10px; background: #333; color: white; display: flex; gap: 10px; align-items: center;">
      <h1 style="margin: 0; font-size: 18px;">GardenCAD</h1>
      <button id="reset-view">Reset View</button>
      <span style="margin-left: auto; font-size: 12px;">Pan: Shift+Drag | Zoom: Wheel</span>
    </div>
    <div id="viewport-container" style="flex: 1; position: relative;"></div>
  </div>
`;

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

// Initialize and activate SelectTool
const selectTool = new SelectTool(
  project,
  viewport.getSelection()!,
  () => viewport.refresh()
);

viewport.setTool(selectTool);
console.log('Select tool active - click objects to select, drag to move');

document.getElementById('reset-view')?.addEventListener('click', () => {
  viewport.reset();
});

console.log(`Loaded ${project.getAllObjects().length} objects`);