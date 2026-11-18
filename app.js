'use strict';

const form = document.querySelector('#inputs');
const memory = document.querySelector('#memory');
const calculationStatus = document.querySelector('#status');
const download = document.querySelector('#download');
const downloadPdf=document.querySelector('#download-pdf');
const pdfStatus=document.querySelector('#pdf-status');
let generatingPdf=false;
const defaults = {
  rpm: 2100, ratio: 1.875, load: 18000,
  gearEff: 100, beltEff: 100, nominal: 75, pulley: 300, centers: 0.90,
  start: 200, angle: 60, belt: 9,
  pd:3.175, np:20, ng:80, faceStart:0, phi:20, yp:.322, yg:.426, ktGear:1.8, gearFat:2, gearStatic:4,
  gearSteel:17, gearFinish:1, x2:120, x3:320, span:620,
  shaftSteel:33, shaftFinish:1, shaftStart:40, fillet:.1, kc:.59, ktFlex:1.7,
  ktTors:1.4, shaftFat:2, shaftStatic:2, temperature:20, reliability:99,
  bearingType:0, life:20000, bearingStatic:1.5,
  wire:0, wireStart:4, travel:20, idlerRadius:56, armAngle:-14, springRate:5.5, preload:35, springIndex:10, springSafety:2, hookRadius:2
};
const fields = {
  powerFields: [
    ['rpm','Velocidad del motor (rpm)'], ['load','Torque de salida (kgf·cm)'],
    ['nominal','Potencia nominal propuesta (kW)']
  ],
  beltFields: [
    ['ratio','Relación de banda'], ['beltEff','Eficiencia de la banda (%)'],
    ['pulley','Diámetro de polea conducida (mm)'], ['centers','Distancia entre centros (m)'],
    ['start','Ancho inicial para iterar (mm)'], ['angle','Orientación de carga (°)']
  ],
  gearFields: [
    ['pd','Paso diametral propuesto (dientes/in)'],
    ['np','Dientes del piñón'], ['ng','Dientes de la rueda'], ['phi','Ángulo de presión (°)'],
    ['faceStart','Ancho inicial para iterar (mm, 0 usa 3 pasos)'],
    ['gearEff','Eficiencia de engranes (%)'], ['yp','Lewis · piñón'], ['yg','Lewis · rueda'], ['ktGear','Kt en raíz del diente'],
    ['gearFat','Seguridad a fatiga'], ['gearStatic','Seguridad estática']
  ],
  balanceFields: [
    ['x2','Posición del piñón (mm)'], ['x3','Posición de la polea (mm)'],
    ['span','Distancia entre apoyos (mm)']
  ],
  shaftFields: [
    ['shaftStart','Diámetro inicial para iterar (mm)'], ['fillet','Radio de filete relativo r/d'],
    ['ktFlex','Kt en flexión'], ['ktTors','Kts en torsión'],
    ['shaftFat','Índice mínimo de Hencky–Marin'], ['shaftStatic','Seguridad estática'],
    ['temperature','Temperatura de servicio (°C) · flecha y engranes'],
    ['reliability','Confiabilidad de fatiga (%) · flecha y engranes']
  ],
  bearingFields: [['life','Vida L10 solicitada (h)'], ['bearingStatic','Seguridad estática']],
  springFields: [
    ['wireStart','Diámetro de alambre inicial (mm)'],
    ['travel','Recorrido axial del resorte (mm)'], ['idlerRadius','Radio del rodillo propuesto (mm)'],
    ['armAngle','Ángulo inicial del brazo (° desde la horizontal hacia la izquierda; negativo hacia abajo)'],
    ['springRate','Rigidez propuesta del resorte (N/mm)'],
    ['preload','Tensión inicial de fabricación (% de la carga mínima)'],
    ['springIndex','Índice del resorte D/d'], ['springSafety','Factor de seguridad'],
    ['hookRadius','Radio medio del gancho / d']
  ]
};

for (const [group, definitions] of Object.entries(fields)) {
  for (const [name, text] of definitions) {
    const label = document.createElement('label');
    label.textContent = text;
    const input = document.createElement('input');
    Object.assign(input, {type: 'number', step: 'any', required: true, name, value: defaults[name]});
    label.append(input);
    document.getElementById(group).append(label);
  }
}
function addSelect(group, name, title, labels, values=labels.map((_,i)=>i)) {
  const label = document.createElement('label');
  label.textContent = title;
  const select = document.createElement('select');
  select.name = name;
  labels.forEach((value,i)=>select.add(new Option(value,values[i])));
  select.value = defaults[name];
  label.append(select);
  document.getElementById(group).prepend(label);
}
const steelLabels=steels.map(steel=>steel.label);
addSelect('gearFields','gearFinish','Acabado',finishes.map(row=>row[0]));
addSelect('gearFields','gearSteel','Acero propuesto para los engranes',steelLabels);
addSelect('shaftFields','shaftFinish','Acabado',finishes.map(row=>row[0]));
addSelect('shaftFields','shaftSteel','Acero propuesto para la flecha',steelLabels);
addSelect('shaftFields','kc','Factor de carga · apuntes, p. 9',shaftLoadFactors.map(item=>item.label),shaftLoadFactors.map(item=>item.value));
addSelect('bearingFields','bearingType','Tipo · serie 02',['Ranura profunda','Contacto angular']);

addSelect('springFields','wire','Alambre propuesto · tablas 10-4 y 10-5',springWires.map(wire=>wire.name));

const select = form.elements.belt;
catalog.forEach(([name, , minimum], index) => {
  select.add(new Option(minimum ? name : name + ' · método pendiente', index));
});
select.value = defaults.belt;

const tables = document.querySelector('#catalog-tables');
for (const {label, columns, rows} of referenceTables) {
  const group = document.createElement('details');
  const title = document.createElement('summary');
  title.textContent = label + ' (' + rows.length + ')';
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.setAttribute('aria-label', label);
  function appendRows(container, values, tag) {
    for (const row of values) {
      const tr = document.createElement('tr');
      for (const value of row) {
        const cell = document.createElement(tag);
        cell.textContent = value ?? '—';
        if (tag === 'th') cell.scope = 'col';
        tr.append(cell);
      }
      container.append(tr);
    }
  }
  const head = document.createElement('thead');
  const body = document.createElement('tbody');
  appendRows(head, [columns], 'th');
  appendRows(body, rows, 'td');
  table.append(head, body);
  wrap.append(table);
  group.append(title, wrap);
  tables.append(group);
}

const overview=document.querySelector('#overview');
const stageTitle=document.querySelector('#stage-title');
const stageResult=document.querySelector('#stage-result');
const stageMaterials=document.querySelector('#stage-material');
const stageCalculation=document.querySelector('#stage-calculation');
const resultTabs=document.querySelector('#result-tabs');
const editStage=document.querySelector('#edit-stage');
const decisionLog=document.querySelector('#decision-log');
const proposalMaterials=document.querySelectorAll('[data-material-stage]');
const stages=[
  ['Potencia y velocidades','powerFields'],
  ['Poleas y banda','beltFields'],
  ['Engranes','gearFields'],
  ['Equilibrio de la flecha','balanceFields'],
  ['Dimensionamiento de la flecha','shaftFields'],
  ['Rodamientos','bearingFields'],
  ['Brazo tensor y resorte','springFields'],
  ['Diagramas de la propuesta',null]
];
let current;
let submittedValues;
let edited=false;
let activeStage=1;

function formValues() {
  return Object.fromEntries(Array.from(new FormData(form),([key,value])=>[key,value===''?NaN:Number(value)]));
}

function setCurrentLink(links, key, value) {
  for(const link of links){
    if(link.dataset[key]===value) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
}

function showView() {
  const hash=location.hash.slice(1);
  const stageMatch=/^etapa-([1-8])$/.exec(hash);
  const stageView=Boolean(stageMatch)||hash==='datos'||hash==='memoria';
  const resultView=hash==='resultados'||hash==='bitacora';
  const view=stageView?'datos':resultView?'resultados':hash==='catalogos'?'catalogos':'propuesta';
  if(stageMatch) activeStage=Number(stageMatch[1]);
  if(hash==='datos'&&activeStage===8) activeStage=1;
  for(const panel of document.querySelectorAll('.view')) panel.hidden=panel.id!==view;
  setCurrentLink(document.querySelectorAll('.views [data-view]'),'view',stageView?'resultados':hash==='bitacora'?'bitacora':view);
  resultTabs.hidden=!(resultView||stageView);
  setCurrentLink(resultTabs.querySelectorAll('[data-stage]'),'stage',stageView?'etapa-'+activeStage:'resultados');
  if(!stageView) return;

  const [title]=stages[activeStage-1];
  stageTitle.textContent=title;
  editStage.href=activeStage===8?'#propuesta':'#propuesta-'+activeStage;
  editStage.textContent=activeStage===8?'Editar propuesta':'Editar datos de esta etapa';
  stageResult.hidden=activeStage===8&&Boolean(current&&!current.error);
  const stageKey='etapa-'+activeStage;
  let hasCalculation=false;
  for(const section of memory.children){
    section.hidden=section.id!==stageKey;
    if(!section.hidden) hasCalculation=true;
  }
  stageCalculation.hidden=!hasCalculation;
  stageCalculation.querySelector('summary').textContent=activeStage===8?'Diagramas':'Desarrollo del cálculo';
  stageCalculation.open=hasCalculation;
  renderStageResult();
  renderStageMaterial();
}

function navigateToView() {
  const hash=location.hash.slice(1);
  if(hash==='contenido') return;
  showView();
  if(hash==='bitacora'||/^propuesta-[1-7]$/.test(hash)){
    document.getElementById(hash).scrollIntoView({block:'start'});
  }else{
    window.scrollTo({top:0});
  }
}

function metric(value,unit,digits=2){
  return Number.isFinite(value)?number(value,digits)+(unit?' '+unit:''):'—';
}

function stageFacts(result,stage,includeSelection){
  const {power,belt,design,spring}=result;
  const minimum=values=>values?.length?Math.min(...values):undefined;
  switch(stage){
    case 1: return power&&[
      ['Potencia mecánica requerida',metric(power.motorPower/1000,'kW')],
      ['Velocidad de la flecha',metric(power.shaftRpm,'rpm',0)],
      ['Velocidad de salida',metric(power.outRpm,'rpm',0)]
    ];
    case 2: return belt&&[
      [belt.review.fixedWidth?'Ancho fijo de tabla':'Ancho mínimo calculado',metric(belt.selected*1000,'mm',3)],
      ['Diámetro propuesto del rodillo',metric(belt.rollerDiameter,'mm')],
      ['Demanda de tensión',metric(belt.review.demandImperial,'lbf/in')]
    ];
    case 3: return design&&[
      ['Ancho de cara calculado',metric(design.faceMm,'mm')],
      ['Paso diametral',metric(design.diametral,'dientes/in',4)],
      ['Módulo',metric(design.module,'mm')],
      ['Diámetro primitivo del piñón',metric(design.pinion,'mm')],
      ['Diámetro primitivo de la rueda',metric(design.gear,'mm')],
      ['Factor mínimo a fatiga',metric(minimum(design.gearFatigue),'')],
      ['Factor mínimo estático',metric(minimum(design.gearStatic),'')]
    ];
    case 4: return design&&[
      ['Reacción máxima · apoyo 1',metric(design.loads[0]/1000,'kN')],
      ['Reacción máxima · apoyo 4',metric(design.loads[1]/1000,'kN')],
      ['Momento flector máximo',metric(Math.max(...design.moments),'N·m')]
    ];
    case 5: return design&&[
      ...(includeSelection?[['Acero propuesto',steels[design.shaftSteelIndex]?.label||'—']]:[]),
      ['Diámetro comercial',metric(design.diameter,'mm',0)],
      ['Diámetro continuo',metric(design.continuous,'mm')],
      ['Índice mínimo de Hencky–Marin',metric(minimum(design.shaftFatigue),'')],
      ['Factor mínimo estático',metric(minimum(design.shaftStatic),'')]
    ];
    case 6: return design&&[
      ['Diámetro de agujero',metric(design.diameter,'mm',0)],
      ['Vida L10 · apoyo 1',metric(design.bearingLife?.[0],'h',0)],
      ['Vida L10 · apoyo 4',metric(design.bearingLife?.[1],'h',0)]
    ];
    case 7: return spring&&[
      ['Diámetro de alambre calculado',metric(spring.selected,'mm')],
      ['Carga de trabajo',metric(spring.fmin,'',1)+'–'+metric(spring.fmax,'N',1)],
      ['Factor mínimo estático',metric(minimum(spring.elasticFactors),'')]
    ];
    default: return null;
  }
}

function failureStage(result) {
  return result.errorStage||result.entries.filter(entry=>entry.type==='section').length||1;
}

function stageStatus(result,stage){
  if(result.error && stage===failureStage(result)) return 'Propuesta no viable en esta corrida. '+result.error;
  if(result.error && stage>failureStage(result)) return 'Pendiente. La corrida se detuvo en '+stages[failureStage(result)-1][0]+'.';
  if(stage===1&&result.power) return 'Cumple la potencia nominal propuesta.';
  if(stage===2&&result.belt) return 'Cumple la geometría y la tensión de referencia del modelo. La tabla 17-2 da el límite a 600 ft/min. Quedan pendientes la capacidad a '+metric(result.belt.review.operatingFpm,'ft/min',0)+' y la contraflexión.';
  if(stage===3&&result.design) return 'El ancho calculado cumple fatiga y estática en el modelo. Los factores de Lewis deben corresponder al perfil elegido. Las tablas aportan el acero y sus propiedades.';
  if(stage===5&&result.design?.stockReview) {
    return 'Cumple fatiga y estática en el modelo. La validez para fabricación depende del diámetro y estado de suministro de la barra.';
  }
  if(stage===6&&result.design?.bearingLife) return 'La fila de la tabla 11-2 cumple carga estática y vida L10. '+(result.design.bearingMountPending?'Queda por resolver la interferencia del filete en el montaje.':'El radio del filete permite el montaje directo.');
  if(stage===7&&result.spring) return 'El diámetro calculado cumple estática y longitud en el modelo. La tabla da el intervalo del alambre. La fatiga del cuerpo y los ganchos requiere su resistencia cíclica.';
  return '';
}

function renderStageResult() {
  stageResult.replaceChildren();
  if(!current){
    stageResult.textContent='Calcula la propuesta para ver los resultados de esta etapa.';
    return;
  }
  if(activeStage===8&&!current.error) return;
  const facts=stageFacts(current,activeStage,!edited);
  if(edited){
    const stale=document.createElement('p');
    stale.className='note';
    stale.textContent='Resultados de la última corrida. Pulsa Calcular para aplicar los cambios.';
    stageResult.append(stale);
  }
  if(facts){
    const list=document.createElement('dl');
    list.className='stage-facts';
    for(const [label,value] of facts){
      const item=document.createElement('div');
      item.className='fact';
      const term=document.createElement('dt');
      term.textContent=label;
      const definition=document.createElement('dd');
      definition.textContent=value;
      item.append(term,definition);
      list.append(item);
    }
    stageResult.append(list);
  }
  if(activeStage===5&&!edited&&current.design?.shaftTrials?.length){
    const attempts=document.createElement('p');
    const count=current.design.shaftTrials.length;
    attempts.textContent=(count===1?'Se comprobó un diámetro de catálogo.':'Se comprobaron '+count+' diámetros de catálogo.')+' Consulta las iteraciones en Desarrollo del cálculo.';
    stageResult.append(attempts);
  }
  const status=edited?'':stageStatus(current,activeStage);
  if(status){
    const item=document.createElement('p');
    item.className='note';
    item.textContent=status;
    stageResult.append(item);
  }
}

function renderMaterialCards(host,cards) {
  host.replaceChildren();
  for(const {title,source,rows,note} of cards){
    const card=document.createElement('section');
    card.className='material-card';
    const name=document.createElement('h4');
    name.textContent=title;
    const reference=document.createElement('p');
    reference.className='material-source';
    reference.textContent=source;
    const list=document.createElement('dl');
    list.className='material-grid';
    for(const [label,value] of rows){
      const term=document.createElement('dt');
      term.textContent=label;
      const definition=document.createElement('dd');
      definition.textContent=value;
      const item=document.createElement('div');
      item.append(term,definition);
      list.append(item);
    }
    card.append(name,reference,list);
    if(note){
      const notice=document.createElement('p');
      notice.className='material-note';
      notice.textContent=note;
      card.append(notice);
    }
    host.append(card);
  }
}

function renderStageMaterial() {
  const cards=current?stageMaterial(activeStage,submittedValues,current):[];
  stageMaterials.hidden=!cards.length;
  renderMaterialCards(stageMaterials,cards);
}

function renderProposalMaterials() {
  const values=formValues();
  for(const group of proposalMaterials){
    const cards=stageMaterial(group.dataset.materialStage,values,null);
    group.hidden=!cards.length;
    renderMaterialCards(group.querySelector('.proposal-material'),cards);
  }
}

window.addEventListener('hashchange',navigateToView);
document.querySelector('.skip').addEventListener('click',event=>{
  event.preventDefault();
  document.querySelector('#contenido').focus();
});

function renderOverview(result) {
  overview.replaceChildren();
  if(!result){
    const note=document.createElement('p');
    note.className='note';
    note.textContent='Calcula la propuesta para ver las dimensiones y comprobaciones del conjunto.';
    overview.append(note);
    return;
  }
  if(edited){
    const note=document.createElement('p');
    note.className='note';
    note.textContent='Estos resultados corresponden a la última corrida. Calcula de nuevo para aplicar los cambios.';
    overview.append(note);
  }
  if(result.error){
    const notice=document.createElement('p');
    notice.className='note';
    notice.textContent='Propuesta no viable en esta corrida. '+result.error;
    const link=document.createElement('a');
    link.className='button secondary';
    link.href='#etapa-'+failureStage(result);
    link.textContent='Revisar el cálculo que se detuvo';
    overview.append(notice,link);
  }
  const {power,belt,design,spring}=result;
  const values=[
    power&&['Potencia requerida',number(power.motorPower/1000,2)+' kW',number(power.outRpm)+' rpm a la salida',1],
    belt&&[belt.review.fixedWidth?'Ancho de banda de tabla':'Ancho mínimo de banda',number(1000*belt.selected)+' mm','Rodillo propuesto de '+number(belt.rollerDiameter)+' mm',2],
    design&&['Engranes',number(design.faceMm)+' mm de cara calculada','Módulo '+number(design.module)+' mm',3],
    design&&['Equilibrio de la flecha',metric(Math.max(...design.moments),'N·m'),'Momento flector máximo',4],
    design&&['Flecha',number(design.diameter)+' mm',steels[design.shaftSteelIndex]?.label||'Diámetro comercial',5],
    design&&['Rodamientos',number(design.diameter)+' mm de agujero','Vida mínima L10 de '+metric(Math.min(...design.bearingLife),'h',0),6],
    spring&&['Resorte',number(spring.selected)+' mm de alambre calculado',number(spring.fmin,1)+' a '+number(spring.fmax,1)+' N',7]
  ].filter(Boolean);
  const grid=document.createElement('div');
  grid.className='grid';
  for(const [label,value,detail,stage] of values){
    const card=document.createElement('article');
    card.className='card';
    const title=document.createElement('h3');
    title.textContent=label;
    const reading=document.createElement('strong');
    reading.textContent=value;
    const caption=document.createElement('p');
    caption.textContent=detail;
    const link=document.createElement('a');
    link.href='#etapa-'+stage;
    link.textContent='Ver cálculo';
    link.setAttribute('aria-label','Ver cálculo de '+label.toLowerCase());
    card.append(title,reading,caption,link);
    grid.append(card);
  }
  if(values.length) overview.append(grid);
  if(!result.error){
    const note=document.createElement('p');
    note.className='note';
    note.textContent='La banda requiere verificar la tensión admisible a '+number(belt.review.operatingFpm,0)+' ft/min y la contraflexión. El resorte cumple estática en el modelo y queda pendiente de verificar a fatiga.';
    overview.append(note);
  }
}

function renderDecisions(result) {
  decisionLog.replaceChildren();
  if(!result?.decisions.length||edited){
    const note=document.createElement('p');
    note.className='note';
    note.textContent=edited?'Calcula la propuesta para actualizar la bitácora.':
      result?'La corrida se detuvo antes de registrar candidatas.':'Las medidas probadas aparecerán aquí después de calcular.';
    decisionLog.append(note);
    return;
  }

  for(const [index,{title,summary,trials}] of result.decisions.entries()){
    const card=document.createElement('article');
    card.className='decision-card';
    const header=document.createElement('div');
    header.className='decision-heading';
    const name=document.createElement('h3');
    name.id='decision-group-'+(index+1);
    name.textContent=title;
    header.append(name);
    const outcome=trials.find(({status})=>['selected','calculated','verified'].includes(status));
    const selection=document.createElement('p');
    selection.className='decision-selection';
    selection.textContent=outcome?decisionLabels[outcome.status]+' · '+outcome.measure:trials.length?'Sin medida aprobada':'Sin medidas probadas';
    header.append(selection);
    card.append(header);
    if(summary){
      const description=document.createElement('p');
      description.className='decision-summary';
      description.textContent=summary;
      card.append(description);
    }
    if(trials.length) {
      const container=document.createElement('div');
      container.className='decision-trials';
      const table=document.createElement('table');
      table.setAttribute('aria-labelledby',name.id);
      const head=table.createTHead().insertRow();
      for(const label of ['Medida','Resultado','Motivo']){
        const cell=document.createElement('th');
        cell.scope='col';
        cell.textContent=label;
        head.append(cell);
      }
      const body=table.createTBody();
      for(const {measure,status,reason} of trials){
        const row=body.insertRow();
        row.dataset.status=status;
        row.insertCell().textContent=measure;
        const tag=document.createElement('span');
        tag.className='trial-status';
        tag.dataset.status=status;
        tag.textContent=decisionLabels[status];
        row.insertCell().append(tag);
        row.insertCell().textContent=reason;
      }
      container.append(table);
      card.append(container);
    }
    decisionLog.append(card);
  }
}

function render(entries) {
  memory.replaceChildren();
  let index = 0;
  let section = memory;
  let target = memory;
  for (const {type, value} of entries) {
    if (type === 'section') {
      section = document.createElement('section');
      section.id = 'etapa-' + (++index);
      memory.append(section);
      target = section;
    } else if (type === 'heading') {
      target = section;
    } else if (type === 'iteration') {
      target = document.createElement('div');
      target.className = 'iteration';
      section.append(target);
    }
    if (type === 'diagram') {
      const figure = document.createElement('figure');
      figure.className = 'design-diagram';
      const title = document.createElement('h3');
      title.textContent = value.title;
      const canvas = document.createElement('canvas');
      canvas.width=840; canvas.height=250;
      canvas.setAttribute('role','img');
      canvas.setAttribute('aria-label',value.title+'. '+value.caption);
      const caption = document.createElement('figcaption');
      caption.textContent=value.caption;
      figure.append(title,canvas,caption);
      target.append(figure);
      paintDiagram(canvas,value);
      continue;
    }
    const tag = {section:'h2', heading:'h3', iteration:'h4', eq:'div'}[type] || 'p';
    const element = document.createElement(tag);
    if (type === 'eq') {
      element.className = 'eq';
      if (window.katex) window.katex.render(formatEquation(value), element, {displayMode:true, throwOnError:false});
      else element.textContent = value;
    } else {
      element.textContent = plainNumberNotation(value);
      if (type === 'note') element.className = 'note';
    }
    target.append(element);
  }
}

function formatEquation(value) {
  const parts = value.split(/;\\quad\s*/);
  if (parts.length > 1 && value.length > 120) {
    return '\\begin{gathered}\n' + parts.join(' \\\\\n') + '\n\\end{gathered}';
  }
  const terms = value.split('=');
  if (value.length <= 112 || terms.length < 3 || value.includes(';') ||
      value.includes('\\ge ') || value.includes('\\le ')) return value;
  return '\\begin{aligned}\n' + terms[0] + '&=' +
    terms.slice(1).join(' \\\\\n&=') + '\n\\end{aligned}';
}

const decisionLabels={rejected:'Descartada',viable:'Viable',selected:'Seleccionada',calculated:'Calculada',verified:'Verificada'};

function reportEntries(result) {
  const log=result.decisions.map(value=>({type:'decision',value}));
  if(!log.length) log.push({type:'note',value:'La corrida se detuvo antes de registrar candidatas.'});
  return [...result.entries,{type:'section',value:'Bitácora de decisiones'},...log];
}

function decisionTex({title,summary,trials},escape) {
  const heading='\\subsection*{'+escape(title)+'}';
  const description=summary?escape(summary):'';
  if(!trials.length) return [heading,description,'La corrida no llegó a probar una medida.'].filter(Boolean).join('\n\n');

  const header='\\textbf{Medida} & \\textbf{Resultado} & \\textbf{Motivo} \\\\ \\hline';
  const rows=trials.map(({measure,status,reason})=>{
    const label=escape(decisionLabels[status]);
    const result=status==='selected'?'\\textbf{'+label+'}':label;
    return [escape(measure),result,escape(reason)].join(' & ')+' \\\\';
  });
  const table=['\\begin{longtable}{@{}p{.16\\linewidth}p{.18\\linewidth}p{.57\\linewidth}@{}}',
    '\\hline',header,'\\endfirsthead','\\hline',header,'\\endhead',
    '\\hline','\\endfoot',...rows,'\\end{longtable}'].join('\n');
  return [heading,description,table].filter(Boolean).join('\n\n');
}

function tex(entries) {
  const escape = value => plainNumberNotation(value).replace(/[#$%&_{}]/g, character => '\\' + character).replace(/–/g,'--').replace(/·/g,'\\textperiodcentered{}');
  return [
    '\\documentclass[11pt]{article}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage[spanish,es-minimal]{babel}',
    '\\usepackage{amsmath}',
    '\\usepackage{pict2e}',
    '\\usepackage{longtable}',
    '\\usepackage[a4paper,margin=20mm]{geometry}',
    '\\allowdisplaybreaks',
    '\\setlength{\\parskip}{0.45em}',
    '\\title{Memoria de cálculo de la prensa mecánica}',
    '\\author{}',
    '\\date{}',
    '\\begin{document}',
    '\\maketitle',
    ...entries.map(({type, value}) => {
      if (type === 'diagram') return diagramTex(value,escape);
      if (type === 'decision') return decisionTex(value,escape);
      if (type === 'eq') {
        return '\\[\n' + formatEquation(value) + '\n\\]';
      }
      const command = {section:'section', heading:'subsection*', iteration:'subsubsection*'}[type];
      return command ? '\\' + command + '{' + escape(value) + '}' : escape(value) + '\n';
    }),
    '\\end{document}', ''
  ].join('\n\n');
}

function run() {
  const invalid=Array.from(form.elements).find(input=>input.willValidate&&!input.validity.valid);
  if(invalid){
    invalid.scrollIntoView({block:'center'});
    invalid.focus({preventScroll:true});
    invalid.reportValidity();
    return false;
  }
  submittedValues=formValues();
  current=calculate(submittedValues);
  edited=false;
  render(current.entries);
  renderOverview(current);
  renderDecisions(current);
  showView();
  calculationStatus.textContent=current.error?'Corrida detenida · '+stages[failureStage(current)-1][0]:'Propuesta calculada';
  calculationStatus.dataset.state=current.error?'error':'ready';
  updateDownloads();
  if(!generatingPdf) pdfStatus.textContent='';
  return !current.error;
}
form.addEventListener('submit',event=>{
  event.preventDefault();
  const previous=current;
  run();
  if(current!==previous){
    location.hash='resultados';
    navigateToView();
    document.querySelector('#results-title').focus({preventScroll:true});
  }
});

function markEdited(message) {
  const firstEdit=!edited;
  edited=true;
  renderProposalMaterials();
  if(firstEdit){
    renderOverview(current);
    renderDecisions(current);
    updateDownloads();
  }
  if(!generatingPdf) pdfStatus.textContent='';
  calculationStatus.dataset.state='edited';
  calculationStatus.textContent=message;
}

form.addEventListener('input',event=>{
  if(event.target.name) markEdited('Hay cambios sin calcular.');
});
document.querySelector('#restore').addEventListener('click',()=>{
  for(const [key,value] of Object.entries(defaults)) form.elements.namedItem(key).value=value;
  markEdited('Datos iniciales de la prensa cargados. Calcula para ver los resultados.');
});
function updateDownloads(){
  const available=!edited&&Boolean(current?.entries.some(entry=>entry.type==='eq'));
  download.disabled=!available;
  downloadPdf.disabled=!available||generatingPdf;
}

function memoryFilename(result,extension){
  return (result.error?'memoria_prensa_propuesta_no_viable':'memoria_prensa')+'.'+extension;
}

function saveDocument(blob,name){
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=name;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

download.addEventListener('click',()=>{
  saveDocument(new Blob([tex(reportEntries(current))],{type:'application/x-tex;charset=utf-8'}),memoryFilename(current,'tex'));
});
downloadPdf.addEventListener('click',async()=>{
  const snapshot=current;
  generatingPdf=true;
  updateDownloads();
  pdfStatus.textContent='Preparando el PDF…';
  try{
    const document=await buildMemoryPdf(reportEntries(snapshot),formatEquation,(completed,total)=>{
      pdfStatus.textContent='Generando PDF… '+Math.floor(100*completed/total)+' %';
    });
    if(snapshot!==current||edited){
      pdfStatus.textContent='Los datos cambiaron. Genera el PDF de la corrida actual.';
      return;
    }
    saveDocument(document,memoryFilename(snapshot,'pdf'));
    pdfStatus.textContent='PDF listo.';
  }catch(error){
    pdfStatus.textContent=error.message||'No se pudo generar el PDF.';
  }finally{
    generatingPdf=false;
    updateDownloads();
  }
});
window.addEventListener('DOMContentLoaded',()=>{
  renderProposalMaterials();
  if(/^#(?:etapa-[1-8]|datos|memoria|resultados|bitacora)$/.test(location.hash)) run();
  else {
    renderOverview();
    renderDecisions();
  }
  navigateToView();
});
