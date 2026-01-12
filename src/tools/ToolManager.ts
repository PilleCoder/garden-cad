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
    this.attachKeyboardListeners();
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
    this.svg.addEventListener('dblclick', this.handleDoubleClick.bind(this));
    this.svg.addEventListener('contextmenu', this.handleContextMenu.bind(this));
  }

  private attachKeyboardListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private convertMouseEvent(e: MouseEvent): ToolMouseEvent {
    const rect = this.svg.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = this.transform.screenToWorld(screenX, screenY);

    return {
      worldPos,
      screenPos: { x: screenX, y: screenY },
      clientPos: { x: e.clientX, y: e.clientY },
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

  private handleContextMenu(e: MouseEvent): void {
    if (!this.activeTool) return;
    
    // Prevent default browser context menu
    e.preventDefault();
    
    // Call tool's context menu handler if it exists
    if (this.activeTool.onContextMenu) {
      const toolEvent = this.convertMouseEvent(e);
      this.activeTool.onContextMenu(toolEvent);
    }
  }

  private handleDoubleClick(e: MouseEvent): void {
    if (!this.activeTool) return;
    if (e.shiftKey || e.button === 1) return;
    
    // Prevent default selection
    e.preventDefault();
    
    // Call tool's double-click handler if it exists
    if (this.activeTool.onDoubleClick) {
      this.activeTool.onDoubleClick();
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.activeTool) return;
    
    // Call tool's keydown handler if it exists
    if (this.activeTool.onKeyDown) {
      this.activeTool.onKeyDown(e.key);
    }
  }

  private updateCursor(): void {
    if (this.activeTool) {
      this.svg.style.cursor = this.activeTool.getCursor();
    }
  }
}
