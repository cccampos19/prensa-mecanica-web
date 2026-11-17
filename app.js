'use strict';

const form = document.querySelector('#inputs');
const memory = document.querySelector('#memory');
const calculationStatus = document.querySelector('#status');
const download = document.querySelector('#download');
const defaults = {
  rpm: 2100, ratio: 1.875, load: 18000, pinion: 160, gear: 640,
  gearEff: 97, beltEff: 94, nominal: 75, pulley: 300, centers: 0.90,
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
    ['rpm','Velocidad del motor (rpm)'], ['ratio','Relación de banda'],
    ['load','Torque de salida (kgf·cm)'], ['pinion','Diámetro primitivo del piñón (mm)'],
    ['gear','Diámetro primitivo del engrane (mm)'], ['gearEff','Eficiencia de engranes (%)'],
    ['beltEff','Eficiencia de banda (%)'], ['nominal','Motor nominal (kW)']
  ],
  beltFields: [
    ['pulley','Diámetro de polea conducida (mm)'], ['centers','Distancia entre centros (m)'],
    ['start','Ancho inicial propuesto (mm)'], ['angle','Orientación de carga (°)']
  ],
  gearFields: [
    ['np','Dientes del piñón'], ['ng','Dientes de la rueda'], ['phi','Ángulo de presión (°)'],
    ['yp','Lewis · piñón'], ['yg','Lewis · rueda'], ['ktGear','Kt en raíz del diente'],
    ['gearFat','Seguridad a fatiga'], ['gearStatic','Seguridad estática']
  ],
  balanceFields: [
    ['x2','Posición del piñón (mm)'], ['x3','Posición de la polea (mm)'],
    ['span','Distancia entre apoyos (mm)']
  ],
  shaftFields: [
    ['shaftStart','Diámetro inicial (mm)'], ['fillet','Radio de filete relativo r/d'],
    ['kc','Factor de carga kc'], ['ktFlex','Kt en flexión'], ['ktTors','Kts en torsión'],
    ['shaftFat','Seguridad a fatiga'], ['shaftStatic','Seguridad estática'],
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
function addSelect(group, name, title, labels) {
  const label = document.createElement('label');
  label.textContent = title;
  const select = document.createElement('select');
  select.name = name;
  labels.forEach((value,i)=>select.add(new Option(value,i)));
  select.value = defaults[name];
  label.append(select);
  document.getElementById(group).prepend(label);
}
for (const [group, prefix] of [['gearFields','gear'],['shaftFields','shaft']]) {
  addSelect(group,prefix+'Finish','Acabado',finishes.map(row=>row[0]));
  addSelect(group,prefix+'Steel','Acero',steels.map(steel=>steel.label));
}
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

const stageInput=document.querySelector('#edit-stage');
const memoryStage=document.querySelector('#memory-stage');
const overview=document.querySelector('#overview');
let current;
let edited=false;
let activeStage='etapa-1';

function selectEditor(id) {
  stageInput.value=id;
  for(const fieldset of form.querySelectorAll('fieldset')) fieldset.hidden=fieldset.id!==id;
}

function showMemoryStep(id) {
  if (!memory.querySelector('#'+id)) id=memoryStage.options[0]?.value;
  activeStage=id||'etapa-1';
  memoryStage.value=activeStage;
  for(const section of memory.children) section.hidden=section.id!==activeStage;
}

function showView(){
  const hash=location.hash.slice(1);
  const stage=/^etapa-[1-8]$/.test(hash);
  const view=stage?'memoria':(['datos','memoria','catalogos'].includes(hash)?hash:'resultados');
  for(const panel of document.querySelectorAll('.view')) panel.hidden=panel.id!==view;
  for(const link of document.querySelectorAll('.views [data-view]')){
    if(link.dataset.view===view) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  showMemoryStep(stage?hash:activeStage);
}

stageInput.addEventListener('change',()=>selectEditor(stageInput.value));
memoryStage.addEventListener('change',()=>{location.hash=memoryStage.value;});
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
    ['Flecha',number(design.diameter)+' mm','Diámetro comercial',5],
    ['Rodamientos',number(design.diameter)+' mm de agujero','Reacciones máximas: '+design.loads.map(load=>number(load/1000,2)).join(' y ')+' kN',6],
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
  note.textContent='Por verificar: fatiga del resorte y condiciones de trabajo de la banda.';
  const diagrams=document.createElement('a');
  diagrams.href='#etapa-8';
  diagrams.className='button secondary';
  diagrams.textContent='Ver diagramas';
  overview.append(grid,note,diagrams);
}

function render(entries) {
  memory.replaceChildren();
  memoryStage.replaceChildren();
  let index = 0;
  let section = memory;
  let target = memory;
  for (const {type, value} of entries) {
    if (type === 'section') {
      section = document.createElement('section');
      section.id = 'etapa-' + (++index);
      memoryStage.add(new Option(value,section.id));
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
    selectEditor(invalid.closest('fieldset').id);
    location.hash='datos';
    showView();
    invalid.focus();
    invalid.reportValidity();
    return false;
  }
  const values=Object.fromEntries(new FormData(form));
  current=calculate(Object.fromEntries(Object.entries(values).map(([key,value])=>[key,Number(value)])));
  edited=false;
  render(current.entries);
  renderOverview(current);
  showView();
  calculationStatus.textContent=current.error?current.error:'Caso calculado · siete etapas';
  calculationStatus.dataset.state=current.error?'error':'ready';
  download.disabled=!current.spring;
  return !current.error;
}
form.addEventListener('submit',event=>{
  event.preventDefault();
  if(run()) location.hash='resultados';
});
form.addEventListener('input',event=>{
  if(!event.target.name||edited) return;
  edited=true;
  download.disabled=true;
  calculationStatus.dataset.state='edited';
  calculationStatus.textContent='Hay cambios sin calcular. Pulsa Calcular para actualizar los resultados.';
});
document.querySelector('#restore').addEventListener('click',()=>{
  for(const [key,value] of Object.entries(defaults)) form.elements.namedItem(key).value=value;
  if(run()) location.hash='resultados';
});
download.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([tex(current.entries)], {type:'application/x-tex;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'memoria_prensa.tex';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('DOMContentLoaded', run);
