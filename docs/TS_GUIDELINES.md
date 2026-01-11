# TypeScript Guidelines for GardenCAD

## Overview
This document defines TypeScript coding standards for the GardenCAD project. All code must follow these guidelines to ensure consistency, maintainability, and type safety.

## Compiler Configuration

### Strict Mode
- **Always enabled** via `tsconfig.json`
- No exceptions to strict type checking
- All strict flags are enabled:
  - `strict: true`
  - `noImplicitAny: true`
  - `strictNullChecks: true`
  - `strictFunctionTypes: true`
  - `strictBindCallApply: true`
  - `strictPropertyInitialization: true`
  - `noImplicitThis: true`
  - `alwaysStrict: true`

### Additional Strictness
- `noUnusedLocals: true` - No unused variables
- `noUnusedParameters: true` - No unused function parameters (prefix with `_` if intentionally unused)
- `noFallthroughCasesInSwitch: true` - All switch cases must break/return
- `noImplicitReturns: true` - All code paths must return a value
- `noUncheckedIndexedAccess: true` - Array access returns `T | undefined`

## Type Annotations

### When to Annotate

**Always annotate:**
```typescript
// Function return types (explicit)
function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// Public class properties
class Viewport {
  public scale: number = 1;
  public offsetX: number = 0;
  public offsetY: number = 0;
}

// Exported constants
export const DEFAULT_GRID_SIZE: number = 10;
```

**Let TypeScript infer:**
```typescript
// Simple variable assignments
const point = { x: 10, y: 20 }; // Inferred as { x: number; y: number }

// Array literals with obvious types
const numbers = [1, 2, 3]; // Inferred as number[]

// Return values when obvious from body
const add = (a: number, b: number) => a + b; // Returns number (inferred)
```

### The `any` Type

**Rule: `any` is FORBIDDEN**

ESLint enforces: `@typescript-eslint/no-explicit-any: error`

**If you need dynamic typing:**
```typescript
// ❌ WRONG
function process(data: any): any {
  return data.value;
}

// ✅ CORRECT - Use unknown and type guards
function process(data: unknown): number {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    const obj = data as { value: unknown };
    if (typeof obj.value === 'number') {
      return obj.value;
    }
  }
  throw new Error('Invalid data structure');
}

// ✅ CORRECT - Use generic types
function process<T extends { value: number }>(data: T): number {
  return data.value;
}
```

## Naming Conventions

### General Rules
```typescript
// PascalCase for types, interfaces, classes, enums
interface Point { }
class Viewport { }
type GeometryType = 'line' | 'circle';
enum ToolMode { }

// camelCase for variables, functions, methods, properties
const gridSize = 10;
function drawLine() { }
class Canvas {
  private context: CanvasRenderingContext2D;
  
  public render(): void { }
}

// UPPER_SNAKE_CASE for constants
const MAX_ZOOM_LEVEL = 100;
const DEFAULT_LINE_WIDTH = 2;

// Prefix private members with underscore (optional but recommended)
class Tool {
  private _isActive: boolean = false;
  
  public activate(): void {
    this._isActive = true;
  }
}
```

### File Naming
```typescript
// PascalCase for files matching the primary export
Point.ts         // exports interface/class Point
LineTool.ts      // exports class LineTool
Viewport.ts      // exports class Viewport

// kebab-case for utility files
math-utils.ts
type-guards.ts
```

## Interface vs Type

### When to Use Interface
```typescript
// For object shapes that may be extended
interface Point {
  x: number;
  y: number;
}

interface Point3D extends Point {
  z: number;
}

// For class contracts
interface Drawable {
  draw(ctx: CanvasRenderingContext2D): void;
}

class Line implements Drawable {
  draw(ctx: CanvasRenderingContext2D): void {
    // Implementation
  }
}
```

### When to Use Type
```typescript
// For unions and intersections
type GeometryType = 'line' | 'circle' | 'rectangle';

type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

// For primitive aliases (rare)
type Coordinate = number;

// For mapped types
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};
```

**Default: Prefer `interface` for objects, `type` for everything else.**

## Null vs Undefined

### Rules
- Use `undefined` for optional/missing values
- Use `null` only when interfacing with external APIs that use null
- **Never use both** in the same context

```typescript
// ✅ CORRECT - Optional parameters use undefined
function drawLine(start: Point, end: Point, color?: string): void {
  const actualColor = color ?? 'black'; // Nullish coalescing
}

// ✅ CORRECT - Return undefined for "not found"
function findPoint(id: string): Point | undefined {
  return points.find(p => p.id === id);
}

// ❌ WRONG - Don't mix null and undefined
function getPoint(): Point | null | undefined {
  // Confusing!
}
```

## Function Signatures

### Parameter Order
```typescript
// Required parameters first, optional last
function drawCircle(
  center: Point,
  radius: number,
  options?: DrawOptions
): void {
  // Implementation
}

// For many parameters, use options object
interface CircleOptions {
  radius: number;
  fill?: string;
  stroke?: string;
  lineWidth?: number;
}

function drawCircle(center: Point, options: CircleOptions): void {
  // Implementation
}
```

### Return Types
```typescript
// ✅ Always annotate return types
function transform(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.offsetX) * viewport.scale,
    y: (point.y - viewport.offsetY) * viewport.scale,
  };
}

// ✅ Even for void
function clearCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

// ✅ Use never for functions that throw
function assertNever(x: never): never {
  throw new Error('Unexpected value: ' + x);
}
```

## Type Guards

### Built-in Type Guards
```typescript
function processValue(value: string | number): string {
  if (typeof value === 'string') {
    return value.toUpperCase();
  }
  return value.toFixed(2);
}

function handleShape(shape: Line | Circle): void {
  if ('radius' in shape) {
    // shape is Circle
    console.log(shape.radius);
  } else {
    // shape is Line
    console.log(shape.start, shape.end);
  }
}
```

### Custom Type Guards
```typescript
interface Point {
  x: number;
  y: number;
}

function isPoint(value: unknown): value is Point {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    typeof value.x === 'number' &&
    typeof value.y === 'number'
  );
}

// Usage
function process(input: unknown): void {
  if (isPoint(input)) {
    console.log(input.x, input.y); // TypeScript knows it's a Point
  }
}
```

## Generics

### When to Use Generics
```typescript
// ✅ For reusable data structures
class EventEmitter<T> {
  private listeners: Array<(data: T) => void> = [];
  
  public on(listener: (data: T) => void): void {
    this.listeners.push(listener);
  }
  
  public emit(data: T): void {
    this.listeners.forEach(listener => listener(data));
  }
}

// ✅ For type-safe functions
function firstOrUndefined<T>(array: T[]): T | undefined {
  return array[0];
}

// ✅ With constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### Generic Naming
```typescript
// Single letter for simple cases
function identity<T>(value: T): T {
  return value;
}

// Descriptive for complex cases
function mapObject<TInput, TOutput>(
  obj: Record<string, TInput>,
  mapper: (value: TInput) => TOutput
): Record<string, TOutput> {
  // Implementation
}
```

## Immutability

### Prefer Readonly
```typescript
// ✅ Readonly properties
interface Point {
  readonly x: number;
  readonly y: number;
}

// ✅ Readonly arrays
function processPoints(points: readonly Point[]): void {
  // Can't modify the array
  // points.push({ x: 0, y: 0 }); // Error!
}

// ✅ Const assertions for literals
const COLORS = {
  primary: '#007bff',
  secondary: '#6c757d',
} as const;

type Color = typeof COLORS[keyof typeof COLORS];
```

### Immutable Updates
```typescript
// ✅ Create new objects instead of mutating
function movePoint(point: Point, dx: number, dy: number): Point {
  return {
    x: point.x + dx,
    y: point.y + dy,
  };
}

// ✅ Use spread for arrays
function addPoint(points: Point[], newPoint: Point): Point[] {
  return [...points, newPoint];
}
```

## Error Handling

### Typed Errors
```typescript
// ✅ Create custom error types
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ✅ Type-safe error handling
function parseCoordinate(value: string): number {
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new ValidationError('Invalid coordinate', 'coordinate');
  }
  return parsed;
}
```

### Result Types (Alternative to Exceptions)
```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function parsePoint(input: string): Result<Point> {
  const parts = input.split(',');
  if (parts.length !== 2) {
    return { success: false, error: new Error('Invalid format') };
  }
  
  const x = parseFloat(parts[0]);
  const y = parseFloat(parts[1]);
  
  if (isNaN(x) || isNaN(y)) {
    return { success: false, error: new Error('Invalid numbers') };
  }
  
  return { success: true, data: { x, y } };
}
```

## Documentation

### JSDoc Comments
```typescript
/**
 * Calculates the distance between two points using Euclidean distance formula.
 * 
 * @param p1 - The first point
 * @param p2 - The second point
 * @returns The distance between the two points
 * 
 * @example
 * ```typescript
 * const distance = calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
 * console.log(distance); // 5
 * ```
 */
function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}
```

### When to Document
- All exported functions, classes, and interfaces
- Complex algorithms or business logic
- Non-obvious behavior or edge cases
- Not needed for trivial getters/setters

## Code Smells to Avoid

### Type Assertions
```typescript
// ❌ WRONG - Casting without validation
const point = data as Point;

// ✅ CORRECT - Use type guards
if (isPoint(data)) {
  const point = data;
}
```

### Non-null Assertions
```typescript
// ❌ WRONG - Bypassing null checks
const element = document.getElementById('canvas')!;

// ✅ CORRECT - Handle null case
const element = document.getElementById('canvas');
if (!element) {
  throw new Error('Canvas element not found');
}
```

### Optional Chaining Overuse
```typescript
// ❌ WRONG - Hides structural problems
const value = obj?.prop?.nested?.deep?.value;

// ✅ CORRECT - Fix the data structure
interface Config {
  value: number;
}
const value = config.value;
```

## Testing Types

### Use Type-Level Tests
```typescript
// Assert types compile correctly
type _Test1 = Expect<Equal<Point, { x: number; y: number }>>;

// Helper types for testing
type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
  ? true
  : false;
```

## Tools Configuration

These guidelines are enforced by:
- **TypeScript Compiler**: `tsconfig.json` with strict mode
- **ESLint**: `eslint.config.js` with TypeScript rules
- **Prettier**: `.prettierrc` for formatting

Violations will be caught during development and CI/CD.

## Summary Checklist

- [ ] Strict mode enabled, no `any` types
- [ ] Function return types explicitly annotated
- [ ] Prefer `interface` for objects, `type` for unions
- [ ] Use `undefined` for optional values (not `null`)
- [ ] Custom type guards for complex validation
- [ ] Immutable data structures with readonly
- [ ] JSDoc comments for public APIs
- [ ] No type assertions without validation
- [ ] Handle null/undefined explicitly