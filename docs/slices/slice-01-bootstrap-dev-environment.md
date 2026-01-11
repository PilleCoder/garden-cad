# Slice 1: Bootstrap Minimal Dev Environment

## User Value

As a developer, I need a working development environment so that I can begin implementing GardenCAD features with TypeScript, have live reloading during development, and serve the application locally in a browser.

## Slice Features

1. **NPM project initialization** with essential dependencies
2. **TypeScript configuration** for strict type checking
3. **Vite dev server** for fast development and hot module reloading
4. **Basic HTML entry point** that loads the TypeScript application
5. **Minimal TypeScript entry file** that proves the setup works
6. **Git ignore rules** for node_modules and build artifacts
7. **Project structure** with src/ folder convention

## Technical Implementation Sketch

### File Structure to Create

```
garden-cad/
├── package.json          # NPM dependencies and scripts
├── tsconfig.json         # TypeScript compiler configuration
├── vite.config.ts        # Vite bundler configuration
├── .gitignore            # Git ignore rules
├── index.html            # HTML entry point (Vite convention: root level)
└── src/
    └── main.ts           # TypeScript application entry point
```

### package.json

- **Dependencies**: None required initially (pure TypeScript + browser APIs)
- **DevDependencies**:
  - `vite`: ^5.0.0 (dev server + bundler)
  - `typescript`: ^5.3.0 (TypeScript compiler)
  - `@types/node`: (for Vite config typing)
- **Scripts**:
  - `dev`: Start Vite dev server
  - `build`: Build production bundle
  - `preview`: Preview production build

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GardenCAD</title>
  <style>
    body { margin: 0; padding: 0; font-family: system-ui, sans-serif; }
    #app { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### src/main.ts

```typescript
// Entry point - proof of setup
console.log('GardenCAD initializing...');

const app = document.getElementById('app');
if (app) {
  app.innerHTML = `
    <div style="padding: 20px;">
      <h1>GardenCAD</h1>
      <p>Development environment initialized successfully.</p>
      <p>TypeScript: ✓</p>
      <p>Vite: ✓</p>
    </div>
  `;
}
```

### .gitignore

```
node_modules/
dist/
*.log
.DS_Store
.vite/
```

### vite.config.ts (optional, use defaults)

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  // Default configuration sufficient for now
});
```

## Test Plan

### Manual Testing Steps

1. **Installation test**
   - Run `npm install`
   - Verify no errors
   - Verify node_modules/ created

2. **Dev server test**
   - Run `npm run dev`
   - Verify Vite starts (typically on http://localhost:5173)
   - Verify no TypeScript errors in console

3. **Browser test**
   - Open browser to dev server URL
   - Verify "GardenCAD" heading displays
   - Verify "TypeScript: ✓" and "Vite: ✓" messages
   - Open browser DevTools console
   - Verify "GardenCAD initializing..." log message

4. **Hot reload test**
   - Edit src/main.ts (change heading text)
   - Save file
   - Verify browser updates without full page reload

5. **Build test**
   - Run `npm run build`
   - Verify dist/ folder created
   - Verify no TypeScript compilation errors
   - Run `npm run preview`
   - Verify production build works in browser

6. **Type checking test**
   - Add intentional TypeScript error in src/main.ts (e.g., `const x: number = "string";`)
   - Verify Vite reports error in terminal and browser

## Acceptance Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts Vite dev server successfully
- [ ] Browser displays "GardenCAD" page at localhost:5173
- [ ] Console log "GardenCAD initializing..." appears in browser DevTools
- [ ] Changing src/main.ts triggers hot reload in browser
- [ ] `npm run build` produces dist/ folder with bundled files
- [ ] TypeScript strict mode catches type errors during development
- [ ] .gitignore prevents node_modules/ and dist/ from being committed
- [ ] Project structure follows Vite + TypeScript conventions

## Deliverables

1. **package.json** - NPM project configuration with Vite and TypeScript
2. **tsconfig.json** - TypeScript strict configuration
3. **vite.config.ts** - Vite configuration (minimal/default)
4. **.gitignore** - Git ignore rules for dependencies and build artifacts
5. **index.html** - HTML entry point with app container
6. **src/main.ts** - TypeScript entry file with initialization proof
7. **Working dev server** - Running on localhost with hot reload
8. **README update** - Add "Getting Started" section with setup instructions

---

**Estimated effort**: 30-45 minutes  
**Dependencies**: None (first slice)  
**Risk**: Low - standard tooling setup
