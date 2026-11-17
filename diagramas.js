'use strict';

function designDiagrams(c,p,b,d,s){
  const diagrams=[];
  let diagram;
  const num=v=>Number(v.toFixed(2));
  const panel=(title,caption)=>{diagram={title,caption,marks:[]};diagrams.push(diagram);};
  const line=(x,y,X,Y)=>diagram.marks.push(['line',x,y,X,Y]);
  const circle=(x,y,r)=>diagram.marks.push(['circle',x,y,r]);
  const label=(x,y,text)=>diagram.marks.push(['label',x,y,text]);
  const poly=points=>points.slice(1).forEach(([x,y],i)=>line(...points[i],x,y));
  function arrow(x,y,X,Y){
    line(x,y,X,Y);
    const a=Math.atan2(Y-y,X-x);
    for(const t of [-.55,.55]) line(X,Y,X-8*Math.cos(a+t),Y-8*Math.sin(a+t));
  }
  function box(x,y,w,h,title,value){
    poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]);
    label(x+w/2,y+h*.65,title);label(x+w/2,y+h*.31,value);
  }

  panel('Cadena de potencia','Velocidades del caso calculado. El sentido de las flechas indica la transmisión de potencia.');
  box(12,35,105,52,'Motor',num(c.rpm)+' rpm');
  box(158,35,105,52,'Flecha',num(p.shaftRpm)+' rpm');
  box(304,35,105,52,'Salida',num(p.outRpm)+' rpm');
  arrow(117,61,158,61);arrow(263,61,304,61);
  label(210,14,'Potencia requerida: '+num(p.motorPower/1000)+' kW');

  panel('Banda y polea tensora','Posición intermedia. Los centros, radios y tangentes se dibujan con una escala común.');
  const state=b.states[50], beta=c.angle*Math.PI/180;
  const motor=[c.centers*Math.cos(beta),c.centers*Math.sin(beta)];
  const rod=[motor[0]-.15*Math.cos(state.phi),motor[1]+.15*Math.sin(state.phi)];
  const origin=[0,0];
  const centers=[origin,motor,rod], radii=[b.driven/2,b.driver/2,b.rollerDiameter/2000];
  const low=axis=>Math.min(...centers.map((point,i)=>point[axis]-radii[i]));
  const high=axis=>Math.max(...centers.map((point,i)=>point[axis]+radii[i]));
  const scale=Math.min(133/(high(0)-low(0)),106/(high(1)-low(1)));
  const xy=(x,y)=>[138+(x-low(0))*scale,9+(y-low(1))*scale];
  const pulley=(point,r)=>circle(...xy(...point),r*scale);
  const tangent=(a,r,z,R,t)=>{
    const point=(v,h)=>xy(v[0]-h*Math.sin(t),v[1]+h*Math.cos(t));
    line(...point(a,r),...point(z,R));
  };
  const t=beta+Math.asin((b.driven-b.driver)/(2*c.centers));
  pulley(origin,b.driven/2);pulley(motor,b.driver/2);pulley(rod,b.rollerDiameter/2000);
  tangent(origin,-b.driven/2,motor,-b.driver/2,t);
  tangent(origin,b.driven/2,rod,-b.rollerDiameter/2000,state.b);
  tangent(rod,-b.rollerDiameter/2000,motor,b.driver/2,state.m);
  label(65,97,'Rodillo '+num(b.rollerDiameter)+' mm');
  label(64,75,'Ramal flojo');
  label(332,85,'Motriz '+num(b.driver*1000)+' mm');
  label(332,55,'Ramal tenso');
  label(65,19,'Conducida '+num(b.driven*1000)+' mm');
  label(328,16,'Ancho '+num(b.selected*1000)+' mm');

  panel('Engranes rectos','Círculos primitivos y componentes de la fuerza sobre el piñón. El perfil de diente es esquemático.');
  const largerGear=Math.max(d.pinion,d.gear);
  const rA=10+28*d.pinion/largerGear,rB=10+28*d.gear/largerGear;
  circle(159-rA,60,rA);circle(159+rB,60,rB);
  arrow(159,60,159,104);arrow(159,60,113,60);
  label(150,115,'Wt');label(93,63,'Wr');
  label(72,14,'Piñón '+c.np+' dientes');label(274,14,'Rueda '+c.ng+' dientes');
  label(329,80,'Módulo '+num(d.module)+' mm');label(324,53,'Cara '+num(d.faceMm)+' mm');

  panel('Diagrama de cuerpo libre de la flecha','Posición intermedia. Las flechas indican los puntos de aplicación; sus componentes se calculan en los planos Y y Z.');
  const x=[35,35+342*c.x2/c.span,35+342*c.x3/c.span,377];
  line(x[0],58,x[3],58);
  x.forEach((a,i)=>{circle(a,58,3);label(a,43,String(i+1));});
  arrow(x[0],12,x[0],53);arrow(x[3],12,x[3],53);
  arrow(x[1],102,x[1],64);arrow(x[2],102,x[2],64);
  label(x[0],8,'R1');label(x[3],8,'R4');
  label(x[1],111,'Engrane');label(x[2],111,'Banda');

  panel('Cortante y momento de la flecha','Diagramas por plano para la posición intermedia. Las escalas verticales son independientes y las envolventes de diseño se listan en la memoria.');
  const plot=(data,y,title,step)=>{
    const max=Math.max(1,...data.map(Math.abs));
    const points=data.map((v,i)=>[x[i],y+v*11/max]);
    line(x[0],y,x[3],y);
    if(step) for(let i=0;i<3;i++){line(x[i],points[i][1],x[i+1],points[i][1]);if(i<2)line(x[i+1],points[i][1],...points[i+1]);}
    else poly(points);
    label(15,y,title);
  };
  d.planes.forEach(({v,m},i)=>{plot(v,102-i*26,i?'Vz':'Vy',true);plot(m,50-i*26,i?'Mz':'My',false);});

  panel('Flecha escalonada','Esquema de los diámetros locales conforme al modelo. Los apoyos comparten el diámetro comercial.');
  poly([[27,49],[80,49],[80,45],[200,45],[200,40],[318,40],[318,49],[390,49],[390,81],[318,81],[318,90],[200,90],[200,85],[80,85],[80,81],[27,81],[27,49]]);
  label(63,24,'Base '+d.diameter+' mm');
  label(200,24,'Sección 3 '+num(1.2*d.diameter)+' mm');
  label(347,24,'Hombro '+num(1.5*d.diameter)+' mm');
  if(d.continuous!==null) label(202,107,'Diámetro continuo: '+num(d.continuous)+' mm');

  panel('Rodamientos y reacciones máximas','Las reacciones mostradas son máximos del recorrido y pueden corresponder a posiciones diferentes.');
  circle(92,63,33);circle(92,63,19);circle(327,63,33);circle(327,63,19);
  line(126,63,294,63);
  label(92,15,'Apoyo 1: '+num(d.loads[0]/1000)+' kN');
  label(327,15,'Apoyo 4: '+num(d.loads[1]/1000)+' kN');
  label(210,87,'Serie 02');label(210,43,'Agujero '+d.diameter+' mm');

  panel('Brazo tensor y resorte','Cotas del plano, acción del rodillo y resortes en tensión. Configuración esquemática.');
  circle(304,91,6);circle(141,82,15);line(141,82,304,91);
  line(110,9,304,9);line(141,9,141,21);
  const spring=[[141,67]];
  for(let i=0;i<8;i++)spring.push([141+(i%2?7:-7),63-i*5]);
  spring.push([141,21]);poly(spring);
  arrow(110,64,110,97);label(65,101,'Reacción');
  label(230,103,'Brazo 150 mm');label(305,108,'Pivote');
  label(257,39,'Cota vertical 180 mm');label(246,19,'Alambre '+num(s.selected)+' mm');
  return diagrams;
}

function paintDiagram(canvas,diagram){
  const ctx=canvas.getContext('2d');
  ctx.scale(2,2);ctx.strokeStyle='#21594c';ctx.fillStyle='#172f29';ctx.lineWidth=1.7;
  ctx.font='12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const [kind,x,y,a,b] of diagram.marks){
    if(kind==='label'){ctx.fillText(a,x,125-y);continue;}
    ctx.beginPath();
    if(kind==='circle')ctx.arc(x,125-y,a,0,2*Math.PI);
    else {ctx.moveTo(x,125-y);ctx.lineTo(a,125-b);}
    ctx.stroke();
  }
}

function diagramTex(diagram,escape){
  const v=x=>Number(x.toFixed(2));
  const point=(x,y)=>'('+v(x)+','+v(y)+')';
  const row=([kind,x,y,a,b])=>{
    if(kind==='line')return '\\Line'+point(x,y)+point(a,b);
    if(kind==='circle')return '\\put'+point(x,y)+'{\\circle{'+v(2*a)+'}}';
    return '\\put'+point(x,y)+'{\\makebox(0,0){\\scriptsize '+escape(a)+'}}';
  };
  return ['\\begin{samepage}','\\subsection*{'+escape(diagram.title)+'}',
    '\\begin{center}\\setlength{\\unitlength}{1pt}\\begin{picture}(420,125)',
    ...diagram.marks.map(row),'\\end{picture}\\end{center}',escape(diagram.caption),'\\end{samepage}'].join('\n');
}
