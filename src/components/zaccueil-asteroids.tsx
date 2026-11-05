/**
 * Z’Accueil — a quiet, permanently inhabited asteroid field.
 *
 * All asteroid meshes are generated deterministically on the server and
 * included in the very first HTML paint. Never load a texture late, never
 * mount/remove a rock after hydration, and never animate opacity.
 *
 * These are artistic rocky bodies, not live tracked near-Earth objects.
 */
import type {CSSProperties} from 'react';

type Point=readonly [number,number];
type Rock={
  key:string;left:string;top:string;size:number;
  drift:string;phase:string;tumble:string;tumblePhase:string;
  seed:number;opacity:number;
};

const ROCKS: readonly Rock[]=[
  {key:'distant-one',left:'82%',top:'20%',size:69,drift:'214s',phase:'-127s',tumble:'139s',tumblePhase:'-78s',seed:21,opacity:.86},
  {key:'distant-two',left:'13%',top:'37%',size:42,drift:'267s',phase:'-168s',tumble:'183s',tumblePhase:'-113s',seed:37,opacity:.70},
  {key:'distant-three',left:'89%',top:'74%',size:52,drift:'231s',phase:'-93s',tumble:'167s',tumblePhase:'-144s',seed:9,opacity:.80},
  {key:'distant-four',left:'62%',top:'79%',size:29,drift:'311s',phase:'-219s',tumble:'227s',tumblePhase:'-58s',seed:56,opacity:.62},
  {key:'distant-five',left:'60%',top:'12%',size:33,drift:'283s',phase:'-174s',tumble:'193s',tumblePhase:'-93s',seed:74,opacity:.68},
];

function noise(seed:number,i:number){
  const n=Math.sin((i+1)*113.137+seed*73.719)*43758.5453123;
  return n-Math.floor(n);
}
const point=(p:Point)=>p.map(n=>n.toFixed(2)).join(',');
const ring=(seed:number,count:number,radius:number,variation:number):Point[]=>
  Array.from({length:count},(_,i)=>{
    const a=-Math.PI/2+(2*Math.PI*i/count);
    const r=radius*(1-variation/2+noise(seed,i)*variation);
    return [Math.cos(a)*r*(1.07+noise(seed,97)*.12),
      Math.sin(a)*r*(.88+noise(seed,98)*.13)];
  });
function faceColor(seed:number,i:number,offset:number):string{
  const sun=(Math.cos((i/17)*Math.PI*2+2.6)+1)/2;
  const grain=noise(seed,i+offset);
  const luminance=47+sun*43+grain*18+offset%3*3;
  return `rgb(${Math.round(luminance*1.08)},${Math.round(luminance*.99)},${Math.round(luminance*.88)})`;
}

function AsteroidMesh({rock}:{rock:Rock}){
  const segments=17;
  const outer=ring(rock.seed,segments,50,.32);
  const inner=ring(rock.seed+8,segments,26,.25);
  const core:Point=[-4+noise(rock.seed,67)*7,-3+noise(rock.seed,68)*8];
  const outline=outer.map(point).join(' ');
  const clip=`zaray-rock-${rock.key}`;
  const light=`zaray-light-${rock.key}`;
  return <svg className="zaray-asteroid-mesh" viewBox="-63 -63 126 126"
    focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id={clip}><polygon points={outline}/></clipPath>
      <radialGradient id={light} cx="29%" cy="24%" r="85%">
        <stop offset="0%" stopColor="#c7bdaf"/>
        <stop offset="29%" stopColor="#827c73"/>
        <stop offset="66%" stopColor="#575655"/>
        <stop offset="100%" stopColor="#1b2025"/>
      </radialGradient>
    </defs>
    <polygon points={outline} fill={`url(#${light})`}/>
    <g clipPath={`url(#${clip})`}>
      {outer.map((vertex,i)=>{
        const j=(i+1)%segments;
        return <g key={'facet-'+i}>
          <polygon points={[vertex,outer[j],inner[j],inner[i]].map(point).join(' ')}
            fill={faceColor(rock.seed,i,13)} opacity=".64"/>
          <polygon points={[inner[i],inner[j],core].map(point).join(' ')}
            fill={faceColor(rock.seed+11,i,23)} opacity=".48"/>
        </g>;
      })}
      {Array.from({length:3},(_,i)=>{
        const cx=(-23+i*19)+(noise(rock.seed,i+39)-.5)*8;
        const cy=(i===1?-18:9)+(noise(rock.seed,i+54)-.5)*13;
        const rx=5.4+noise(rock.seed,i+73)*4.6;
        const ry=rx*(.58+noise(rock.seed,i+84)*.25);
        const tilt=noise(rock.seed,i+103)*90-45;
        return <g key={'crater-'+i} transform={`rotate(${tilt.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})`}>
          <ellipse cx={cx} cy={cy} rx={rx+1.3} ry={ry+1.1}
            fill="#bcb5a7" opacity=".45"/>
          <ellipse cx={cx+1.1} cy={cy+1.2} rx={rx} ry={ry}
            fill="#202327" opacity=".65"/>
          <ellipse cx={cx+1.5} cy={cy+1.6} rx={rx*.69} ry={ry*.68}
            fill="#555452" opacity=".47"/>
        </g>;
      })}
      {Array.from({length:18},(_,i)=>{
        const a=noise(rock.seed+13,i)*Math.PI*2;
        const r=Math.sqrt(noise(rock.seed+27,i))*42;
        const x=Math.cos(a)*r,y=Math.sin(a)*r;
        return <circle key={'grain-'+i} cx={x} cy={y}
          r={.3+noise(rock.seed+41,i)*.95}
          fill={i%3===0?'#d5c8ae':'#111b20'} opacity={i%3===0?.35:.33}/>;
      })}
    </g>
    <polygon points={outline} fill="none" stroke="#b8aca0" strokeWidth=".65" opacity=".38"/>
  </svg>;
}

export default function ZaccueilAsteroids(){
  return <div className="zaray-asteroid-field" aria-hidden="true"
    data-asteroid-presence="continuous">
    {ROCKS.map(rock=><span key={rock.key}
      className="zaray-asteroid-orbit"
      data-asteroid={rock.key}
      style={{
        left:rock.left,top:rock.top,width:rock.size,
        opacity:rock.opacity,
        animationDuration:rock.drift,animationDelay:rock.phase,
      } as CSSProperties}>
      <span className="zaray-asteroid-tumble"
        style={{animationDuration:rock.tumble,animationDelay:rock.tumblePhase}}>
        <AsteroidMesh rock={rock}/>
      </span>
    </span>)}
  </div>;
}
