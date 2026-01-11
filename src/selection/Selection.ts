export type SelectionChangeListener = (selectedIds: Set<string>) => void;

export class Selection {
  private selectedIds: Set<string> = new Set();
  private listeners: SelectionChangeListener[] = [];

  select(objectId: string): void {
    this.selectedIds.clear();
    this.selectedIds.add(objectId);
    this.notifyListeners();
  }

  deselect(): void {
    this.selectedIds.clear();
    this.notifyListeners();
  }

  isSelected(objectId: string): boolean {
    return this.selectedIds.has(objectId);
  }

  getSelectedIds(): Set<string> {
    return new Set(this.selectedIds);
  }

  hasSelection(): boolean {
    return this.selectedIds.size > 0;
  }

  getFirstSelected(): string | null {
    if (this.selectedIds.size === 0) return null;
    const first = Array.from(this.selectedIds)[0];
    return first !== undefined ? first : null;
  }

  onChange(listener: SelectionChangeListener): void {
    this.listeners.push(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.getSelectedIds());
    }
  }
}
