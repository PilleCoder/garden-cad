import { Project } from '../model/Project';
import { ShapeRenderer } from './ShapeRenderer';
import { LayerManager } from '../model/LayerManager';

export class Renderer {
  private shapeRenderer: ShapeRenderer;
  private objectsGroup: SVGGElement;
  private layerManager?: LayerManager;

  constructor(worldGroup: SVGGElement) {
    this.shapeRenderer = new ShapeRenderer();
    
    // Create dedicated group for objects (after grid)
    this.objectsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.objectsGroup.id = 'objects';
    worldGroup.appendChild(this.objectsGroup);
  }

  setLayerManager(layerManager: LayerManager): void {
    this.layerManager = layerManager;
  }

  // Render all objects from project
  render(project: Project, zoom: number): void {
    // Clear existing objects
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

  // Get objects group for direct manipulation (selection, etc.)
  getObjectsGroup(): SVGGElement {
    return this.objectsGroup;
  }
}
