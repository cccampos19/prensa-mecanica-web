'use strict';

function solveComponentBearings(c, {add, check, decision, trial}) {
  const {radialLoad, rpm, life, bearingType, bearingStatic, boreMin} = c;
  const n = number;
  const eq = value => add('eq', value);
  const text = value => add('text', value);
  const capacity = value => display(value, 'kN');
  const mm = value => display(value, 'mm');

  check([radialLoad,rpm,life].every(value=>Number.isFinite(value)&&value>0),
    'Ingresa una carga radial, una velocidad y una vida L10 positivas.');
  check([0,1].includes(bearingType), 'Elige un tipo de rodamiento de la tabla 11-2.');
  check(Number.isFinite(bearingStatic)&&bearingStatic>=1&&Number.isFinite(boreMin)&&boreMin>=0,
    'El factor estático debe ser al menos 1 y el diámetro mínimo debe ser cero o positivo.');

  const lifeMillions=60*rpm*life/1e6;
  const dynamicRequired=radialLoad*Math.cbrt(lifeMillions)/1000;
  const staticRequired=bearingStatic*radialLoad/1000;
  check(lifeMillions>0&&[lifeMillions,dynamicRequired,staticRequired].every(Number.isFinite),
    'La combinación de velocidad, carga y vida excede el intervalo numérico.');
  const family=bearingType===0?'Ranura profunda':'Contacto angular';
  const capacityColumn=bearingType===0?6:8;
  const selection=decision(6,'Agujero del rodamiento','mm',
    family+' · Serie 02 · tabla 11-2. Se elige el primer diámetro que cumple vida L10, capacidad estática y agujero mínimo.');

  add('heading','Carga equivalente y capacidades requeridas');
  text('Rodamiento de bolas con carga radial y sin empuje axial. Se usa V = 1 para aro interior giratorio. La vida L10 corresponde al 90 % de confiabilidad del rodamiento.');
  eq(math`P=VF_r=1(${n(radialLoad)})=${display(radialLoad,'N')}`);
  eq(math`L_{10}=\frac{60 n L_{10h}}{10^6}=\frac{60(${n(rpm)})(${n(life)})}{10^6}=${n(lifeMillions)}\ \mathrm{millones\ de\ rev}`);
  eq(math`C_{10,\mathrm{req}}=P L_{10}^{1/3}=\frac{${n(radialLoad)}}{1000}(${n(lifeMillions)})^{1/3}=${capacity(dynamicRequired)}`);
  eq(math`C_{0,\mathrm{req}}=n_0 F_r=\frac{(${n(bearingStatic)})(${n(radialLoad)})}{1000}=${capacity(staticRequired)}`);
  eq(math`d_{\min}=${mm(boreMin)}`);

  let selected;
  add('heading','Iteración por filas de la tabla 11-2');
  for(const row of referenceTables[3].rows){
    const [bore]=row;
    const [dynamic,elastic]=row.slice(capacityColumn,capacityColumn+2);
    const fails=[];
    if(bore<boreMin) fails.push('Agujero menor al mínimo de '+n(boreMin)+' mm.');
    if(dynamic<dynamicRequired) fails.push('Capacidad dinámica insuficiente.');
    if(elastic<staticRequired) fails.push('Capacidad estática insuficiente.');
    const accepted=fails.length===0;
    const rating='Capacidades tabuladas C10 de '+n(dynamic)+' kN y C0 de '+n(elastic)+' kN.';
    const reason=accepted?'Cumple el agujero mínimo, la capacidad dinámica y la estática.':fails.join(' ');

    add('iteration','Candidato · '+n(bore)+' mm');
    eq(math`d=${mm(bore)};\quad C_{10}=${capacity(dynamic)};\quad C_0=${capacity(elastic)}`);
    text(reason);
    trial(selection,bore,accepted?'selected':'rejected',rating+' '+reason);
    if(accepted){
      selected=row;
      break;
    }
  }
  check(selected,'Las filas de la tabla 11-2 para este tipo quedan por debajo de los requisitos de agujero o carga.');
  const [bore,outer,width,rmax,shoulder,housing]=selected;
  const [dynamic,elastic]=selected.slice(capacityColumn,capacityColumn+2);
  const lifeAtDuty=1e6*(dynamic*1000/radialLoad)**3/(60*rpm);
  const staticAtDuty=elastic*1000/radialLoad;
  check(Number.isFinite(lifeAtDuty)&&Number.isFinite(staticAtDuty),
    'Los resultados de vida y seguridad estática exceden el intervalo numérico.');

  add('heading','Dimensiones de la fila seleccionada');
  eq(math`d=${mm(bore)};\quad D_E=${mm(outer)};\quad B=${mm(width)}`);
  eq(math`r_{\max}=${mm(rmax)};\quad d_s=${mm(shoulder)};\quad d_H=${mm(housing)}`);
  eq(math`L_{10h,\mathrm{calc}}=\frac{10^6}{60(${n(rpm)})}\left(\frac{${n(dynamic)}}{${n(radialLoad/1000,6)}}\right)^3=${display(lifeAtDuty,'h')}`);
  eq(math`n_{0,\mathrm{calc}}=\frac{C_0}{F_r}=\frac{${n(elastic)}}{${n(radialLoad/1000,6)}}=${n(staticAtDuty)}`);
  add('note','Comprueba el radio de filete y los hombros de montaje con las dimensiones de esta fila antes de definir la geometría del alojamiento.');
  add('diagram',{
    title:'Rodamiento seleccionado · serie 02',
    caption:'Vista frontal esquemática. Las cotas corresponden a la fila de la tabla 11-2.',
    marks:[
      ['circle',105,68,42],['circle',105,68,42*bore/outer],
      ['label',105,14,'Vista frontal'],
      ['label',284,100,family],
      ['label',284,75,'Agujero d = '+n(bore)+' mm'],
      ['label',284,51,'Diámetro exterior DE = '+n(outer)+' mm'],
      ['label',284,27,'Ancho B = '+n(width)+' mm']
    ]
  });
  return {design:{diameter:bore},metrics:[
    ['Agujero seleccionado',bore,'mm',0],
    ['Diámetro exterior',outer,'mm',0],
    ['Ancho',width,'mm',0],
    ['Capacidad dinámica C10',dynamic,'kN',2],
    ['Capacidad estática C0',elastic,'kN',2],
    ['Vida L10 calculada',lifeAtDuty,'h',0],
    ['Factor estático calculado',staticAtDuty,'',2]
  ]};
}

function solveComponentBalance(c, {add, check, decision, trial}) {
  const {span, x1, x2, fy1, fz1, fy2, fz2} = c;
  const n = number;
  const eq = value => add('eq',value);
  const text = value => add('text',value);
  const mm = value => display(value,'mm');
  const force = value => display(value,'N');
  const moment = value => display(value,'N\\,m');
  check([span,x1,x2,fy1,fz1,fy2,fz2].every(Number.isFinite)&&span>0,
    'Ingresa una distancia positiva entre apoyos y componentes de carga finitas.');
  check(x1>0&&x1<span&&x2>0&&x2<span,
    'Las posiciones de las cargas deben quedar entre ambos apoyos.');

  const stations=[...new Set([0,x1,x2,span])].sort((a,b)=>a-b);
  const criticalStations=stations.slice(1,-1);

  add('heading','Geometría y convención');
  text('Flecha simplemente apoyada en A y B, con dos cargas puntuales. Usa los signos de las componentes en los ejes Y y Z. Las posiciones se miden desde A y pueden coincidir.');
  eq(math`L=${mm(span)};\quad x_1=${mm(x1)};\quad x_2=${mm(x2)}`);
  const planes=[['y',fy1,fy2],['z',fz1,fz2]].map(([axis,f1,f2])=>{
    const right=-(f1*(x1/span)+f2*(x2/span));
    const left=-f1-f2-right;
    const shear=stations.slice(0,-1).map(x=>left+(x>=x1?f1:0)+(x>=x2?f2:0));
    const at=x=>left*(x/1000)+f1*(Math.max(0,x-x1)/1000)+f2*(Math.max(0,x-x2)/1000);
    const moments=[0,...criticalStations.map(at),0];
    check([left,right,...shear,...moments].every(Number.isFinite),'Las reacciones o momentos exceden el intervalo numérico.');

    add('heading','Equilibrio en el plano '+axis.toUpperCase());
    eq(math`F_{1${axis}}=${force(f1)};\quad F_{2${axis}}=${force(f2)}`);
    eq(math`\sum M_{A,${axis}}=R_{B,${axis}}L+F_{1${axis}}x_1+F_{2${axis}}x_2=0`);
    eq(math`R_{B,${axis}}=-\frac{(${n(f1)})(${n(x1)})+(${n(f2)})(${n(x2)})}{${n(span)}}=${force(right)}`);
    eq(math`R_{A,${axis}}=-(${n(f1)})-(${n(f2)})-(${n(right)})=${force(left)}`);
    eq(math`M_{(${axis})}(x)=R_{A,${axis}}x+F_{1${axis}}\langle x-x_1\rangle+F_{2${axis}}\langle x-x_2\rangle`);
    text('En la ecuación de momento las posiciones se expresan en metros y los paréntesis angulares representan la parte positiva.');
    shear.forEach((value,i)=>{
      eq(math`V_{${axis},${i+1}}=${force(value)};\quad ${n(stations[i])}<x<${n(stations[i+1])}\,\mathrm{mm}`);
    });
    criticalStations.forEach((x,i)=>{
      eq(math`M_{(${axis})}(${n(x)}\,\mathrm{mm})=(${n(left)})(${n(x/1000,5)})+(${n(f1)})(${n(Math.max(0,x-x1)/1000,5)})+(${n(f2)})(${n(Math.max(0,x-x2)/1000,5)})=${moment(moments[i+1])}`);
    });
    return {axis,left,right,shear,moments};
  });

  add('heading','Reacciones y momento flector resultantes');
  const [Y,Z]=planes;
  const radialLeft=Math.hypot(Y.left,Z.left), radialRight=Math.hypot(Y.right,Z.right);
  const combined=stations.map((_,i)=>Math.hypot(Y.moments[i],Z.moments[i]));
  const maximum=Math.max(...combined);
  const maxStation=stations[combined.indexOf(maximum)];
  check([radialLeft,radialRight,maximum].every(Number.isFinite),'Las resultantes exceden el intervalo numérico.');
  eq(math`R_A=\sqrt{(${n(Y.left)})^2+(${n(Z.left)})^2}=${force(radialLeft)};\quad R_B=\sqrt{(${n(Y.right)})^2+(${n(Z.right)})^2}=${force(radialRight)}`);
  criticalStations.forEach((x,i)=>{
    eq(math`M_R(${n(x)}\,\mathrm{mm})=\sqrt{(${n(Y.moments[i+1])})^2+(${n(Z.moments[i+1])})^2}=${moment(combined[i+1])}`);
  });
  text('Entre cargas los momentos de cada plano cambian linealmente. La magnitud resultante alcanza un máximo en alguno de los apoyos o puntos de carga.');
  eq(math`M_{R,\max}=${moment(maximum)};\quad x=${mm(maxStation)}`);
  const result=decision(4,'Momento flector máximo','N·m','Equilibrio de la flecha en dos planos.');
  trial(result,maximum,'calculated',maximum===0?'El momento resultante es cero en todo el vano.':'El máximo resultante se alcanza a '+n(maxStation)+' mm desde A.');

  const xAt=x=>55+330*(x/span);
  const geometry=[
    ['line',xAt(0),60,xAt(span),60],
    ['label',xAt(0),89,'A'],['label',xAt(span),89,'B'],
    ['label',220,15,'L = '+n(span)+' mm']
  ];
  for(const x of [xAt(0),xAt(span)]){
    geometry.push(['line',x,60,x-12,38],['line',x,60,x+12,38],['line',x-12,38,x+12,38]);
  }
  for(const x of criticalStations) geometry.push(['circle',xAt(x),60,4],['line',xAt(x),65,xAt(x),98]);
  add('diagram',{
    title:'Flecha y puntos de carga',
    caption:'F1 a '+n(x1)+' mm y F2 a '+n(x2)+' mm desde A. Las componentes y los signos se indican en las ecuaciones.',
    marks:geometry
  });

  for(const {axis,shear,moments} of planes){
    const vLimit=Math.max(1,...shear.map(Math.abs)), mLimit=Math.max(1,...moments.map(Math.abs));
    const v=value=>91+20*(value/vLimit), m=value=>36+20*(value/mLimit);
    const marks=[
      ['line',xAt(0),91,xAt(span),91],['line',xAt(0),36,xAt(span),36],
      ['label',23,91,'V'+axis],['label',23,36,'M('+axis+')'],
      ['label',xAt(0),6,'A'],['label',xAt(span),6,'B'],
      ['line',xAt(0),91,xAt(0),v(shear[0])]
    ];
    shear.forEach((value,i)=>{
      const end=xAt(stations[i+1]);
      marks.push(['line',xAt(stations[i]),v(value),end,v(value)],
        ['line',end,v(value),end,i+1<shear.length?v(shear[i+1]):91],
        ['line',xAt(stations[i]),m(moments[i]),end,m(moments[i+1])]);
    });
    add('diagram',{
      title:'Cortante y momento · plano '+axis.toUpperCase(),
      caption:'V en N y M en N·m. Cada gráfica usa su propia escala vertical y el mismo eje longitudinal.',
      marks
    });
  }
  return {metrics:[
    ['Reacción radial en A',radialLeft,'N',2],
    ['Reacción radial en B',radialRight,'N',2],
    ['Momento flector máximo',maximum,'N·m',2],
    ['Posición del máximo desde A',maxStation,'mm',2]
  ]};
}
