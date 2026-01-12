import { Project } from '../model/Project';
import { Selection } from './Selection';
import { GeometryType, PointGeometry, LineGeometry, CircleGeometry, PolylineGeometry, PolygonGeometry } from '../geometry/types';

export class SelectionRenderer {
  private selectionGroup: SVGGElement;
  private selection: Selection;
  private project: Project;

  constructor(worldGroup: SVGGElement, selection: Selection, project: Project) {
    this.selection = selection;
    this.project = project;
    
    // Create selection overlay group
    this.selectionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.selectionGroup.id = 'selection';
    worldGroup.appendChild(this.selectionGroup);

    // Listen to selection changes
    this.selection.onChange(() => this.render());
  }

  render(zoom: number = 1): void {
    // Clear existing selection indicators
    while (this.selectionGroup.firstChild) {
      this.selectionGroup.removeChild(this.selectionGroup.firstChild);
    }

    const selectedIds = this.selection.getSelectedIds();
    for (const id of selectedIds) {
      const obj = this.project.getObject(id);
      if (!obj) continue;

      // Create selection highlight based on geometry type
      const highlight = this.createHighlight(obj, zoom);
      if (highlight) {
        this.selectionGroup.appendChild(highlight);
      }
    }
  }

  private createHighlight(obj: any, zoom: number): SVGElement | null {
    const geom = obj.geometry;
    
    switch (geom.type) {
      case GeometryType.POINT: {
        const pointGeom = geom as PointGeometry;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pointGeom.position.x.toString());
        circle.setAttribute('cy', pointGeom.position.y.toString());
        circle.setAttribute('r', (8 / zoom).toString());
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#0066ff');
        circle.setAttribute('stroke-width', (2 / zoom).toString());
        return circle;
      }

      case GeometryType.LINE: {
        const lineGeom = geom as LineGeometry;
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Highlight line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', lineGeom.start.x.toString());
        line.setAttribute('y1', lineGeom.start.y.toString());
        line.setAttribute('x2', lineGeom.end.x.toString());
        line.setAttribute('y2', lineGeom.end.y.toString());
        line.setAttribute('stroke', '#0066ff');
        line.setAttribute('stroke-width', ((obj.style.strokeWidth || 2) / zoom + 2 / zoom).toString());
        line.setAttribute('opacity', '0.5');
        group.appendChild(line);

        // Endpoint handles
        [lineGeom.start, lineGeom.end].forEach(point => {
          const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          handle.setAttribute('cx', point.x.toString());
          handle.setAttribute('cy', point.y.toString());
          handle.setAttribute('r', (6 / zoom).toString());
          handle.setAttribute('fill', 'white');
          handle.setAttribute('stroke', '#0066ff');
          handle.setAttribute('stroke-width', (2 / zoom).toString());
          group.appendChild(handle);
        });

        return group;
      }

      case GeometryType.CIRCLE: {
        const circleGeom = geom as CircleGeometry;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', circleGeom.center.x.toString());
        circle.setAttribute('cy', circleGeom.center.y.toString());
        circle.setAttribute('r', circleGeom.radius.toString());
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#0066ff');
        circle.setAttribute('stroke-width', (2 / zoom).toString());
        circle.setAttribute('stroke-dasharray', `${8 / zoom} ${4 / zoom}`);
        return circle;
      }

      case GeometryType.POLYLINE: {
        const polylineGeom = geom as PolylineGeometry;
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Highlight the path
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        const pointsStr = polylineGeom.points.map(p => `${p.x},${p.y}`).join(' ');
        polyline.setAttribute('points', pointsStr);
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', '#0066ff');
        polyline.setAttribute('stroke-width', ((obj.style.strokeWidth || 2) / zoom + 2 / zoom).toString());
        polyline.setAttribute('opacity', '0.5');
        group.appendChild(polyline);
        
        // Vertex handles
        polylineGeom.points.forEach(point => {
          const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          handle.setAttribute('cx', point.x.toString());
          handle.setAttribute('cy', point.y.toString());
          handle.setAttribute('r', (6 / zoom).toString());
          handle.setAttribute('fill', 'white');
          handle.setAttribute('stroke', '#0066ff');
          handle.setAttribute('stroke-width', (2 / zoom).toString());
          group.appendChild(handle);
        });
        
        return group;
      }

      case GeometryType.POLYGON: {
        const polygonGeom = geom as PolygonGeometry;
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Highlight the polygon
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const pointsStr = polygonGeom.points.map(p => `${p.x},${p.y}`).join(' ');
        polygon.setAttribute('points', pointsStr);
        polygon.setAttribute('fill', 'none');
        polygon.setAttribute('stroke', '#0066ff');
        polygon.setAttribute('stroke-width', (2 / zoom).toString());
        polygon.setAttribute('stroke-dasharray', `${8 / zoom} ${4 / zoom}`);
        group.appendChild(polygon);
        
        // Vertex handles
        polygonGeom.points.forEach(point => {
          const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          handle.setAttribute('cx', point.x.toString());
          handle.setAttribute('cy', point.y.toString());
          handle.setAttribute('r', (6 / zoom).toString());
          handle.setAttribute('fill', 'white');
          handle.setAttribute('stroke', '#0066ff');
          handle.setAttribute('stroke-width', (2 / zoom).toString());
          group.appendChild(handle);
        });
        
        return group;
      }

      default:
        return null;
    }
  }
}
