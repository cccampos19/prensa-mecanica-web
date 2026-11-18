'use strict';

function solveShaftPointLoads(geometry, {add,check}) {
  const {length,supportA:a,supportB:b,loads}=geometry;
  const n=number;
  check(Number.isFinite(length)&&length>0,'La longitud de la flecha debe ser positiva.');
  check(Number.isFinite(a)&&Number.isFinite(b)&&0<=a&&a<b&&b<=length,
    'Coloca los apoyos de izquierda a derecha dentro de la flecha y con A a la izquierda de B.');
  check(loads.every(({x,fy,fz})=>[x,fy,fz].every(Number.isFinite)&&x>=0&&x<=length),
    'Cada fuerza necesita una posición sobre la flecha y componentes Fy y Fz en N.');
  add('heading','Diagrama de cuerpo libre y cargas aplicadas');
  add('text','Dos apoyos simples. Las posiciones se miden desde el extremo izquierdo. Las fuerzas permanecen fijas en el espacio mientras la flecha gira. Se evalúa el hombro propuesto en la sección de momento máximo con el torque constante indicado.');
  add('data',{headers:['Punto','Posición y cargas'],rows:[
    ['Extremos','0 y '+n(length)+' mm'],['Apoyo A',n(a)+' mm'],['Apoyo B',n(b)+' mm'],
    ...loads.map((p,i)=>['F'+(i+1)+(p.source?' · '+p.source:''),n(p.x)+' mm · Fy = '+n(p.fy)+' N · Fz = '+n(p.fz)+' N'])
  ]});
  for(const [i,p] of loads.entries()){
    if(!p.source) continue;
    add('text',p.source+'. Dirección medida desde +Y hacia +Z.');
    add('eq',math`F_{${i+1}y}=(${n(p.magnitude)})\cos(${n(p.angle)}^\circ)=${display(p.fy,'N')}`);
    add('eq',math`F_{${i+1}z}=(${n(p.magnitude)})\sin(${n(p.angle)}^\circ)=${display(p.fz,'N')}`);
  }
  const stations=[...new Set([0,a,b,...loads.map(p=>p.x),length])].sort((x,y)=>x-y);
  const planes=['y','z'].map(axis=>{
    const forces=loads.map(({x,...p})=>({x,f:p['f'+axis]}));
    const sum=forces.reduce((s,p)=>s+p.f,0);
    const RB=-forces.reduce((s,p)=>s+p.f*((p.x-a)/(b-a)),0), RA=-sum-RB;
    const actions=[...forces,{x:a,f:RA},{x:b,f:RB}];
    const shear=[], moments=[0];
    add('heading','Equilibrio y cortes en el plano X'+axis.toUpperCase());
    add('eq',math`\sum M_A=0,\qquad R_{B${axis}}=-\frac{\sum_i F_{i${axis}}(x_i-x_A)}{x_B-x_A}`);
    forces.forEach(({f,x},i)=>add('eq',math`M_{A,${i+1}}=(${n(f)})(${n(x)}-${n(a)})=${display(f*(x-a),'N\\,mm')}`));
    add('eq',math`R_{B${axis}}=-\frac{${n(forces.reduce((s,p)=>s+p.f*(p.x-a),0))}}{${n(b)}-${n(a)}}=${display(RB,'N')}`);
    add('eq',math`R_{A${axis}}=-\sum_i F_{i${axis}}-R_{B${axis}}=-(${n(sum)})-(${n(RB)})=${display(RA,'N')}`);
    let v=0;
    for(let i=0;i<stations.length-1;i++){
      const x=stations[i], end=stations[i+1];
      const jump=actions.filter(p=>p.x===x).reduce((s,p)=>s+p.f,0);
      const before=v;
      v+=jump;
      shear.push(v);
      const m=moments[i]+v*((end-x)/1000);
      moments.push(m);
      add('eq',math`V_{(${axis}),${i+1}}=(${n(before)})+(${n(jump)})=${display(v,'N')},\quad ${n(x)}<x<${n(end)}\\,\mathrm{mm}`);
      add('eq',math`M_{(${axis})}(${n(end)})=(${n(moments[i])})+(${n(v)})\frac{${n(end)}-${n(x)}}{1000}=${display(m,'N\\,m')}`);
    }
    check([RA,RB,...shear,...moments].every(Number.isFinite),'Las cargas exceden el intervalo numérico.');
    return {axis,RA,RB,shear,moments};
  });
  const [Y,Z]=planes;
  const combined=stations.map((x,i)=>Math.hypot(Y.moments[i],Z.moments[i]));
  const maximum=Math.max(...combined), maxStation=stations[combined.indexOf(maximum)];
  add('heading','Momento que gobierna el diámetro');
  add('text','En cada tramo las dos componentes del momento varían linealmente. El máximo de su magnitud se alcanza en un extremo del tramo.');
  stations.forEach((x,i)=>add('eq',math`M_R(${n(x)})=\sqrt{(${n(Y.moments[i])})^2+(${n(Z.moments[i])})^2}=${display(combined[i],'N\\,m')}`));
  const metrics=[['Momento máximo',maximum,'N·m'],['Reacción radial en A',Math.hypot(Y.RA,Z.RA),'N'],['Reacción radial en B',Math.hypot(Y.RB,Z.RB),'N']];
  if(maximum>0) metrics.push(['Posición de momento máximo',maxStation,'mm']);
  for(const plane of planes){
    add('diagram',shaftPlaneSketch(geometry,plane.axis,plane));
    add('diagram',shaftCutPlot(length,stations,plane));
  }
  return {maximum,maxStation,metrics,planes,stations};
}
