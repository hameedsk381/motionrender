import { scheduleRoute } from '../../timeline/src/route';
import type { Route } from '@ove/schema';
import type { SceneLayoutOptions } from './scene-layouts';

export function routeLayers(id: string, route: Route, o: SceneLayoutOptions) {
  const { width: w, height: h, durationFrames: frames } = o;
  const size = Math.min(w, h);
  const schedule = scheduleRoute(route, frames);
  const labels = (name: string, content: string, x: number, y: number, fontSize: number, maxWidth: number) => ({
    id: id + '-' + name, type: 'text', content, x, y, fontSize, fontFamily: o.font, fontWeight: 700, color: o.ink,
    textAlign: 'center', width: maxWidth, maxWidth, minFontSize: fontSize * .62, maxLines: 2,
  });
  const layers: Record<string, any>[] = [];
  const rail = route.variant === 'rail';
  schedule.stops.forEach((s, i) => {
    layers.push({ id: id+'-stop-'+i, type:'circle', x:s.x*w, y:s.y*h, width:size*.045, height:size*.045, fill:o.muted });
    layers.push(labels('label-'+i, s.name, s.x*w, s.y*h+size*.04, size*(rail ? .040 : .045), w*(rail ? .82/schedule.stops.length : .31)));
  });
  for (const [i, trip] of schedule.trips.entries()) {
    layers.push({ ...labels('trip-'+i, trip.name, w/2, h*.13, size*.07, w*.82), startFrame: trip.start, endFrame: trip.end });
    // In the rail drawing, a bypass goes around the unvisited stations.
    // Use those same points for the traveler and its trace.
    const path = [trip.visits[0]!];
    for (let leg = 1; leg < trip.visits.length; leg++) {
      const a = trip.visits[leg - 1]!, b = trip.visits[leg]!;
      const skipped = schedule.stops.some(stop => stop.x > Math.min(a.x, b.x) && stop.x < Math.max(a.x, b.x));
      if (rail && skipped && b.frame - a.frame >= 3) {
        for (const t of [.22, .78]) {
          path.push({ ...a, x: a.x + (b.x - a.x) * t, y: .37, frame: a.frame + Math.round((b.frame - a.frame) * t) });
        }
      }
      path.push(b);
    }
    for (let leg = 1; leg < path.length; leg++) {
      const a = path[leg - 1]!, b = path[leg]!;
      for (let dot = 1; dot < 15; dot++) {
        const t = dot / 15;
        layers.push({ id: id+'-trace-'+i+'-'+leg+'-'+dot, type: 'circle',
          x: (a.x + (b.x-a.x)*t)*w, y: (a.y + (b.y-a.y)*t)*h,
          width: size*.008, height: size*.008, fill: o.accent, opacity: .65,
          startFrame: Math.round(a.frame+(b.frame-a.frame)*t), endFrame: trip.end });
      }
    }
    const first = trip.visits[0]!;
    const animations = (['x','y'] as const).map(property => ({ property, keyframes: path.map(v => ({
      frame: v.frame-trip.start, value: v[property]*(property==='x'?w:h),
    })) }));
    layers.push({ id:id+'-traveler-'+i, type:'circle', width:size*.034, height:size*.034, fill:o.accent,
      x:first.x*w, y:first.y*h, startFrame:trip.start, endFrame:trip.end, animations });
  }
  if(schedule.saved) {
    const s=schedule.saved;
    layers.push({ ...labels('saved', s.label, s.x*w, s.y*h-size*.09, size*.034,w*.32), color:o.accent, startFrame:s.frame });
  }
  return layers;
}
