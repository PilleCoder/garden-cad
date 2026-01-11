# Technology Stack

## Core Technologies

### TypeScript 5.x
- **Version**: Latest stable (5.x)
- **Compiler**: `tsc` via Vite
- **Strict Mode**: Enabled for type safety
- **Target**: ES2020 (modern browser support)

### Build Tool: Vite
- **Why Vite**: Fast HMR, native ESM, excellent TypeScript support
- **Dev Server**: Hot module replacement for rapid development
- **Production**: Optimized bundling with Rollup

### Rendering: Canvas API
- **Why Canvas**: Simplicity for 2D graphics, sufficient performance for garden planning
- **Not WebGL**: Overkill for our use case, Canvas API provides easier debugging
- **Context**: 2D rendering context (`CanvasRenderingContext2D`)

## Development Tools

### Testing: Vitest
- **Why Vitest**: Native Vite integration, TypeScript support out-of-box, Jest-compatible API
- **Speed**: Extremely fast test execution
- **Coverage**: Built-in code coverage with c8

### Code Quality

#### ESLint
- TypeScript ESLint parser and rules
- Enforces code consistency
- Catches common bugs at development time

#### Prettier
- Consistent code formatting
- Integrates with ESLint
- Auto-format on save (recommended)

## Project Structure

```
garden-cad/
├── src/
│   ├── geometry/       # Shape models (Point, Line, Circle, etc.)
│   ├── viewport/       # Pan, zoom, coordinate transformation
│   ├── tools/          # Drawing tools (line, circle, rectangle, etc.)
│   ├── renderer/       # Canvas rendering logic
│   ├── types/          # Shared TypeScript types and interfaces
│   ├── utils/          # Helper functions
│   └── main.ts         # Application entry point
├── tests/              # Test files (mirrors src structure)
├── docs/               # Documentation
└── dist/               # Build output (git-ignored)
```

## Browser Support
- Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ features
- No IE11 support

## Dependencies Philosophy
- Minimal dependencies
- Vanilla TypeScript where possible
- No heavy frameworks (React, Vue) for slice 1-20
- Future: Consider framework after core functionality proven

## Performance Targets
- Target: 60 FPS rendering
- Max entities before optimization: 1000 shapes
- Canvas size: Up to 4K resolution support