import { GeometryObject } from '../geometry/GeometryObject';
import { GeometryType, PointGeometry, LineGeometry, CircleGeometry, PolylineGeometry, PolygonGeometry } from '../geometry/types';

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
      case GeometryType.POLYLINE:
        return this.renderPolyline(obj, zoom);
      case GeometryType.POLYGON:
        return this.renderPolygon(obj, zoom);
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

  private renderLine(obj: GeometryObject, _zoom: number): SVGLineElement {
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

  private renderCircle(obj: GeometryObject, _zoom: number): SVGCircleElement {
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

  private renderPolyline(obj: GeometryObject, zoom: number): SVGPolylineElement {
    const geom = obj.geometry as PolylineGeometry;
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    
    const pointsStr = geom.points.map(p => `${p.x},${p.y}`).join(' ');
    polyline.setAttribute('points', pointsStr);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', obj.style.stroke || '#000000');
    polyline.setAttribute('stroke-width', ((obj.style.strokeWidth || 2) / zoom).toString());
    polyline.setAttribute('stroke-linejoin', 'round');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('opacity', obj.style.opacity?.toString() || '1');
    polyline.setAttribute('data-object-id', obj.id);
    
    return polyline;
  }

  private renderPolygon(obj: GeometryObject, zoom: number): SVGPolygonElement {
    const geom = obj.geometry as PolygonGeometry;
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    
    const pointsStr = geom.points.map(p => `${p.x},${p.y}`).join(' ');
    polygon.setAttribute('points', pointsStr);
    polygon.setAttribute('fill', obj.style.fill || 'none');
    polygon.setAttribute('stroke', obj.style.stroke || '#000000');
    polygon.setAttribute('stroke-width', ((obj.style.strokeWidth || 2) / zoom).toString());
    polygon.setAttribute('stroke-linejoin', 'round');
    polygon.setAttribute('opacity', obj.style.opacity?.toString() || '1');
    polygon.setAttribute('data-object-id', obj.id);
    
    return polygon;
  }
}
