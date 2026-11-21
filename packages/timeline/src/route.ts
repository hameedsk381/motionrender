import type { Route } from '../../schema/src/route';

/** Fixed stop positions and arrival frames are shared by the React and primitive renderers. */
export function scheduleRoute(route: Route, frames: number) {
  const units = route.trips.reduce((sum, trip) => sum + trip.via.length + 1, 0);
  const at = (unit: number) => Math.round(unit / units * (frames - 1));
  // The most complete trip establishes the line's station order.
  const railOrder = [...new Set([...route.trips.reduce((longest, trip) =>
    new Set(trip.via).size > new Set(longest).size ? trip.via : longest, route.trips[0]!.via), ...route.stops])];
  const stops = (route.variant === 'rail' ? railOrder : route.stops).map((name, i) => {
    if (route.variant === 'rail') return { name, x: .16 + .68 * i / (railOrder.length - 1), y: .55 };
    const angle = Math.PI * 2 * i / route.stops.length - Math.PI / 2;
    return { name, x: .5 + .31 * Math.cos(angle), y: .45 + .17 * Math.sin(angle) };
  });
  let cursor = 0;
  const trips = route.trips.map(trip => {
    const start = at(cursor);
    const visits = trip.via.map((name, i) => ({ ...stops.find(s => s.name === name)!, frame: at(cursor + .5 + i) }));
    cursor += trip.via.length + 1;
    return { name: trip.name, start, end: cursor === units ? frames : at(cursor), visits };
  });
  const arrival = (event: Route['cue'] | NonNullable<Route['save']>) =>
    trips.find(trip => trip.name === event.trip)!.visits.find((v, i) => event.visit === undefined ? v.name === event.stop : i === event.visit - 1)!;
  return { stops, trips, cue: { name: route.cue.name, frame: arrival(route.cue).frame }, saved: route.save && { ...arrival(route.save), label: route.save.label } };
}
