export interface LayerData {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0.0 to 1.0
  order: number;   // Display order (lower = bottom)
}

export class Layer {
  readonly id: string;
  private data: LayerData;

  constructor(id: string, name: string, order: number = 0) {
    this.id = id;
    this.data = {
      id,
      name,
      visible: true,
      locked: false,
      opacity: 1.0,
      order
    };
  }

  getName(): string {
    return this.data.name;
  }

  setName(name: string): void {
    this.data.name = name;
  }

  isVisible(): boolean {
    return this.data.visible;
  }

  setVisible(visible: boolean): void {
    this.data.visible = visible;
  }

  isLocked(): boolean {
    return this.data.locked;
  }

  setLocked(locked: boolean): void {
    this.data.locked = locked;
  }

  getOpacity(): number {
    return this.data.opacity;
  }

  setOpacity(opacity: number): void {
    this.data.opacity = Math.max(0, Math.min(1, opacity));
  }

  getOrder(): number {
    return this.data.order;
  }

  setOrder(order: number): void {
    this.data.order = order;
  }

  getData(): LayerData {
    return { ...this.data };
  }

  clone(): Layer {
    const layer = new Layer(this.id, this.data.name, this.data.order);
    layer.data = { ...this.data };
    return layer;
  }
}
