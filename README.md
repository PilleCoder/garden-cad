# GardenCAD

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/yourusername/garden-cad/releases/tag/v0.1.0)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

GardenCAD is a local-first, browser-based 2D CAD-style application for planning, documenting, and evolving a garden or property layout with centimeter-level precision. The tool enables users to manually define geometry on a scalable 2D plane, organize them into layers, and accurately measure distances and areas over time.

## Features (v0.1.0 - MVP)

### ✨ Current Features

- **SVG-Based Viewport**: Zoomable and pannable 2D canvas with 1:1 coordinate precision (1 SVG unit = 1 cm)
- **Drawing Tools**: Create points, lines, and circles with precision
- **Selection & Move**: Select and reposition objects with mouse interaction
- **Grid Display**: Visual grid overlay for spatial reference
- **Tool Switching**: Seamless switching between selection and drawing modes

### 🚧 Coming Soon

- Grid snapping and alignment tools
- Multi-layer organization system
- Distance and area measurement tools
- Save/Load functionality with local storage
- Polyline and polygon tools
- Advanced snapping (endpoints, midpoints, intersections)

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes and the [roadmap](#roadmap) for future plans.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd garden-cad
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server with hot module reloading:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

### Testing

Run tests:

```bash
npm test
```

Run tests with UI:

```bash
npm run test:ui
```

Run tests with coverage:

```bash
npm run test:coverage
```

### Code Quality

Type check:

```bash
npm run typecheck
```

Lint code:

```bash
npm run lint
```

Fix linting issues:

```bash
npm run lint:fix
```

Format code:

```bash
npm run format
```

## Project Structure

```
garden-cad/
├── src/
│   ├── main.ts              # Application entry point
│   ├── geometry/            # Geometry models and types
│   ├── model/               # Project and data models
│   ├── renderer/            # SVG rendering system
│   ├── selection/           # Selection management
│   ├── tools/               # Drawing and interaction tools
│   ├── types/               # Shared type definitions
│   └── viewport/            # Viewport, transform, and grid
├── tests/                   # Test files
├── docs/                    # Documentation
└── index.html              # Application shell
```

## Architecture

GardenCAD follows a modular architecture with clear separation of concerns:

- **Viewport**: Manages the SVG canvas, pan/zoom, and coordinate transforms
- **Geometry**: Defines the shape models (Point, Line, Circle)
- **Renderer**: Handles SVG rendering of geometric objects
- **Tools**: Implements user interaction modes (Select, Point, Line, Circle)
- **Selection**: Manages object selection and visual feedback

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed design documentation.

## Roadmap

### v1.0.0 - Core Features
- Layer system with visibility controls
- Grid snapping and alignment
- Measurement tools (distance, area)
- Local persistence (IndexedDB)
- Polyline and polygon tools

### v2.0.0 - Advanced Tools
- Advanced snapping (endpoints, midpoints, intersections)
- View rotation with compass
- Undo/redo system
- Bezier curve tool

### v3.0.0 - Mobile & PWA
- Progressive Web App features
- Touch-optimized controls
- Camera-assisted measurements
- Offline functionality

See [docs/ELEPHANT_CARPACCIO_SLICE_PLAN.md](docs/ELEPHANT_CARPACCIO_SLICE_PLAN.md) for the complete implementation plan.

## Contributing

This project follows trunk-based development with slice-based feature branches. See [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) for contribution guidelines.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Tech Stack

- **TypeScript** - Type-safe development
- **Vite** - Fast development and building
- **Vitest** - Unit testing framework
- **SVG** - Scalable vector graphics rendering
- **ESLint + Prettier** - Code quality and formatting

See [docs/TECH_STACK.md](docs/TECH_STACK.md) for detailed technical decisions.
