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

const tables = document.querySelector('#catalogs');
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

let current;

function render(entries) {
  memory.replaceChildren();
  const nav = document.createElement('nav');
  nav.className = 'memory-nav';
  nav.setAttribute('aria-label','Etapas de la memoria');
  memory.append(nav);
  let index = 0;
  let section = memory;
  let target = memory;
  for (const {type, value} of entries) {
    if (type === 'section') {
      section = document.createElement('section');
      section.id = 'etapa-' + (++index);
      const link = document.createElement('a');
      link.href = '#' + section.id;
      link.textContent = value;
      nav.append(link);
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
  const values = Object.fromEntries(new FormData(form));
  current = calculate(Object.fromEntries(Object.entries(values).map(([key,value]) => [key, Number(value)])));
  render(current.entries);
  calculationStatus.textContent = current.error
    ? 'Propuesta incompleta. Revisa la anotación en la memoria.'
    : 'Siete etapas calculadas · revisa las verificaciones pendientes.';
  download.disabled = !current.spring;
}
form.addEventListener('submit', event => {
  event.preventDefault();
  run();
});
form.addEventListener('input', () => {
  download.disabled = true;
  calculationStatus.textContent = 'Propuesta editada. Pulsa Calcular para actualizar la memoria.';
});
document.querySelector('#restore').addEventListener('click', () => {
  for (const [key, value] of Object.entries(defaults)) form.elements.namedItem(key).value = value;
  run();
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
