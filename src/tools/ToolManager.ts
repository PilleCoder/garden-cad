import { Tool, ToolMouseEvent } from './Tool';
import { ViewportTransform } from '../viewport/ViewportTransform';

export class ToolManager {
  private activeTool: Tool | null = null;
  private svg: SVGSVGElement;
  private transform: ViewportTransform;

  constructor(svg: SVGSVGElement, transform: ViewportTransform) {
    this.svg = svg;
    this.transform = transform;
    this.attachEventListeners();
  }

  setActiveTool(tool: Tool): void {
    if (this.activeTool) {
      this.activeTool.onDeactivate();
    }
    this.activeTool = tool;
    if (this.activeTool) {
      this.activeTool.onActivate();
      this.updateCursor();
    }
  }

  getActiveTool(): Tool | null {
    return this.activeTool;
  }

  private attachEventListeners(): void {
    this.svg.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.svg.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.svg.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.svg.addEventListener('click', this.handleClick.bind(this));
  }

  private convertMouseEvent(e: MouseEvent): ToolMouseEvent {
    const rect = this.svg.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = this.transform.screenToWorld(screenX, screenY);

    return {
      worldPos,
      screenPos: { x: screenX, y: screenY },
      button: e.button,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey
    };
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.activeTool) return;
    if (e.shiftKey || e.button === 1) return; // Let viewport handle pan
    
    const toolEvent = this.convertMouseEvent(e);
    this.activeTool.onMouseDown(toolEvent);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.activeTool) return;
    const toolEvent = this.convertMouseEvent(e);
    this.activeTool.onMouseMove(toolEvent);
    this.updateCursor();
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.activeTool) return;
    const toolEvent = this.convertMouseEvent(e);
    this.activeTool.onMouseUp(toolEvent);
  }

  private handleClick(e: MouseEvent): void {
    if (!this.activeTool) return;
    if (e.shiftKey || e.button === 1) return;
    
    const toolEvent = this.convertMouseEvent(e);
    this.activeTool.onMouseClick(toolEvent);
  }

  private updateCursor(): void {
    if (this.activeTool) {
      this.svg.style.cursor = this.activeTool.getCursor();
    }
  }
}
