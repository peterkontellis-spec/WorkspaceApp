'use client';

import { createContext, useContext, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { createStellarRenderer } from '@/lib/stellar-renderer';
import './stellar-identity.css';
import { useTheme } from './theme-provider';

type StarState = { progress: number; neutral: boolean; animate: boolean };
const initial: StarState = { progress: 75, neutral: false, animate: true };
const StarContext = createContext<{state: StarState; update: (patch: Partial<StarState>) => void}>({state: initial, update: () => {}});
export function StellarProvider({children}: {children: ReactNode}) {
  const [state,setState] = useState(initial);
  const { mode, tint } = useTheme();
  useEffect(() => {
    const ratio=Math.max(0,Math.min(1,state.progress<60?state.progress/60:(state.progress-60)/20));
    const colors=state.progress<60?['200,108,99','210,161,99']:['210,161,99','111,170,140'];
    const strength=!tint||state.neutral?0:mode==='light'?0.18:0.10;
    const root=document.documentElement;
    root.style.setProperty('--star-tint-a',`rgba(${colors[0]},${strength*(1-ratio)})`);
    root.style.setProperty('--star-tint-b',`rgba(${colors[1]},${strength*ratio})`);
    return ()=>{root.style.removeProperty('--star-tint-a');root.style.removeProperty('--star-tint-b');};
  },[mode,tint,state.progress,state.neutral]);
  return <StarContext.Provider value={{state,update:patch=>setState(current=>({...current,...patch}))}}>{children}</StarContext.Provider>;
}

export function StellarOrb({compact=false}: {compact?:boolean}) {
  const {state} = useContext(StarContext);
  const canvas = useRef<HTMLCanvasElement>(null);
  const settings = useRef(state);
  const wake = useRef<()=>void>(()=>{});
  const [rendered,setRendered] = useState(false);
  useEffect(()=>{ settings.current=state; wake.current(); },[state]);
  useEffect(()=>{
    const element=canvas.current;
    if(!element) return;
    let renderer: ReturnType<typeof createStellarRenderer> = null;
    let frame=0, last=0, time=0, visible=false, disposed=false, lost=false, didRender=false;
    let shown=settings.current.progress;
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    function tick(now:number) {
      frame=0;
      if(disposed || lost || !visible || document.hidden) { last=0; return; }
      if(!renderer) {renderer=createStellarRenderer(element!);if(!renderer) {lost=true;return;}}
      const delta=last ? Math.min((now-last)/1000,.1) : 1/30;
      if(last && delta<1/30) { frame=requestAnimationFrame(tick); return; }
      last=now;
      const value=settings.current;
      const moving=value.animate && !motion.matches;
      if(moving) time+=delta;
      shown=motion.matches ? value.progress : shown+(value.progress-shown)*(1-Math.exp(-delta*9));
      if(Math.abs(shown-value.progress)<.05) shown=value.progress;
      renderer!.draw(time,value.neutral ? null : shown);
      if(!didRender) {didRender=true;setRendered(true);}
      if(moving || shown!==value.progress) frame=requestAnimationFrame(tick);
    }
    function schedule() { if(!frame && !disposed && !lost && visible && !document.hidden) frame=requestAnimationFrame(tick); }
    function visibility() { if(document.hidden) {cancelAnimationFrame(frame);frame=0;last=0;} else schedule(); }
    function contextLost(event:Event) {event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;setRendered(false);}
    const observer=new IntersectionObserver(entries=>{
      visible=entries[0]?.isIntersecting ?? false;
      if(!visible) {cancelAnimationFrame(frame);frame=0;last=0;} else schedule();
    });
    observer.observe(element);
    motion.addEventListener('change',schedule);
    document.addEventListener('visibilitychange',visibility);
    element.addEventListener('webglcontextlost',contextLost);
    wake.current=schedule;
    return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();motion.removeEventListener('change',schedule);document.removeEventListener('visibilitychange',visibility);element.removeEventListener('webglcontextlost',contextLost);renderer?.dispose();wake.current=()=>{};};
  },[]);
  const colour=state.neutral ? '#adb6d3' : state.progress<60 ? '#fa5931' : state.progress<80 ? '#edb952' : '#72e795';
  return <span className={`stellar-orb ${compact?'stellar-orb--compact':''}`} style={{'--star-colour':colour} as CSSProperties} aria-hidden="true">
    <span className="stellar-fallback" hidden={rendered}/><canvas ref={canvas} width={compact?96:256} height={compact?96:256} className={rendered?'stellar-canvas--ready':''}/>
  </span>;
}

export function StellarControl({name}: {name:string}) {
  const {state,update}=useContext(StarContext);
  const id=useId();
  const green=Math.round(Math.max(0,Math.min(1,(state.progress-60)/20))*100);
  const orange=Math.round(Math.max(0,Math.min(1,state.progress/60))*100);
  const description=state.neutral?'A quiet, neutral star.':state.progress<60?`${100-orange}% red · ${orange}% orange`:state.progress<80?`${100-green}% orange · ${green}% green`:state.progress===100?'Green · full radiance':'Green · building radiance';
  return <details className="stellar-control">
    <summary aria-label={`Your star preview: ${state.neutral?'no planned work':`${state.progress}%`}. Adjust appearance`}>
      <StellarOrb/>
      <span className="stellar-caption"><span>Your star</span><strong>{state.neutral?'Neutral':`${state.progress}%`}</strong><span className="stellar-preview-label">Preview <ChevronDown size={13}/></span></span>
    </summary>
    <div className="stellar-adjustments">
      <p className="stellar-person">{name}</p>
      <p className="stellar-explainer">Explore your star’s phases. This preview isn’t connected to your tasks.</p>
      <label htmlFor={id} className="stellar-range-label">Preview progress <output htmlFor={id}>{state.progress}%</output></label>
      <input id={id} name="star-preview-progress" type="range" min="0" max="100" step="1" value={state.progress} disabled={state.neutral} onChange={event=>update({progress:Number(event.target.value)})} aria-describedby={`${id}-phase`}/>
      <p id={`${id}-phase`} className="stellar-phase" aria-live="polite">{description}</p>
      <label className="stellar-option"><input type="checkbox" checked={state.neutral} onChange={event=>update({neutral:event.target.checked})}/>No planned work</label>
      <label className="stellar-option"><input type="checkbox" checked={state.animate} onChange={event=>update({animate:event.target.checked})}/>Animate star</label>
      <p className="stellar-footnote">Respects reduced motion. Preview settings reset when you refresh or switch account.</p>
    </div>
  </details>;
}
