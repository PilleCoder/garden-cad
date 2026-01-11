# GardenCAD Architecture

## Overview
GardenCAD is a browser-based 2D CAD application built with vanilla TypeScript and Canvas API. The architecture follows a layered approach with clear separation of concerns.

## Project Structure

```
garden-cad/
├── src/
│   ├── geometry/           # Domain models for shapes
│   │   ├── Point.ts       # 2D point primitive
│   │   ├── Line.ts        # Line segment
│   │   ├── Circle.ts      # Circle shape
│   │   ├── Rectangle.ts   # Rectangle shape
│   │   └── Polyline.ts    # Multi-segment line
│   │
│   ├── viewport/           # Canvas coordinate system
│   │   ├── Viewport.ts    # Pan, zoom, world↔screen transforms
│   │   └── Camera.ts      # View state management
│   │
│   ├── tools/              # User interaction tools
│   │   ├── Tool.ts        # Base tool interface
│   │   ├── LineTool.ts    # Line drawing tool
│   │   ├── CircleTool.ts  # Circle drawing tool
│   │   └── SelectTool.ts  # Selection/editing tool
│   │
│   ├── renderer/           # Canvas rendering
│   │   ├── Renderer.ts    # Main rendering engine
│   │   ├── Grid.ts        # Background grid rendering
│   │   └── styles.ts      # Visual styling constants
│   │
│   ├── state/              # Application state
│   │   ├── DrawingState.ts # Canvas entities and document
│   │   └── UIState.ts      # Tool selection, mode
│   │
│   ├── types/              # Shared TypeScript types
│   │   ├── geometry.ts    # Geometry interfaces
│   │   └── events.ts      # Event type definitions
│   │
│   ├── utils/              # Helper functions
│   │   ├── math.ts        # Math utilities
│   │   └── validation.ts  # Input validation
│   │
│   └── main.ts             # Application entry point
│
├── tests/                  # Test files (mirrors src/)
│   ├── geometry/
│   ├── viewport/
│   └── ...
│
├── docs/                   # Documentation
│   ├── slices/            # Per-slice implementation docs
│   └── ...
│
├── public/                 # Static assets
└── dist/                   # Build output (gitignored)
```

## Core Concepts

### 1. Geometry Layer (`src/geometry/`)
**Purpose**: Domain models representing shapes and their mathematical properties.

**Key Principles:**
- Pure data structures with no rendering logic
- Immutable where possible
- Rich with geometric operations (intersect, contains, distance, etc.)
- Serializable for save/load functionality

**Example:**
```typescript
interface Point {
  x: number;
  y: number;
}

interface Line {
  start: Point;
  end: Point;
}
```

### 2. Viewport Layer (`src/viewport/`)
**Purpose**: Coordinate transformation between world space and screen space.

**Responsibilities:**
- Pan: Translate the view
- Zoom: Scale the view
- Transform: Convert world coordinates ↔ screen coordinates
- Handle canvas resize

**Key Concepts:**
- **World Space**: Infinite 2D coordinate system (e.g., millimeters, meters)
- **Screen Space**: Canvas pixel coordinates (0,0 at top-left)

### 3. Tools Layer (`src/tools/`)
**Purpose**: Handle user interaction and create/modify geometry.

**Tool Lifecycle:**
1. **Activate**: Tool becomes active (cursor change, UI update)
2. **Mouse Events**: Handle mousedown, mousemove, mouseup
3. **Create Geometry**: Generate geometry objects
4. **Deactivate**: Clean up temporary state

**Tool Interface:**
```typescript
interface Tool {
  onMouseDown(point: Point): void;
  onMouseMove(point: Point): void;
  onMouseUp(point: Point): void;
  onActivate(): void;
  onDeactivate(): void;
  getPreview(): Geometry | null; // Temporary visual feedback
}
```

### 4. Renderer Layer (`src/renderer/`)
**Purpose**: Draw everything to the canvas.

**Rendering Pipeline:**
```
State → Viewport Transform → Canvas Drawing → Display
```

**What Gets Rendered:**
1. Background grid (fixed to world space)
2. Geometry entities (lines, circles, etc.)
3. Tool preview (temporary geometry)
4. Selection highlights
5. UI overlays (coordinates, measurements)

**Performance Considerations:**
- Clear and redraw entire canvas each frame (simple, works for 1000s of entities)
- Future optimization: dirty rectangles, offscreen canvases

### 5. State Management (`src/state/`)
**Purpose**: Single source of truth for application data.

**DrawingState:**
- List of all geometry entities
- Current tool selection
- Selection set
- Undo/redo history (future slices)

**Why Centralized State:**
- Easier testing
- Enables undo/redo
- Simplifies save/load
- Clear data flow

## Data Flow

```
User Input (Mouse/Keyboard)
        ↓
    Tool Layer (interpret interaction)
        ↓
    State Layer (update entities)
        ↓
    Renderer (draw updated state)
        ↓
    Canvas (visual output)
```

## Coordinate Systems

### World Space
- Origin: Arbitrary (typically center of initial view)
- Units: Real-world units (mm, meters - TBD in slice plan)
- Infinite extents
- Used for: Geometry storage, calculations

### Screen Space
- Origin: Top-left of canvas (0, 0)
- Units: Pixels
- Bounded by canvas size
- Used for: Mouse events, rendering

### Viewport Transformation
```typescript
// World → Screen
screenX = (worldX - viewport.offsetX) * viewport.scale;
screenY = (worldY - viewport.offsetY) * viewport.scale;

// Screen → World
worldX = screenX / viewport.scale + viewport.offsetX;
worldY = screenY / viewport.scale + viewport.offsetY;
```

## Design Patterns

### 1. Strategy Pattern (Tools)
Each tool implements the same interface but with different behavior.

### 2. Observer Pattern (State Updates)
State changes trigger re-renders (simple callback for now, event system later).

### 3. Immutable Updates
Geometry objects don't mutate - create new instances for changes.

## Testing Strategy

### Unit Tests (`tests/geometry/`, `tests/viewport/`)
- Test pure functions and geometry math
- No canvas/DOM dependencies
- Fast execution

### Integration Tests (`tests/tools/`)
- Mock canvas context
- Test tool behavior across multiple interactions
- Verify state updates

### Manual Testing
- Visual verification in browser
- Each slice should be manually testable
- Use dev server with HMR for rapid feedback

## Future Considerations (Post Slice-20)

### Performance Optimizations
- Spatial indexing (quadtree) for large drawings
- Dirty rectangle rendering
- Web Workers for heavy calculations

### Architecture Evolution
- Consider framework (React/Vue) for complex UI
- State management library (Zustand, Jotai)
- Canvas vs. WebGL trade-offs

### Extensibility
- Plugin system for custom tools
- Custom geometry types
- Export formats (DXF, SVG, PDF)

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Canvas API (not WebGL) | Sufficient for 2D CAD, easier to debug, simpler code |
| Vanilla TypeScript | Learn fundamentals before framework complexity |
| Strict TypeScript | Catch bugs early, better IDE support |
| Vite | Fast HMR, modern tooling, simple config |
| Vitest | Matches Vite, Jest-compatible API |
| No framework (slices 1-20) | Prove core architecture before adding framework |

## References
- Slice Plan: `docs/ELEPHANT_CARPACCIO_SLICE_PLAN.md`
- Tech Stack: `docs/TECH_STACK.md`
- Git Workflow: `docs/GIT_WORKFLOW.md`