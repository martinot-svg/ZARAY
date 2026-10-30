/**
 * Z'Accueil: three Starlink V2 Mini-inspired spacecraft rendered from one
 * actual 3D polygon model, sunlight-shaded and projected during SSR.
 *
 * The final 3D geometry is INCLUDED in the first HTML response. It does not
 * depend on hydration, canvas/WebGL initialization, image requests or GPU
 * support. The very same geometry stays visible forever: NO skeleton,
 * replacement satellite, overlay fade, delayed appearance or morphing.
 *
 * CSS orbital animations start at first paint, run continuously without JS,
 * respect prefers-reduced-motion, and preserve the existing Earth framing.
 *
 * Geometry follows the public SpaceX V2 Mini architecture: thin flat
 * communications bus, two deployed PV wings, multiple phased-array patches,
 * E/Ka-band radio hardware, three optical terminals and ion thruster.
 * Reference: https://starlink.com/technology
 * This is a faithful public-reference reconstruction, NOT proprietary SpaceX
 * CAD and not live tracking.
 */

type V3 = readonly [number, number, number];
type Quad = { vertices: [V3,V3,V3,V3]; material: V3 };
type RenderFace = { points: string; fill: string; depth: number };
type Craft = {
  key: string; x: number; y: number; size: number;
  angles: V3; orbitClass: string; period: string; delay: string;
};

// SpaceX spacecraft use dark optical/radio surfaces, not a glossy chrome bus.
const aluminum: V3 = [0.72,0.77,0.78];
const steel: V3 = [0.30,0.36,0.42];
const graphite: V3 = [0.052,0.070,0.089];
const photovoltaic: V3 = [0.052,0.095,0.156];
const glass: V3 = [0.27,0.49,0.59];
const copper: V3 = [0.59,0.35,0.20];
const foil: V3 = [0.64,0.68,0.65];

const CRAFT: readonly Craft[] = [
  {key:'one', x:670, y:-92, size:17.5, angles:[-0.32,-0.35,-0.12],
    orbitClass:'one', period:'112s', delay:'-14s'},
  {key:'two', x:866, y:-10, size:15.0, angles:[0.26,0.47,0.14],
    orbitClass:'two', period:'136s', delay:'-54s'},
  {key:'three', x:1050, y:92, size:13.4, angles:[-0.20,-0.53,0.18],
    orbitClass:'three', period:'164s', delay:'-93s'},
];

function makeModel(): Quad[] {
  const quads: Quad[]=[];
  function quad(a:V3,b:V3,c:V3,d:V3,material:V3) {
    quads.push({vertices:[a,b,c,d],material});
  }
  function box(x:number,y:number,z:number,w:number,h:number,depth:number,
    face:V3,side:V3=face) {
    const x0=x-w/2,x1=x+w/2,y0=y-h/2,y1=y+h/2,z0=z-depth/2,z1=z+depth/2;
    quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],face);
    quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],side);
    quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],side);
    quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],side);
    quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],side);
    quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],side);
  }
  function circle(x:number,y:number,z:number,radius:number,material:V3) {
    for(let i=0;i<16;i++) {
      const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
      quad([x,y,z],[x+radius*Math.cos(a),y+radius*Math.sin(a),z],
        [x+radius*Math.cos(b),y+radius*Math.sin(b),z],[x,y,z],material);
    }
  }
  function dish(x:number,y:number,z:number,radius:number) {
    const steps=3,parts=16;
    for(let ring=0;ring<steps;ring++) {
      const inner=radius*ring/steps,outer=radius*(ring+1)/steps;
      const zi=z+.11*(inner/radius)**2,zo=z+.11*(outer/radius)**2;
      for(let i=0;i<parts;i++) {
        const a=2*Math.PI*i/parts,b=2*Math.PI*(i+1)/parts;
        const metal:V3=i%3===0?[.78,.85,.9]:i%3===1?[.58,.69,.77]:[.68,.78,.84];
        quad([x+inner*Math.cos(a),y+inner*Math.sin(a),zi],
          [x+outer*Math.cos(a),y+outer*Math.sin(a),zo],
          [x+outer*Math.cos(b),y+outer*Math.sin(b),zo],
          [x+inner*Math.cos(b),y+inner*Math.sin(b),zi],metal);
      }
    }
    circle(x,y,z+.031,radius*.14,graphite);
    circle(x,y,z+.041,radius*.06,glass);
  }

  // Low-profile dark V2 Mini bus, powder-coated equipment panels and
  // exposed lightweight-aluminum perimeter. Individual slabs have volume.
  box(0,0,.04,2.10,1.54,.43,steel,graphite);
  box(0,0,.295,1.85,1.32,.10,[.21,.26,.29],steel);
  box(0,-.69,.36,2.02,.08,.07,aluminum,steel);
  box(0,.69,.36,2.02,.08,.07,aluminum,steel);
  box(-.99,0,.36,.095,1.42,.09,foil,steel);
  box(.99,0,.36,.095,1.42,.09,foil,steel);
  box(0,0,.38,.034,1.35,.014,aluminum,graphite);
  box(0,0,.389,1.84,.028,.012,[.48,.54,.58],graphite);
  // External silvery rails, fasteners and foil-clad battery/avionics panels.
  for (const side of [-1,1]) {
    box(side*.84,-.57,.415,.17,.15,.035,foil,steel);
    box(side*.84,.56,.415,.16,.13,.035,foil,steel);
    for(const y of [-.58,-.38,.38,.59]) {
      circle(side*.98,y,.43,.025,[.57,.61,.63]);
      circle(side*.98,y,.44,.010,graphite);
    }
  }
  // Five user-link Ku patches and three Ka/E-band apertures.
  // Unlike toy solar panels, RF surfaces face Earth and are matte/dark.
  for (const [i,x] of [-.61,-.305,0,.305,.61].entries()) {
    const y=-.27;
    box(x,y,.400,.24,.33,.021,[.085,.125,.14],steel);
    box(x,y,.415,.18,.265,.010,[.16,.21,.23],graphite);
    if(i%2===0) box(x,y,.424,.07,.20,.006,[.23,.27,.28],graphite);
  }
  for (const x of [-.54,0,.54]) {
    const y=.20;
    box(x,y,.402,.32,.30,.024,[.105,.14,.16],steel);
    box(x,y,.422,.24,.23,.016,[.20,.24,.25],graphite);
  }
  // Realistic radio feed dishes, recessed optics and copper-like RF ports.
  dish(-.72,.48,.425,.145);
  dish(.72,.48,.425,.145);
  circle(0,-.56,.442,.10,graphite);
  circle(0,-.56,.448,.046,glass);
  for (const side of [-1,1]) {
    box(side*1.04,-.15,.0,.16,.28,.17,foil,steel);
    circle(side*1.07,-.15,.105,.10,copper);
    circle(side*1.07,-.15,.117,.045,graphite);
    box(side*.93,.28,.12,.24,.16,.13,steel,graphite);
    circle(side*.93,.28,.217,.065,[.31,.44,.54]);
  }
  // Three optical inter-satellite terminal apertures.
  circle(-.91,.58,.425,.055,graphite);
  circle(-.91,.58,.437,.024,glass);
  circle(.91,.58,.425,.055,graphite);
  circle(.91,.58,.437,.024,glass);
  circle(0,.61,.425,.056,graphite);
  circle(0,.61,.437,.026,glass);

  // Two broad structural solar wings, not thin flat 2D clipart.
  for(const sign of [-1,1]) {
    box(sign*1.13,-.24,-.05,.55,.11,.14,aluminum,steel);
    box(sign*1.13,.24,-.05,.55,.11,.14,aluminum,steel);
    const cx=sign*3.11;
    box(cx,0,-.13,3.66,2.16,.10,steel,graphite);
    box(cx,0,-.044,3.51,2.00,.024,photovoltaic,graphite);
    // Two segmented deployable wings, not featureless rectangles:
    // bright titanium longitudinal hinge and four transverse seams.
    for (const seam of [-.65,-.21,.21,.65]) {
      box(cx,seam,.016,3.50,.010,.010,[.18,.27,.33],graphite);
    }
    const xStart=cx-1.69;
    for(let col=0;col<9;col++) {
      for(let row=0;row<5;row++) {
        const px=xStart+(col+.5)*3.37/9;
        const py=-.94+(row+.5)*1.87/5;
        const shimmer=(col*3+row)%4;
        const material:V3=shimmer===0?[.14,.25,.33]:
          shimmer===1?[.038,.085,.14]:
          shimmer===2?[.095,.18,.27]:[.065,.135,.21];
        quad([px-.171,py-.174,.004],[px+.171,py-.174,.004],
          [px+.171,py+.174,.004],[px-.171,py+.174,.004],material);
        // One thin visible conductive busbar, not a six-faced micro-box:
        // substantially smaller first-paint HTML and faster mobile parsing.
        quad([px-.006,py-.15,.017],[px+.006,py-.15,.017],
          [px+.006,py+.15,.017],[px-.006,py+.15,.017],[.29,.44,.54]);
      }
    }
    for(const y of [-1.06,1.06]) {
      box(cx,y,.03,3.68,.042,.075,aluminum,steel);
    }
    for(const x of [cx-1.83,cx+1.83]) {
      box(x,0,.03,.048,2.14,.072,aluminum,steel);
    }
    box(cx,0,.042,.036,2.08,.05,[.43,.57,.65],steel);
  }
  // Hall-effect argon thruster: real raised nozzle and metallic housing.
  box(0,0,-.35,.62,.62,.21,steel,graphite);
  circle(0,0,-.47,.22,foil);
  circle(0,0,-.482,.176,copper);
  circle(0,0,-.490,.126,graphite);
  return quads;
}

function rotate(p:V3,angles:V3):V3 {
  const [rx,ry,rz]=angles;
  const [cx,sx]=[Math.cos(rx),Math.sin(rx)];
  const [cy,sy]=[Math.cos(ry),Math.sin(ry)];
  const [cz,sz]=[Math.cos(rz),Math.sin(rz)];
  const x=p[0],y=p[1]*cx-p[2]*sx,z=p[1]*sx+p[2]*cx;
  const a=x*cy+z*sy,b=y,c=-x*sy+z*cy;
  return [a*cz-b*sz,a*sz+b*cz,c];
}
function shade(normal:V3,material:V3):string {
  const light:V3=[-.41,.50,.77];
  const norm=Math.hypot(...normal)||1;
  const incidence=Math.max(0,(normal[0]*light[0]+normal[1]*light[1]+normal[2]*light[2])/norm);
  const ambient=.48+.52*incidence;
  const spec=Math.pow(Math.max(0,normal[2]/norm),20)*.11;
  return '#'+material.map((channel,i)=>{
    const value=Math.min(255,Math.round((channel*ambient+spec*(i===0?1:.90))*255));
    return value.toString(16).padStart(2,'0');
  }).join('');
}
function projected(quads:readonly Quad[],angles:V3):RenderFace[] {
  return quads.map(({vertices,material})=>{
    const [a,b,c,d]=vertices.map(v=>rotate(v,angles));
    const u:V3=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
    const v:V3=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const normal:V3=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const pts=[a,b,c,d].map(p=>{
      const perspective=1/(1+.045*p[2]);
      return (p[0]*perspective).toFixed(3)+','+(p[1]*perspective).toFixed(3);
    }).join(' ');
    return {points:pts,fill:shade(normal,material),depth:(a[2]+b[2]+c[2]+d[2])/4};
  }).sort((a,b)=>a.depth-b.depth);
}

// Pure, deterministic, shared by SSR and hydration: no clock, randomness,
// loading placeholder, client effect, external 3D model request, or swap.
const model=makeModel();
const snapshots=CRAFT.map(c=>projected(model,c.angles));

export default function StarlinkSatellites3D() {
  return <svg className="zaray-starlink-permanent" viewBox="0 0 1185 1185"
    preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"
    xmlns="http://www.w3.org/2000/svg">
    {CRAFT.map((craft,index)=>(
      <g key={craft.key} transform={`translate(${craft.x} ${craft.y})`}>
        <g className={'zaray-starlink-orbit zaray-starlink-orbit-'+craft.orbitClass}
          style={{animationDuration:craft.period,animationDelay:craft.delay}}>
          <g className="zaray-starlink-solid" transform={`scale(${craft.size})`}>
            {snapshots[index].map((face,n)=>
              <polygon key={n} points={face.points} fill={face.fill}/>)}
          </g>
        </g>
      </g>
    ))}
  </svg>;
}
