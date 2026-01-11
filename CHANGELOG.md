# Changelog

All notable changes to GardenCAD will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-11

### Added - MVP Release (Slices 1-5)

#### Development Environment (Slice 1)
- Initial project setup with Vite, TypeScript, and Vitest
- ESLint and Prettier configuration for code quality
- Modern development tooling with hot module reloading
- Comprehensive test infrastructure

#### SVG Viewport Foundation (Slice 2)
- SVG-based viewport with 1:1 coordinate system (1 SVG unit = 1 cm)
- Pan and zoom capabilities using SVG transforms
- Responsive viewport that adapts to window size
- Grid rendering system for visual reference
- Coordinate system stability across zoom levels

#### Geometry Rendering (Slice 3)
- Core geometry model supporting Points, Lines, and Circles
- Type-safe geometry definitions with TypeScript
- SVG-based shape rendering system
- Layer-based organization structure
- Project model for managing geometric objects

#### Selection and Move Tool (Slice 4)
- Interactive selection tool with mouse hit-testing
- Visual selection feedback for selected objects
- Drag-to-move functionality with live coordinate updates
- Precise object manipulation maintaining centimeter accuracy
- Selection rendering system with visual indicators

#### Drawing Tools (Slice 5)
- Point drawing tool for precise coordinate placement
- Line drawing tool with two-point definition
- Circle drawing tool with center and radius
- Tool management system for switching between modes
- Modal drawing interactions with tool-specific behaviors

### Technical Highlights

- **TypeScript**: Full type safety across the codebase
- **SVG Rendering**: Scalable, precise vector graphics
- **Modular Architecture**: Clean separation of concerns (viewport, geometry, tools, renderer)
- **Test Coverage**: Unit tests for core functionality
- **Modern Tooling**: Vite for fast development, Vitest for testing

### Known Limitations

- Single layer only (multi-layer system coming in v1.0.0)
- No grid snapping yet (coming in v1.0.0)
- No persistence/save functionality (coming in v1.0.0)
- Limited to basic shapes (polylines/polygons coming in v1.0.0)

### Roadmap

- **v1.0.0**: Layer system, grid snapping, measurement tools, persistence, polyline/polygon support
- **v2.0.0**: Advanced snapping, view rotation, undo/redo system, bezier curves
- **v3.0.0**: Mobile PWA, touch support, camera-assisted measurements

[0.1.0]: https://github.com/yourusername/garden-cad/releases/tag/v0.1.0
