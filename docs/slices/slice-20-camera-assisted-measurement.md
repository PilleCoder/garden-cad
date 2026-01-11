# Slice 20: Camera-Assisted Measurement

## User Value

As a user, I need to take measurements from photos using my phone's camera, so that I can capture real-world dimensions without physical measuring tools, calibrate measurements using known reference objects, and convert photos into accurate CAD drawings by marking distances directly on images.

## Slice Features

1. **Photo capture** - Take photos with phone camera from within app
2. **Perspective calibration** - Define reference measurements on photo
3. **Photo annotation** - Mark points and distances on images
4. **Distance extraction** - Calculate real-world distances from calibrated photos
5. **Photo overlay mode** - Display photo behind CAD viewport for tracing
6. **Reference object detection** - Use common objects for scale (credit card, door, etc.)
7. **Multi-point measurement** - Mark multiple distances in single photo
8. **Angle measurement** - Measure angles from photos
9. **Photo alignment** - Rotate and scale photo to match drawing
10. **Measurement accuracy indicator** - Show confidence/error estimates
11. **Photo measurement history** - Track all measurements from photos
12. **Export annotated photos** - Save photos with markup
13. **AR preview** - Live camera overlay with measurements (future)
14. **Batch photo processing** - Process multiple photos sequentially

## Technical Implementation Sketch

### File Structure

```
src/
├── camera/
│   ├── CameraCapture.ts          # Camera access and photo capture
│   ├── PhotoCalibration.ts       # Calibrate perspective and scale
│   ├── PhotoAnnotation.ts        # Draw on photos
│   └── MeasurementExtractor.ts   # Calculate distances from photos
├── ui/
│   ├── PhotoCaptureDialog.ts     # Camera UI
│   ├── CalibrationWizard.ts      # Step-by-step calibration
│   └── PhotoOverlay.ts           # Photo background in viewport
└── model/
    └── PhotoMeasurement.ts       # Photo measurement data model
```

### Core Concepts

**Camera-Assisted Workflow**:
1. User takes photo of garden area
2. User marks two points of known distance (e.g., "this path is 200cm wide")
3. System calculates pixels-per-cm ratio
4. User marks additional points to measure unknown distances
5. System converts pixel distances to real-world cm using calibration
6. Measurements can be imported into CAD drawing

**Perspective Correction**:
- Photos taken at angles have perspective distortion
- User marks 4 corners of rectangular object (e.g., paving stone)
- System applies perspective transform to correct distortion
- More accurate measurements from corrected image

**Reference Objects**:
- Common objects with known dimensions (credit card = 8.5 x 5.4 cm, door = 200cm height, etc.)
- User selects reference type and marks it in photo
- Automatic calibration based on known dimensions

**Photo Overlay**:
- Display photo as semi-transparent background in CAD viewport
- User can trace over photo to create CAD geometry
- Photo can be scaled, rotated, and positioned
- Useful for converting photos to accurate drawings

### src/model/PhotoMeasurement.ts

```typescript
export interface PhotoMeasurement {
  id: string;
  photoId: string;  // Reference to attachment
  capturedAt: Date;
  calibration: PhotoCalibration | null;
  measurements: Measurement[];
  metadata: {
    deviceModel?: string;
    resolution?: { width: number; height: number };
    focalLength?: number;
    notes?: string;
  };
}

export interface PhotoCalibration {
  type: 'two-point' | 'reference-object' | 'perspective';
  pixelsPerCm: number;
  referencePoints: CalibrationPoint[];
  confidence: number; // 0-1
  transform?: PerspectiveTransform;
}

export interface CalibrationPoint {
  pixelX: number;
  pixelY: number;
  worldX?: number;
  worldY?: number;
  label?: string;
}

export interface Measurement {
  id: string;
  type: 'distance' | 'angle' | 'area';
  points: MeasurementPoint[];
  value: number;  // cm for distance, degrees for angle, cm² for area
  accuracy: number; // Estimated error in cm or degrees
  label?: string;
  color?: string;
}

export interface MeasurementPoint {
  pixelX: number;
  pixelY: number;
  worldX?: number;
  worldY?: number;
}

export interface PerspectiveTransform {
  matrix: number[][]; // 3x3 transformation matrix
  sourceCorners: { x: number; y: number }[];
  targetCorners: { x: number; y: number }[];
}

export enum ReferenceObjectType {
  CREDIT_CARD = 'credit-card',      // 8.56 x 5.398 cm
  DOOR = 'door',                     // 203.2 cm height
  A4_PAPER = 'a4-paper',            // 21 x 29.7 cm
  FLOOR_TILE = 'floor-tile',        // User-specified
  RULER = 'ruler',                   // Variable
  CUSTOM = 'custom'
}

export const REFERENCE_DIMENSIONS: Record<ReferenceObjectType, { width?: number; height?: number }> = {
  [ReferenceObjectType.CREDIT_CARD]: { width: 8.56, height: 5.398 },
  [ReferenceObjectType.DOOR]: { height: 203.2 },
  [ReferenceObjectType.A4_PAPER]: { width: 21, height: 29.7 },
  [ReferenceObjectType.FLOOR_TILE]: {},
  [ReferenceObjectType.RULER]: {},
  [ReferenceObjectType.CUSTOM]: {}
};
```

### src/camera/CameraCapture.ts

```typescript
export class CameraCapture {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  async requestCamera(): Promise<boolean> {
    try {
      // Request rear camera on mobile, any camera on desktop
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment', // Rear camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      return true;
    } catch (error) {
      console.error('Camera access denied:', error);
      return false;
    }
  }

  attachToVideo(video: HTMLVideoElement): void {
    if (this.stream) {
      video.srcObject = this.stream;
      this.videoElement = video;
    }
  }

  async capturePhoto(): Promise<Blob> {
    if (!this.videoElement) {
      throw new Error('No video element attached');
    }

    const video = this.videoElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to capture photo'));
          }
        },
        'image/jpeg',
        0.9
      );
    });
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.videoElement = null;
  }

  async getDeviceCapabilities(): Promise<any> {
    if (this.stream) {
      const videoTrack = this.stream.getVideoTracks()[0];
      return videoTrack.getCapabilities();
    }
    return null;
  }
}
```

### src/camera/PhotoCalibration.ts

```typescript
import { PhotoCalibration, CalibrationPoint, ReferenceObjectType, REFERENCE_DIMENSIONS } from '../model/PhotoMeasurement';

export class PhotoCalibrator {
  /**
   * Calibrate using two points with known distance
   */
  calibrateTwoPoint(
    point1: { pixelX: number; pixelY: number },
    point2: { pixelX: number; pixelY: number },
    knownDistanceCm: number
  ): PhotoCalibration {
    const pixelDistance = Math.sqrt(
      (point2.pixelX - point1.pixelX) ** 2 +
      (point2.pixelY - point1.pixelY) ** 2
    );

    const pixelsPerCm = pixelDistance / knownDistanceCm;

    return {
      type: 'two-point',
      pixelsPerCm,
      referencePoints: [
        { pixelX: point1.pixelX, pixelY: point1.pixelY, label: 'Start' },
        { pixelX: point2.pixelX, pixelY: point2.pixelY, label: 'End' }
      ],
      confidence: 0.9 // High confidence for direct measurement
    };
  }

  /**
   * Calibrate using reference object
   */
  calibrateReferenceObject(
    corners: { pixelX: number; pixelY: number }[],
    referenceType: ReferenceObjectType,
    customDimensions?: { width?: number; height?: number }
  ): PhotoCalibration {
    const dimensions = referenceType === ReferenceObjectType.CUSTOM
      ? customDimensions!
      : REFERENCE_DIMENSIONS[referenceType];

    // Calculate pixel dimensions
    const pixelWidth = Math.sqrt(
      (corners[1].pixelX - corners[0].pixelX) ** 2 +
      (corners[1].pixelY - corners[0].pixelY) ** 2
    );

    const pixelHeight = Math.sqrt(
      (corners[3].pixelX - corners[0].pixelX) ** 2 +
      (corners[3].pixelY - corners[0].pixelY) ** 2
    );

    // Average pixels per cm from width and height
    let pixelsPerCm = 0;
    let count = 0;

    if (dimensions.width) {
      pixelsPerCm += pixelWidth / dimensions.width;
      count++;
    }

    if (dimensions.height) {
      pixelsPerCm += pixelHeight / dimensions.height;
      count++;
    }

    pixelsPerCm /= count;

    return {
      type: 'reference-object',
      pixelsPerCm,
      referencePoints: corners.map((c, i) => ({
        pixelX: c.pixelX,
        pixelY: c.pixelY,
        label: `Corner ${i + 1}`
      })),
      confidence: 0.85 // Good confidence for reference objects
    };
  }

  /**
   * Apply perspective correction for more accurate measurements
   */
  calibrateWithPerspective(
    corners: { pixelX: number; pixelY: number }[],
    realWorldCorners: { x: number; y: number }[],
    knownDistance: number
  ): PhotoCalibration {
    // Simplified perspective transform
    // In production, use library like perspective-transform or implement full homography
    
    const transform = this.calculatePerspectiveTransform(
      corners,
      realWorldCorners
    );

    // Calculate scale after perspective correction
    const correctedCorners = corners.map(c => 
      this.applyTransform(c, transform.matrix)
    );

    const pixelDistance = Math.sqrt(
      (correctedCorners[1].pixelX - correctedCorners[0].pixelX) ** 2 +
      (correctedCorners[1].pixelY - correctedCorners[0].pixelY) ** 2
    );

    const pixelsPerCm = pixelDistance / knownDistance;

    return {
      type: 'perspective',
      pixelsPerCm,
      referencePoints: corners.map((c, i) => ({
        pixelX: c.pixelX,
        pixelY: c.pixelY,
        worldX: realWorldCorners[i].x,
        worldY: realWorldCorners[i].y,
        label: `Corner ${i + 1}`
      })),
      confidence: 0.95, // Highest confidence with perspective correction
      transform
    };
  }

  private calculatePerspectiveTransform(
    source: { pixelX: number; pixelY: number }[],
    target: { x: number; y: number }[]
  ): any {
    // Simplified - in production use proper homography calculation
    return {
      matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], // Identity for now
      sourceCorners: source.map(s => ({ x: s.pixelX, y: s.pixelY })),
      targetCorners: target
    };
  }

  private applyTransform(
    point: { pixelX: number; pixelY: number },
    matrix: number[][]
  ): { pixelX: number; pixelY: number } {
    // Simplified transform application
    return point; // Return unchanged for now
  }

  /**
   * Estimate measurement accuracy based on calibration quality
   */
  estimateAccuracy(calibration: PhotoCalibration): number {
    // Base error depends on calibration type
    const baseError = {
      'two-point': 2, // ±2cm
      'reference-object': 3, // ±3cm
      'perspective': 1.5 // ±1.5cm (best)
    }[calibration.type];

    // Adjust by confidence
    return baseError / calibration.confidence;
  }
}
```

### src/camera/MeasurementExtractor.ts

```typescript
import { PhotoCalibration, Measurement, MeasurementPoint } from '../model/PhotoMeasurement';

export class MeasurementExtractor {
  private calibration: PhotoCalibration;

  constructor(calibration: PhotoCalibration) {
    this.calibration = calibration;
  }

  /**
   * Measure distance between two points
   */
  measureDistance(
    point1: { pixelX: number; pixelY: number },
    point2: { pixelX: number; pixelY: number },
    label?: string
  ): Measurement {
    const pixelDistance = Math.sqrt(
      (point2.pixelX - point1.pixelX) ** 2 +
      (point2.pixelY - point1.pixelY) ** 2
    );

    const distanceCm = pixelDistance / this.calibration.pixelsPerCm;
    const accuracy = this.estimateAccuracy(distanceCm);

    return {
      id: this.generateId(),
      type: 'distance',
      points: [
        { pixelX: point1.pixelX, pixelY: point1.pixelY },
        { pixelX: point2.pixelX, pixelY: point2.pixelY }
      ],
      value: distanceCm,
      accuracy,
      label,
      color: '#0066ff'
    };
  }

  /**
   * Measure angle between three points
   */
  measureAngle(
    point1: { pixelX: number; pixelY: number },
    vertex: { pixelX: number; pixelY: number },
    point2: { pixelX: number; pixelY: number },
    label?: string
  ): Measurement {
    // Calculate vectors
    const v1x = point1.pixelX - vertex.pixelX;
    const v1y = point1.pixelY - vertex.pixelY;
    const v2x = point2.pixelX - vertex.pixelX;
    const v2y = point2.pixelY - vertex.pixelY;

    // Calculate angle using dot product
    const dot = v1x * v2x + v1y * v2y;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
    
    const angleRad = Math.acos(dot / (mag1 * mag2));
    const angleDeg = (angleRad * 180) / Math.PI;

    return {
      id: this.generateId(),
      type: 'angle',
      points: [
        { pixelX: point1.pixelX, pixelY: point1.pixelY },
        { pixelX: vertex.pixelX, pixelY: vertex.pixelY },
        { pixelX: point2.pixelX, pixelY: point2.pixelY }
      ],
      value: angleDeg,
      accuracy: 2, // ±2 degrees
      label,
      color: '#FF9800'
    };
  }

  /**
   * Measure area of polygon
   */
  measureArea(
    points: { pixelX: number; pixelY: number }[],
    label?: string
  ): Measurement {
    // Convert to world coordinates
    const worldPoints = points.map(p => ({
      x: p.pixelX / this.calibration.pixelsPerCm,
      y: p.pixelY / this.calibration.pixelsPerCm
    }));

    // Calculate area using Shoelace formula
    let area = 0;
    for (let i = 0; i < worldPoints.length; i++) {
      const j = (i + 1) % worldPoints.length;
      area += worldPoints[i].x * worldPoints[j].y;
      area -= worldPoints[j].x * worldPoints[i].y;
    }
    area = Math.abs(area / 2);

    return {
      id: this.generateId(),
      type: 'area',
      points: points.map(p => ({ pixelX: p.pixelX, pixelY: p.pixelY })),
      value: area,
      accuracy: area * 0.1, // 10% error estimate
      label,
      color: '#4CAF50'
    };
  }

  /**
   * Measure multiple distances in sequence (polyline)
   */
  measurePath(
    points: { pixelX: number; pixelY: number }[],
    label?: string
  ): Measurement {
    let totalDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const pixelDist = Math.sqrt(
        (points[i + 1].pixelX - points[i].pixelX) ** 2 +
        (points[i + 1].pixelY - points[i].pixelY) ** 2
      );
      totalDistance += pixelDist / this.calibration.pixelsPerCm;
    }

    return {
      id: this.generateId(),
      type: 'distance',
      points: points.map(p => ({ pixelX: p.pixelX, pixelY: p.pixelY })),
      value: totalDistance,
      accuracy: this.estimateAccuracy(totalDistance),
      label,
      color: '#9C27B0'
    };
  }

  private estimateAccuracy(value: number): number {
    // Error grows with distance
    const baseError = 2; // ±2cm base
    const percentError = 0.02; // 2% of value
    return baseError + (value * percentError);
  }

  private generateId(): string {
    return `meas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### src/ui/CalibrationWizard.ts

```typescript
import { PhotoCalibrator } from '../camera/PhotoCalibration';
import { ReferenceObjectType } from '../model/PhotoMeasurement';

export class CalibrationWizard {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement;
  private calibrator: PhotoCalibrator;
  
  private step: number = 0;
  private points: { x: number; y: number }[] = [];
  private onComplete: (calibration: any) => void;

  constructor(imageBlob: Blob, onComplete: (calibration: any) => void) {
    this.calibrator = new PhotoCalibrator();
    this.onComplete = onComplete;
    this.container = this.createWizard();
    this.canvas = this.container.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.image = new Image();
    this.image.onload = () => this.drawImage();
    this.image.src = URL.createObjectURL(imageBlob);
  }

  private createWizard(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;

    // Instructions
    const instructions = document.createElement('div');
    instructions.id = 'wizard-instructions';
    instructions.style.cssText = `
      color: white;
      font-size: 16px;
      margin-bottom: 20px;
      text-align: center;
      max-width: 600px;
      padding: 0 20px;
    `;
    instructions.textContent = 'Step 1: Click the start of a known distance';
    overlay.appendChild(instructions);

    // Canvas
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'max-width: 90%; max-height: 70%; cursor: crosshair; border: 2px solid white;';
    canvas.addEventListener('click', (e) => this.handleClick(e));
    overlay.appendChild(canvas);

    // Input for known distance
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = 'margin-top: 20px; display: none;';
    inputContainer.id = 'distance-input-container';

    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'known-distance';
    input.placeholder = 'Enter distance in cm';
    input.style.cssText = `
      padding: 12px;
      font-size: 16px;
      width: 200px;
      border: 2px solid white;
      border-radius: 4px;
      background: transparent;
      color: white;
      margin-right: 12px;
    `;
    inputContainer.appendChild(input);

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm';
    confirmBtn.style.cssText = `
      padding: 12px 24px;
      font-size: 16px;
      background: #0066ff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    confirmBtn.addEventListener('click', () => this.confirmCalibration());
    inputContainer.appendChild(confirmBtn);

    overlay.appendChild(inputContainer);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '✕ Cancel';
    cancelBtn.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: transparent;
      color: white;
      border: 2px solid white;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    `;
    cancelBtn.addEventListener('click', () => this.close());
    overlay.appendChild(cancelBtn);

    return overlay;
  }

  private drawImage(): void {
    this.canvas.width = this.image.width;
    this.canvas.height = this.image.height;
    this.ctx.drawImage(this.image, 0, 0);
    this.drawPoints();
  }

  private drawPoints(): void {
    this.ctx.drawImage(this.image, 0, 0);

    // Draw existing points
    for (let i = 0; i < this.points.length; i++) {
      const point = this.points[i];
      
      // Draw point
      this.ctx.fillStyle = '#0066ff';
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Draw label
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 16px Arial';
      this.ctx.fillText(`${i + 1}`, point.x + 15, point.y - 5);

      // Draw line between points
      if (i > 0) {
        this.ctx.strokeStyle = '#0066ff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.points[i - 1].x, this.points[i - 1].y);
        this.ctx.lineTo(point.x, point.y);
        this.ctx.stroke();
      }
    }
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    this.points.push({ x, y });
    this.step++;

    if (this.step === 1) {
      const instructions = this.container.querySelector('#wizard-instructions')!;
      instructions.textContent = 'Step 2: Click the end of the known distance';
    } else if (this.step === 2) {
      const instructions = this.container.querySelector('#wizard-instructions')!;
      instructions.textContent = 'Step 3: Enter the actual distance between the two points';
      
      const inputContainer = this.container.querySelector('#distance-input-container') as HTMLElement;
      inputContainer.style.display = 'block';
      
      const input = this.container.querySelector('#known-distance') as HTMLInputElement;
      input.focus();
    }

    this.drawPoints();
  }

  private confirmCalibration(): void {
    const input = this.container.querySelector('#known-distance') as HTMLInputElement;
    const distance = parseFloat(input.value);

    if (!distance || distance <= 0) {
      alert('Please enter a valid distance');
      return;
    }

    const calibration = this.calibrator.calibrateTwoPoint(
      { pixelX: this.points[0].x, pixelY: this.points[0].y },
      { pixelX: this.points[1].x, pixelY: this.points[1].y },
      distance
    );

    this.onComplete(calibration);
    this.close();
  }

  private close(): void {
    this.container.remove();
    URL.revokeObjectURL(this.image.src);
  }

  show(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }
}
```

### src/ui/PhotoOverlay.ts

```typescript
export class PhotoOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement | null = null;
  private opacity: number = 0.5;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private scale: number = 1;
  private rotation: number = 0;

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d')!;
  }

  async loadPhoto(blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      this.image = new Image();
      this.image.onload = () => resolve();
      this.image.onerror = reject;
      this.image.src = URL.createObjectURL(blob);
    });
  }

  render(viewportTransform: any): void {
    if (!this.image) return;

    this.ctx.save();
    
    // Apply opacity
    this.ctx.globalAlpha = this.opacity;

    // Apply transformations
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
    this.ctx.rotate(this.rotation);

    // Draw image
    this.ctx.drawImage(
      this.image,
      -this.image.width / 2,
      -this.image.height / 2,
      this.image.width,
      this.image.height
    );

    this.ctx.restore();
  }

  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(1, opacity));
  }

  setPosition(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }

  setScale(scale: number): void {
    this.scale = Math.max(0.1, Math.min(10, scale));
  }

  setRotation(degrees: number): void {
    this.rotation = (degrees * Math.PI) / 180;
  }

  clear(): void {
    this.image = null;
  }

  isActive(): boolean {
    return this.image !== null;
  }
}
```

### Integration Example

```typescript
import { CameraCapture } from './camera/CameraCapture';
import { CalibrationWizard } from './ui/CalibrationWizard';
import { MeasurementExtractor } from './camera/MeasurementExtractor';
import { PhotoOverlay } from './ui/PhotoOverlay';

// Camera capture button
const captureBtn = document.createElement('button');
captureBtn.textContent = '📷 Measure from Photo';
captureBtn.style.cssText = `
  position: fixed;
  bottom: 100px;
  right: 20px;
  background: #0066ff;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 1000;
`;

captureBtn.addEventListener('click', async () => {
  const camera = new CameraCapture();
  const hasCamera = await camera.requestCamera();
  
  if (!hasCamera) {
    alert('Camera access denied or not available');
    return;
  }

  // Show camera preview
  const dialog = createCameraDialog(camera);
  document.body.appendChild(dialog);
});

function createCameraDialog(camera: CameraCapture): HTMLElement {
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: black;
    z-index: 10000;
    display: flex;
    flex-direction: column;
  `;

  const video = document.createElement('video');
  video.autoplay = true;
  video.style.cssText = 'flex: 1; object-fit: contain;';
  camera.attachToVideo(video);
  dialog.appendChild(video);

  const controls = document.createElement('div');
  controls.style.cssText = `
    padding: 20px;
    display: flex;
    justify-content: center;
    gap: 20px;
    background: rgba(0,0,0,0.8);
  `;

  const captureBtn = document.createElement('button');
  captureBtn.textContent = '📸 Capture';
  captureBtn.style.cssText = `
    background: #0066ff;
    color: white;
    border: none;
    padding: 16px 32px;
    border-radius: 50px;
    font-size: 18px;
    cursor: pointer;
  `;
  captureBtn.addEventListener('click', async () => {
    const photo = await camera.capturePhoto();
    camera.stopCamera();
    dialog.remove();
    
    // Start calibration wizard
    const wizard = new CalibrationWizard(photo, (calibration) => {
      console.log('Calibration complete:', calibration);
      
      // Create measurement extractor
      const extractor = new MeasurementExtractor(calibration);
      
      // Now user can mark additional measurements
      showMeasurementUI(photo, extractor);
    });
    wizard.show(document.body);
  });
  controls.appendChild(captureBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕ Cancel';
  cancelBtn.style.cssText = `
    background: transparent;
    color: white;
    border: 2px solid white;
    padding: 16px 32px;
    border-radius: 50px;
    font-size: 18px;
    cursor: pointer;
  `;
  cancelBtn.addEventListener('click', () => {
    camera.stopCamera();
    dialog.remove();
  });
  controls.appendChild(cancelBtn);

  dialog.appendChild(controls);
  return dialog;
}

function showMeasurementUI(photo: Blob, extractor: MeasurementExtractor) {
  // Show UI for marking additional measurements
  console.log('Measurement UI ready');
  
  // Could display photo with measurement tools
  // User clicks to mark distances, angles, areas
  // Results can be saved or imported into CAD drawing
}

document.body.appendChild(captureBtn);
console.log('Camera-assisted measurement ready');
```

## Test Plan

### Manual Testing Steps

1. **Camera access test**
   - Click "Measure from Photo" button
   - Verify camera permission prompt
   - Grant permission
   - Verify live camera feed displays

2. **Photo capture test**
   - Open camera
   - Point at garden area
   - Click capture button
   - Verify photo captured
   - Verify camera stops

3. **Two-point calibration test**
   - Capture photo with known distance (e.g., path)
   - Click start point of path
   - Click end point
   - Enter "200" cm
   - Verify calibration completes

4. **Distance measurement test**
   - After calibration, mark two new points
   - Verify distance calculated
   - Verify shows in cm
   - Verify accuracy indicator shown

5. **Multiple measurements test**
   - Mark 5 different distances on same photo
   - Verify all measurements stored
   - Verify all visible with labels
   - Verify can be reviewed

6. **Reference object calibration test**
   - Take photo with credit card visible
   - Select "Credit Card" reference
   - Mark 4 corners of card
   - Verify automatic calibration
   - Verify scale correct (8.56cm width)

7. **Angle measurement test**
   - Mark three points for angle
   - Verify angle calculated in degrees
   - Verify angle arc drawn
   - Verify reasonably accurate

8. **Photo overlay test**
   - Calibrate photo
   - Enable overlay mode
   - Verify photo appears behind CAD viewport
   - Adjust opacity slider
   - Verify photo transparency changes

9. **Photo alignment test**
   - Load photo overlay
   - Drag to reposition
   - Pinch to scale
   - Rotate with controls
   - Verify photo moves smoothly

10. **Tracing test**
    - Enable photo overlay
    - Use line tool to trace path in photo
    - Verify can draw over photo
    - Disable overlay
    - Verify traced geometry remains

11. **Measurement accuracy test**
    - Calibrate with known 100cm distance
    - Measure another known 100cm distance
    - Verify result within ±5cm
    - Verify accuracy estimate shown

12. **Export measurement test**
    - Create multiple measurements
    - Export project
    - Verify measurements included
    - Import project
    - Verify measurements restored

13. **Mobile camera test (phone)**
    - Open on phone
    - Tap measure from photo
    - Verify rear camera opens
    - Capture photo
    - Verify high resolution
    - Verify calibration works

14. **Perspective distortion test**
    - Take photo at angle
    - Mark rectangular object
    - Apply perspective correction
    - Measure same object before/after
    - Verify correction improves accuracy

15. **Batch measurement test**
    - Capture 3 photos
    - Calibrate each
    - Mark measurements on each
    - Verify all measurements tracked separately
    - Verify can switch between photos

## Acceptance Criteria

- [ ] CameraCapture class accesses device camera
- [ ] Photo capture works on desktop and mobile
- [ ] Rear camera preferred on mobile devices
- [ ] CalibrationWizard UI guides user through calibration
- [ ] Two-point calibration implemented and working
- [ ] Reference object calibration supported
- [ ] Known reference dimensions defined (credit card, door, A4)
- [ ] PhotoCalibrator calculates pixels-per-cm ratio
- [ ] MeasurementExtractor calculates distances from pixels
- [ ] Distance measurements accurate within ±5cm for calibrated photos
- [ ] Angle measurement implemented
- [ ] Area measurement implemented (polygon)
- [ ] Multiple measurements can be marked on one photo
- [ ] Measurement accuracy estimates provided
- [ ] PhotoOverlay displays photo behind CAD viewport
- [ ] Photo overlay opacity adjustable (0-100%)
- [ ] Photo overlay can be positioned, scaled, rotated
- [ ] User can trace over photo to create CAD geometry
- [ ] All measurements stored in PhotoMeasurement model
- [ ] Measurements persist in project data
- [ ] Export/import includes photo measurements
- [ ] UI shows confidence/accuracy for each measurement
- [ ] Cancel button works at any step
- [ ] Camera stops when dialog closed
- [ ] No TypeScript compilation errors

## Deliverables

1. **src/camera/CameraCapture.ts** - Camera access and photo capture
2. **src/camera/PhotoCalibration.ts** - Calibration algorithms
3. **src/camera/MeasurementExtractor.ts** - Distance/angle calculation from photos
4. **src/model/PhotoMeasurement.ts** - Data models for photo measurements
5. **src/ui/CalibrationWizard.ts** - Step-by-step calibration UI
6. **src/ui/PhotoOverlay.ts** - Photo background for tracing
7. **Updated main.ts** - Camera measurement integration
8. **Working camera capture** - Take photos from within app
9. **Working calibration** - Two-point and reference object calibration
10. **Working measurements** - Extract real-world dimensions from photos

---

**Estimated effort**: 7-8 hours  
**Dependencies**: Slice 17 (attachments), Slice 19 (mobile/camera)  
**Risk**: Medium-High - Camera API compatibility, perspective math complexity, mobile browser variations

---

## 🎉 Project Complete!

All 20 slices of the GardenCAD elephant carpaccio implementation plan are now documented. This comprehensive plan takes the application from initial bootstrap through advanced features like camera-assisted measurement, providing a clear roadmap for incremental development with testable milestones at each step.

**Total estimated effort**: 90-100 hours of development
**Slice complexity**: Progressive (simple → advanced)
**Architecture**: Modular, testable, maintainable

Ready for implementation! 🚀

