import type { Split } from '@ove/schema';
import type { SceneLayoutOptions } from './scene-layouts';

const destinations = {
  left: [.18, .40], right: [.82, .40], down: [.50, .76],
  'down-left': [.20, .62], 'down-right': [.80, .62],
} as const;
const outlets = {
  left: [.16, .56], right: [.84, .56], down: [.50, .69],
  'down-left': [.26, .69], 'down-right': [.74, .69],
} as const;
export const splitArrival = .78;

export function splitLayers(id: string, scene: Split, options: SceneLayoutOptions) {
  const {width, height, durationFrames, accent, ink, font} = options;
  const size = Math.min(width, height);
  const frame = (t: number) => Math.round(t * (durationFrames - 1));
  const manifold = scene.variant === 'manifold';
  const origin = { x: width * .5, y: height * (manifold ? .29 : .40) };
  const circle = (name: string, x: number, y: number, diameter: number, fill: string) =>
    ({id: id+'-'+name, type: 'circle', x, y, width: diameter, height: diameter, fill});
  const label = (name: string, content: string, x: number, y: number) => ({
    id: id+'-'+name, type: 'text', content, x, y, color: ink, fontFamily: font,
    fontWeight: 700, fontSize: size*.046, minFontSize: size*.028, textAlign: 'center',
    width: width*(manifold ? .23 : .32), maxWidth: width*(manifold ? .23 : .32), maxLines: 2,
  });
  const layers: Record<string, unknown>[] = [
    label('origin-label', scene.origin, origin.x, origin.y - size*.12),
    circle('origin', origin.x, origin.y, size*.052, ink),
  ];
  for (const [i, branch] of scene.branches.entries()) {
    const [nx, ny] = (manifold ? outlets : destinations)[branch.direction];
    const x = nx * width, y = ny * height;
    const start = frame(.18), arrival = frame(splitArrival);
    const junction = { x: origin.x, y: height * .46, frame: frame(.38) };
    const path = [{ ...origin, frame: start }];
    if (manifold && junction.frame > start && arrival > junction.frame) {
      path.push(junction);
      const elbowFrame = frame(.62);
      if (x !== junction.x && elbowFrame > junction.frame && arrival > elbowFrame) path.push({ x, y: junction.y, frame: elbowFrame });
    }
    path.push({ x, y, frame: arrival });
    for (let leg = 1; leg < path.length; leg++) {
      const a = path[leg - 1]!, b = path[leg]!;
      const count = Math.max(2, Math.ceil(Math.hypot(b.x-a.x, b.y-a.y)/(size*.013)));
      for (let n = 1; n <= count; n++) {
        const t = n / count;
        layers.push({ ...circle('trail-'+i+'-'+leg+'-'+n, a.x+(b.x-a.x)*t, a.y+(b.y-a.y)*t, size*.013, accent),
          startFrame: Math.round(a.frame+(b.frame-a.frame)*t) });
      }
    }
    const travel = arrival - start;
    const animations = travel > 0 ? (['x','y'] as const).map(property => ({ property,
      keyframes: path.map(point => ({ frame: point.frame-start, value: point[property] })),
    })) : [];
    layers.push({...circle('traveler-'+i, travel ? origin.x : x, travel ? origin.y : y, size*.036, accent), startFrame: start, animations});
    layers.push(label('endpoint-'+i, branch.endpoint, x, y+size*.035));
  }
  return layers;
}
