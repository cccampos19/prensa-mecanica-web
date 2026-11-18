'use strict';

function solveComponentPower(c,{add,check,decision,trial}) {
  const {torque,rpm,efficiency}=c;
  check(torque>0&&rpm>0&&efficiency>0&&efficiency<=100,'Ingresa torque y velocidad positivos y una eficiencia entre 0 y 100 %.');
  const speed=2*Math.PI*rpm/60;
  const output=torque*speed/1000;
  const input=output/(efficiency/100);
  const n=number;
  add('eq',math`\omega=\frac{2\pi n}{60}=\frac{2\pi(${n(rpm)})}{60}=${display(speed,'rad/s')}`);
  add('eq',math`P_s=T\omega=\frac{(${n(torque)})(${n(speed,6)})}{1000}=${display(output,'kW')}`);
  add('eq',math`P_e=\frac{P_s}{\eta}=\frac{${n(output,6)}}{${n(efficiency/100)}}=${display(input,'kW')}`);
  const power=decision(1,'Potencia de entrada requerida','kW','El cálculo usa el torque, la velocidad y la eficiencia indicados.');
  trial(power,input,'calculated','Potencia mecánica requerida para entregar '+n(output)+' kW en el punto que gira a '+n(rpm)+' rpm.');
  add('diagram',{
    title:'Balance de potencia',
    caption:'La eficiencia relaciona las potencias de entrada y salida.',
    marks:[
      ['line',15,38,122,38],['line',122,38,122,89],['line',122,89,15,89],['line',15,89,15,38],
      ['line',296,38,404,38],['line',404,38,404,89],['line',404,89,296,89],['line',296,89,296,38],
      ['line',127,62,290,62],['line',290,62,281,68],['line',290,62,281,56],
      ['label',68,74,'Entrada'],['label',68,52,n(input)+' kW'],
      ['label',350,74,'Salida'],['label',350,52,n(output)+' kW'],
      ['label',209,82,'Eficiencia '+n(efficiency)+' %']
    ]
  });
  return {metrics:[
    ['Potencia de entrada',input,'kW',3],['Potencia de salida',output,'kW',3],
    ['Velocidad angular',speed,'rad/s',3]
  ]};
}

function worksheetNumber(value, unit, digits=3) {
  return plainNumberNotation(number(value,digits))+(unit?' '+unit:'');
}

function arrangeWorksheet(component, values, work, metrics, error, shaftInputs) {
  const fromForces=shaftInputs?.mode==='forces';
  const rows=component.groups.flatMap(([,fields])=>fields.filter(([key])=>!fromForces||key!=='moment').map(([key,label,,options])=>{
    if(!Number.isFinite(values[key])) return [label,'Dato inválido'];
    if(!options) return [label,worksheetNumber(values[key],'',6)];
    const title=options.find((choice,i)=>values[key]===(Array.isArray(choice)?choice[0]:i));
    return [label,Array.isArray(title)?title[1]:title??'Selección inválida'];
  }));
  if(component===components.flecha){
    rows.unshift(['Modo de entrada',fromForces?'Fuerzas y apoyos':'Momento y torque']);
  }
  const entries=[
    {type:'section',value:component.title},
    {type:'heading',value:'Datos y propuesta'},
    {type:'data',value:{headers:['Dato','Valor usado'],rows}}
  ];
  const sketch=component.sketch&&work.find(entry=>entry.type==='diagram');
  if(sketch) entries.push({type:'heading',value:'Croquis'},sketch);
  const calculations=work.filter(entry=>entry.type!=='diagram');
  if(calculations.length&&calculations[0].type!=='heading') entries.push({type:'heading',value:'Desarrollo'});
  entries.push(...calculations);
  const diagrams=work.filter(entry=>entry.type==='diagram'&&entry!==sketch);
  if(diagrams.length) entries.push({type:'heading',value:'Diagramas del cálculo'},...diagrams);
  entries.push({type:'heading',value:'Resultado de la corrida'});
  if(error) entries.push({type:'note',value:error});
  else entries.push({type:'data',value:{headers:['Resultado','Valor'],rows:metrics.map(([label,value,unit,digits])=>[label,worksheetNumber(value,unit,digits)])}});
  return entries;
}

function calculateComponent(component, values, shaftInputs) {
  const trace=createCalculationTrace();
  const {entries,decisions,check}=trace;
  try {
    check(Object.values(values).every(Number.isFinite),'Todos los datos deben ser números finitos.');
    const result=component.solve(values,trace,shaftInputs);
    check(result.metrics.every(([,value])=>Number.isFinite(value)),'Los resultados exceden el rango numérico del modelo.');
    return {...result,entries:arrangeWorksheet(component,values,entries,result.metrics,null,shaftInputs),decisions};
  } catch(error) {
    if(error.name!=='Error') throw error;
    return {entries:arrangeWorksheet(component,values,entries,[],error.message,shaftInputs),
      decisions,metrics:[],error:error.message,nonconvergence:error.code==='SHAFT_NO_CONVERGENCE'};
  }
}

const shaftSeeds=referenceTables[3].rows.map(([d])=>[d,d+' mm']);
const shaftShoulders=[
  {label:'Hombro de la p. 21 · D/d = 1.5, r/d = 0.10',fillet:.1,ktFlex:1.6,ktTors:1.4},
  {label:'Hombro de la p. 20 · D/d = 1.5, r/d = 0.01/1.1',fillet:.01/1.1,ktFlex:1.7,ktTors:1.4}
];
function solveIndependentShaft(values, trace, inputs) {
  trace.check(shaftSeeds.some(([d])=>d===values.shaftStart),'Selecciona el diámetro inicial de la tabla 11-2.');
  const shoulder=shaftShoulders[values.shoulder];
  trace.check(shoulder,'Elige una geometría de hombro de la libreta.');
  values={...values,...shoulder};
  if(inputs?.mode!=='forces') return solveComponentShaft(values,trace);
  const beam=solveShaftPointLoads(inputs,trace);
  const result=solveComponentShaft({...values,moment:beam.maximum},trace);
  return {...result,metrics:[...result.metrics,...beam.metrics]};
}

const steelOptions=steels.map(steel=>steel.label);
const finishOptions=finishes.map(row=>row[0]);
const environmentFields=[
  ['temperature','Temperatura de servicio (°C)',20],
  ['reliability','Confiabilidad a fatiga (%)',99]
];
const components={
  engranes:{
    title:'Engranes rectos',nav:'Engranes',type:'Transmisión',
    description:'Dimensiona el ancho de cara y comprueba la fatiga y la resistencia estática del piñón y la rueda.',
    solve:solveComponentGears,materialStage:3,sketch:true,
    groups:[
      ['Carga y geometría',[
        ['torque','Torque en el piñón (N·m)',160],['rpm','Velocidad del piñón (rpm)',900],
        ['pd','Paso diametral (dientes/in)',4],['np','Dientes del piñón',20],['ng','Dientes de la rueda',50],
        ['phi','Ángulo de presión (°)',20],['faceStart','Ancho inicial (mm, 0 inicia en 3 pasos)',0]
      ]],
      ['Material y acabado',[
        ['gearSteel','Acero · tablas A-20 y A-21',17,steelOptions],['gearFinish','Acabado · tabla 6-2',1,finishOptions]
      ]],
      ['Factores de diseño',[
        ['yp','Factor de Lewis del piñón',.322],['yg','Factor de Lewis de la rueda',.409],
        ['ktGear','Concentración de esfuerzo en la raíz Kt',1.8],
        ['gearFat','Factor mínimo de fatiga',2],['gearStatic','Factor estático mínimo',2],
        ...environmentFields
      ],'Usa los factores de Lewis del perfil, número de dientes y ángulo de presión que elegiste.']
    ]
  },
  banda:{
    title:'Banda plana abierta',nav:'Banda y poleas',type:'Transmisión',
    description:'Dimensiona una banda entre dos poleas a partir de potencia, velocidad y geometría. Usa la tensión de referencia de la tabla 17-2.',
    solve:solveComponentBelt,materialStage:2,sketch:true,
    groups:[
      ['Potencia y geometría',[
        ['powerKw','Potencia por transmitir (kW)',5],['rpm','Velocidad de la polea motriz (rpm)',900],
        ['driverMm','Diámetro de la polea motriz (mm)',150],['drivenMm','Diámetro de la polea conducida (mm)',250],
        ['centersMm','Distancia entre centros (mm)',700]
      ]],
      ['Material y ancho inicial',[
        ['belt','Banda · tabla 17-2',9,catalog.map(row=>row[0])],
        ['startWidthMm','Ancho inicial (mm)',50]
      ]]
    ]
  },
  flecha:{
    title:'Dimensionamiento de flecha',nav:'Flecha',type:'Ejes y apoyos',
    description:'Diseña una flecha circular maciza. Plantea las fuerzas y apoyos o captura el momento y el torque. Elige un acero de catálogo para iterar el diámetro por fatiga y fluencia.',
    solve:solveIndependentShaft,materialStage:5,sketch:true,
    groups:[
      ['Material y acabado',[
        ['shaftSteel','Acero · tablas A-20 y A-21',33,steelOptions],
        ['shaftFinish','Acabado · tabla 6-2',1,finishOptions]
      ]],
      ['Cargas y sección',[
        ['moment','Momento flector alternante (N·m)',200],['torque','Torque constante (N·m)',100],
        ['shaftStart','Diámetro inicial · agujero de tabla 11-2',30,shaftSeeds],
        ['shoulder','Geometría y concentradores · libreta',0,shaftShoulders.map(s=>s.label+' · Kt '+s.ktFlex+', Kts '+s.ktTors)]
      ],'El agujero tabulado sirve como propuesta inicial. El resultado es el diámetro continuo que cumple los objetivos.'],
      ['Factores de diseño',[
        ['kc','Factor de carga · apuntes, p. 9',1,shaftLoadFactors.map(item=>[item.value,item.label])],
        ['shaftFat','Índice mínimo de Hencky–Marin',2],['shaftStatic','Factor estático mínimo',2],
        ...environmentFields
      ]]
    ]
  },
  equilibrio:{
    title:'Equilibrio de una flecha',nav:'Reacciones y momentos',type:'Ejes y apoyos',
    description:'Calcula las reacciones y el momento máximo en una flecha simplemente apoyada con dos cargas radiales. Usa cero en las componentes que no apliquen.',
    solve:solveComponentBalance,sketch:true,
    groups:[
      ['Posiciones desde el apoyo izquierdo',[
        ['span','Distancia entre apoyos (mm)',550],['x1','Posición de la carga 1 (mm)',150],['x2','Posición de la carga 2 (mm)',370]
      ]],
      ['Componentes de las cargas',[
        ['fy1','Carga 1 en Y (N)',-1800],['fz1','Carga 1 en Z (N)',500],
        ['fy2','Carga 2 en Y (N)',-700],['fz2','Carga 2 en Z (N)',-350]
      ],'El signo representa el sentido en cada eje.']
    ]
  },
  rodamientos:{
    title:'Rodamientos de bolas',nav:'Rodamientos',type:'Ejes y apoyos',
    description:'Selecciona una medida de la serie 02 de la tabla 11-2 para una carga radial. El cálculo comprueba capacidad, vida y agujero.',
    solve:solveComponentBearings,materialStage:6,
    groups:[
      ['Carga y requisitos',[
        ['radialLoad','Carga radial (N)',1800],['rpm','Velocidad (rpm)',1200],
        ['life','Vida requerida L10 (h)',10000],['bearingStatic','Factor estático mínimo',1.5],
        ['boreMin','Agujero mínimo (mm, 0 para cualquier tamaño)',20]
      ]],
      ['Tipo de rodamiento',[
        ['bearingType','Serie 02 · tabla 11-2',0,['Ranura profunda','Contacto angular']]
      ]]
    ]
  },
  resorte:{
    title:'Resorte de extensión',nav:'Resorte',type:'Resortes',
    description:'Dimensiona el alambre y comprueba el cuerpo y los ganchos con el intervalo de cargas que definas.',
    solve:solveComponentSpring,materialStage:7,
    groups:[
      ['Cargas y longitud',[
        ['fmin','Carga mínima de servicio (N)',60],['fmax','Carga máxima de servicio (N)',120],
        ['springRate','Rigidez (N/mm)',4],['springInstalledLength','Longitud instalada a carga mínima (mm)',140],
        ['preload','Tensión inicial (% de la carga mínima)',30]
      ]],
      ['Alambre y geometría',[
        ['wire','Alambre · tablas 10-4 y 10-5',0,springWires.map(wire=>wire.name)],
        ['wireStart','Diámetro inicial del alambre (mm)',3],
        ['springIndex','Índice del resorte D/d',8],['hookRadius','Radio medio del gancho / d',2],
        ['springSafety','Factor estático mínimo',2]
      ]]
    ]
  },
  potencia:{
    title:'Potencia mecánica',nav:'Potencia',type:'Potencia',
    description:'Calcula la potencia a partir del torque y la velocidad en un punto. Usa 100 % de eficiencia para el caso ideal.',
    solve:solveComponentPower,
    groups:[
      ['Punto de operación',[
        ['torque','Torque de salida (N·m)',180],['rpm','Velocidad de salida (rpm)',900],
        ['efficiency','Eficiencia de transmisión (%)',100]
      ]]
    ]
  }
};
