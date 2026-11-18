'use strict';

function shaftPlaneSketch({length,supportA,supportB,loads},axis,reactions) {
  const marks=[], labels=[], coord=x=>38+344*x/length;
  const fmt=v=>plainNumberNotation(number(v,2));
  const line=(x,y,a,b)=>marks.push(['line',x,y,a,b]);
  const label=(x,y,s)=>marks.push(['label',x,y,s]);
  const draws=[];
  function force(x,name,f){
    if(!Number.isFinite(x)||x<0||x>length||!Number.isFinite(f)||f===0) return;
    draws.push({pos:coord(x),name,f});
    labels.push(name+' = '+fmt(f)+' N a '+fmt(x)+' mm');
  }
  line(38,62,382,62);
  label(38,8,'0'); label(382,8,fmt(length)+' mm');
  for(const [name,x] of [['A',supportA],['B',supportB]]){
    if(!Number.isFinite(x)||x<0||x>length) continue;
    const u=coord(x);
    line(u,60,u-6,51);line(u,60,u+6,51);line(u-6,51,u+6,51);
    label(u,38,name);
  }
  loads.forEach((load,i)=>force(load.x,'F'+(i+1),load['f'+axis]));
  if(reactions){force(supportA,'RA',reactions.RA);force(supportB,'RB',reactions.RB);}
  // A leader preserves the station when nearby arrows need separate lanes.
  draws.sort((a,b)=>a.pos-b.pos);
  const spacing=Math.min(24,344/Math.max(1,draws.length-1));
  let previous=16-spacing;
  draws.forEach((p,i)=>{
    p.u=Math.min(404-(draws.length-1-i)*spacing,Math.max(p.pos,previous+spacing));
    previous=p.u;
    line(p.pos,62,p.u,70);
    const tail=p.f>0?72:99, tip=p.f>0?99:72, sign=Math.sign(p.f);
    line(p.u,tail,p.u,tip);line(p.u,tip,p.u-3,tip-sign*5);line(p.u,tip,p.u+3,tip-sign*5);
    label(p.u,112,p.name);
  });
  return {title:'Cuerpo libre · plano X'+axis.toUpperCase(),
    caption:'Arriba es +'+axis.toUpperCase()+'. '+(labels.length?labels.join('. ')+'.':'Cargas transversales nulas en este plano.'),marks};
}

function shaftCutPlot(length,stations,{axis,shear,moments}){
  const pos=x=>38+344*x/length;
  const marks=[], line=(x,y,a,b)=>marks.push(['line',x,y,a,b]);
  const vs=Math.max(1e-30,...shear.map(Math.abs)),ms=Math.max(1e-30,...moments.map(Math.abs));
  const vy=v=>87+20*v/vs, my=m=>33+20*m/ms;
  line(38,87,382,87);line(38,33,382,33);
  marks.push(['label',16,87,'V'],['label',16,33,'M']);
  shear.forEach((v,i)=>{
    const start=pos(stations[i]), end=pos(stations[i+1]);
    line(start,vy(i?shear[i-1]:0),start,vy(v));line(start,vy(v),end,vy(v));
    line(start,my(moments[i]),end,my(moments[i+1]));
  });
  line(382,vy(shear[shear.length-1]),382,87);
  marks.push(['label',38,9,'0'],['label',369,9,plainNumberNotation(number(length))+' mm']);
  return {title:'Cortante y momento · plano X'+axis.toUpperCase(),
    caption:'V en N y M en N·m. Los valores de cada tramo se indican en las ecuaciones de los cortes.',marks};
}

function shaftLoadPreview(geometry){
  const panel=node('div',null,'shaft-live-plots');
  if(!Number.isFinite(geometry.length)||geometry.length<=0){
    panel.append(node('p','Indica una longitud positiva para dibujar la flecha.','field-hint'));
    return panel;
  }
  for(const axis of ['y','z']){
    const d=shaftPlaneSketch(geometry,axis);
    const figure=node('figure'),canvas=node('canvas');
    canvas.width=840;canvas.height=250;
    canvas.setAttribute('role','img');canvas.setAttribute('aria-label',d.title+'. '+d.caption);
    figure.append(node('strong',d.title),canvas,node('figcaption',d.caption));
    paintDiagram(canvas,d);
    panel.append(figure);
  }
  return panel;
}
