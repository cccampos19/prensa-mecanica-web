'use strict';

const springWires = [
  {name:'ASTM A228 · alambre de piano', A:2211,m:.145,min:.1,max:6.5, G:[82.7,81.7,81,80], sy:.65, shear:.45},
  {name:'ASTM A227 · alambre estirado duro', A:1783,m:.19,min:.7,max:12.7,G:[80.7,80,79.3,78.6],sy:.60,shear:.45}
];

function springDesign(c,belt,add,check){
  const n=number, eq=value=>add('eq',value), note=value=>add('note',value);
  const head=value=>add('heading',value), text=value=>add('text',value);
  const mm=v=>dual(v,'mm',1/25.4,'in');
  const N=v=>dual(v,'N',1/lbf,'lbf');
  const MPa=v=>dual(v,'MPa',1/6.894757293,'kpsi');
  const wire=springWires[c.wire];
  check(wire&&c.preload>0&&c.preload<100&&c.springSafety>=1&&
    c.springIndex>=6&&c.springIndex<=12&&c.hookRadius>=1,'Revisa alambre, tensión inicial y factores del tensor.');
  const first=belt.states[0], last=belt.states.at(-1);
  const fmin=first.springForce, fmax=last.springForce;
  const k=c.springRate, fi=fmin*c.preload/100, mount=first.len*1000;
  head('Equilibrio del brazo y tensión de montaje');
  text('Pivote en la polea motriz. El rodillo gira libremente y se usa la misma tensión en ambos tramos del ramal flojo. El momento de la resultante de esos tramos se equilibra con el del resorte respecto al pivote.');
  eq(math`\mathbf{R}_t=F_2(\mathbf{u}_{t,m}-\mathbf{u}_{c,t});\quad a=-\frac{\mathbf{r}_t\times(\mathbf{u}_{t,m}-\mathbf{u}_{c,t})}{\mathbf{r}_t\times\mathbf{u}_r}`);
  eq(math`\phi_0=${n(first.phi*180/Math.PI)}^\circ;\quad\phi_1=${n(last.phi*180/Math.PI)}^\circ`);
  eq(math`F_{r,0}=(${n(first.lever,6)})(${n(first.slack)})=${N(fmin)};\quad L_{inst,0}=${mm(mount)}`);
  eq(math`F_{r,1}=F_{r,0}+k\Delta x=${n(fmin)}+(${n(k)})(${n(c.travel)})=${N(fmax)}`);
  eq(math`F_i=(${n(c.preload/100)})(${n(fmin)})=${N(fi)}`);
  const xmin=(fmin-fi)/k, xmax=(fmax-fi)/k;
  const free=mount-xmin;
  eq(math`x_{\min}=\frac{${n(fmin)}-${n(fi)}}{${n(k,5)}}=${mm(xmin)}`);
  eq(math`x_{\max}=\frac{${n(fmax)}-${n(fi)}}{${n(k,5)}}=${mm(xmax)}`);
  eq(math`L_0=L_{\mathrm{inst,\min}}-x_{\min}=${n(mount)}-${n(xmin)}=${mm(free)}`);
  check(free>0,'La distancia instalada no deja longitud libre positiva.');
  text('Fᵢ representa la tensión inicial de fabricación. F mínima es la carga instalada. El modelo usa la curva F = Fᵢ + kx después de abrir las espiras.');

  head('Material, esfuerzos e iteraciones');
  text(wire.name+' · tablas 10-4 y 10-5. Se reutiliza la rigidez de la libreta (pp. 49–50), Wahl y la resistencia del alambre. Se usan los límites elásticos inferiores de la tabla 10-5. Para los esfuerzos en los extremos se conserva la geometría de gancho de Shigley como método de cálculo.');
  const C=c.springIndex;
  const kw=(4*C-1)/(4*C-4)+.615/C;
  const Ci=2*c.hookRadius;
  const ka=(4*Ci*Ci-Ci-1)/(4*Ci*(Ci-1)), kb=(4*Ci-1)/(4*Ci-4);
  const body=kw*8*C/Math.PI, hookBend=(ka*16*C+4)/Math.PI, hookShear=kb*8*C/Math.PI;
  const fa=(fmax-fmin)/2, fm=(fmax+fmin)/2;
  eq(math`C=${n(C)};\quad K_W=\frac{4C-1}{4C-4}+\frac{0.615}{C}=${n(kw,5)}`);
  eq(math`C_1=C_2=2r_g/d=${n(Ci)};\quad K_A=${n(ka,5)};\quad K_B=${n(kb,5)}`);
  eq(math`F_a=\frac{${n(fmax)}-${n(fmin)}}2=${N(fa)};\quad F_m=\frac{${n(fmax)}+${n(fmin)}}2=${N(fm)}`);
  note('Las tablas entregadas 10-4 y 10-5 dan resistencia última y límites elásticos. La resistencia cíclica del cuerpo y los ganchos queda sin verificar; se calculan los esfuerzos alternantes y medios para esa comprobación.');
  function sizing(d){
    const sut=wire.A/d**wire.m;
    const required=[
      Math.sqrt(c.springSafety*body*fmax/(wire.shear*sut)),
      Math.sqrt(c.springSafety*hookBend*fmax/(wire.sy*sut)),
      Math.sqrt(c.springSafety*hookShear*fmax/(wire.shear*sut))
    ];
    return {sut,required};
  }
  let d=Math.min(wire.max,Math.max(wire.min,4)), converged=false;
  for(let i=1;i<=100;i++){
    add('iteration','Iteración '+i+' · diámetro del alambre');
    const {sut,required}=sizing(d);
    const next=Math.max(wire.min,...required);
    const error=100*Math.abs(next-d)/next;
    eq(math`d=${mm(d)};\quad S_{ut}=\frac{${n(wire.A)}}{(${n(d,6)})^{${n(wire.m)}}}=${MPa(sut)}`);
    eq(math`d_{\mathrm{cuerpo}}=\sqrt{\frac{${n(c.springSafety)}(${n(body,5)})(${n(fmax)})}{${n(wire.shear,6)}(${n(sut)})}}=${mm(required[0])}`);
    eq(math`d_{\mathrm{gancho,A}}=\sqrt{\frac{${n(c.springSafety)}(${n(hookBend,5)})(${n(fmax)})}{${n(wire.sy)}(${n(sut)})}}=${mm(required[1])}`);
    eq(math`d_{\mathrm{gancho,B}}=\sqrt{\frac{${n(c.springSafety)}(${n(hookShear,5)})(${n(fmax)})}{${n(wire.shear,6)}(${n(sut)})}}=${mm(required[2])}`);
    eq(math`d_{\mathrm{nuevo}}=\max(${[wire.min,...required].map(v=>n(v,5)).join(',')})=${mm(next)}`);
    eq(math`\varepsilon=100\frac{|${n(next,6)}-${n(d,6)}|}{${n(next,6)}}=${n(error,5)}\,\%`);
    check(next<=wire.max,'El diámetro requerido supera el rango del alambre seleccionado en la tabla 10-4.');
    d=next;
    if(error<tolerance){converged=true;break;}
  }
  check(converged,'El diámetro del resorte no convergió.');
  head('Propuesta de fabricación y comprobaciones');
  let selected=Math.ceil(d*2)/2;
  while(selected<=wire.max && Math.max(...sizing(selected).required)>selected) {
    text('Candidato de '+n(selected)+' mm insuficiente tras recalcular las resistencias de tabla. Se incrementa 0.5 mm.');
    selected+=.5;
  }
  check(selected<=wire.max,'El diámetro redondeado supera el rango de la tabla 10-4.');
  const {sut}=sizing(selected), D=C*selected;
  const G=1000*wire.G[selected/25.4<=.032?0:selected/25.4<=.063?1:selected/25.4<=.125?2:3];
  const active=G*selected**4/(8*D**3*k);
  const initialStress=8*C*fi/(Math.PI*selected**2);
  eq(math`d=${mm(selected)};\quad D=Cd=${mm(D)};\quad D_{\mathrm{ext}}=${mm(D+selected)}`);
  eq(math`G=${display(G/1000,'GPa')};\quad N_a=\frac{Gd^4}{8D^3k}=\frac{${n(G)}(${n(selected)})^4}{8(${n(D)})^3(${n(k,5)})}=${n(active,4)}`);
  eq(math`\tau_i=\frac{8CF_i}{\pi d^2}=\frac{8(${n(C)})(${n(fi)})}{\pi(${n(selected)})^2}=${MPa(initialStress)}`);
  const tau=body*fmax/selected**2, sigmaA=hookBend*fmax/selected**2, tauB=hookShear*fmax/selected**2;
  eq(math`\tau_{\max}=K_W\frac{8F_{\max}D}{\pi d^3}=${MPa(tau)};\quad n_{\mathrm{cuerpo}}=${n(wire.shear*sut/tau,4)}`);
  eq(math`\sigma_A=\frac{F_{\max}}{\pi d^2}(16K_A C+4)=${MPa(sigmaA)};\quad n_A=${n(wire.sy*sut/sigmaA,4)}`);
  eq(math`\tau_B=K_B\frac{8F_{\max}D}{\pi d^3}=${MPa(tauB)};\quad n_B=${n(wire.shear*sut/tauB,4)}`);
  eq(math`L_{\mathrm{cuerpo,est}}=N_a d=${mm(active*selected)};\quad L_{0}=${mm(free)}`);
  const envelope=active*selected+4*c.hookRadius*selected;
  eq(math`L_{est}=N_a d+4r_g=${mm(envelope)};\quad L_{0}=${mm(free)}`);
  check(envelope<=free,'La estimación de longitud del cuerpo y los dos ganchos excede la longitud libre.');
  head('Esfuerzos para la comprobación cíclica');
  for (const [label,factor] of [['Cuerpo',body],['Gancho A · flexión',hookBend],['Gancho B · torsión',hookShear]]) {
    text(label);
    eq(math`s_a=\frac{K_F F_a}{d^2}=\frac{(${n(factor,6)})(${n(fa)})}{${n(selected)}^2}=${MPa(factor*fa/selected**2)}`);
    eq(math`s_m=\frac{K_F F_m}{d^2}=\frac{(${n(factor,6)})(${n(fm)})}{${n(selected)}^2}=${MPa(factor*fm/selected**2)}`);
  }
  note('Faltan propiedades de fatiga para cerrar esta verificación con las tablas entregadas. Cambiar el diámetro modifica los esfuerzos, pero no aporta la resistencia cíclica faltante.');
  return {name:wire.name,fmin,fmax,k,fi,selected,D,active,free};
}
