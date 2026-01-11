# GardenCAD – Comprehensive Project Description

## 1. Overview

**GardenCAD** is a local-first, browser-based 2D CAD-style application for planning, documenting, and evolving a garden or property layout with centimeter-level precision. The tool enables users to manually define geometry (property boundaries, buildings, trees, paths, beds, utilities) on a scalable 2D plane, organize them into layers, and accurately measure distances and areas over time.

The project is explicitly designed for **long-term use**, **offline operation**, and **precise real‑world planning**, while remaining significantly simpler and more approachable than professional CAD software.

---

## 2. Goals and Non-Goals

### 2.1 Primary Goals

* Provide a **precise 2D planning environment** with **1 cm accuracy**
* Enable **manual coordinate-based drawing and editing**
* Support **CAD-like workflows** (snapping, constraints, measurement)
* Allow **layered organization** of garden elements
* Operate **fully offline** in a browser or localhost environment
* Use **open, durable data formats** suitable for long-term evolution

### 2.2 Non-Goals

* No real-time collaboration
* No photorealistic rendering
* No full 3D modeling (2D is authoritative)
* No dependency on cloud services
* No automatic GIS or GPS integration (manual input is primary)

---

## 3. Target Users

* Homeowners planning and evolving a garden over multiple years
* Hobby gardeners requiring precise spacing and measurements
* Technically inclined users who value accuracy and control
* Users who prefer ownership of their data and offline operation

---

## 4. Functional Requirements

### 4.0 Mobile & Sensor Support (summary)

This project supports optional mobile capture (camera/AR/GPS) for onsite measurements; see Section 13 for full details. The mobile baseline is PWA-first with an optional native wrapper for advanced sensors and storage.

### 4.1 Workspace & Viewport

* Infinite 2D plane rendered using **SVG**
* Pan, zoom, and rotate the view
* Stable world coordinate system independent of zoom level
* Configurable grid (1 cm, 5 cm, 10 cm, etc.)

* Rotate view around the Z axis (bearing); by default the view's Z rotation is `0` (north-up)
* Compass overlay: show current viewing azimuth (N/E/S/W and degrees) while rotating the view

### 4.2 Coordinate System

* Internal unit: **centimeters**
* Deterministic geometry (1 SVG unit = 1 cm)
* Viewport transformations applied separately from geometry

* Z axis: view rotation is represented as a Z rotation value; geometry is stored in the XY plane and the default Z rotation is `0` so sketches are north-up unless the user rotates the view

### 4.3 Geometry Objects

Supported object types:

* Point
* Line segment
* Polyline
* Polygon
* Circle (e.g. trees, canopies)
* Bezier spline (paths, organic shapes)

Each object contains:

* Unique ID
* Layer assignment
* Geometry definition (coordinates in cm)
* Optional metadata (name, category, notes)
* Optional construction constraints (provenance): allow storing how an object's position was derived (e.g., distances to two reference objects)

### 4.4 Drawing & Editing Tools

* Object creation tools for each geometry type
* Construct-by-distance tool: create a new object by entering distances to two existing objects; the system computes the new position and stores the construction provenance
* Selection tool with resize and move handles
* Numeric input for precise dimensions
* Object duplication and deletion
* Editable control points for polylines and splines

### 4.5 Snapping & Precision Tools

* Grid snapping
* Endpoint snapping
* Midpoint snapping
* Angle snapping (e.g. 0°, 45°, 90°)
* Visual snapping indicators

### 4.6 Measurement Tools

* Distance measurement between arbitrary points
* Perimeter calculation for closed shapes
* Area calculation for polygons
* Live measurement preview during drawing
* Display in cm, m, and m²

### 4.7 Layers

* Unlimited number of layers
* Toggle visibility per layer
* Lock/unlock layers
* Adjustable layer opacity
* Logical grouping (e.g. property, buildings, vegetation)

### 4.8 Persistence & Data Management

* Local-first storage (IndexedDB or localStorage)
* Export/import as JSON
* Versioned document format
* Optional snapshot history for rollback
 
### 4.9 Mobile & Sensor Measurement

* Camera-assisted capture and sketching (photo + perspective/reference tools)
* AR Measure Mode (optional): place anchors and capture distances/areas via AR when available
* Calibration wizard: per-device calibration using a known-length reference
* GPS-tagged anchors: optional geolocation + accuracy metadata for anchors
* Quick-capture widget: fast capture of photo + sensor data + timestamp for later refinement
* Precision & uncertainty: store and display estimated uncertainty for sensor-derived measures

---

## 5. Non-Functional Requirements

### 5.1 Offline Operation

* Fully functional without internet access
* Runs in a modern browser on localhost

### 5.2 Performance

* Smooth interaction with hundreds to low thousands of objects
* Stable zoom and pan at any scale

Mobile performance notes summarized — see Section 13.

### 5.3 Longevity

* Human-readable, open data format
* Minimal external dependencies
* Forward-compatible schema versioning

### 5.4 Usability

* CAD-inspired but simplified UI
* Immediate visual feedback for precision actions
* Clear separation between drawing and navigation modes

### 5.5 Mobile UX & Measurement Requirements

Mobile UX and measurement details are included in Section 13; key items include touch-friendly handles, a calibration flow, adjustable snapping tolerance, sensor-noise handling, and clear permission prompts.


---

## 6. Technology Stack

### 6.1 Core Technologies

* **TypeScript** – application logic, geometry, state
* **HTML** – structure and UI
* **SVG** – rendering and interaction layer

### 6.2 Supporting Libraries (Indicative)

* SVG pan/zoom utility
* D3.js or equivalent for geometry utilities
* Optional geometry helper libraries for math

### 6.3 Deployment

* Static web application
* Served via local web server or file system
* Optional future packaging via Electron or Tauri

---

## 7. Data Model (Conceptual)

```json
{
  "schemaVersion": "1.1",
  "units": "cm",
  "attachments": [],
  "layers": [
    {
      "id": "trees",
      "name": "Trees",
      "visible": true,
      "locked": false,
      "objects": [
        {
          "id": "t1",
          "type": "circle",
          "geometry": { "x": 1200, "y": 750, "r": 50 },
          "layer": "trees",
          "metadata": {
            "name": "Apple Tree",
            "construction": {
              "method": "distance-to-two",
              "refs": ["obj_A", "obj_B"],
              "distances": [120, 250]
            },
            "capture": {
              "captureTimestamp": "2026-01-11T12:00:00Z",
              "captureMethod": "camera",
              "deviceInfo": { "model": "Pixel 7", "os": "Android 14", "appVersion": "0.1.0" },
              "geolocation": { "lat": 51.5000, "lon": -0.1200, "crs": "WGS84", "accuracy": 5 },
              "photoRefs": ["img_001.jpg"],
              "measurementUncertainty": 4.2
            }
          }
        }
      ]
    }
  ]
}
```

The data model is designed to be:

* Explicit
* Extensible
* Backward compatible

---

## 7.1 Relational Mapping & Persistence (optional)

While GardenCAD uses a JSON-first canonical format, the schema is organized to map cleanly to a relational store when needed for performance or advanced queries.

Suggested simple table mapping:

- `projects` (id, schemaVersion, units, metadata)
- `layers` (id, project_id, name, visible, locked, opacity, order)
- `objects` (id, layer_id, type, geometry_json, metadata_json, x REAL, y REAL)
- `attachments` (id, project_id, filename, mime, blob_ref, thumbnail_ref, created_at)
- `captures` (id, object_id, timestamp, method, device_info_json, lat, lon, accuracy, uncertainty)
- `construction_refs` (id, object_id, ref_object_id, distance_cm, ord)

Minimal SQL schema (illustrative):

```sql
CREATE TABLE projects (id TEXT PRIMARY KEY, schemaVersion TEXT, units TEXT);
CREATE TABLE layers (id TEXT PRIMARY KEY, project_id TEXT, name TEXT, visible INTEGER, locked INTEGER, opacity REAL);
CREATE TABLE objects (id TEXT PRIMARY KEY, layer_id TEXT, type TEXT, geometry_json TEXT, metadata_json TEXT, x REAL, y REAL);
CREATE TABLE attachments (id TEXT PRIMARY KEY, project_id TEXT, filename TEXT, mime TEXT, blob_ref TEXT, created_at TEXT);
CREATE TABLE captures (id TEXT PRIMARY KEY, object_id TEXT, timestamp TEXT, method TEXT, device_info_json TEXT, lat REAL, lon REAL, accuracy REAL, uncertainty REAL);
CREATE TABLE construction_refs (id INTEGER PRIMARY KEY AUTOINCREMENT, object_id TEXT, ref_object_id TEXT, distance_cm REAL, ord INTEGER);
```

Practical persistence plan:

1. Start JSON-first (canonical project files) and store in IndexedDB for PWA.  
2. Implement a storage-adapter interface (`getProject`, `saveProject`, `queryObjects`, `addAttachment`) so backends are swappable.  
3. Provide an SQLite adapter implementing the same interface for native/Capacitor builds.  
4. Keep attachments outside the canonical JSON (blobs referenced by ID) to keep exports small.  
5. Drive migrations with `schemaVersion` and provide migration hooks for adapters.


## 8. User Interface Concept

### Main Areas

* **Top Toolbar**: drawing and measurement tools
* **Left Panel**: layers and visibility control
* **Right Panel**: object properties and numeric input
* **Center Canvas**: SVG workspace
* **Compass Overlay**: small persistent indicator showing current viewing azimuth (cardinal direction + degrees) with a north-up toggle

### Interaction Principles

* Mouse for drawing and navigation
* Keyboard modifiers for snapping and constraints
* Numeric input for exact dimensions

---

## 9. Development Phases

### Phase 1 – Core Infrastructure

* SVG viewport
* Pan/zoom/rotate
* Grid and coordinate display
* Layer system

### Phase 2 – Geometry & Editing

* Drawing tools
* Selection and manipulation
* Measurement tools
* Save/load

### Phase 3 – CAD Refinement

* Advanced snapping
* Splines
* Undo/redo
* Precision numeric constraints

---

## 10. Risks & Mitigations

| Risk              | Mitigation               |
| ----------------- | ------------------------ |
| CAD UX complexity | Start with minimal tools |
| Geometry bugs     | Strong typing & tests    |
| Feature creep     | Strict V1 scope          |
| Performance       | SVG object limits        |

---

## 11. Success Criteria

The project is successful if:

* Users can plan a garden with real-world accuracy
* Measurements are trusted and repeatable
* Plans can evolve over years without data loss
* The tool remains usable offline

---

## 12. Future Extensions (Out of Scope for V1)

* Growth simulation (trees over time)
* Sun/shade analysis
* Simple 3D visualization
* DXF/SVG export for printing
* Constraint-based layout rules

---

**GardenCAD** aims to balance the rigor of CAD with the accessibility required for everyday garden planning, providing a durable, precise, and user-owned planning environment.

---

## 13. Mobile & On‑Device Measurement (Optional / Future)

GardenCAD is designed to be web-first and local-first, with an explicit path to run as an installable mobile app for in‑field measurements. The mobile strategy emphasizes reuse of the TypeScript + SVG codebase (PWA-first) and an optional native wrapper (e.g., Capacitor) to access advanced sensors and app-store distribution.

### 13.1 Mobile-focused features

- Camera-Assisted Measurement: capture a photo and create measured sketches via perspective/reference tools
- AR Measure Mode: place anchors and measure distances/areas via AR (ARCore/ARKit/WebXR where available)
- Calibration Wizard: capture a known-length reference to calibrate camera/touch input per device
- GPS-Tagged Anchors: optionally attach `lat/lon` + `accuracy` to anchor points for georeferencing
- Quick-Measure Widget: one-tap captures (photo + sensor data + timestamp) for rapid site logging
- Precision Mode & Uncertainty: display measurement precision and computed uncertainty for sensor-derived captures

### 13.2 Deployment & technical tradeoffs

- PWA-first (recommended): fastest development loop, offline via service worker + IndexedDB, maximum code reuse; limited native sensors and AR support on some devices
- Capacitor wrapper: small native shell to reuse web UI while exposing native plugins (camera, GPS, SQLite, AR) and enabling app-store distribution
- Native rewrites (React Native / Flutter): better native API coverage but require significant UI / SVG reimplementation; consider only if extreme native performance is required

### 13.3 Mobile UX & measurement requirements

- Touch ergonomics: larger hit targets, precision hold modifier, and touch-friendly handles
- Calibration: store per-device calibration profiles and guide users through a reference measurement flow
- Snapping tolerance: expose adjustable snapping tolerance in cm and a visible precision indicator
- Sensor handling: apply smoothing (median/Kalman) for GPS/compass samples, show sample confidence, and timestamp sensor readings

### 13.4 Data model additions for mobile

Additions to the canonical project schema to support mobile captures:

- `schemaVersion` (string)
- `geolocation`: { `lat`, `lon`, `crs`, `accuracy` }
- `captureTimestamp` (ISO8601)
- `deviceInfo`: { `model`, `os`, `appVersion` }
- `photoRefs`: array of attachment IDs (thumbnail + blob/file path)
- `captureMethod`: enum (`manual` | `camera` | `AR` | `GPS`)
- `measurementUncertainty` (numeric, cm)

Attachments (photos) should be stored as local blobs with thumbnails and referenced by ID in the JSON export; provide an optional export bundle (zip) containing project JSON and media files.

### 13.5 Performance & architecture notes for mobile

- Rendering: keep editable UI in SVG; render large/passive layers to Canvas or raster tiles for mobile performance
- Spatial indexing: use an R-tree/quadtree for hit-testing and visibility culling
- Offload heavy work (geometry ops, photo processing) to Web Workers
- Storage: use IndexedDB for browser/PWA, and SQLite (via Capacitor) for large datasets when wrapped natively

### 13.6 Privacy & offline-first

- Local-first by default: user data remains local and offline unless the user opts in to sync or cloud backup
- Permissions: request camera/location only when used and explain purpose inline; allow per-project opt-out of geotagging
- Optional encryption: offer local encryption for project exports and backups using Web Crypto and a user passphrase

---
