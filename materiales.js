'use strict';

const materialNumber = new Intl.NumberFormat('es-MX',{maximumFractionDigits:6,useGrouping:false});
const materialUnit = (value,unit) => materialNumber.format(value)+' '+unit;

// Tablas 10-4 y 10-5, p. 503 del PDF «resortes tablas».
// Los límites inferiores y G en GPa son los mismos que usa springWires.
const wireTableExtras = [
  {
    diameterIn:'0.004–0.256 in',
    coefficientImperial:201,
    cost:2.6,
    yieldMax:[75,60],
    E:[203.4,200,196.5,193],
    EMpsi:[29.5,29,28.5,28],
    GMpsi:[12,11.85,11.75,11.6],
    finish:'Superficie lisa y brillante, sin defectos'
  },
  {
    diameterIn:'0.028–0.500 in',
    coefficientImperial:140,
    cost:1,
    yieldMax:[70,55],
    E:[198.6,197.9,197.2,196.5],
    EMpsi:[28.8,28.7,28.6,28.5],
    GMpsi:[11.7,11.6,11.5,11.4]
  }
];

function bandMaterial(values,result) {
  const row=catalog[values.belt];
  if(!row) return [];
  const [title,size,minPulley,tension,weight,friction,fixedWidth,shape]=row;
  const dim=value=>materialUnit(value,'in')+' · '+materialUnit(value*25.4,'mm');
  const density=value=>value*lbf/inch**3/gravity;
  const weightLabel=Array.isArray(weight)?weight.map(v=>materialNumber.format(v)).join('–'):materialNumber.format(weight);
  const rows=[
    ['Tipo',shape==='plana'?'Plana':'Redonda'],
    [shape==='plana'?'Espesor':'Diámetro de sección',dim(size)],
    ['Ancho',fixedWidth==null?(shape==='plana'?'Por dimensionar':'Sección circular'):dim(fixedWidth)],
    ['Diámetro mínimo de polea',minPulley==null?'Consultar la tabla 17-3':dim(minPulley)],
    ['Tensión por ancho a 600 ft/min',materialUnit(tension,'lbf/in')+' · '+materialUnit(tension*lbf/25.4,'N/mm')],
    ['Peso específico',weightLabel+' lbf/in³'],
    ['Coeficiente de fricción μ',materialNumber.format(friction)]
  ];
  if(title.startsWith('Poliamida')) rows.push(['Revestimiento','Caucho de acrilonitrilo-butadieno en ambas caras']);
  if([3,4].includes(values.belt)) rows.push(['Nota a','Aumentar 2 in el mínimo para anchos de 8 in o más']);
  if(minPulley!=null) {
    const weightUsed=Array.isArray(weight)?Math.max(...weight):weight;
    rows.push(['Densidad calculada',materialUnit(Math.round(density(weightUsed)),'kg/m³')]);
  }
  if(result?.belt?.selected) {
    rows.push(['Ancho de la propuesta',materialUnit(result.belt.selected*1000,'mm')]);
    rows.push(['Velocidad del caso',materialUnit(Math.round(result.belt.review.operatingFpm),'ft/min')]);
  }
  const note=minPulley==null
    ?'La tabla 17-2 remite a la 17-3 para el diámetro mínimo. Falta esa tabla para dimensionar esta opción.'
    :'La tensión tabulada corresponde a la velocidad de referencia. La contraflexión y la duración a la velocidad del caso siguen pendientes de datos del fabricante.';
  return [{title,source:'Tabla 17-2',rows,note}];
}

function steelMaterial(steelIndex,finishIndex,forShaft) {
  const steel=steels[steelIndex];
  if(!steel) return [];
  const carbon=steel.table==='A-20';
  const table=referenceTables[carbon?1:2];
  const row=table.rows[carbon?steelIndex:steelIndex-referenceTables[1].rows.length];
  const i=carbon?2:3;
  const rows=[
    ['Grado AISI',row[0]],
    [carbon?'Proceso':'Tratamiento',row[1]],
    ['Resistencia última Sut',materialUnit(row[i],'MPa')+' · '+materialUnit(row[i+1],'kpsi')],
    ['Resistencia a la fluencia Sy',materialUnit(row[i+2],'MPa')+' · '+materialUnit(row[i+3],'kpsi')],
    [carbon?'Elongación en 2 in':'Elongación a la rotura',materialUnit(row[i+4],'%')],
    ['Reducción de área',materialUnit(row[i+5],'%')],
    ['Dureza Brinell',materialUnit(row[i+6],'HB')]
  ];
  if(carbon) rows.splice(1,0,['Designación UNS','G'+row[0]+'0']);
  else rows.splice(2,0,['Temperatura del tratamiento',materialUnit(row[2],'°C')]);
  const note=carbon
    ?'La tabla A-20 da estimaciones de resistencia para tamaños de 18 a 32 mm.'+
        (forShaft?' Para un diámetro fuera de ese intervalo se necesita certificar la resistencia mínima del material suministrado.':'')
    :'La tabla A-21 da propiedades medias para el tratamiento indicado, en probetas mecanizadas de barras de 25.4 mm. Verifica los mínimos para el diámetro y estado de suministro reales.';
  const cards=[{title:steel.label,source:table.label,rows,note}];
  const finish=finishes[finishIndex];
  if(finish){
    const [label,a,b]=finish;
    cards.push({title:label,source:'Tabla 6-2 · Acabado superficial',rows:[
      ['Coeficiente a con Sut en MPa',materialNumber.format(a)],
      ['Exponente b',materialNumber.format(b)],
      ['Factor superficial ka (calculado)',materialNumber.format(Number((a*steel.sut**b).toFixed(4)))]
    ]});
  }
  return cards;
}

function bearingMaterial(values,result){
  if(![0,1].includes(values.bearingType)) return [];
  const title=values.bearingType===0?'Ranura profunda · Serie 02':'Contacto angular · Serie 02';
  const source='Tablas 11-1 y 11-2 · Rodamientos';
  const row=referenceTables[3].rows.find(r=>r[0]===result?.design?.diameter);
  if(!row) return [{title,source,rows:[],note:'Calcula el proyecto para conocer el código dimensional y las capacidades del rodamiento seleccionado.'}];
  const col=values.bearingType===0?6:8;
  const dimensions=['Diámetro interior d','Diámetro exterior DE','Ancho B','Radio máximo de entalle','Hombro mínimo del eje ds','Hombro máximo de la caja dH'];
  const rows=dimensions.map((label,i)=>[label,materialUnit(row[i],'mm')]);
  rows.push(['Capacidad dinámica C10',materialUnit(row[col],'kN')],['Capacidad estática C0',materialUnit(row[col+1],'kN')]);
  return [{title,source,rows,note:'Las tablas aportadas especifican dimensiones y capacidades; el grado del acero del rodamiento queda sujeto al catálogo del fabricante.'}];
}

function springWireMaterial(values,result){
  const wire=springWires[values.wire];
  const extra=wireTableExtras[values.wire];
  if(!wire||!extra) return [];
  const selected=result?.spring?.selected;
  const properties=[
    ['Rango válido para estimar Sut',materialNumber.format(wire.min)+'–'+materialUnit(wire.max,'mm')+' · '+extra.diameterIn],
    ['Coeficiente A',materialUnit(wire.A,'MPa·mmᵐ')+' · '+materialUnit(extra.coefficientImperial,'kpsi·inᵐ')],
    ['Exponente m',materialNumber.format(wire.m)],
    ['Costo relativo del alambre',materialNumber.format(extra.cost)],
    ['Límite elástico en tensión',Math.round(100*wire.sy)+'–'+extra.yieldMax[0]+' % de Sut'],
    ['Límite elástico en torsión',Math.round(100*wire.shear)+'–'+extra.yieldMax[1]+' % de Sut']
  ];
  if(extra.finish) properties.push(['Superficie según tabla',extra.finish]);
  if(selected){
    const sut=wire.A/selected**wire.m;
    const d=selected/25.4;
    const i=d<=.032?0:d<=.063?1:d<=.125?2:3;
    properties.push(
      ['Diámetro del alambre seleccionado',materialUnit(selected,'mm')],
      ['Sut estimado para ese diámetro',materialUnit(Math.round(sut),'MPa')],
      ['Límite en tensión usado en estática',materialUnit(Math.round(wire.sy*sut),'MPa')],
      ['Límite en torsión usado en estática',materialUnit(Math.round(wire.shear*sut),'MPa')],
      ['Módulo de elasticidad E para ese diámetro',materialUnit(extra.E[i],'GPa')],
      ['Módulo de corte G usado en el cálculo',materialUnit(wire.G[i],'GPa')]
    );
  }
  const ranges=['< 0.032 in','0.033–0.063 in','0.064–0.125 in','> 0.125 in'];
  const moduli=ranges.map((range,i)=>[
    range,
    'E '+materialUnit(extra.E[i],'GPa')+' ('+materialUnit(extra.EMpsi[i],'Mpsi')+
      ') · G '+materialUnit(wire.G[i],'GPa')+' ('+materialUnit(extra.GMpsi[i],'Mpsi')+')'
  ]);
  return [
    {title:wire.name,source:'Tablas 10-4 y 10-5 · Alambres para resortes',rows:properties,
      note:'Se emplea el límite inferior del rango elástico para el cálculo estático. Las tablas entregadas no dan la resistencia cíclica del cuerpo ni de los ganchos.'},
    {title:'Módulos por diámetro',source:'Tabla 10-5 · Propiedades mecánicas',rows:moduli}
  ];
}

function stageMaterial(stage,values,result) {
  switch(Number(stage)){
    case 2: return bandMaterial(values,result);
    case 3: return steelMaterial(values.gearSteel,values.gearFinish,false);
    case 5: {
      const selected=result?.design?.shaftSteelIndex;
      if(selected==null&&values.shaftSteel===-1) return [{
        title:'Selección automática de acero',
        source:'Tablas A-20 y A-21',
        rows:[],
        note:result?.error
          ?'La corrida no llegó a una selección de acero. Revisa el mensaje del cálculo.'
          :'Pulsa Calcular para probar las filas de las tablas y ver las propiedades del acero elegido.'
      }];
      const cards=steelMaterial(selected??values.shaftSteel,values.shaftFinish,true);
      if(selected==null&&cards.length){
        cards[0].title='Preferencia inicial · '+cards[0].title;
      }
      const stock=result?.design?.stockReview;
      if(stock) cards.push({
        title:'Alcance para esta flecha',
        source:'Notas de las tablas A-20 y A-21',
        rows:[
          ['Diámetro base',materialUnit(stock.base,'mm')],
          ['Sección 3',materialUnit(stock.section,'mm')],
          ['Hombro mayor',materialUnit(stock.shoulder,'mm')],
          ['Intervalo de A-20','18–32 mm'],
          ['Barra de las probetas A-21','25.4 mm']
        ],
        note:stock.a20CoversFinishedSizes
          ? 'Confirma el tamaño real de suministro y los requisitos de la fila.'
          : 'Las tablas entregadas no garantizan las resistencias para este tamaño. Para una flecha de una sola pieza, pide mínimos de Sut y Sy certificados para la barra real que cubrirá el hombro mayor.'
      });
      return cards;
    }
    case 6: return bearingMaterial(values,result);
    case 7: return springWireMaterial(values,result);
    default: return [];
  }
}
