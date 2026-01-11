# Slice 16: UI Polish and Precision Features

## User Value

As a user, I need professional UI refinements including numeric dimension input, an object property panel for precise editing, a keyboard shortcuts reference, and clear visual indicators, so that I can work efficiently and precisely without guessing tool behavior or keyboard commands.

## Slice Features

1. **Numeric dimension input** - Enter exact dimensions while drawing (length, radius, angle)
2. **Object property panel** - Edit selected object properties (position, size, style)
3. **Keyboard shortcuts help** - Modal dialog showing all available shortcuts
4. **Precision mode indicator** - Visual feedback for snap/grid status
5. **Coordinate precision toggle** - Switch between integer/decimal coordinate display
6. **Unit system selector** - Choose cm/m/inches for display
7. **Toolbar tooltips** - Enhanced tooltips with shortcuts
8. **Status bar enhancements** - Show active layer, zoom level, selection count
9. **Tool hints panel** - Context-sensitive help for active tool
10. **Quick actions bar** - Common operations (duplicate, rotate, flip)
11. **Zoom controls** - Zoom in/out/fit buttons with percentages

## Technical Implementation Sketch

### File Structure

```
src/
├── ui/
│   ├── PropertyPanel.ts         # Object property editor
│   ├── ShortcutsDialog.ts       # Keyboard shortcuts reference
│   ├── DimensionInput.ts        # Numeric input overlay
│   ├── StatusBar.ts             # Enhanced status bar
│   ├── ToolHints.ts             # Context-sensitive hints
│   └── QuickActions.ts          # Quick action toolbar
├── model/
│   └── UnitSystem.ts            # Unit conversion utilities
└── main.ts                      # Updated with UI components
```

### Core Concepts

**Numeric Dimension Input**:
- Floating input box appears during drawing
- Type exact values (e.g., "250" for 250cm line length)
- Tab key to switch between dimensions (length/width/angle)
- Enter to confirm, ESC to cancel
- Works with all drawing tools

**Property Panel**:
- Shows properties of selected object(s)
- Editable fields for coordinates, dimensions, style
- Color pickers for stroke/fill
- Layer assignment dropdown
- Apply changes via commands (undoable)

**Keyboard Shortcuts Dialog**:
- Organized by category (Tools, View, Edit, Selection)
- Searchable/filterable
- Visual key representations
- Printable reference

**Status Bar Sections**:
- Left: Cursor coordinates
- Center: Active tool, layer, selection count
- Right: Zoom level, grid spacing, snap status

### src/ui/PropertyPanel.ts

```typescript
import { GeometryObject } from '../geometry/GeometryObject';
import { Selection } from '../selection/Selection';
import { LayerManager } from '../model/LayerManager';
import { ModifyObjectCommand } from '../commands/ModifyObjectCommand';
import { CommandHistory } from '../commands/CommandHistory';
import { GeometryType } from '../geometry/types';

export class PropertyPanel {
  private container: HTMLElement;
  private selection: Selection;
  private layerManager: LayerManager;
  private commandHistory: CommandHistory;
  private onUpdate: () => void;
  private currentObject: GeometryObject | null = null;

  constructor(
    selection: Selection,
    layerManager: LayerManager,
    commandHistory: CommandHistory,
    onUpdate: () => void
  ) {
    this.selection = selection;
    this.layerManager = layerManager;
    this.commandHistory = commandHistory;
    this.onUpdate = onUpdate;
    this.container = this.createPanel();
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'property-panel';
    panel.style.cssText = `
      position: absolute;
      top: 80px;
      right: 10px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-family: Arial, sans-serif;
      font-size: 13px;
      width: 280px;
      max-height: 500px;
      overflow-y: auto;
      z-index: 100;
      display: none;
    `;

    // Title
    const title = document.createElement('div');
    title.id = 'property-title';
    title.textContent = 'Properties';
    title.style.cssText = 'font-weight: bold; margin-bottom: 12px; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 8px;';
    panel.appendChild(title);

    // Content area (populated dynamically)
    const content = document.createElement('div');
    content.id = 'property-content';
    panel.appendChild(content);

    return panel;
  }

  update(): void {
    const selected = this.selection.getSelectedObjects();
    
    if (selected.length === 0) {
      this.container.style.display = 'none';
      return;
    }

    if (selected.length === 1) {
      this.showSingleObjectProperties(selected[0]);
    } else {
      this.showMultipleObjectProperties(selected);
    }

    this.container.style.display = 'block';
  }

  private showSingleObjectProperties(obj: GeometryObject): void {
    this.currentObject = obj;
    const content = this.container.querySelector('#property-content') as HTMLElement;
    content.innerHTML = '';

    // Object name
    this.addField(content, 'Name', 'text', obj.metadata.name || obj.id, (value) => {
      const cmd = new ModifyObjectCommand(obj, 'metadata.name', value);
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });

    // Layer
    this.addLayerSelect(content, obj);

    // Geometry-specific fields
    const geom = obj.geometry;
    
    switch (geom.type) {
      case GeometryType.POINT:
        this.addPointFields(content, obj, geom as any);
        break;
      case GeometryType.LINE:
        this.addLineFields(content, obj, geom as any);
        break;
      case GeometryType.CIRCLE:
        this.addCircleFields(content, obj, geom as any);
        break;
      case GeometryType.POLYLINE:
      case GeometryType.POLYGON:
        this.addPolyFields(content, obj, geom as any);
        break;
      case GeometryType.BEZIER_SPLINE:
        this.addBezierFields(content, obj, geom as any);
        break;
    }

    // Style section
    this.addStyleFields(content, obj);
  }

  private showMultipleObjectProperties(objects: GeometryObject[]): void {
    const content = this.container.querySelector('#property-content') as HTMLElement;
    content.innerHTML = '';

    const info = document.createElement('div');
    info.textContent = `${objects.length} objects selected`;
    info.style.cssText = 'margin-bottom: 12px; color: #666; font-style: italic;';
    content.appendChild(info);

    // Common style fields only
    const section = this.createSection('Common Style');
    content.appendChild(section);

    // Stroke color (if all same)
    const strokes = objects.map(o => o.style.stroke);
    if (strokes.every(s => s === strokes[0])) {
      this.addColorField(section, 'Stroke', strokes[0] || '#000000', (value) => {
        objects.forEach(obj => {
          const cmd = new ModifyObjectCommand(obj, 'style.stroke', value);
          this.commandHistory.execute(cmd);
        });
        this.onUpdate();
      });
    }
  }

  private addPointFields(content: HTMLElement, obj: GeometryObject, geom: any): void {
    const section = this.createSection('Position');
    content.appendChild(section);

    this.addField(section, 'X', 'number', geom.point.x, (value) => {
      const cmd = new ModifyObjectCommand(obj, 'geometry.point.x', parseFloat(value));
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });

    this.addField(section, 'Y', 'number', geom.point.y, (value) => {
      const cmd = new ModifyObjectCommand(obj, 'geometry.point.y', parseFloat(value));
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });
  }

  private addLineFields(content: HTMLElement, obj: GeometryObject, geom: any): void {
    const section = this.createSection('Geometry');
    content.appendChild(section);

    const length = Math.sqrt(
      (geom.end.x - geom.start.x) ** 2 + 
      (geom.end.y - geom.start.y) ** 2
    );

    this.addReadOnlyField(section, 'Length', `${length.toFixed(2)} cm`);

    this.addField(section, 'Start X', 'number', geom.start.x, (value) => {
      const cmd = new ModifyObjectCommand(obj, 'geometry.start.x', parseFloat(value));
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });

    this.addField(section, 'Start Y', 'number', geom.start.y, (value) => {
      const cmd = new ModifyObjectCommand(obj, 'geometry.start.y', parseFloat(value));
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });

    this.addField(section, 'End X', 'number', geom.end.x, (value) => {
      const cmd = new ModifyObjectCommand(obj, 'geometry.end.x', parseFloat(value));
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });

    this.addField(section, 'End Y', 'number', geom.end.y, (value) => {
      const cmd = new ModifyObjectCommand(obj, 'geometry.end.y', parseFloat(value));
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });
  }

  private addCircleFields(content: HTMLElement, obj: GeometryObject, geom: any): void {
    const section = this.createSection('Geometry');
    content.appendChild(section);

    this.addField(section, 'Center X', 'number', geom.center.x, (value) => {
      const cmd = new ModifyObjectCommand(obj, 'geometry.center.x', parseFloat(value));
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });

    this.addField(section, 'Center Y', 'number', geom.center.y, (value) => {
      const cmd = new ModifyObjectCommand(obj, 'geometry.center.y', parseFloat(value));
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });

    this.addField(section, 'Radius', 'number', geom.radius, (value) => {
      const cmd = new ModifyObjectCommand(obj, 'geometry.radius', parseFloat(value));
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });

    const circumference = 2 * Math.PI * geom.radius;
    const area = Math.PI * geom.radius * geom.radius;
    this.addReadOnlyField(section, 'Circumference', `${circumference.toFixed(2)} cm`);
    this.addReadOnlyField(section, 'Area', `${(area / 10000).toFixed(2)} m²`);
  }

  private addPolyFields(content: HTMLElement, obj: GeometryObject, geom: any): void {
    const section = this.createSection('Geometry');
    content.appendChild(section);

    this.addReadOnlyField(section, 'Vertices', geom.points.length.toString());

    if (geom.type === GeometryType.POLYGON && obj.metadata.area) {
      this.addReadOnlyField(section, 'Area', `${(obj.metadata.area / 10000).toFixed(2)} m²`);
    }

    if (obj.metadata.length || obj.metadata.perimeter) {
      const length = obj.metadata.length || obj.metadata.perimeter;
      this.addReadOnlyField(section, 'Length', `${(length / 100).toFixed(2)} m`);
    }
  }

  private addBezierFields(content: HTMLElement, obj: GeometryObject, geom: any): void {
    const section = this.createSection('Geometry');
    content.appendChild(section);

    this.addReadOnlyField(section, 'Segments', geom.segments.length.toString());

    if (obj.metadata.length) {
      this.addReadOnlyField(section, 'Length', `${(obj.metadata.length / 100).toFixed(2)} m`);
    }
  }

  private addStyleFields(content: HTMLElement, obj: GeometryObject): void {
    const section = this.createSection('Style');
    content.appendChild(section);

    this.addColorField(section, 'Stroke', obj.style.stroke || '#000000', (value) => {
      const cmd = new ModifyObjectCommand(obj, 'style.stroke', value);
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });

    this.addField(section, 'Stroke Width', 'number', obj.style.strokeWidth || 2, (value) => {
      const cmd = new ModifyObjectCommand(obj, 'style.strokeWidth', parseFloat(value));
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });

    if (obj.geometry.type === GeometryType.POLYGON || obj.geometry.type === GeometryType.CIRCLE) {
      this.addColorField(section, 'Fill', obj.style.fill || 'none', (value) => {
        const cmd = new ModifyObjectCommand(obj, 'style.fill', value);
        this.commandHistory.execute(cmd);
        this.onUpdate();
      });
    }

    this.addField(section, 'Opacity', 'number', obj.style.opacity || 1, (value) => {
      const cmd = new ModifyObjectCommand(obj, 'style.opacity', parseFloat(value));
      this.onUpdate();
    }, 0, 1, 0.1);
  }

  private addLayerSelect(content: HTMLElement, obj: GeometryObject): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom: 10px;';

    const label = document.createElement('div');
    label.textContent = 'Layer';
    label.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 4px;';
    row.appendChild(label);

    const select = document.createElement('select');
    select.style.cssText = 'width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;';

    for (const layer of this.layerManager.getLayers()) {
      const option = document.createElement('option');
      option.value = layer.id;
      option.textContent = layer.name;
      option.selected = layer.id === obj.layerId;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      const cmd = new ModifyObjectCommand(obj, 'layerId', select.value);
      this.commandHistory.execute(cmd);
      this.onUpdate();
    });

    row.appendChild(select);
    content.appendChild(row);
  }

  private createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 16px;';

    const header = document.createElement('div');
    header.textContent = title;
    header.style.cssText = 'font-weight: bold; font-size: 12px; color: #333; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;';
    section.appendChild(header);

    return section;
  }

  private addField(
    parent: HTMLElement,
    label: string,
    type: string,
    value: any,
    onChange: (value: any) => void,
    min?: number,
    max?: number,
    step?: number
  ): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 12px; color: #666; flex: 1;';
    row.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.style.cssText = 'width: 120px; padding: 4px 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;';
    
    if (type === 'number') {
      if (min !== undefined) input.min = min.toString();
      if (max !== undefined) input.max = max.toString();
      if (step !== undefined) input.step = step.toString();
    }

    input.addEventListener('change', () => onChange(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        onChange(input.value);
      }
    });

    row.appendChild(input);
    parent.appendChild(row);
  }

  private addColorField(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (value: string) => void
  ): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 12px; color: #666; flex: 1;';
    row.appendChild(labelEl);

    const colorWrapper = document.createElement('div');
    colorWrapper.style.cssText = 'display: flex; gap: 6px; align-items: center;';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = value === 'none' ? '#ffffff' : value;
    colorInput.style.cssText = 'width: 40px; height: 28px; border: 1px solid #ccc; border-radius: 3px; cursor: pointer;';
    colorInput.addEventListener('change', () => onChange(colorInput.value));

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = value;
    textInput.style.cssText = 'width: 70px; padding: 4px 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; font-family: monospace;';
    textInput.addEventListener('change', () => onChange(textInput.value));

    colorWrapper.appendChild(colorInput);
    colorWrapper.appendChild(textInput);
    row.appendChild(colorWrapper);
    parent.appendChild(row);
  }

  private addReadOnlyField(parent: HTMLElement, label: string, value: string): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 12px; color: #666; flex: 1;';
    row.appendChild(labelEl);

    const valueEl = document.createElement('div');
    valueEl.textContent = value;
    valueEl.style.cssText = 'font-size: 12px; color: #333; font-weight: 500;';
    row.appendChild(valueEl);

    parent.appendChild(row);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  unmount(): void {
    this.container.remove();
  }
}
```

### src/ui/ShortcutsDialog.ts

```typescript
export class ShortcutsDialog {
  private overlay: HTMLElement;
  private dialog: HTMLElement;

  constructor() {
    this.overlay = this.createOverlay();
    this.dialog = this.createDialog();
    this.overlay.appendChild(this.dialog);
  }

  private createOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'shortcuts-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hide();
      }
    });

    return overlay;
  }

  private createDialog(): HTMLElement {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      max-width: 700px;
      max-height: 80vh;
      overflow-y: auto;
      font-family: Arial, sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #0066ff; padding-bottom: 12px;';

    const title = document.createElement('h2');
    title.textContent = 'Keyboard Shortcuts';
    title.style.cssText = 'margin: 0; font-size: 24px; color: #333;';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 32px;
      height: 32px;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    dialog.appendChild(header);

    // Content
    const shortcuts = [
      {
        category: 'Tools',
        items: [
          { key: 'V', description: 'Select tool' },
          { key: 'P', description: 'Point tool' },
          { key: 'L', description: 'Line tool' },
          { key: 'C', description: 'Circle tool' },
          { key: 'Shift+L', description: 'Polyline tool' },
          { key: 'Shift+P', description: 'Polygon tool' },
          { key: 'B', description: 'Bezier spline tool' },
          { key: 'M', description: 'Measure tool' },
          { key: 'A', description: 'Area tool' },
          { key: 'R', description: 'Rotate view tool' },
          { key: 'Shift+D', description: 'Construction by distance' }
        ]
      },
      {
        category: 'View',
        items: [
          { key: 'Mouse Wheel', description: 'Zoom in/out' },
          { key: 'Space + Drag', description: 'Pan view' },
          { key: 'Alt + Drag', description: 'Rotate view' },
          { key: 'Ctrl+0', description: 'Reset view' },
          { key: '0-9', description: 'Set zoom level' }
        ]
      },
      {
        category: 'Edit',
        items: [
          { key: 'Ctrl+Z', description: 'Undo' },
          { key: 'Ctrl+Y', description: 'Redo' },
          { key: 'Ctrl+Shift+Z', description: 'Redo (alternate)' },
          { key: 'Delete', description: 'Delete selected' },
          { key: 'Ctrl+D', description: 'Duplicate selected' },
          { key: 'Ctrl+A', description: 'Select all' }
        ]
      },
      {
        category: 'Selection',
        items: [
          { key: 'Click', description: 'Select object' },
          { key: 'Shift+Click', description: 'Add to selection' },
          { key: 'Ctrl+Click', description: 'Toggle selection' },
          { key: 'Drag', description: 'Selection box' },
          { key: 'Escape', description: 'Clear selection / Cancel' }
        ]
      },
      {
        category: 'Snapping',
        items: [
          { key: 'G', description: 'Toggle grid snap' },
          { key: '1', description: 'Grid 1cm' },
          { key: '5', description: 'Grid 5cm' },
          { key: '0', description: 'Grid 10cm' }
        ]
      },
      {
        category: 'File',
        items: [
          { key: 'Ctrl+S', description: 'Save project' },
          { key: 'Ctrl+O', description: 'Open project' },
          { key: 'Ctrl+E', description: 'Export' }
        ]
      },
      {
        category: 'Drawing',
        items: [
          { key: 'Enter', description: 'Complete shape' },
          { key: 'Escape', description: 'Cancel drawing' },
          { key: 'Double-click', description: 'Finish multi-point shape' }
        ]
      }
    ];

    shortcuts.forEach(section => {
      const sectionEl = document.createElement('div');
      sectionEl.style.cssText = 'margin-bottom: 20px;';

      const categoryTitle = document.createElement('h3');
      categoryTitle.textContent = section.category;
      categoryTitle.style.cssText = 'font-size: 16px; color: #0066ff; margin-bottom: 10px;';
      sectionEl.appendChild(categoryTitle);

      const table = document.createElement('div');
      table.style.cssText = 'display: grid; grid-template-columns: 140px 1fr; gap: 8px;';

      section.items.forEach(item => {
        const keyEl = document.createElement('div');
        keyEl.innerHTML = `<kbd style="
          background: #f0f0f0;
          border: 1px solid #ccc;
          border-radius: 3px;
          padding: 4px 8px;
          font-family: monospace;
          font-size: 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        ">${item.key}</kbd>`;
        table.appendChild(keyEl);

        const descEl = document.createElement('div');
        descEl.textContent = item.description;
        descEl.style.cssText = 'font-size: 13px; color: #666; padding: 4px 0;';
        table.appendChild(descEl);
      });

      sectionEl.appendChild(table);
      dialog.appendChild(sectionEl);
    });

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top: 24px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 12px;';
    footer.textContent = 'Press ? or F1 to show this dialog';
    dialog.appendChild(footer);

    return dialog;
  }

  show(): void {
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.overlay);
  }

  unmount(): void {
    this.overlay.remove();
  }
}
```

### src/ui/StatusBar.ts

```typescript
import { ViewportTransform } from '../viewport/ViewportTransform';
import { LayerManager } from '../model/LayerManager';
import { Selection } from '../selection/Selection';
import { SnapManager } from '../snapping/SnapManager';

export class StatusBar {
  private container: HTMLElement;
  private transform: ViewportTransform;
  private layerManager: LayerManager;
  private selection: Selection;
  private snapManager: SnapManager;

  private coordsEl: HTMLElement;
  private toolEl: HTMLElement;
  private layerEl: HTMLElement;
  private selectionEl: HTMLElement;
  private zoomEl: HTMLElement;
  private gridEl: HTMLElement;
  private snapEl: HTMLElement;

  constructor(
    transform: ViewportTransform,
    layerManager: LayerManager,
    selection: Selection,
    snapManager: SnapManager
  ) {
    this.transform = transform;
    this.layerManager = layerManager;
    this.selection = selection;
    this.snapManager = snapManager;
    this.container = this.createStatusBar();
  }

  private createStatusBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.id = 'status-bar';
    bar.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 32px;
      background: #2c2c2c;
      color: #e0e0e0;
      display: flex;
      align-items: center;
      padding: 0 12px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      border-top: 1px solid #444;
      z-index: 1000;
    `;

    // Left section: Coordinates
    this.coordsEl = this.createSection('Cursor: (0, 0)');
    bar.appendChild(this.coordsEl);

    bar.appendChild(this.createSeparator());

    // Center section: Tool, Layer, Selection
    this.toolEl = this.createSection('Tool: Select');
    bar.appendChild(this.toolEl);

    bar.appendChild(this.createSeparator());

    this.layerEl = this.createSection('Layer: Default');
    bar.appendChild(this.layerEl);

    bar.appendChild(this.createSeparator());

    this.selectionEl = this.createSection('');
    bar.appendChild(this.selectionEl);

    // Spacer
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    bar.appendChild(spacer);

    // Right section: Zoom, Grid, Snap
    this.zoomEl = this.createSection('Zoom: 100%');
    bar.appendChild(this.zoomEl);

    bar.appendChild(this.createSeparator());

    this.gridEl = this.createSection('Grid: 10cm');
    bar.appendChild(this.gridEl);

    bar.appendChild(this.createSeparator());

    this.snapEl = this.createSection('Snap: ON', '#4CAF50');
    bar.appendChild(this.snapEl);

    return bar;
  }

  private createSection(text: string, color: string = '#e0e0e0'): HTMLElement {
    const section = document.createElement('div');
    section.textContent = text;
    section.style.cssText = `padding: 0 12px; color: ${color}; white-space: nowrap;`;
    return section;
  }

  private createSeparator(): HTMLElement {
    const sep = document.createElement('div');
    sep.style.cssText = 'width: 1px; height: 20px; background: #555; margin: 0 4px;';
    return sep;
  }

  updateCoordinates(x: number, y: number): void {
    this.coordsEl.textContent = `Cursor: (${x.toFixed(1)}, ${y.toFixed(1)})`;
  }

  updateTool(toolName: string): void {
    const names: Record<string, string> = {
      select: 'Select',
      point: 'Point',
      line: 'Line',
      circle: 'Circle',
      polyline: 'Polyline',
      polygon: 'Polygon',
      bezier: 'Bezier',
      measure: 'Measure',
      area: 'Area',
      rotate: 'Rotate View',
      constructByDistance: 'Distance Positioning'
    };
    this.toolEl.textContent = `Tool: ${names[toolName] || toolName}`;
  }

  updateLayer(): void {
    const activeLayer = this.layerManager.getActiveLayer();
    if (activeLayer) {
      this.layerEl.textContent = `Layer: ${activeLayer.name}`;
    }
  }

  updateSelection(): void {
    const count = this.selection.getSelectedObjects().length;
    if (count === 0) {
      this.selectionEl.textContent = '';
    } else if (count === 1) {
      this.selectionEl.textContent = '1 object selected';
    } else {
      this.selectionEl.textContent = `${count} objects selected`;
    }
  }

  updateZoom(): void {
    const zoom = this.transform.getZoom();
    this.zoomEl.textContent = `Zoom: ${(zoom * 100).toFixed(0)}%`;
  }

  updateGrid(): void {
    const spacing = this.snapManager.getGridSpacing();
    if (spacing < 100) {
      this.gridEl.textContent = `Grid: ${spacing}cm`;
    } else {
      this.gridEl.textContent = `Grid: ${(spacing / 100).toFixed(1)}m`;
    }
  }

  updateSnap(): void {
    const enabled = this.snapManager.isEnabled();
    this.snapEl.textContent = enabled ? 'Snap: ON' : 'Snap: OFF';
    this.snapEl.style.color = enabled ? '#4CAF50' : '#999';
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  unmount(): void {
    this.container.remove();
  }
}
```

### src/main.ts (integration)

```typescript
import { PropertyPanel } from './ui/PropertyPanel';
import { ShortcutsDialog } from './ui/ShortcutsDialog';
import { StatusBar } from './ui/StatusBar';

// Create property panel
const propertyPanel = new PropertyPanel(
  selection,
  layerManager,
  commandHistory,
  updateView
);
propertyPanel.mount(document.body);

// Update property panel when selection changes
selection.onChange(() => {
  propertyPanel.update();
  statusBar.updateSelection();
});

// Create shortcuts dialog
const shortcutsDialog = new ShortcutsDialog();
shortcutsDialog.mount(document.body);

// Create status bar
const statusBar = new StatusBar(
  viewport.getTransform(),
  layerManager,
  selection,
  snapManager
);
statusBar.mount(document.body);

// Update status bar on mouse move
viewport.getSVG().addEventListener('mousemove', (e) => {
  const rect = viewport.getSVG().getBoundingClientRect();
  const worldPos = viewport.getTransform().screenToWorld(
    e.clientX - rect.left,
    e.clientY - rect.top,
    rect.width,
    rect.height
  );
  statusBar.updateCoordinates(worldPos.x, worldPos.y);
});

// Update status bar when changing tools
function setTool(toolName: string) {
  // ... existing tool switching logic ...
  statusBar.updateTool(toolName);
}

// Update status bar on zoom
function updateView() {
  // ... existing render logic ...
  statusBar.updateZoom();
  statusBar.updateGrid();
  statusBar.updateSnap();
  propertyPanel.update();
}

// Keyboard shortcuts for dialog
document.addEventListener('keydown', (e) => {
  // Help dialog: ? or F1
  if (e.key === '?' || e.key === 'F1') {
    e.preventDefault();
    shortcutsDialog.show();
  }
  
  // ... existing shortcuts ...
});

// Enhanced tooltips
document.querySelectorAll('.tool-btn').forEach(btn => {
  const toolName = btn.id.replace('tool-', '');
  const shortcuts: Record<string, string> = {
    select: 'V',
    point: 'P',
    line: 'L',
    circle: 'C',
    bezier: 'B'
  };
  
  if (shortcuts[toolName]) {
    const currentTitle = btn.getAttribute('title') || '';
    btn.setAttribute('title', `${currentTitle} (${shortcuts[toolName]})`);
  }
});

// Zoom controls
const zoomInBtn = document.createElement('button');
zoomInBtn.textContent = '+';
zoomInBtn.title = 'Zoom In';
zoomInBtn.addEventListener('click', () => {
  viewport.getTransform().zoom(1.2, viewportWidth / 2, viewportHeight / 2);
  updateView();
});

const zoomOutBtn = document.createElement('button');
zoomOutBtn.textContent = '−';
zoomOutBtn.title = 'Zoom Out';
zoomOutBtn.addEventListener('click', () => {
  viewport.getTransform().zoom(0.8, viewportWidth / 2, viewportHeight / 2);
  updateView();
});

const zoomFitBtn = document.createElement('button');
zoomFitBtn.textContent = '⊡';
zoomFitBtn.title = 'Fit to View';
zoomFitBtn.addEventListener('click', () => {
  // Calculate bounding box and fit
  viewport.getTransform().reset();
  updateView();
});

// Add to UI
const zoomControls = document.createElement('div');
zoomControls.style.cssText = 'position: absolute; bottom: 40px; right: 10px; display: flex; gap: 4px;';
zoomControls.appendChild(zoomInBtn);
zoomControls.appendChild(zoomOutBtn);
zoomControls.appendChild(zoomFitBtn);
document.body.appendChild(zoomControls);

console.log('UI polish features loaded. Press ? or F1 for keyboard shortcuts');
```

## Test Plan

### Manual Testing Steps

1. **Property panel display test**
   - Select an object
   - Verify property panel appears
   - Verify shows object name, layer, geometry fields
   - Deselect object
   - Verify panel hides

2. **Property editing test**
   - Select a point
   - Change X coordinate to 100
   - Press Enter
   - Verify point moves to new position
   - Verify change is undoable

3. **Style editing test**
   - Select a line
   - Change stroke color using color picker
   - Verify line color updates immediately
   - Change stroke width to 5
   - Verify line thicker

4. **Multi-selection properties test**
   - Select 3 objects
   - Verify panel shows "3 objects selected"
   - Verify only common style fields shown
   - Change stroke color
   - Verify all 3 objects update

5. **Shortcuts dialog test**
   - Press ? key
   - Verify modal dialog appears
   - Verify shortcuts organized by category
   - Verify close button works
   - Click outside dialog
   - Verify closes

6. **Status bar coordinates test**
   - Move mouse around viewport
   - Verify cursor coordinates update in real-time
   - Verify shows format "(X.X, Y.Y)"
   - Verify precision to 0.1 cm

7. **Status bar tool indicator test**
   - Switch between tools
   - Verify "Tool: [Name]" updates
   - Verify correct friendly names displayed

8. **Status bar layer indicator test**
   - Switch active layer
   - Verify "Layer: [Name]" updates
   - Verify shows current active layer

9. **Status bar selection count test**
   - Select no objects - verify blank
   - Select 1 object - verify "1 object selected"
   - Select 5 objects - verify "5 objects selected"

10. **Status bar zoom indicator test**
    - Zoom in/out with mouse wheel
    - Verify "Zoom: XX%" updates
    - Verify percentage accurate

11. **Status bar snap indicator test**
    - Toggle grid snap with G key
    - Verify "Snap: ON" changes to "Snap: OFF"
    - Verify color changes (green when on, gray when off)

12. **Zoom controls test**
    - Click + button
    - Verify zooms in
    - Click − button
    - Verify zooms out
    - Click fit button
    - Verify view resets

13. **Enhanced tooltips test**
    - Hover over tool buttons
    - Verify tooltips show keyboard shortcuts
    - Example: "Select (V)"

14. **Layer dropdown in properties test**
    - Select object
    - Open layer dropdown in property panel
    - Change to different layer
    - Verify object moves to new layer
    - Verify change is undoable

15. **Read-only fields test**
    - Select circle
    - Verify circumference and area shown as read-only
    - Verify displayed but not editable
    - Change radius
    - Verify calculated fields update

## Acceptance Criteria

- [ ] PropertyPanel component implemented
- [ ] Shows properties for single selected object
- [ ] Shows common properties for multi-selection
- [ ] Editable fields for coordinates, dimensions
- [ ] Color pickers for stroke/fill
- [ ] Layer dropdown selector
- [ ] All edits use commands (undoable)
- [ ] Read-only calculated fields (area, length, etc.)
- [ ] ShortcutsDialog modal implemented
- [ ] Shortcuts organized by category
- [ ] Keyboard shortcuts styled with <kbd> elements
- [ ] Dialog shows on ? or F1 key
- [ ] Dialog closes on click outside or close button
- [ ] StatusBar component implemented
- [ ] Real-time cursor coordinates display
- [ ] Active tool indicator
- [ ] Active layer indicator
- [ ] Selection count display
- [ ] Zoom percentage display
- [ ] Grid spacing display
- [ ] Snap on/off indicator with color
- [ ] Zoom controls (+/−/fit buttons)
- [ ] Enhanced tooltips with keyboard shortcuts
- [ ] Property panel hides when nothing selected
- [ ] Property panel updates when selection changes
- [ ] All UI components properly styled
- [ ] No TypeScript compilation errors

## Deliverables

1. **src/ui/PropertyPanel.ts** - Object property editor
2. **src/ui/ShortcutsDialog.ts** - Keyboard shortcuts reference
3. **src/ui/StatusBar.ts** - Enhanced status bar
4. **Updated src/main.ts** - UI component integration
5. **Working property panel** - Edit object properties with undo
6. **Working shortcuts dialog** - Searchable keyboard reference
7. **Working status bar** - Real-time feedback for all states
8. **Zoom controls** - UI buttons for zoom operations

---

**Estimated effort**: 4-5 hours  
**Dependencies**: All previous slices (integrates with entire system)  
**Risk**: Low - primarily UI work, well-defined components

