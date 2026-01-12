/**
 * Context menu component for object operations
 */
export class ContextMenu {
  private element: HTMLElement;
  private visible: boolean = false;

  constructor(private container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'context-menu';
    this.element.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-size: 13px;
      font-family: system-ui, sans-serif;
      z-index: 10000;
      display: none;
      min-width: 150px;
    `;
    this.container.appendChild(this.element);

    // Hide menu when clicking elsewhere
    document.addEventListener('click', () => {
      this.hide();
    });

    // Prevent menu from closing when clicking on it
    this.element.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Show context menu at specific position with menu items
   */
  show(x: number, y: number, items: Array<{ label: string; icon?: string; action: () => void; danger?: boolean }>): void {
    this.element.innerHTML = '';
    
    items.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        color: ${item.danger ? '#ef4444' : '#333'};
      `;
      
      if (item.icon) {
        const icon = document.createElement('span');
        icon.textContent = item.icon;
        menuItem.appendChild(icon);
      }
      
      const label = document.createElement('span');
      label.textContent = item.label;
      menuItem.appendChild(label);
      
      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.background = item.danger ? '#fee' : '#f0f0f0';
      });
      
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.background = 'white';
      });
      
      menuItem.addEventListener('click', () => {
        item.action();
        this.hide();
      });
      
      this.element.appendChild(menuItem);
    });

    // Position menu
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.element.style.display = 'block';
    this.visible = true;

    // Adjust if menu goes off-screen
    setTimeout(() => {
      const rect = this.element.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.element.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.element.style.top = `${y - rect.height}px`;
      }
    }, 0);
  }

  /**
   * Hide context menu
   */
  hide(): void {
    this.element.style.display = 'none';
    this.visible = false;
  }

  /**
   * Check if menu is visible
   */
  isVisible(): boolean {
    return this.visible;
  }
}
