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
              <button class="layer-visibility-btn" data-layer-id="${layer.id}" title="Toggle visibility"
                      style="background: none; border: none; cursor: pointer; font-size: 16px; padding: 0; width: 24px;">
                ${layer.isVisible() ? '👁️' : '🚫'}
              </button>
              <button class="layer-lock-btn" data-layer-id="${layer.id}" title="Toggle lock"
                      style="background: none; border: none; cursor: pointer; font-size: 16px; padding: 0; width: 24px;">
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
