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
      { id: 'reference', name: 'Reference Points', order: 5 },
      { id: 'measurements', name: 'Measurements', order: 6 }
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
