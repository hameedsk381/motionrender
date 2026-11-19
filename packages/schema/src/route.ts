import { z } from 'zod';

const label = z.string().trim().min(1).max(28);
const arrival = z.object({ trip: label, visit: z.number().int().min(1).max(8).optional(), stop: label.optional() });
export const routeVariants = ['map', 'rail'] as const;
export const routeFields = {
  variant: z.enum(routeVariants).optional(),
  stops: z.array(label).min(2).max(5),
  trips: z.array(z.object({ name: label, via: z.array(label).min(2).max(8) })).min(1).max(3),
  cue: arrival.extend({ name: label }),
  save: arrival.extend({ label }).optional(),
};
export type Route = z.infer<typeof routeSchema>;
export const routeSchema = z.object(routeFields);
type Input = z.infer<typeof routeSchema>;
export function validateRoute(route: Input, ctx: z.RefinementCtx) {
  const issue = (path: (number | string)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  if (new Set(route.stops).size !== route.stops.length) issue(['stops'], 'Use unique stop names');
  if (new Set(route.trips.map(t => t.name)).size !== route.trips.length) issue(['trips'], 'Use unique trip names');
  route.trips.forEach((trip, i) => trip.via.forEach((stop, j) => {
    if (!route.stops.includes(stop) || stop === trip.via[j - 1]) issue(['trips', i, 'via', j], 'Use a declared stop different from its predecessor');
  }));
  for (const key of ['save', 'cue'] as const) {
    const event = route[key];
    if (!event) continue;
    const trip = route.trips.find(item => item.name === event.trip);
    const byName = trip?.via.filter(stop => stop === event.stop).length === 1;
    const valid = event.visit !== undefined
      ? !!trip && event.visit <= trip.via.length && (!event.stop || trip.via[event.visit - 1] === event.stop)
      : byName;
    if (!valid) issue([key], 'Use a declared trip and unique stop, or a valid one-based visit for a repeated stop');
  }
}
