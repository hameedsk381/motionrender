import type { Fold } from '@ove/schema';
import type { SceneLayoutOptions } from './scene-layouts';

const timing = {
  sheet: { start: .18, edge: .48, reveal: .48, closed: .78 },
  booklet: { start: .27, edge: .49, reveal: .56, closed: .70 },
};
export const foldClosed = (fold: Fold) => timing[fold.variant ?? 'sheet'].closed;

/** The front and back use the same stationary hinge. Only one face is visible at a time. */
export function foldLayers(id: string, fold: Fold, o: SceneLayoutOptions) {
  const booklet = fold.variant === 'booklet';
  const panel = Math.min(o.width * .40, o.height * .26);
  const height = panel * (booklet ? .83 : 1.42), hinge = o.width / 2, top = (o.height - height) / 2;
  const movingRight = fold.direction === 'right-to-left';
  const fixedX = movingRight ? -panel : 0, movingX = movingRight ? 0 : -panel;
  const frame = (fraction: number) => Math.round(fraction * (o.durationFrames - 1));
  const motion = timing[fold.variant ?? 'sheet'];
  const start = frame(motion.start), edge = frame(motion.edge), reveal = frame(motion.reveal), closed = frame(motion.closed);
  const rect = (name: string, x: number, y: number, w: number, h: number, fill: string) => ({
    id: id+'-'+name, type:'rect', x, y, width:w, height:h, fill,
  });
  const paper = '#fff1d5', ink = '#242923', tint = fold.artwork === 'map' ? '#a7c8ae' : '#ee6847';
  const art = (name: string, x: number, title: string, back: boolean) => {
    const marks = fold.artwork === 'map'
      ? Array.from({length:5},(_,i)=>rect(name+'-street-'+i,x+panel*.08,height*(.43+i*.065),panel*(.62+i%2*.22),height*.012,ink))
        .concat([rect(name+'-avenue',x+panel*.57,height*.39,panel*.033,height*.41,ink)])
      : booklet
        ? [rect(name+'-rule',x+panel*.09,height*.59,panel*.82,height*.022,ink),
           rect(name+'-band',x+panel*.09,height*.63,panel*.82,height*.16,back ? paper : tint)]
        : [rect(name+'-block',x+panel*.10,height*.52,panel*.8,height*.26,ink),
           rect(name+'-stripe',x+panel*.20,height*.52,panel*.15,height*.26,tint)];
    return [rect(name+'-paper',x,0,panel,height,back?tint:paper), ...marks,
      { id:id+'-'+name+'-title', type:'text', x:x+panel*.09,y:height*.11,
        content:title, color:ink,fontFamily:o.font,fontWeight:800,fontSize:panel*(booklet ? .105 : .131),minFontSize:panel*.075,
        width:panel*.82,maxWidth:panel*.82,maxLines:booklet ? 2 : 3,
        // The inside title disappears into the crease before the cover title comes into view.
        ...(name === 'fixed' && reveal > 0 ? { endFrame: reveal, animations: [{ property: 'opacity', keyframes: [
          { frame: Math.max(0, reveal - Math.max(1, frame(.07))), value: 1 },
          { frame: reveal, value: 0 },
        ] }] } : {}) },
      rect(name+'-imprint',x+panel*.1,height*.88,panel*.25,height*.014,ink)];
  };
  function face(name: string, x: number, title: string, back: boolean, from: number, until: number, keys: {frame:number;value:number}[]) {
    return {id:id+'-'+name,type:'group',x:hinge,y:top,originX:0,originY:0,startFrame:from,endFrame:until,
      animations: keys.length ? [{property:'scaleX',keyframes:keys}] : [], children:art(name,x,title,back)};
  }
  const layers = [face('fixed',fixedX,fold.inside,false,0,o.durationFrames,[])];
  if (edge > 0) {
    const keys = [{frame:start,value:1}];
    if (edge > start) keys.push({frame:edge,value:0});
    layers.push(face('inside',movingX,'',false,0,edge,keys));
  }
  const keys = closed > edge ? [{frame:0,value:0},{frame:closed-edge,value:1}] : [];
  if (reveal > edge && closed > reveal) keys.splice(1, 0, {frame:reveal-edge,value:0});
  layers.push(face('cover',fixedX,fold.cover,true,edge,o.durationFrames,keys));
  return layers;
}
