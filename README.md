# GardenCAD

GardenCAD is a local-first, browser-based 2D CAD-style application for planning, documenting, and evolving a garden or property layout with centimeter-level precision. The tool enables users to manually define geometry on a scalable 2D plane, organize them into layers, and accurately measure distances and areas over time.

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
