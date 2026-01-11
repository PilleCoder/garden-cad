import { ViewportTransform } from './ViewportTransform';
import { Grid } from './Grid';
import { Point } from '../types/geometry';
import { Renderer } from '../renderer/Renderer';
import { Project } from '../model/Project';
import { ToolManager } from '../tools/ToolManager';
import { Tool } from '../tools/Tool';
import { Selection } from '../selection/Selection';
import { SelectionRenderer } from '../selection/SelectionRenderer';

export class Viewport {
  private svg: SVGSVGElement;
  private worldGroup: SVGGElement;
  private previewGroup: SVGGElement;
  private transform: ViewportTransform;
  private grid: Grid;
  private isPanning: boolean = false;
  private lastMousePos: Point = { x: 0, y: 0 };
  private coordinateDisplay: HTMLElement;
  private renderer?: Renderer;
  private project?: Project;
  private toolManager?: ToolManager;
  private selection?: Selection;
  private selectionRenderer?: SelectionRenderer;

  constructor(container: HTMLElement) {
    this.transform = new ViewportTransform();
    this.grid = new Grid();

    // Create SVG
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';
    this.svg.style.background = '#f8f8f8';

    // Create world coordinate group
    this.worldGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.worldGroup.id = 'world';
    this.svg.appendChild(this.worldGroup);

    // Create preview group (above objects, below selection)
    this.previewGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.previewGroup.id = 'preview';
    this.worldGroup.appendChild(this.previewGroup);

    container.appendChild(this.svg);

    // Create coordinate display overlay
    this.coordinateDisplay = document.createElement('div');
    this.coordinateDisplay.style.position = 'absolute';
    this.coordinateDisplay.style.bottom = '10px';
    this.coordinateDisplay.style.right = '10px';
    this.coordinateDisplay.style.background = 'rgba(0,0,0,0.7)';
    this.coordinateDisplay.style.color = 'white';
    this.coordinateDisplay.style.padding = '8px 12px';
    this.coordinateDisplay.style.fontFamily = 'monospace';
    this.coordinateDisplay.style.fontSize = '12px';
    this.coordinateDisplay.style.borderRadius = '4px';
    this.coordinateDisplay.style.pointerEvents = 'none';
    container.appendChild(this.coordinateDisplay);

    this.attachEventListeners();
    this.render();
  }

  private attachEventListeners(): void {
    // Pan on middle mouse or Shift+drag
    this.svg.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        this.isPanning = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;
        this.transform.pan(dx, dy);
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this.render();
      }

      // Update coordinate display
      const rect = this.svg.getBoundingClientRect();
      const worldPos = this.transform.screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top
      );
      this.coordinateDisplay.textContent = 
        `X: ${worldPos.x.toFixed(1)} cm  Y: ${worldPos.y.toFixed(1)} cm  Zoom: ${(this.transform.getState().zoom * 100).toFixed(0)}%`;
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
    });

    // Zoom on wheel
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.svg.getBoundingClientRect();
      const zoomDelta = e.deltaY < 0 ? 1.1 : 0.9;
      this.transform.zoomAt(e.clientX - rect.left, e.clientY - rect.top, zoomDelta);
      this.render();
    });
  }

  private render(): void {
    // Apply transform to world group
    this.worldGroup.setAttribute('transform', this.transform.toSVGTransform());

    // Render grid in world coordinates
    const svgRect = this.svg.getBoundingClientRect();
    this.grid.render(this.worldGroup, this.transform.getState(), svgRect);

    // Render geometry objects
    if (this.renderer && this.project) {
      this.renderer.render(this.project, this.transform.getState().zoom);
    }

    // Render selection indicators
    if (this.selectionRenderer) {
      this.selectionRenderer.render(this.transform.getState().zoom);
    }

    // Scale preview elements for proper display
    this.scalePreviewElements(this.transform.getState().zoom);
  }

  private scalePreviewElements(zoom: number): void {
    // Scale text and stroke-widths in preview for visibility
    const texts = this.previewGroup.querySelectorAll('text');
    texts.forEach(text => {
      text.setAttribute('font-size', (14 / zoom).toString());
      const currentStrokeWidth = text.getAttribute('stroke-width');
      if (currentStrokeWidth) {
        text.setAttribute('stroke-width', (parseFloat(currentStrokeWidth) / zoom).toString());
      }
    });
    
    const lines = this.previewGroup.querySelectorAll('line');
    lines.forEach(line => {
      const width = line.getAttribute('stroke-width');
      if (width && !line.hasAttribute('data-no-scale')) {
        line.setAttribute('stroke-width', (parseFloat(width) / zoom).toString());
      }
    });
    
    const circles = this.previewGroup.querySelectorAll('circle');
    circles.forEach(circle => {
      const r = circle.getAttribute('r');
      if (r && parseFloat(r) < 10) { // Small circles (handles, etc.)
        circle.setAttribute('r', (parseFloat(r) / zoom).toString());
      }
    });
  }

  // Public render method for tools to trigger updates
  public refresh(): void {
    this.render();
  }

  reset(): void {
    this.transform.reset();
    this.render();
  }

  // Set project and initialize renderer
  setProject(project: Project): void {
    this.project = project;
    this.renderer = new Renderer(this.worldGroup);
    
    // Initialize selection system
    this.selection = new Selection();
    this.selectionRenderer = new SelectionRenderer(this.worldGroup, this.selection, project);
    
    // Initialize tool manager
    this.toolManager = new ToolManager(this.svg, this.transform);
    
    this.render();
  }

  // Set active tool
  setTool(tool: Tool): void {
    if (this.toolManager) {
      this.toolManager.setActiveTool(tool);
    }
  }

  getSelection(): Selection | undefined {
    return this.selection;
  }

  getWorldGroup(): SVGGElement {
    return this.worldGroup;
  }

  getPreviewGroup(): SVGGElement {
    return this.previewGroup;
  }
}
