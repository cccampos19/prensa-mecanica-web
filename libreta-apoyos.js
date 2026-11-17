'use strict';

function calculateNotebookBalance(){
  const {entries,decisions,add,decision,trial}=createCalculationTrace();
  const n=number;
  const eq=value=>add('eq',value);
  const mm=value=>display(value,'mm');
  const load=value=>display(value,'kN');
  const moment=value=>display(value,'kN\\,mm');
  const L=500, xD=325, F=9;
  const left=F*(L-xD)/L, right=F-left;
  const stations=[['E',20],['C',200],['D',xD],['F',480]];
  add('section','Ejercicio de la libreta · Reacciones y momentos');
  add('heading','Enunciado y croquis');
  add('text','Página 14 de la libreta. Una flecha apoyada en A y B recibe 9 kN hacia abajo en D. Se calcula el equilibrio y se determinan los momentos en los cambios de sección y en el punto de carga.');
  eq(math`L=${mm(L)};\quad x_D=${mm(xD)};\quad DB=${mm(L-xD)};\quad F=${load(F)}`);
  const xp=x=>45+330*x/L;
  const geometry=[
    ['line',xp(0),64,xp(L),64],['label',xp(0),34,'A'],['label',xp(L),34,'B'],
    ['line',xp(xD),105,xp(xD),66],['line',xp(xD),66,xp(xD)-4,74],['line',xp(xD),66,xp(xD)+4,74],
    ['label',xp(xD),115,'9 kN'],['label',210,11,'500 mm']
  ];
  for(const point of [0,L]){
    const x=xp(point);
    geometry.push(['line',x,64,x-9,45],['line',x,64,x+9,45],['line',x-9,45,x+9,45]);
  }
  for(const [label,position] of stations) geometry.push(['circle',xp(position),64,2],['label',xp(position),54,label]);
  add('diagram',{title:'Flecha, apoyos y puntos E, C, D y F',caption:'Posiciones medidas desde el apoyo A. El croquis toma las distancias analizadas en la p. 14.',marks:geometry});
  add('heading','Equilibrio de fuerzas y momentos');
  eq(math`\sum M_B=-R_A L+F(L-x_D)=0;\quad R_A=\frac{9(500-325)}{500}=${load(left)}`);
  eq(math`\sum F_y=R_A+R_B-F=0;\quad R_B=9-${n(left)}=${load(right)}`);
  add('heading','Cortes antes y después de D');
  add('text','Se conserva la convención de signos de la libreta, con el cortante dibujado en la cara derecha del tramo izquierdo. En las ecuaciones, x está en milímetros.');
  eq(math`0<x<325:\quad V+R_A=0,\quad V=${load(-left)},\quad M(x)=${n(left)}x`);
  eq(math`325<x<500:\quad V+R_A-F=0,\quad V=${load(right)},\quad M(x)=${n(left)}x-9(x-325)`);
  const at=x=>left*x-F*Math.max(0,x-xD);
  eq(math`M(0)=0;\quad M(500)=${n(left)}(500)-9(500-325)=0`);
  add('heading','Momentos en los puntos de interés');
  const values=stations.map(([label,x])=>{
    const value=at(x);
    eq(math`M_{${label}}=${n(left)}(${x})-9(${n(Math.max(0,x-xD))})=${moment(value)}`);
    return [label,x,value];
  });
  const maximum=Math.max(...values.map(row=>row[2]));
  const log=decision(4,'Momento flector máximo','N·m','Equilibrio de la flecha con carga puntual.');
  trial(log,maximum,'calculated','El máximo se alcanza en D a 325 mm de A. La libreta también revisa C por el cambio de diámetro.');
  const mid=xp(xD);
  add('diagram',{
    title:'Diagramas de cortante y momento en la flecha',
    caption:'El signo de V sigue la convención de la libreta. El máximo de M aparece en D.',
    marks:[
      ['line',xp(0),88,xp(L),88],['line',xp(0),88,xp(0),75],['line',xp(0),75,mid,75],
      ['line',mid,75,mid,112],['line',mid,112,xp(L),112],['line',xp(L),112,xp(L),88],
      ['line',xp(0),22,xp(L),22],['line',xp(0),22,mid,62],['line',mid,62,xp(L),22],
      ['label',20,88,'V'],['label',20,23,'M'],['label',xp(0),8,'A'],['label',mid,8,'D'],['label',xp(L),8,'B'],
      ['label',100,104,'-3.15 kN'],['label',344,98,'+5.85 kN'],['label',mid,48,n(maximum)+' N·m']
    ]
  });
  return {entries,decisions,metrics:[
    ['Reacción en A',left,'kN',2],['Reacción en B',right,'kN',2],
    ['Momento en C',at(200),'N·m',2],['Momento máximo en D',maximum,'N·m',2]
  ]};
}

function calculateNotebookBearings(){
  const {entries,decisions,add,check,decision,trial}=createCalculationTrace();
  const n=number;
  const eq=value=>add('eq',value);
  const kn=value=>display(value,'kN',4);
  const Fr=175*gravity/1000, Fa=75*gravity/1000, V=1, rpm=8000, hours=350;
  const life=60*rpm*hours/1e6;
  const lower=referenceTables[3].rows.find(row=>row[0]===17);
  const upper=referenceTables[3].rows.find(row=>row[0]===20);
  check(lower&&upper,'Se requieren las filas de 17 y 20 mm de la tabla 11-2.');
  const loadFactors=referenceTables.find(table=>table.label.startsWith('Tabla 11-1')).rows;
  const loadsRatio=Fa/(V*Fr);
  let required;
  const interpolateFactors=c0=>{
    const ratio=Fa/c0;
    const i=loadFactors.findIndex(row=>row[0]>=ratio);
    check(i>0,'La relación Fa/C0 queda fuera del intervalo de interpolación del ejemplo.');
    const a=loadFactors[i-1], b=loadFactors[i], fraction=(ratio-a[0])/(b[0]-a[0]);
    const e=a[1]+fraction*(b[1]-a[1]);
    const useCombined=loadsRatio>e;
    const x=useCombined?a[4]+fraction*(b[4]-a[4]):a[2];
    const y=useCombined?a[5]+fraction*(b[5]-a[5]):a[3];
    eq(math`F_a/C_0=${n(Fa,5)}/${n(c0,5)}=${n(ratio,5)};\quad \lambda=\frac{${n(ratio,5)}-${n(a[0])}}{${n(b[0])}-${n(a[0])}}=${n(fraction,5)}`);
    eq(math`e=${n(a[1])}+${n(fraction,5)}(${n(b[1])}-${n(a[1])})=${n(e,5)}`);
    const comparator=useCombined?'>':'\\le';
    eq(math`\frac{F_a}{VF_r}=${n(loadsRatio,5)} ${comparator} e=${n(e,5)};\quad X=${n(x,5)};\quad Y=${n(y,5)}`);
    if(useCombined)eq(math`Y_2=${n(a[5])}+${n(fraction,5)}(${n(b[5])}-${n(a[5])})=${n(y,5)}`);
    return [x,y];
  };
  const calcLoad=(x,y)=>{
    const Fe=x*V*Fr+y*Fa;
    required=Fe*Math.cbrt(life);
    eq(math`F_e=XVF_r+YF_a=(${n(x,5)})(${V})(${n(Fr,5)})+(${n(y,5)})(${n(Fa,5)})=${kn(Fe)}`);
    eq(math`C_{10,\mathrm{req}}=F_e L_{10}^{1/3}=${n(Fe,5)}(${n(life)})^{1/3}=${kn(required)}`);
    return Fe;
  };
  add('section','Ejercicio de la libreta · Rodamientos');
  add('heading','Datos y croquis');
  add('text','Páginas 58–60. Se elige el rodamiento izquierdo para 350 horas a 8000 rpm. Se usan las columnas de contacto angular, serie 02, que corresponden a las capacidades anotadas en el ejercicio. El aro interior gira.');
  eq(math`F_r=\frac{175(9.80665)}{1000}=${kn(Fr)};\quad F_a=\frac{75(9.80665)}{1000}=${kn(Fa)};\quad V=${V}`);
  eq(math`L_{10}=\frac{60(${rpm})(${hours})}{10^6}=${n(life)}\,\mathrm{millones\ de\ rev}`);
  add('diagram',{
    title:'Cargas en el rodamiento izquierdo',
    caption:'Se analiza el apoyo izquierdo indicado en la libreta. Las cargas originales están expresadas en kgf.',
    marks:[['circle',132,60,34],['circle',132,60,16],['line',167,61,331,61],
      ['line',132,113,132,96],['line',132,96,128,103],['line',132,96,136,103],
      ['line',57,60,96,60],['line',96,60,89,56],['line',96,60,89,64],
      ['label',132,121,'175 kgf radial'],['label',48,76,'75 kgf axial'],['label',257,78,'Flecha']]
  });
  add('heading','Estimación de las capacidades');
  add('iteration','Corrida 1 · Factores iniciales del ejercicio');
  calcLoad(.56,1.63);
  const [lowDynamic,lowStatic]=lower.slice(8,10), [highDynamic,highStatic]=upper.slice(8,10);
  const c0=lowStatic+(required-lowDynamic)*(highStatic-lowStatic)/(highDynamic-lowDynamic);
  add('text','Se interpola C0 entre las dos filas para actualizar los factores. Esa interpolación es un paso de cálculo.');
  eq(math`C_{0,\mathrm{est}}=${n(lowStatic)}+\frac{${n(required,5)}-${n(lowDynamic)}}{${n(highDynamic)}-${n(lowDynamic)}}(${n(highStatic)}-${n(lowStatic)})=${kn(c0)}`);
  add('iteration','Corrida 2 · Factores interpolados de la tabla 11-1');
  calcLoad(...interpolateFactors(c0));
  add('heading','Comprobación de las filas vecinas');
  const log=decision(6,'Diámetro del rodamiento por vida','mm','Se comprueban las dos filas del ejemplo con su propio C0. Las capacidades finales son las de la tabla 11-2.');
  let selected;
  for(const row of [lower,upper]){
    const [bore,outer,width]=row;
    const [C10,C0]=row.slice(8,10);
    add('iteration','Comprobación · '+bore+' mm');
    eq(math`d=${display(bore,'mm')};\quad C_{10}=${kn(C10)};\quad C_0=${kn(C0)}`);
    const Fe=calcLoad(...interpolateFactors(C0));
    const accepted=C10>=required;
    trial(log,bore,accepted?'selected':'rejected','Capacidad '+n(C10)+' kN frente a '+n(required,4)+' kN requeridos con los factores de esta fila.');
    if(accepted){
      selected={bore,outer,width,C10,C0,Fe,required};
      break;
    }
  }
  check(selected,'Ninguna de las dos filas del ejemplo cubre la vida solicitada.');
  add('heading','Resultado de la selección por vida');
  eq(math`d=${display(selected.bore,'mm')};\quad D_E=${display(selected.outer,'mm')};\quad B=${display(selected.width,'mm')}`);
  const actualHours=1e6/(60*rpm)*(selected.C10/selected.Fe)**3;
  eq(math`L_{10h}=\frac{10^6}{60(${rpm})}\left(\frac{${n(selected.C10)}}{${n(selected.Fe,5)}}\right)^3=${display(actualHours,'h')}`);
  add('note','La libreta redondea las relaciones y capacidades intermedias. Aquí se actualizan e, X e Y con las filas tabuladas y se verifica la vida de la fila seleccionada.');
  return {entries,decisions,metrics:[
    ['Agujero seleccionado',selected.bore,'mm',0],['Diámetro exterior',selected.outer,'mm',0],
    ['Ancho del rodamiento',selected.width,'mm',0],['Capacidad dinámica requerida',selected.required,'kN',3],
    ['Vida con la fila seleccionada',actualHours,'h',1]
  ]};
}
