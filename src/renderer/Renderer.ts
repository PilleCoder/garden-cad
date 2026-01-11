import { Project } from '../model/Project';
import { ShapeRenderer } from './ShapeRenderer';

export class Renderer {
  private shapeRenderer: ShapeRenderer;
  private objectsGroup: SVGGElement;

  constructor(worldGroup: SVGGElement) {
    this.shapeRenderer = new ShapeRenderer();
    
    // Create dedicated group for objects (after grid)
    this.objectsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.objectsGroup.id = 'objects';
    worldGroup.appendChild(this.objectsGroup);
  }

  // Render all objects from project
  render(project: Project, zoom: number): void {
    // Clear existing objects
    while (this.objectsGroup.firstChild) {
      this.objectsGroup.removeChild(this.objectsGroup.firstChild);
    }

    // Render all objects
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
