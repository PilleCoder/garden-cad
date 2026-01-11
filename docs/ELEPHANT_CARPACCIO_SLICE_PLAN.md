# Plan: GardenCAD Incremental Implementation

Build a browser-based 2D CAD application for garden planning with centimeter precision, using TypeScript and SVG. Start from zero code with minimal tooling, implement core viewport and geometry incrementally, then add layers, tools, and persistence.

## Elephant Carpaccio Plan Summary:

- **Slices 1-5**: Foundation (dev environment, basic shapes, viewport, rendering)
- **Slices 6-10**: Core features (selection, layers, measurement, save/load, multi-vertex shapes)
- **Slices 11-15**: Advanced tools (snapping, rotation, trilateration, undo/redo, bezier curves)
- **Slices 16-20**: Polish & mobile (UI refinement, attachments, performance, PWA, camera measurements)

**Total**: 20 incremental, testable implementation steps
Estimated effort: 90-100 development hours

## Steps

1. **Bootstrap minimal dev environment**: Create package.json, tsconfig.json, and index.html with Vite dev server; add basic .gitignore and src/main.ts entry point

2. **Implement SVG viewport foundation**: Build coordinate system (1 SVG unit = 1 cm), basic pan/zoom using SVG transforms in src/viewport/, render empty grid, and prove coordinate stability

3. **Add single-layer geometry rendering**: Create geometry model (src/geometry/types.ts) for Point/Line/Circle, implement SVG rendering (src/renderer/), and render hardcoded test shapes on canvas

4. **Build selection and move tool**: Implement mouse hit-testing, object selection with visual feedback, drag-to-move with live coordinate updates, and prove coordinate precision

5. **Add drawing tools (Point, Line, Circle)**: Create tool system (src/tools/) with tool switching, modal drawing interaction, numeric coordinate input fields, and geometry creation

6. **Implement grid snapping**: Add configurable grid (1/5/10 cm), visual snap indicators, snap-to-grid for drawing and moving, and keyboard toggle for snapping

7. **Build layer system**: Create layer model and UI panel, implement visibility/lock toggles, assign objects to layers, and add layer-aware selection

8. **Add measurement tools**: Implement distance measurement between points, area calculation for polygons, live measurement preview during drawing, and unit display (cm/m/m²)

9. **Implement persistence layer**: Create JSON serialization (src/persistence/), IndexedDB storage adapter, save/load/export functions, and schema versioning

10. **Add Polyline and Polygon tools**: Extend geometry model, implement multi-point drawing with live preview, close-polygon action, and editable control points

11. **Build advanced snapping**: Add endpoint/midpoint detection, intersection snapping, angle constraints (0°/45°/90°), and visual snap guides

12. **Implement view rotation and compass**: Add Z-axis rotation control, persistent compass overlay showing azimuth and cardinal directions, and north-up reset toggle

13. **Add construction-by-distance tool**: Create distance-to-two-objects positioning, provenance storage in metadata, and UI for entering reference distances

14. **Build undo/redo system**: Implement command pattern for all mutations, history stack with limits, and keyboard shortcuts (Ctrl+Z/Ctrl+Y)

15. **Add Bezier spline tool**: Implement cubic Bezier curves, control point editing, smooth path rendering, and spline-to-polyline conversion

16. **Polish UI and precision features**: Add numeric dimension input for all shapes, object property panel, keyboard shortcuts reference, and precision mode indicators

17. **Implement attachment and capture metadata**: Extend data model for photos and sensor data, create attachment storage interface, and prepare mobile capture schema

18. **Performance optimization**: Add spatial indexing (quadtree) for hit-testing, implement viewport culling, optimize SVG re-rendering, and test with 1000+ objects

19. **Create mobile PWA foundation**: Add service worker for offline, implement touch-friendly controls, create installable manifest, and test responsive layouts

20. **Build camera-assisted measurement**: Implement photo capture, perspective reference tools, calibration wizard, and measurement-from-photo workflow