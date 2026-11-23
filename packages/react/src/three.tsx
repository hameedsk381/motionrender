// `motionrender/three`: react-three-fiber, drawn by the frame. A plain <Canvas> keeps its own render loop on the wall clock, so a video made from it shows nothing,
// or the same picture, in every frame. <ThreeCanvas> turns that loop off, draws the scene once for each video frame, and holds the frame until it is drawn.
// It is its own entry because it needs the video's own `@react-three/fiber` and `three` (npm install them next to the video): a video that does not import it pays nothing.
import { createContext, createElement as h, useContext, useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
// '@ove/react' is the same module the rest of the video uses (the build aliases it), so the frame context is shared, not duplicated in this bundle.
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from '@ove/react';

type ThreeTime = { frame: number; seconds: number };
const TimeContext = createContext<ThreeTime>({ frame: 0, seconds: 0 });

/** The video frame and its time in seconds, from inside a <ThreeCanvas> (the video's own hooks do not reach into the 3D scene). Drive animation from this, or from useFrame's clock, which is set to the same time. */
export function useThreeTime(): ThreeTime { return useContext(TimeContext); }

function Stepper({ time, onDrawn }: { time: ThreeTime; onDrawn: () => void }) {
  const advance = useThree((state: any) => state.advance) as (seconds: number) => void;
  useEffect(() => {
    advance(time.seconds);   // with frameloop="never" this sets the clock to this time and draws once
    requestAnimationFrame(() => requestAnimationFrame(onDrawn));
  }, [time.frame]);
  return null;
}

export type ThreeCanvasProps = { children?: ReactNode; style?: CSSProperties; camera?: Record<string, unknown>; gl?: Record<string, unknown>; [prop: string]: unknown };

/** A react-three-fiber <Canvas> that fills its box and draws once per video frame. Put 3D objects inside; read the time with useThreeTime(). */
export function ThreeCanvas({ children, style, camera, gl, ...rest }: ThreeCanvasProps) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const time = useMemo(() => ({ frame, seconds: frame / fps }), [frame, fps]);
  const handle = useMemo(() => delayRender(`three frame ${frame}`), [frame]);
  return h('div', { style: { width: '100%', height: '100%', ...style } },
    h(Canvas as any, { frameloop: 'never', gl: { preserveDrawingBuffer: true, ...gl }, camera, ...rest },
      h(TimeContext.Provider, { value: time }, children),
      h(Stepper, { time, onDrawn: () => continueRender(handle) })));
}
