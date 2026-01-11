# Slice 17: Attachment and Capture Metadata

## User Value

As a user, I need to attach photos and sensor data to geometry objects, so that I can document real-world measurements, reference actual garden conditions, and maintain a rich dataset linking my CAD drawings to physical evidence captured on-site.

## Slice Features

1. **Photo attachment system** - Attach images to geometry objects
2. **Attachment metadata storage** - Store EXIF data (GPS, timestamp, device)
3. **Thumbnail generation** - Create preview thumbnails for performance
4. **Attachment viewer** - Modal gallery for viewing full-size images
5. **Sensor data capture** - Store measurement metadata (distance, angle sensors)
6. **GPS coordinate linking** - Associate real-world GPS with drawing coordinates
7. **Capture timestamp tracking** - Record when measurements were taken
8. **Attachment list UI** - Panel showing all attachments for selected object
9. **IndexedDB blob storage** - Efficient binary storage for images
10. **Attachment import/export** - Include attachments in project files
11. **File size management** - Compress images, limit sizes
12. **Camera metadata extraction** - Parse EXIF from photos
13. **Attachment deletion** - Remove attachments with confirmation
14. **Provenance tracking** - Track which attachments informed which geometry

## Technical Implementation Sketch

### File Structure

```
src/
├── attachments/
│   ├── AttachmentManager.ts      # Manages attachments lifecycle
│   ├── AttachmentStore.ts        # IndexedDB storage for blobs
│   ├── ExifParser.ts             # Extract EXIF metadata
│   ├── ThumbnailGenerator.ts     # Generate image previews
│   └── types.ts                  # Attachment data structures
├── ui/
│   ├── AttachmentPanel.ts        # List attachments for object
│   └── AttachmentViewer.ts       # Full-screen image viewer
└── model/
    └── CaptureMetadata.ts        # Sensor data structures
```

### Core Concepts

**Attachment Model**:
- Each attachment has unique ID, type (photo/sensor), timestamp
- Stored in IndexedDB as blobs (not in JSON)
- Linked to geometry objects via `attachmentIds` array
- Metadata extracted from EXIF (GPS, camera settings, timestamp)

**Storage Strategy**:
- Main project JSON contains attachment metadata only (not blobs)
- Blobs stored in separate IndexedDB object store
- Export includes base64-encoded attachments or external files
- Thumbnails generated at 200x200px for UI performance

**GPS Coordinate Linking**:
- Store original GPS lat/lon from photo EXIF
- User calibrates by placing point at known GPS location
- System calculates transformation from GPS to drawing coordinates
- Subsequent photos auto-placed using calibration

**Sensor Data**:
- Distance measurements (from laser tools, trilateration)
- Angle measurements (from compass/gyroscope)
- Environmental data (temperature, time of day)
- Associated with specific geometry objects as metadata

### src/attachments/types.ts

```typescript
export enum AttachmentType {
  PHOTO = 'photo',
  SENSOR_DATA = 'sensor-data',
  DOCUMENT = 'document'
}

export interface Attachment {
  id: string;
  type: AttachmentType;
  objectId: string;  // Associated geometry object
  createdAt: Date;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailId?: string;  // Blob ID for thumbnail
  blobId: string;  // Reference to IndexedDB blob
  metadata: AttachmentMetadata;
}

export interface AttachmentMetadata {
  // Photo metadata (from EXIF)
  width?: number;
  height?: number;
  gps?: GPSCoordinates;
  cameraModel?: string;
  captureTimestamp?: Date;
  orientation?: number;
  
  // Sensor data
  distance?: number;  // cm
  angle?: number;  // degrees
  accuracy?: number;  // cm
  deviceId?: string;
  
  // User notes
  description?: string;
  tags?: string[];
}

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;  // meters
}

export interface GPSCalibration {
  // Mapping from GPS to drawing coordinates
  gpsLat: number;
  gpsLon: number;
  drawingX: number;
  drawingY: number;
  scale?: number;  // meters per drawing unit
  rotation?: number;  // degrees
}
```

### src/attachments/AttachmentStore.ts

```typescript
export class AttachmentStore {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'GardenCAD-Attachments';
  private readonly DB_VERSION = 1;
  private readonly BLOB_STORE = 'blobs';
  private readonly METADATA_STORE = 'metadata';

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Blob store (binary data)
        if (!db.objectStoreNames.contains(this.BLOB_STORE)) {
          db.createObjectStore(this.BLOB_STORE, { keyPath: 'id' });
        }
        
        // Metadata store
        if (!db.objectStoreNames.contains(this.METADATA_STORE)) {
          const metaStore = db.createObjectStore(this.METADATA_STORE, { keyPath: 'id' });
          metaStore.createIndex('objectId', 'objectId', { unique: false });
          metaStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  async storeBlob(id: string, blob: Blob): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.BLOB_STORE], 'readwrite');
      const store = transaction.objectStore(this.BLOB_STORE);
      const request = store.put({ id, blob });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getBlob(id: string): Promise<Blob | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.BLOB_STORE], 'readonly');
      const store = transaction.objectStore(this.BLOB_STORE);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.blob : null);
      };
    });
  }

  async deleteBlob(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.BLOB_STORE], 'readwrite');
      const store = transaction.objectStore(this.BLOB_STORE);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async storeMetadata(attachment: Attachment): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(this.METADATA_STORE);
      const request = store.put(attachment);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getMetadata(id: string): Promise<Attachment | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.METADATA_STORE], 'readonly');
      const store = transaction.objectStore(this.METADATA_STORE);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getMetadataByObjectId(objectId: string): Promise<Attachment[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.METADATA_STORE], 'readonly');
      const store = transaction.objectStore(this.METADATA_STORE);
      const index = store.index('objectId');
      const request = index.getAll(objectId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async deleteMetadata(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(this.METADATA_STORE);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAllMetadata(): Promise<Attachment[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.METADATA_STORE], 'readonly');
      const store = transaction.objectStore(this.METADATA_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getTotalSize(): Promise<number> {
    const metadata = await this.getAllMetadata();
    return metadata.reduce((sum, att) => sum + att.sizeBytes, 0);
  }
}
```

### src/attachments/ExifParser.ts

```typescript
import { GPSCoordinates } from './types';

export class ExifParser {
  /**
   * Extract EXIF metadata from image file
   */
  async parse(file: File): Promise<{
    gps?: GPSCoordinates;
    timestamp?: Date;
    cameraModel?: string;
    width?: number;
    height?: number;
    orientation?: number;
  }> {
    const arrayBuffer = await file.arrayBuffer();
    const view = new DataView(arrayBuffer);

    // Check for JPEG marker
    if (view.getUint16(0) !== 0xFFD8) {
      throw new Error('Not a valid JPEG file');
    }

    const metadata: any = {};
    
    // Find EXIF marker (0xFFE1)
    let offset = 2;
    while (offset < view.byteLength) {
      const marker = view.getUint16(offset);
      
      if (marker === 0xFFE1) {
        // EXIF segment found
        const exifData = this.parseExifSegment(view, offset);
        Object.assign(metadata, exifData);
        break;
      }
      
      // Skip to next marker
      const segmentLength = view.getUint16(offset + 2);
      offset += segmentLength + 2;
    }

    return metadata;
  }

  private parseExifSegment(view: DataView, offset: number): any {
    const metadata: any = {};
    
    // Skip marker and length
    offset += 4;
    
    // Check for "Exif\0\0" header
    const exifHeader = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    
    if (exifHeader !== 'Exif') {
      return metadata;
    }
    
    offset += 6; // Skip "Exif\0\0"
    
    // Determine byte order
    const byteOrder = view.getUint16(offset);
    const littleEndian = byteOrder === 0x4949; // "II" = Intel (little endian)
    
    offset += 2;
    
    // Read IFD entries
    const ifdOffset = this.readUint32(view, offset, littleEndian);
    offset += ifdOffset + 2;
    
    const numEntries = this.readUint16(view, offset, littleEndian);
    offset += 2;
    
    for (let i = 0; i < numEntries; i++) {
      const tag = this.readUint16(view, offset, littleEndian);
      const type = this.readUint16(view, offset + 2, littleEndian);
      const count = this.readUint32(view, offset + 4, littleEndian);
      const valueOffset = offset + 8;
      
      // Parse specific tags
      switch (tag) {
        case 0x0132: // DateTime
          metadata.timestamp = this.readDateTime(view, valueOffset, littleEndian);
          break;
        case 0x010F: // Make
        case 0x0110: // Model
          if (!metadata.cameraModel) {
            metadata.cameraModel = this.readString(view, valueOffset, count);
          } else {
            metadata.cameraModel += ' ' + this.readString(view, valueOffset, count);
          }
          break;
        case 0x0100: // ImageWidth
          metadata.width = this.readUint32(view, valueOffset, littleEndian);
          break;
        case 0x0101: // ImageHeight
          metadata.height = this.readUint32(view, valueOffset, littleEndian);
          break;
        case 0x0112: // Orientation
          metadata.orientation = this.readUint16(view, valueOffset, littleEndian);
          break;
      }
      
      offset += 12;
    }
    
    // Look for GPS IFD
    metadata.gps = this.parseGPSData(view, offset, littleEndian);
    
    return metadata;
  }

  private parseGPSData(view: DataView, offset: number, littleEndian: boolean): GPSCoordinates | undefined {
    // Simplified GPS parsing - in production, use exif-js or similar library
    // This is a placeholder showing the structure
    
    // GPS data is in a sub-IFD, would need to follow pointer
    // For now, return undefined (full implementation would extract lat/lon)
    return undefined;
  }

  private readUint16(view: DataView, offset: number, littleEndian: boolean): number {
    try {
      return view.getUint16(offset, littleEndian);
    } catch {
      return 0;
    }
  }

  private readUint32(view: DataView, offset: number, littleEndian: boolean): number {
    try {
      return view.getUint32(offset, littleEndian);
    } catch {
      return 0;
    }
  }

  private readString(view: DataView, offset: number, length: number): string {
    let str = '';
    for (let i = 0; i < length && offset + i < view.byteLength; i++) {
      const char = view.getUint8(offset + i);
      if (char === 0) break;
      str += String.fromCharCode(char);
    }
    return str.trim();
  }

  private readDateTime(view: DataView, offset: number, littleEndian: boolean): Date | undefined {
    const str = this.readString(view, offset, 19);
    // Format: "YYYY:MM:DD HH:MM:SS"
    const match = str.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      return new Date(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3]),
        parseInt(match[4]),
        parseInt(match[5]),
        parseInt(match[6])
      );
    }
    return undefined;
  }

  /**
   * Use browser's exif-js library if available (better compatibility)
   */
  async parseWithLibrary(file: File): Promise<any> {
    // If exif-js is loaded globally
    if (typeof (window as any).EXIF !== 'undefined') {
      return new Promise((resolve) => {
        (window as any).EXIF.getData(file, function(this: any) {
          const exifData = (window as any).EXIF.getAllTags(this);
          
          const metadata: any = {
            timestamp: exifData.DateTime ? new Date(exifData.DateTime) : undefined,
            cameraModel: [exifData.Make, exifData.Model].filter(Boolean).join(' '),
            width: exifData.PixelXDimension,
            height: exifData.PixelYDimension,
            orientation: exifData.Orientation
          };
          
          // Parse GPS
          if (exifData.GPSLatitude && exifData.GPSLongitude) {
            metadata.gps = {
              latitude: this.convertGPSToDecimal(
                exifData.GPSLatitude,
                exifData.GPSLatitudeRef
              ),
              longitude: this.convertGPSToDecimal(
                exifData.GPSLongitude,
                exifData.GPSLongitudeRef
              ),
              altitude: exifData.GPSAltitude
            };
          }
          
          resolve(metadata);
        });
      });
    }
    
    // Fallback to simple parser
    return this.parse(file);
  }

  private convertGPSToDecimal(coords: number[], ref: string): number {
    const decimal = coords[0] + coords[1] / 60 + coords[2] / 3600;
    return (ref === 'S' || ref === 'W') ? -decimal : decimal;
  }
}
```

### src/attachments/ThumbnailGenerator.ts

```typescript
export class ThumbnailGenerator {
  private readonly THUMBNAIL_SIZE = 200; // pixels

  async generate(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        // Calculate dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > this.THUMBNAIL_SIZE) {
            height = (height * this.THUMBNAIL_SIZE) / width;
            width = this.THUMBNAIL_SIZE;
          }
        } else {
          if (height > this.THUMBNAIL_SIZE) {
            width = (width * this.THUMBNAIL_SIZE) / height;
            height = this.THUMBNAIL_SIZE;
          }
        }

        // Create canvas and draw scaled image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to generate thumbnail'));
            }
          },
          'image/jpeg',
          0.8 // quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };

      img.src = objectUrl;
    });
  }

  async compress(file: File, maxSizeKB: number = 500): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        let quality = 0.9;
        let canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const tryCompress = (q: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Compression failed'));
                return;
              }

              const sizeKB = blob.size / 1024;
              
              if (sizeKB <= maxSizeKB || q <= 0.1) {
                URL.revokeObjectURL(objectUrl);
                resolve(blob);
              } else {
                // Try again with lower quality
                tryCompress(q - 0.1);
              }
            },
            'image/jpeg',
            q
          );
        };

        tryCompress(quality);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };

      img.src = objectUrl;
    });
  }
}
```

### src/attachments/AttachmentManager.ts

```typescript
import { Attachment, AttachmentType, AttachmentMetadata } from './types';
import { AttachmentStore } from './AttachmentStore';
import { ExifParser } from './ExifParser';
import { ThumbnailGenerator } from './ThumbnailGenerator';
import { GeometryObject } from '../geometry/GeometryObject';

export class AttachmentManager {
  private store: AttachmentStore;
  private exifParser: ExifParser;
  private thumbnailGen: ThumbnailGenerator;
  private onChange: () => void;

  constructor(onChange: () => void) {
    this.store = new AttachmentStore();
    this.exifParser = new ExifParser();
    this.thumbnailGen = new ThumbnailGenerator();
    this.onChange = onChange;
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
  }

  async attachPhoto(file: File, object: GeometryObject): Promise<Attachment> {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Generate IDs
    const id = this.generateId();
    const thumbnailId = `${id}-thumb`;

    // Parse EXIF metadata
    let exifMeta: any = {};
    try {
      exifMeta = await this.exifParser.parseWithLibrary(file);
    } catch (error) {
      console.warn('Failed to parse EXIF:', error);
    }

    // Generate thumbnail
    let thumbnailBlob: Blob;
    try {
      thumbnailBlob = await this.thumbnailGen.generate(file);
      await this.store.storeBlob(thumbnailId, thumbnailBlob);
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error);
    }

    // Compress if large
    let finalBlob: Blob = file;
    const sizeKB = file.size / 1024;
    if (sizeKB > 1000) {
      try {
        finalBlob = await this.thumbnailGen.compress(file, 800);
      } catch (error) {
        console.warn('Failed to compress:', error);
      }
    }

    // Store blob
    await this.store.storeBlob(id, finalBlob);

    // Create metadata
    const metadata: AttachmentMetadata = {
      width: exifMeta.width,
      height: exifMeta.height,
      gps: exifMeta.gps,
      cameraModel: exifMeta.cameraModel,
      captureTimestamp: exifMeta.timestamp,
      orientation: exifMeta.orientation
    };

    const attachment: Attachment = {
      id,
      type: AttachmentType.PHOTO,
      objectId: object.id,
      createdAt: new Date(),
      filename: file.name,
      mimeType: file.type,
      sizeBytes: finalBlob.size,
      thumbnailId,
      blobId: id,
      metadata
    };

    // Store metadata
    await this.store.storeMetadata(attachment);

    // Add attachment ID to object
    if (!object.metadata.attachmentIds) {
      object.metadata.attachmentIds = [];
    }
    object.metadata.attachmentIds.push(id);

    this.onChange();
    return attachment;
  }

  async attachSensorData(
    object: GeometryObject,
    sensorData: {
      distance?: number;
      angle?: number;
      accuracy?: number;
      deviceId?: string;
    }
  ): Promise<Attachment> {
    const id = this.generateId();

    const metadata: AttachmentMetadata = {
      distance: sensorData.distance,
      angle: sensorData.angle,
      accuracy: sensorData.accuracy,
      deviceId: sensorData.deviceId
    };

    const attachment: Attachment = {
      id,
      type: AttachmentType.SENSOR_DATA,
      objectId: object.id,
      createdAt: new Date(),
      filename: `sensor-${id}.json`,
      mimeType: 'application/json',
      sizeBytes: JSON.stringify(metadata).length,
      blobId: id,
      metadata
    };

    // Store sensor data as JSON blob
    const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    await this.store.storeBlob(id, blob);
    await this.store.storeMetadata(attachment);

    // Add attachment ID to object
    if (!object.metadata.attachmentIds) {
      object.metadata.attachmentIds = [];
    }
    object.metadata.attachmentIds.push(id);

    this.onChange();
    return attachment;
  }

  async getAttachment(id: string): Promise<Attachment | null> {
    return this.store.getMetadata(id);
  }

  async getAttachmentBlob(id: string): Promise<Blob | null> {
    return this.store.getBlob(id);
  }

  async getThumbnailBlob(thumbnailId: string): Promise<Blob | null> {
    return this.store.getBlob(thumbnailId);
  }

  async getAttachmentsForObject(objectId: string): Promise<Attachment[]> {
    return this.store.getMetadataByObjectId(objectId);
  }

  async deleteAttachment(attachment: Attachment, object: GeometryObject): Promise<void> {
    // Delete blobs
    await this.store.deleteBlob(attachment.blobId);
    if (attachment.thumbnailId) {
      await this.store.deleteBlob(attachment.thumbnailId);
    }

    // Delete metadata
    await this.store.deleteMetadata(attachment.id);

    // Remove from object
    if (object.metadata.attachmentIds) {
      object.metadata.attachmentIds = object.metadata.attachmentIds.filter(
        id => id !== attachment.id
      );
    }

    this.onChange();
  }

  async getTotalStorageSize(): Promise<number> {
    return this.store.getTotalSize();
  }

  async exportAttachments(): Promise<{ [id: string]: string }> {
    // Export all attachments as base64
    const allMeta = await this.store.getAllMetadata();
    const exported: { [id: string]: string } = {};

    for (const meta of allMeta) {
      const blob = await this.store.getBlob(meta.blobId);
      if (blob) {
        exported[meta.id] = await this.blobToBase64(blob);
      }
    }

    return exported;
  }

  async importAttachments(data: { [id: string]: string }): Promise<void> {
    for (const [id, base64] of Object.entries(data)) {
      const blob = this.base64ToBlob(base64);
      await this.store.storeBlob(id, blob);
    }
  }

  private generateId(): string {
    return `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:... prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
    const byteString = atob(base64);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([arrayBuffer], { type: mimeType });
  }
}
```

### src/ui/AttachmentPanel.ts

```typescript
import { AttachmentManager } from '../attachments/AttachmentManager';
import { Attachment } from '../attachments/types';
import { GeometryObject } from '../geometry/GeometryObject';
import { AttachmentViewer } from './AttachmentViewer';

export class AttachmentPanel {
  private container: HTMLElement;
  private attachmentManager: AttachmentManager;
  private viewer: AttachmentViewer;
  private currentObject: GeometryObject | null = null;

  constructor(attachmentManager: AttachmentManager) {
    this.attachmentManager = attachmentManager;
    this.viewer = new AttachmentViewer(attachmentManager);
    this.container = this.createPanel();
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'attachment-panel';
    panel.style.cssText = `
      position: absolute;
      top: 600px;
      right: 10px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      width: 280px;
      max-height: 400px;
      overflow-y: auto;
      z-index: 100;
      display: none;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';

    const title = document.createElement('div');
    title.textContent = 'Attachments';
    title.style.cssText = 'font-weight: bold; font-size: 14px;';
    header.appendChild(title);

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add Photo';
    addBtn.style.cssText = `
      background: #0066ff;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    addBtn.addEventListener('click', () => this.showFileDialog());
    header.appendChild(addBtn);

    panel.appendChild(header);

    // Content area
    const content = document.createElement('div');
    content.id = 'attachment-list';
    panel.appendChild(content);

    return panel;
  }

  async update(object: GeometryObject | null): Promise<void> {
    this.currentObject = object;

    if (!object) {
      this.container.style.display = 'none';
      return;
    }

    const attachments = await this.attachmentManager.getAttachmentsForObject(object.id);
    
    if (attachments.length === 0) {
      this.container.style.display = 'block';
      const content = this.container.querySelector('#attachment-list') as HTMLElement;
      content.innerHTML = '<div style="color: #999; font-size: 12px; font-style: italic;">No attachments</div>';
      return;
    }

    this.container.style.display = 'block';
    await this.renderAttachments(attachments);
  }

  private async renderAttachments(attachments: Attachment[]): Promise<void> {
    const content = this.container.querySelector('#attachment-list') as HTMLElement;
    content.innerHTML = '';

    for (const attachment of attachments) {
      const item = await this.createAttachmentItem(attachment);
      content.appendChild(item);
    }
  }

  private async createAttachmentItem(attachment: Attachment): Promise<HTMLElement> {
    const item = document.createElement('div');
    item.style.cssText = `
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    item.addEventListener('mouseenter', () => item.style.background = '#f5f5f5');
    item.addEventListener('mouseleave', () => item.style.background = 'white');

    // Thumbnail (if photo)
    if (attachment.thumbnailId) {
      const thumbBlob = await this.attachmentManager.getThumbnailBlob(attachment.thumbnailId);
      if (thumbBlob) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(thumbBlob);
        img.style.cssText = 'width: 100%; border-radius: 3px; margin-bottom: 6px;';
        item.appendChild(img);
        
        img.addEventListener('click', () => this.viewer.show(attachment));
      }
    }

    // Filename
    const filename = document.createElement('div');
    filename.textContent = attachment.filename;
    filename.style.cssText = 'font-size: 12px; font-weight: 500; margin-bottom: 4px; word-break: break-word;';
    item.appendChild(filename);

    // Metadata
    const meta = document.createElement('div');
    meta.style.cssText = 'font-size: 11px; color: #666;';
    
    const lines: string[] = [];
    lines.push(this.formatDate(attachment.createdAt));
    lines.push(this.formatSize(attachment.sizeBytes));
    
    if (attachment.metadata.gps) {
      lines.push(`GPS: ${attachment.metadata.gps.latitude.toFixed(6)}, ${attachment.metadata.gps.longitude.toFixed(6)}`);
    }
    
    if (attachment.metadata.distance) {
      lines.push(`Distance: ${attachment.metadata.distance} cm`);
    }

    meta.innerHTML = lines.join('<br>');
    item.appendChild(meta);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #ccc;
      border-radius: 3px;
      cursor: pointer;
      padding: 4px 8px;
      font-size: 14px;
    `;
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Delete this attachment?')) {
        await this.attachmentManager.deleteAttachment(attachment, this.currentObject!);
        await this.update(this.currentObject);
      }
    });
    item.style.position = 'relative';
    item.appendChild(deleteBtn);

    return item;
  }

  private showFileDialog(): void {
    if (!this.currentObject) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use rear camera on mobile
    
    input.addEventListener('change', async () => {
      if (input.files && input.files[0]) {
        try {
          await this.attachmentManager.attachPhoto(input.files[0], this.currentObject!);
          await this.update(this.currentObject);
        } catch (error) {
          alert(`Failed to attach photo: ${error}`);
        }
      }
    });

    input.click();
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.container);
    this.viewer.mount(parent);
  }

  unmount(): void {
    this.container.remove();
    this.viewer.unmount();
  }
}
```

### src/ui/AttachmentViewer.ts

```typescript
import { AttachmentManager } from '../attachments/AttachmentManager';
import { Attachment } from '../attachments/types';

export class AttachmentViewer {
  private overlay: HTMLElement;
  private attachmentManager: AttachmentManager;

  constructor(attachmentManager: AttachmentManager) {
    this.attachmentManager = attachmentManager;
    this.overlay = this.createOverlay();
  }

  private createOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'attachment-viewer';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
    `;

    overlay.addEventListener('click', () => this.hide());

    return overlay;
  }

  async show(attachment: Attachment): Promise<void> {
    const blob = await this.attachmentManager.getAttachmentBlob(attachment.blobId);
    if (!blob) return;

    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    img.style.cssText = 'max-width: 90%; max-height: 90%; object-fit: contain;';
    img.addEventListener('click', (e) => e.stopPropagation());

    this.overlay.innerHTML = '';
    this.overlay.appendChild(img);
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
    this.overlay.innerHTML = '';
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.overlay);
  }

  unmount(): void {
    this.overlay.remove();
  }
}
```

## Test Plan

### Manual Testing Steps

1. **Photo attachment test**
   - Select an object
   - Click "+ Add Photo" in attachment panel
   - Select an image file
   - Verify photo appears in panel with thumbnail
   - Verify file size shown

2. **EXIF parsing test**
   - Attach photo with GPS data (from smartphone)
   - Verify GPS coordinates displayed
   - Verify timestamp shown
   - Verify camera model extracted

3. **Thumbnail generation test**
   - Attach large photo (>2MB)
   - Verify thumbnail loads quickly
   - Verify thumbnail quality acceptable
   - Verify full image opens on click

4. **Full image viewer test**
   - Click on thumbnail
   - Verify full-size image displays in modal
   - Verify modal centered and scaled to fit
   - Click outside modal
   - Verify closes

5. **Multiple attachments test**
   - Attach 3 photos to same object
   - Verify all 3 shown in panel
   - Verify each clickable
   - Verify ordered by date

6. **Attachment deletion test**
   - Attach photo
   - Click delete (🗑️) button
   - Confirm deletion
   - Verify removed from panel
   - Verify blob deleted from IndexedDB

7. **Image compression test**
   - Attach very large photo (5MB+)
   - Verify compressed automatically
   - Verify resulting size < 1MB
   - Verify quality still good

8. **Storage size tracking test**
   - Attach several photos
   - Check total storage size
   - Verify size matches sum of attachments
   - Verify reported in MB/KB

9. **Attachment persistence test**
   - Attach photo to object
   - Reload page/project
   - Select same object
   - Verify attachment still present
   - Verify thumbnail and full image load

10. **Multi-object attachments test**
    - Attach photo to Object A
    - Select Object B
    - Verify panel shows "No attachments"
    - Attach different photo to Object B
    - Select Object A again
    - Verify shows only Object A's photo

11. **Sensor data attachment test**
    - Create distance measurement
    - Verify sensor data attached automatically
    - Verify shows distance value
    - Verify shows accuracy if available

12. **Mobile camera capture test (on phone)**
    - Open in mobile browser
    - Select object, add photo
    - Verify camera app opens
    - Take photo
    - Verify uploaded and displayed

13. **File type validation test**
    - Try to attach non-image file (.txt)
    - Verify error message
    - Verify attachment rejected

14. **Large dataset test**
    - Attach 20 photos across 10 objects
    - Verify panel scrollable
    - Verify performance acceptable
    - Verify memory usage reasonable

15. **Export/import test**
    - Attach photos to objects
    - Export project
    - Clear database
    - Import project
    - Verify attachments restored

## Acceptance Criteria

- [ ] AttachmentStore class implemented with IndexedDB
- [ ] Blob storage separated from metadata storage
- [ ] AttachmentManager handles attachment lifecycle
- [ ] ExifParser extracts GPS, timestamp, camera model
- [ ] ThumbnailGenerator creates 200x200 previews
- [ ] AttachmentPanel UI lists attachments per object
- [ ] AttachmentViewer modal shows full-size images
- [ ] Photos can be attached via file dialog
- [ ] Mobile camera capture supported (capture="environment")
- [ ] Large images automatically compressed
- [ ] Thumbnails generated for all photos
- [ ] EXIF metadata displayed in attachment list
- [ ] GPS coordinates extracted and displayed
- [ ] Attachments can be deleted with confirmation
- [ ] Multiple attachments per object supported
- [ ] Attachment IDs stored in object metadata
- [ ] Total storage size calculated correctly
- [ ] Attachments included in export/import
- [ ] Sensor data attachments supported
- [ ] File type validation prevents non-images
- [ ] No memory leaks with object URLs
- [ ] Attachment panel hides when no object selected
- [ ] All async operations handle errors gracefully
- [ ] No TypeScript compilation errors

## Deliverables

1. **src/attachments/AttachmentStore.ts** - IndexedDB storage for blobs and metadata
2. **src/attachments/AttachmentManager.ts** - Attachment lifecycle management
3. **src/attachments/ExifParser.ts** - EXIF metadata extraction
4. **src/attachments/ThumbnailGenerator.ts** - Image compression and thumbnails
5. **src/attachments/types.ts** - Type definitions for attachments
6. **src/ui/AttachmentPanel.ts** - Attachment list UI component
7. **src/ui/AttachmentViewer.ts** - Full-screen image viewer modal
8. **Working photo attachment system** - Attach images to objects
9. **Working thumbnail system** - Fast preview generation
10. **Working metadata extraction** - GPS and EXIF parsing

---

**Estimated effort**: 5-6 hours  
**Dependencies**: Slice 1-16 (geometry model, UI framework)  
**Risk**: Medium - IndexedDB complexity, EXIF parsing edge cases, mobile camera compatibility

