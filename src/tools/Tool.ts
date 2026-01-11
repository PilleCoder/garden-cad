import { Point } from '../types/geometry';

export interface ToolMouseEvent {
  worldPos: Point;
  screenPos: Point;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

export interface Tool {
  readonly name: string;
  
  // Lifecycle
  onActivate(): void;
  onDeactivate(): void;
  
  // Mouse events (world coordinates provided)
  onMouseDown(event: ToolMouseEvent): void;
  onMouseMove(event: ToolMouseEvent): void;
  onMouseUp(event: ToolMouseEvent): void;
  onMouseClick(event: ToolMouseEvent): void;
  
  // Cursor
  getCursor(): string;
}
