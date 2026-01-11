import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, PointGeometry, LineGeometry, CircleGeometry } from '../geometry/types';

export class ShapeRenderer {
  
  // Render a geometry object to SVG element
  render(obj: GeometryObject, zoom: number): SVGElement {
    switch (obj.geometry.type) {
      case GeometryType.POINT:
        return this.renderPoint(obj, zoom);
      case GeometryType.LINE:
        return this.renderLine(obj, zoom);
      case GeometryType.CIRCLE:
        return this.renderCircle(obj, zoom);
      default:
        throw new Error(`Unsupported geometry type: ${(obj.geometry as any).type}`);
    }
  }

  private renderPoint(obj: GeometryObject, zoom: number): SVGCircleElement {
    const geom = obj.geometry as PointGeometry;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    
    circle.setAttribute('cx', geom.position.x.toString());
    circle.setAttribute('cy', geom.position.y.toString());
    circle.setAttribute('r', (4 / zoom).toString()); // 4px radius in screen space
    circle.setAttribute('fill', obj.style.stroke || '#000000');
    circle.setAttribute('opacity', obj.style.opacity?.toString() || '1');
    circle.setAttribute('data-object-id', obj.id);
    
    return circle;
  }

  private renderLine(obj: GeometryObject, zoom: number): SVGLineElement {
    const geom = obj.geometry as LineGeometry;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    
    line.setAttribute('x1', geom.start.x.toString());
    line.setAttribute('y1', geom.start.y.toString());
    line.setAttribute('x2', geom.end.x.toString());
    line.setAttribute('y2', geom.end.y.toString());
    line.setAttribute('stroke', obj.style.stroke || '#000000');
    line.setAttribute('stroke-width', (obj.style.strokeWidth || 2).toString());
    line.setAttribute('opacity', obj.style.opacity?.toString() || '1');
    line.setAttribute('data-object-id', obj.id);
    
    return line;
  }

  private renderCircle(obj: GeometryObject, zoom: number): SVGCircleElement {
    const geom = obj.geometry as CircleGeometry;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    
    circle.setAttribute('cx', geom.center.x.toString());
    circle.setAttribute('cy', geom.center.y.toString());
    circle.setAttribute('r', geom.radius.toString());
    circle.setAttribute('fill', obj.style.fill || 'none');
    circle.setAttribute('stroke', obj.style.stroke || '#000000');
    circle.setAttribute('stroke-width', (obj.style.strokeWidth || 2).toString());
    circle.setAttribute('opacity', obj.style.opacity?.toString() || '1');
    circle.setAttribute('data-object-id', obj.id);
    
    return circle;
  }
}
