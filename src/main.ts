import { Viewport } from './viewport/Viewport';

console.log('GardenCAD v0.2 - SVG Viewport');

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
      <span style="margin-left: auto; font-size: 12px;">Pan: Shift+Drag or Middle Mouse | Zoom: Mouse Wheel</span>
    </div>
    <div id="viewport-container" style="flex: 1; position: relative;"></div>
  </div>
`;

const container = document.getElementById('viewport-container');
if (!container) {
  throw new Error('Viewport container not found');
}

const viewport = new Viewport(container);

document.getElementById('reset-view')?.addEventListener('click', () => {
  viewport.reset();
});