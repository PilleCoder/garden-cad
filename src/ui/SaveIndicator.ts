/**
 * Visual save status indicator component
 */
export class SaveIndicator {
  private element: HTMLElement;
  private timeoutId: number | null = null;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'save-indicator';
    this.element.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      padding: 8px 16px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      font-size: 13px;
      font-family: system-ui, sans-serif;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      z-index: 1000;
    `;
    container.appendChild(this.element);
  }

  /**
   * Show "saving" indicator
   */
  showSaving(): void {
    this.show('💾 Saving...', '#0066ff');
  }

  /**
   * Show "saved" success indicator
   */
  showSaved(): void {
    this.show('✓ Saved', '#22c55e');
    this.autoHide(2000);
  }

  /**
   * Show error indicator
   */
  showError(message: string = 'Save failed'): void {
    this.show(`⚠ ${message}`, '#ef4444');
    this.autoHide(3000);
  }

  /**
   * Show indicator with custom text and color
   */
  private show(text: string, color: string): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.element.textContent = text;
    this.element.style.color = color;
    this.element.style.opacity = '1';
  }

  /**
   * Auto-hide indicator after delay
   */
  private autoHide(delay: number): void {
    this.timeoutId = window.setTimeout(() => {
      this.element.style.opacity = '0';
      this.timeoutId = null;
    }, delay);
  }
}
