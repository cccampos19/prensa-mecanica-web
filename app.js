'use strict';

const form = document.querySelector('#inputs');
const memory = document.querySelector('#memory');
const calculationStatus = document.querySelector('#status');
const download = document.querySelector('#download');
const downloadPdf=document.querySelector('#download-pdf');
const pdfStatus=document.querySelector('#pdf-status');
let generatingPdf=false;
const defaults = {
  rpm: 2100, ratio: 1.875, load: 18000, pinion: 160, gear: 640,
  gearEff: 100, beltEff: 100, nominal: 75, pulley: 300, centers: 0.90,
  start: 200, angle: 60, belt: 9,
  np:20, ng:80, phi:20, yp:.322, yg:.426, ktGear:1.8, gearFat:2, gearStatic:4,
  gearSteel:17, gearFinish:1, x2:120, x3:320, span:620,
  shaftSteel:17, shaftFinish:1, shaftStart:40, fillet:.1, kc:.59, ktFlex:1.7,
  ktTors:1.4, shaftFat:2, shaftStatic:2, temperature:20, reliability:99,
  bearingType:0, life:20000, bearingStatic:1.5,
  wire:0, travel:20, idlerRadius:56, armAngle:-14, springRate:5.5, preload:35, springIndex:10, springSafety:2, hookRadius:2
};
const fields = {
  powerFields: [
    ['rpm','Velocidad del motor (rpm)'], ['load','Torque de salida (kgf·cm)'],
    ['nominal','Potencia nominal propuesta (kW)']
  ],
  beltFields: [
    ['ratio','Relación de banda'], ['beltEff','Eficiencia de la banda (%)'],
    ['pulley','Diámetro de polea conducida (mm)'], ['centers','Distancia entre centros (m)'],
    ['start','Ancho inicial propuesto (mm)'], ['angle','Orientación de carga (°)']
  ],
  gearFields: [
    ['pinion','Diámetro primitivo del piñón (mm)'], ['gear','Diámetro primitivo de la rueda (mm)'],
    ['gearEff','Eficiencia de engranes (%)'], ['np','Dientes del piñón'], ['ng','Dientes de la rueda'], ['phi','Ángulo de presión (°)'],
    ['yp','Lewis · piñón'], ['yg','Lewis · rueda'], ['ktGear','Kt en raíz del diente'],
    ['gearFat','Seguridad a fatiga'], ['gearStatic','Seguridad estática']
  ],
  balanceFields: [
    ['x2','Posición del piñón (mm)'], ['x3','Posición de la polea (mm)'],
    ['span','Distancia entre apoyos (mm)']
  ],
  shaftFields: [
    ['shaftStart','Diámetro inicial (mm)'], ['fillet','Radio de filete relativo r/d'],
    ['ktFlex','Kt en flexión'], ['ktTors','Kts en torsión'],
    ['shaftFat','Índice mínimo de Hencky–Marin'], ['shaftStatic','Seguridad estática'],
    ['temperature','Temperatura de servicio (°C) · flecha y engranes'],
    ['reliability','Confiabilidad de fatiga (%) · flecha y engranes']
  ],
  bearingFields: [['life','Vida L10 solicitada (h)'], ['bearingStatic','Seguridad estática']],
  springFields: [
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
for (const [group, prefix] of [['gearFields','gear'],['shaftFields','shaft']]) {
  addSelect(group,prefix+'Finish','Acabado',finishes.map(row=>row[0]));
  addSelect(group,prefix+'Steel','Acero',steels.map(steel=>steel.label));
}
addSelect('shaftFields','kc','Factor de carga · tabla de clase',shaftLoadFactors.map(item=>item.label),shaftLoadFactors.map(item=>item.value));
addSelect('bearingFields','bearingType','Tipo · serie 02',['Ranura profunda','Contacto angular']);

addSelect('springFields','wire','Alambre · tablas 10-4 y 10-5',springWires.map(wire=>wire.name));

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
let edited=false;
let activeStage=1;
let openCalculation=0;

function formValues() {
  return Object.fromEntries(Array.from(new FormData(form),([key,value])=>[key,value===''?NaN:Number(value)]));
}

function selectEditor(id) {
  for(const fieldset of form.querySelectorAll('fieldset')) fieldset.hidden=fieldset.id!==id;
}

function showView() {
  const hash=location.hash.slice(1);
  const stageMatch=/^etapa-([1-8])$/.exec(hash);
  const stageView=Boolean(stageMatch)||hash==='datos'||hash==='memoria';
  const view=stageView?'datos':hash==='catalogos'?'catalogos':'resultados';
  if(stageMatch) activeStage=Number(stageMatch[1]);
  if(hash==='datos'&&activeStage===8) activeStage=1;
  for(const panel of document.querySelectorAll('.view')) panel.hidden=panel.id!==view;
  const selected=stageView?'etapa-'+activeStage:view;
  for(const link of document.querySelectorAll('.views [data-view]')){
    if(link.dataset.view===selected) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  if(!stageView) return;

  const [title,fieldset]=stages[activeStage-1];
  stageTitle.textContent=title;
  form.hidden=!fieldset;
  selectEditor(fieldset);
  stageResult.hidden=!fieldset;
  const stageKey='etapa-'+activeStage;
  let hasCalculation=false;
  for(const section of memory.children){
    section.hidden=section.id!==stageKey;
    if(!section.hidden) hasCalculation=true;
  }
  stageCalculation.hidden=!hasCalculation;
  stageCalculation.querySelector('summary').textContent=activeStage===8?'Ver diagramas':'Desarrollo del cálculo';
  if(openCalculation!==activeStage){
    stageCalculation.open=activeStage===8||hash==='memoria';
    openCalculation=activeStage;
  }
  renderStageResult();
  renderStageMaterial();
}

function metric(value,unit,digits=2){
  return Number.isFinite(value)?number(value,digits)+(unit?' '+unit:''):'—';
}

function stageFacts(result,stage){
  const {power,belt,design,spring}=result;
  const minimum=values=>values?.length?Math.min(...values):undefined;
  switch(stage){
    case 1: return power&&[
      ['Potencia mecánica requerida',metric(power.motorPower/1000,'kW')],
      ['Velocidad de la flecha',metric(power.shaftRpm,'rpm',0)],
      ['Velocidad de salida',metric(power.outRpm,'rpm',0)]
    ];
    case 2: return belt&&[
      ['Ancho propuesto',metric(belt.selected*1000,'mm',0)],
      ['Diámetro del rodillo',metric(belt.rollerDiameter,'mm',0)],
      ['Demanda de tensión',metric(belt.review.demandImperial,'lbf/in')]
    ];
    case 3: return design&&[
      ['Ancho de cara',metric(design.faceMm,'mm',0)],
      ['Módulo',metric(design.module,'mm')],
      ['Factor mínimo a fatiga',metric(minimum(design.gearFatigue),'')]
    ];
    case 4: return design&&[
      ['Reacción máxima · apoyo 1',metric(design.loads[0]/1000,'kN')],
      ['Reacción máxima · apoyo 4',metric(design.loads[1]/1000,'kN')],
      ['Momento flector máximo',metric(Math.max(...design.moments),'N·m')]
    ];
    case 5: return design&&[
      ['Diámetro comercial',metric(design.diameter,'mm',0)],
      ['Diámetro continuo',metric(design.continuous,'mm')],
      ['Índice mínimo de Hencky–Marin',metric(minimum(design.shaftFatigue),'')]
    ];
    case 6: return design&&[
      ['Diámetro de agujero',metric(design.diameter,'mm',0)],
      ['Vida L10 · apoyo 1',metric(design.bearingLife?.[0],'h',0)],
      ['Vida L10 · apoyo 4',metric(design.bearingLife?.[1],'h',0)]
    ];
    case 7: return spring&&[
      ['Diámetro de alambre',metric(spring.selected,'mm')],
      ['Carga de trabajo',metric(spring.fmin,'',1)+'–'+metric(spring.fmax,'N',1)],
      ['Factor mínimo estático',metric(minimum(spring.elasticFactors),'')]
    ];
    default: return null;
  }
}

function stageCaution(result,stage){
  if(stage===2&&result.belt) return 'Pendiente de servicio: la tabla 17-2 da el límite a 600 ft/min. La banda trabaja a '+metric(result.belt.review.operatingFpm,'ft/min',0)+' y pasa por un rodillo de contraflexión.';
  if(stage===3&&result.design) return 'La comprobación a fatiga usa el método de los apuntes y los factores de Lewis y entalle propuestos. Coteja esos factores con el perfil real del diente.';
  if(stage===5&&result.design) {
    const {stockReview}=result.design;
    if(!stockReview.a20CoversFinishedSizes) return 'Fatiga provisional. A-20 cubre 18–32 mm y A-21 da promedios de probetas de barras de 25.4 mm. La flecha calculada tiene base de '+metric(stockReview.base,'mm')+' y hombro de '+metric(stockReview.shoulder,'mm')+'.';
    return 'Se verifica la fatiga con la convención de Hencky–Marin de la libreta. Confirma el diámetro y el estado de suministro de la barra.';
  }
  if(stage===6&&result.design) return 'La vida L10 comprueba fatiga de contacto con las cargas calculadas y las capacidades de la tabla 11-2.';
  if(stage===7&&result.spring) return 'Fatiga del cuerpo y los ganchos pendiente. Se calculan los esfuerzos alternantes y medios, pero las tablas 10-4 y 10-5 no incluyen resistencia cíclica.';
  return '';
}

function renderStageResult() {
  stageResult.replaceChildren();
  if(!current||activeStage===8) return;
  const facts=stageFacts(current,activeStage);
  if(!facts) return;
  if(edited){
    const stale=document.createElement('p');
    stale.className='note';
    stale.textContent='Resultados de la última corrida. Pulsa Calcular para aplicar los cambios.';
    stageResult.append(stale);
  }
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
  const caution=stageCaution(current,activeStage);
  if(caution){
    const item=document.createElement('p');
    item.className='note';
    item.textContent=caution;
    stageResult.append(item);
  }
}

function renderStageMaterial() {
  const cards=stageMaterial(activeStage,formValues(),edited?null:current);
  stageMaterials.replaceChildren();
  stageMaterials.hidden=!cards.length;
  if(!cards.length) return;

  const heading=document.createElement('h3');
  heading.textContent='Propiedades de catálogo';
  stageMaterials.append(heading);
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
    stageMaterials.append(card);
  }
}
window.addEventListener('hashchange',showView);

function renderOverview(result) {
  overview.replaceChildren();
  if(result.error){
    const notice=document.createElement('p');
    notice.className='note';
    notice.textContent=result.error;
    overview.append(notice);
    return;
  }
  const {power,belt,design,spring}=result;
  const values=[
    ['Potencia requerida',number(power.motorPower/1000,2)+' kW',number(power.outRpm)+' rpm a la salida',1],
    ['Ancho de banda',number(1000*belt.selected)+' mm','Rodillo de '+number(belt.rollerDiameter)+' mm',2],
    ['Engranes',number(design.faceMm)+' mm de cara','Módulo '+number(design.module)+' mm',3],
    ['Equilibrio de la flecha',metric(Math.max(...design.moments),'N·m'),'Momento flector máximo',4],
    ['Flecha',number(design.diameter)+' mm','Diámetro comercial',5],
    ['Rodamientos',number(design.diameter)+' mm de agujero','Vida mínima L10: '+metric(Math.min(...design.bearingLife),'h',0),6],
    ['Resorte',number(spring.selected)+' mm de alambre',number(spring.fmin,1)+' a '+number(spring.fmax,1)+' N',7]
  ];
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
  const note=document.createElement('p');
  note.className='note';
  note.textContent='Banda: '+number(belt.review.demandImperial,2)+' lbf/in a '+number(belt.review.operatingFpm,0)+' ft/min. La tabla solo da el límite de referencia a 600 ft/min. Resorte: estática comprobada, con factor mínimo '+number(Math.min(...spring.elasticFactors),2)+'. Faltan la resistencia cíclica y los ciclos objetivo.';
  const diagrams=document.createElement('a');
  diagrams.href='#etapa-8';
  diagrams.className='button secondary';
  diagrams.textContent='Ver diagramas';
  overview.append(grid,note,diagrams);
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
      element.textContent = value;
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

function tex(entries) {
  const escape = value => value.replace(/[#$%&_{}]/g, character => '\\' + character).replace(/–/g,'--').replace(/·/g,'\\textperiodcentered{}');
  return [
    '\\documentclass[11pt]{article}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage[spanish,es-minimal]{babel}',
    '\\usepackage{amsmath}',
    '\\usepackage{pict2e}',
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
    activeStage=stages.findIndex(([,id])=>id===invalid.closest('fieldset').id)+1;
    location.hash='etapa-'+activeStage;
    showView();
    invalid.focus();
    invalid.reportValidity();
    return false;
  }
  current=calculate(formValues());
  edited=false;
  render(current.entries);
  renderOverview(current);
  showView();
  calculationStatus.textContent=current.error?current.error:'Caso calculado · siete etapas';
  calculationStatus.dataset.state=current.error?'error':'ready';
  updateDownloads();
  if(!generatingPdf) pdfStatus.textContent='';
  return !current.error;
}
form.addEventListener('submit',event=>{
  event.preventDefault();
  run();
});
form.addEventListener('input',event=>{
  if(!event.target.name) return;
  const firstEdit=!edited;
  edited=true;
  renderStageMaterial();
  if(!firstEdit) return;
  renderStageResult();
  updateDownloads();
  if(!generatingPdf) pdfStatus.textContent='';
  calculationStatus.dataset.state='edited';
  calculationStatus.textContent='Hay cambios sin calcular. Pulsa Calcular para actualizar los resultados.';
});
document.querySelector('#restore').addEventListener('click',()=>{
  for(const [key,value] of Object.entries(defaults)) form.elements.namedItem(key).value=value;
  run();
});
function updateDownloads(){
  const available=Boolean(current?.spring)&&!edited;
  download.disabled=!available;
  downloadPdf.disabled=!available||generatingPdf;
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
  saveDocument(new Blob([tex(current.entries)],{type:'application/x-tex;charset=utf-8'}),'memoria_prensa.tex');
});
downloadPdf.addEventListener('click',async()=>{
  const snapshot=current;
  generatingPdf=true;
  updateDownloads();
  pdfStatus.textContent='Preparando el PDF…';
  try{
    const document=await buildMemoryPdf(snapshot.entries,formatEquation,(completed,total)=>{
      pdfStatus.textContent='Generando PDF… '+Math.floor(100*completed/total)+' %';
    });
    if(snapshot!==current||edited){
      pdfStatus.textContent='Los datos cambiaron. Genera el PDF de la corrida actual.';
      return;
    }
    saveDocument(document,'memoria_prensa.pdf');
    pdfStatus.textContent='PDF listo.';
  }catch(error){
    pdfStatus.textContent=error.message||'No se pudo generar el PDF.';
  }finally{
    generatingPdf=false;
    updateDownloads();
  }
});
window.addEventListener('DOMContentLoaded',run);
