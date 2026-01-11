# Slice 7: Layer System

## User Value

As a user, I need to organize my garden plan into layers (property boundary, buildings, vegetation, utilities) so that I can manage visibility, lock editing, and logically group related elements for easier planning and modification.

## Slice Features

1. **Layer panel UI** - Side panel displaying all layers with controls
2. **Multiple named layers** - Create, rename, and delete layers
3. **Layer visibility toggle** - Show/hide layers individually
4. **Layer locking** - Lock layers to prevent editing
5. **Layer opacity control** - Adjust transparency per layer (0-100%)
6. **Active layer selection** - New objects created on active layer
7. **Layer assignment** - Objects belong to specific layers
8. **Layer-aware rendering** - Respect visibility and opacity settings
9. **Layer-aware selection** - Cannot select objects on locked/hidden layers
10. **Default layers** - Pre-create common garden layers

## Technical Implementation Sketch

### File Structure

```
src/
├── model/
│   ├── Layer.ts              # Layer data model
│   └── LayerManager.ts       # Layer management and state
├── ui/
│   └── LayerPanel.ts         # Layer panel UI component
├── renderer/
│   └── Renderer.ts           # Updated for layer-aware rendering
└── main.ts                   # Updated with layer panel
```

### Core Concepts

**Layer Model**:
- Each layer has: ID, name, visible flag, locked flag, opacity (0-1)
- Objects reference layer by ID
- One layer is "active" at a time for new object creation

**Rendering Order**:
- Layers rendered in order (bottom to top)
- Within each layer, objects render in creation order
- Hidden layers are not rendered
- Opacity applied to entire layer group

**Selection Constraints**:
- Cannot select objects on locked layers
- Cannot select objects on hidden layers
- Move operations respect layer locks

### src/model/Layer.ts

```typescript
export interface LayerData {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0.0 to 1.0
  order: number;   // Display order (lower = bottom)
}

export class Layer {
  readonly id: string;
  private data: LayerData;

  constructor(id: string, name: string, order: number = 0) {
    this.id = id;
    this.data = {
      id,
      name,
      visible: true,
      locked: false,
      opacity: 1.0,
      order
    };
  }

  getName(): string {
    return this.data.name;
  }

  setName(name: string): void {
    this.data.name = name;
  }

  isVisible(): boolean {
    return this.data.visible;
  }

  setVisible(visible: boolean): void {
    this.data.visible = visible;
  }

  isLocked(): boolean {
    return this.data.locked;
  }

  setLocked(locked: boolean): void {
    this.data.locked = locked;
  }

  getOpacity(): number {
    return this.data.opacity;
  }

  setOpacity(opacity: number): void {
    this.data.opacity = Math.max(0, Math.min(1, opacity));
  }

  getOrder(): number {
    return this.data.order;
  }

  setOrder(order: number): void {
    this.data.order = order;
  }

  getData(): LayerData {
    return { ...this.data };
  }

  clone(): Layer {
    const layer = new Layer(this.id, this.data.name, this.data.order);
    layer.data = { ...this.data };
    return layer;
  }
}
```

### src/model/LayerManager.ts

```typescript
import { Layer } from './Layer';

export type LayerChangeListener = () => void;

export class LayerManager {
  private layers: Map<string, Layer> = new Map();
  private activeLayerId: string | null = null;
  private listeners: LayerChangeListener[] = [];

  constructor() {
    // Create default layers
    this.createDefaultLayers();
  }

  private createDefaultLayers(): void {
    const defaultLayers = [
      { id: 'property', name: 'Property Boundary', order: 0 },
      { id: 'buildings', name: 'Buildings', order: 1 },
      { id: 'hardscape', name: 'Hardscape (Paths/Patios)', order: 2 },
      { id: 'vegetation', name: 'Vegetation (Trees/Beds)', order: 3 },
      { id: 'utilities', name: 'Utilities', order: 4 },
      { id: 'reference', name: 'Reference Points', order: 5 }
    ];

    for (const layerData of defaultLayers) {
      const layer = new Layer(layerData.id, layerData.name, layerData.order);
      this.layers.set(layer.id, layer);
    }

    // Set property as active by default
    this.activeLayerId = 'property';
  }

  // Layer CRUD operations
  addLayer(id: string, name: string): Layer {
    if (this.layers.has(id)) {
      throw new Error(`Layer with id '${id}' already exists`);
    }

    const maxOrder = Math.max(...Array.from(this.layers.values()).map(l => l.getOrder()), -1);
    const layer = new Layer(id, name, maxOrder + 1);
    this.layers.set(id, layer);
    this.notifyListeners();
    return layer;
  }

  removeLayer(id: string): boolean {
    if (id === 'default') {
      throw new Error('Cannot remove default layer');
    }

    const removed = this.layers.delete(id);
    if (removed) {
      if (this.activeLayerId === id) {
        // Set first available layer as active
        const firstLayer = Array.from(this.layers.values())[0];
        this.activeLayerId = firstLayer ? firstLayer.id : null;
      }
      this.notifyListeners();
    }
    return removed;
  }

  getLayer(id: string): Layer | undefined {
    return this.layers.get(id);
  }

  getAllLayers(): Layer[] {
    return Array.from(this.layers.values()).sort((a, b) => a.getOrder() - b.getOrder());
  }

  hasLayer(id: string): boolean {
    return this.layers.has(id);
  }

  // Active layer management
  setActiveLayer(id: string): void {
    if (!this.layers.has(id)) {
      throw new Error(`Layer '${id}' does not exist`);
    }
    this.activeLayerId = id;
    this.notifyListeners();
  }

  getActiveLayer(): Layer | null {
    return this.activeLayerId ? this.layers.get(this.activeLayerId) || null : null;
  }

  getActiveLayerId(): string | null {
    return this.activeLayerId;
  }

  // Layer state updates
  updateLayer(id: string, updates: Partial<{ name: string; visible: boolean; locked: boolean; opacity: number }>): void {
    const layer = this.layers.get(id);
    if (!layer) return;

    if (updates.name !== undefined) layer.setName(updates.name);
    if (updates.visible !== undefined) layer.setVisible(updates.visible);
    if (updates.locked !== undefined) layer.setLocked(updates.locked);
    if (updates.opacity !== undefined) layer.setOpacity(updates.opacity);

    this.notifyListeners();
  }

  // Layer visibility
  isLayerVisible(id: string): boolean {
    const layer = this.layers.get(id);
    return layer ? layer.isVisible() : false;
  }

  isLayerLocked(id: string): boolean {
    const layer = this.layers.get(id);
    return layer ? layer.isLocked() : false;
  }

  // Change notifications
  onChange(listener: LayerChangeListener): void {
    this.listeners.push(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
```

### src/ui/LayerPanel.ts

```typescript
import { LayerManager } from '../model/LayerManager';

export class LayerPanel {
  private container: HTMLElement;
  private layerManager: LayerManager;
  private onUpdate: () => void;

  constructor(container: HTMLElement, layerManager: LayerManager, onUpdate: () => void) {
    this.container = container;
    this.layerManager = layerManager;
    this.onUpdate = onUpdate;

    this.layerManager.onChange(() => this.render());
    this.render();
  }

  private render(): void {
    const layers = this.layerManager.getAllLayers();
    const activeLayerId = this.layerManager.getActiveLayerId();

    this.container.innerHTML = `
      <div style="padding: 10px; background: #2a2a2a; color: white; font-weight: bold; border-bottom: 1px solid #444;">
        Layers
      </div>
      <div style="overflow-y: auto; max-height: calc(100vh - 200px);">
        ${layers.map(layer => `
          <div class="layer-item ${layer.id === activeLayerId ? 'active' : ''}" 
               data-layer-id="${layer.id}"
               style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; cursor: pointer; background: ${layer.id === activeLayerId ? '#e3f2fd' : 'white'};">
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="layer-visibility-btn" data-layer-id="${layer.id}" title="Toggle visibility">
                ${layer.isVisible() ? '👁️' : '🚫'}
              </button>
              <button class="layer-lock-btn" data-layer-id="${layer.id}" title="Toggle lock">
                ${layer.isLocked() ? '🔒' : '🔓'}
              </button>
              <span style="flex: 1; font-size: 13px;">${layer.getName()}</span>
              <input type="range" class="layer-opacity-slider" data-layer-id="${layer.id}" 
                     min="0" max="100" value="${layer.getOpacity() * 100}" 
                     style="width: 60px;" title="Opacity: ${Math.round(layer.getOpacity() * 100)}%">
            </div>
          </div>
        `).join('')}
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Layer selection (set active)
    this.container.querySelectorAll('.layer-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // Don't trigger if clicking buttons or slider
        if (target.tagName === 'BUTTON' || target.tagName === 'INPUT') return;
        
        const layerId = (item as HTMLElement).dataset.layerId;
        if (layerId) {
          this.layerManager.setActiveLayer(layerId);
          console.log(`Active layer: ${this.layerManager.getLayer(layerId)?.getName()}`);
        }
      });
    });

    // Visibility toggle
    this.container.querySelectorAll('.layer-visibility-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = (btn as HTMLElement).dataset.layerId;
        if (layerId) {
          const layer = this.layerManager.getLayer(layerId);
          if (layer) {
            layer.setVisible(!layer.isVisible());
            this.layerManager.onChange(() => {}); // Trigger update
            this.onUpdate();
            console.log(`Layer '${layer.getName()}' ${layer.isVisible() ? 'visible' : 'hidden'}`);
          }
        }
      });
    });

    // Lock toggle
    this.container.querySelectorAll('.layer-lock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerId = (btn as HTMLElement).dataset.layerId;
        if (layerId) {
          const layer = this.layerManager.getLayer(layerId);
          if (layer) {
            layer.setLocked(!layer.isLocked());
            this.layerManager.onChange(() => {}); // Trigger update
            console.log(`Layer '${layer.getName()}' ${layer.isLocked() ? 'locked' : 'unlocked'}`);
          }
        }
      });
    });

    // Opacity slider
    this.container.querySelectorAll('.layer-opacity-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        e.stopPropagation();
        const layerId = (slider as HTMLElement).dataset.layerId;
        const value = parseInt((slider as HTMLInputElement).value);
        if (layerId) {
          const layer = this.layerManager.getLayer(layerId);
          if (layer) {
            layer.setOpacity(value / 100);
            this.onUpdate();
          }
        }
      });
    });
  }
}
```

### src/renderer/Renderer.ts (update for layer-aware rendering)

```typescript
import { LayerManager } from '../model/LayerManager';

export class Renderer {
  private shapeRenderer: ShapeRenderer;
  private objectsGroup: SVGGElement;
  private layerManager?: LayerManager;

  constructor(worldGroup: SVGGElement) {
    this.shapeRenderer = new ShapeRenderer();
    this.objectsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.objectsGroup.id = 'objects';
    worldGroup.appendChild(this.objectsGroup);
  }

  setLayerManager(layerManager: LayerManager): void {
    this.layerManager = layerManager;
  }

  render(project: Project, zoom: number): void {
    // Clear existing
    while (this.objectsGroup.firstChild) {
      this.objectsGroup.removeChild(this.objectsGroup.firstChild);
    }

    if (!this.layerManager) {
      // Fallback: render all objects without layers
      this.renderAllObjects(project, zoom);
      return;
    }

    // Render by layer (bottom to top)
    const layers = this.layerManager.getAllLayers();
    
    for (const layer of layers) {
      if (!layer.isVisible()) continue;

      // Create layer group
      const layerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      layerGroup.id = `layer-${layer.id}`;
      layerGroup.setAttribute('opacity', layer.getOpacity().toString());

      // Render objects in this layer
      const objects = project.getObjectsByLayer(layer.id);
      for (const obj of objects) {
        const svgElement = this.shapeRenderer.render(obj, zoom);
        layerGroup.appendChild(svgElement);
      }

      this.objectsGroup.appendChild(layerGroup);
    }
  }

  private renderAllObjects(project: Project, zoom: number): void {
    const objects = project.getAllObjects();
    for (const obj of objects) {
      const svgElement = this.shapeRenderer.render(obj, zoom);
      this.objectsGroup.appendChild(svgElement);
    }
  }

  getObjectsGroup(): SVGGElement {
    return this.objectsGroup;
  }
}
```

### Update tools to use active layer

All drawing tools need to create objects on the active layer:

```typescript
// Example: src/tools/PointTool.ts - updated

export class PointTool implements Tool {
  private layerManager: LayerManager;

  constructor(
    project: Project,
    previewGroup: SVGGElement,
    snapManager: SnapManager,
    snapIndicator: SnapIndicator,
    layerManager: LayerManager,
    onUpdate: () => void
  ) {
    // ... existing properties ...
    this.layerManager = layerManager;
  }

  onMouseClick(event: ToolMouseEvent): void {
    const snapResult = this.snapManager.snap(event.worldPos);
    const activeLayerId = this.layerManager.getActiveLayerId() || 'default';
    
    const id = this.generateId('point');
    const point = new GeometryObject(
      id,
      activeLayerId, // Use active layer
      {
        type: GeometryType.POINT,
        position: snapResult.point
      },
      { stroke: '#333333', strokeWidth: 2 },
      { name: `Point ${id}`, category: 'reference' }
    );

    this.project.addObject(point);
    this.onUpdate();
    console.log(`Created point on layer '${this.layerManager.getLayer(activeLayerId)?.getName()}'`);
  }
}
```

### Update SelectTool to respect locked layers

```typescript
// src/tools/SelectTool.ts - add layer checking

export class SelectTool implements Tool {
  private layerManager?: LayerManager;

  setLayerManager(layerManager: LayerManager): void {
    this.layerManager = layerManager;
  }

  onMouseClick(event: ToolMouseEvent): void {
    if (this.isDragging) return;

    const objects = this.project.getAllObjects();
    let hitObject: GeometryObject | null = null;

    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      
      // Skip if layer is locked or hidden
      if (this.layerManager) {
        if (!this.layerManager.isLayerVisible(obj.layerId)) continue;
        if (this.layerManager.isLayerLocked(obj.layerId)) continue;
      }

      if (this.hitTest(obj, event.worldPos)) {
        hitObject = obj;
        break;
      }
    }

    if (hitObject) {
      this.selection.select(hitObject.id);
    } else {
      this.selection.deselect();
    }
  }

  onMouseDown(event: ToolMouseEvent): void {
    const selectedId = this.selection.getFirstSelected();
    if (selectedId) {
      const obj = this.project.getObject(selectedId);
      
      // Check if object's layer is locked
      if (obj && this.layerManager && this.layerManager.isLayerLocked(obj.layerId)) {
        console.log('Cannot move object on locked layer');
        return;
      }

      if (obj && this.hitTest(obj, event.worldPos)) {
        this.isDragging = true;
        this.dragStartWorld = event.worldPos;
        this.draggedObject = obj;
        this.dragOffset = this.getObjectPosition(obj);
      }
    }
  }
}
```

### src/main.ts (add layer panel)

```typescript
import { LayerManager } from './model/LayerManager';
import { LayerPanel } from './ui/LayerPanel';

// Update HTML to include layer panel:
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
      <span id="status-text">Select tool active</span>
      <span id="snap-status" style="color: #0066ff; font-weight: bold;">SNAP: ON (10 cm)</span>
    </div>
  </div>
`;

// Initialize layer system
const layerManager = new LayerManager();

// Update project to use layers (update test geometry):
project.addObject(new GeometryObject(
  'boundary-north',
  'property', // Use layer ID
  { type: GeometryType.LINE, start: { x: 0, y: 0 }, end: { x: 2000, y: 0 } },
  { stroke: '#333333', strokeWidth: 3 },
  { name: 'North Boundary' }
));

// Trees on vegetation layer:
project.addObject(new GeometryObject(
  'tree-apple-1',
  'vegetation',
  { type: GeometryType.CIRCLE, center: { x: 500, y: 400 }, radius: 150 },
  { stroke: '#228B22', strokeWidth: 2, fill: '#90EE90', opacity: 0.3 },
  { name: 'Apple Tree', category: 'vegetation' }
));

// Initialize layer panel
const layerPanelContainer = document.getElementById('layer-panel');
if (layerPanelContainer) {
  new LayerPanel(layerPanelContainer, layerManager, () => viewport.render());
}

// Set layer manager on renderer
viewport.getRenderer()?.setLayerManager(layerManager);

// Update tools to use layer manager (pass as constructor parameter)
const pointTool = new PointTool(
  project,
  viewport.getPreviewGroup(),
  snapManager,
  snapIndicator,
  layerManager,
  () => viewport.render()
);

// Similar for other tools...

console.log('Layer system initialized with default layers');
```

## Test Plan

### Manual Testing Steps

1. **Layer panel UI test**
   - Load application
   - Verify left panel shows "Layers" header
   - Verify 6 default layers listed:
     - Property Boundary
     - Buildings
     - Hardscape
     - Vegetation
     - Utilities
     - Reference Points
   - Verify first layer highlighted (active)
   - Verify each layer has visibility, lock buttons, and opacity slider

2. **Active layer selection test**
   - Click on "Vegetation" layer
   - Verify layer highlights (blue background)
   - Click on "Property Boundary"
   - Verify selection moves
   - Verify only one layer active at a time

3. **Layer visibility toggle test**
   - Click visibility button (👁️) on Vegetation layer
   - Verify button changes to 🚫
   - Verify all trees disappear from canvas
   - Click visibility button again
   - Verify button changes back to 👁️
   - Verify trees reappear
   - Repeat with other layers

4. **Layer lock test**
   - Select an object on Vegetation layer
   - Verify selection works
   - Click lock button (🔓) on Vegetation layer
   - Verify button changes to 🔒
   - Try to select tree
   - Verify cannot select (locked layer)
   - Try to drag tree
   - Verify cannot drag
   - Unlock layer
   - Verify selection works again

5. **Layer opacity test**
   - Move opacity slider for Vegetation layer to 50%
   - Verify trees become semi-transparent
   - Move slider to 0%
   - Verify trees become invisible (but layer still "visible")
   - Move slider to 100%
   - Verify trees fully opaque
   - Test with other layers

6. **Drawing on active layer test**
   - Select "Buildings" layer (make active)
   - Select Circle tool
   - Draw a circle
   - Verify circle created
   - Hide "Buildings" layer
   - Verify circle disappears
   - Show layer again
   - Select "Hardscape" layer
   - Draw a line
   - Verify line created on Hardscape layer
   - Hide Hardscape
   - Verify only line disappears (circle still visible)

7. **Layer organization test**
   - Create objects on different layers:
     - Property: boundary lines
     - Buildings: circles representing structures
     - Hardscape: paths
     - Vegetation: trees
   - Verify objects group logically
   - Hide/show each layer
   - Verify correct objects disappear/appear

8. **Rendering order test**
   - Create overlapping objects on different layers
   - Draw circle on Property layer (order 0)
   - Draw circle on Vegetation layer (order 3) overlapping first
   - Verify Vegetation circle renders on top
   - Verify layer order matches visual stacking

9. **Console logging test**
   - Select different layers
   - Verify console shows "Active layer: [name]"
   - Toggle visibility
   - Verify console shows "[layer] visible/hidden"
   - Toggle lock
   - Verify console shows "[layer] locked/unlocked"
   - Create object
   - Verify console shows "Created [type] on layer '[name]'"

10. **Selection with hidden layers test**
    - Create multiple overlapping objects on different layers
    - Hide top layer
    - Try to select objects
    - Verify can select objects on visible layers only
    - Verify hidden layer objects are skipped

11. **Move restrictions test**
    - Select object on unlocked layer
    - Start dragging
    - Lock the layer mid-drag
    - This shouldn't happen in practice, but verify no crash
    - Try to select locked layer object
    - Verify console shows "Cannot move object on locked layer"

12. **Multiple layer workflow test**
    - Draw property boundary on Property layer
    - Switch to Buildings layer, draw structures
    - Switch to Vegetation layer, draw trees
    - Switch to Utilities layer, add points
    - Hide Buildings temporarily
    - Continue working on other layers
    - Show Buildings again
    - Verify all objects persist correctly

## Acceptance Criteria

- [ ] Layer panel displays on left side with all layers
- [ ] 6 default layers created on startup
- [ ] Active layer highlighted with blue background
- [ ] Clicking layer sets it as active
- [ ] Visibility button toggles layer visibility
- [ ] Hidden layers do not render on canvas
- [ ] Lock button toggles layer lock state
- [ ] Locked layers cannot be selected or edited
- [ ] Opacity slider adjusts layer transparency (0-100%)
- [ ] New objects created on currently active layer
- [ ] Layers render in correct order (bottom to top)
- [ ] Selection skips hidden layers
- [ ] Selection skips locked layers
- [ ] Move operations respect layer locks
- [ ] Console logs layer operations (select, show/hide, lock/unlock)
- [ ] Layer state persists during viewport operations (pan/zoom)
- [ ] Multiple objects on same layer render together
- [ ] Visual feedback for active layer in panel
- [ ] No TypeScript compilation errors

## Deliverables

1. **src/model/Layer.ts** - Layer data model with visibility/lock/opacity
2. **src/model/LayerManager.ts** - Layer management and active layer tracking
3. **src/ui/LayerPanel.ts** - Interactive layer panel component
4. **Updated src/renderer/Renderer.ts** - Layer-aware rendering with opacity
5. **Updated src/tools/PointTool.ts** - Create objects on active layer
6. **Updated src/tools/LineTool.ts** - Create objects on active layer
7. **Updated src/tools/CircleTool.ts** - Create objects on active layer
8. **Updated src/tools/SelectTool.ts** - Respect layer locks and visibility
9. **Updated src/main.ts** - Layer panel integration and test data
10. **Working layer system** - UI panel, visibility/lock/opacity controls, layer-aware operations

---

**Estimated effort**: 3-4 hours  
**Dependencies**: Slice 6 (all drawing tools working)  
**Risk**: Medium - rendering order and selection filtering require careful coordination
