// Entry point - proof of setup
console.log('GardenCAD initializing...');

const app = document.getElementById('app');
if (app) {
  app.innerHTML = `
    <div style="padding: 20px;">
      <h1>GardenCAD</h1>
      <p>Development environment initialized successfully.</p>
      <p>TypeScript: ✓</p>
      <p>Vite: ✓</p>
    </div>
  `;
}