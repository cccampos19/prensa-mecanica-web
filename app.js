'use strict';

const form = document.querySelector('#inputs');
const memory = document.querySelector('#memory');
const calculationStatus = document.querySelector('#status');
const download = document.querySelector('#download');
const defaults = {
  rpm: 2100, ratio: 1.875, load: 18000, pinion: 160, gear: 640,
  gearEff: 97, beltEff: 94, nominal: 75, pulley: 300, centers: 0.90,
  start: 200, angle: 60, belt: 9
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
  let section = memory;
  let target = memory;
  for (const {type, value} of entries) {
    if (type === 'section') {
      section = document.createElement('section');
      memory.append(section);
      target = section;
    } else if (type === 'heading') {
      target = section;
    } else if (type === 'iteration') {
      target = document.createElement('div');
      target.className = 'iteration';
      section.append(target);
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
  const terms = value.split('=');
  if (value.length <= 125 || terms.length < 3 || value.includes(';') ||
      value.includes('\\ge ') || value.includes('\\le ')) return value;
  return '\\begin{aligned}\n' + terms[0] + '&=' +
    terms.slice(1).join(' \\\\\n&=') + '\n\\end{aligned}';
}

function tex(entries) {
  const escape = value => value.replace(/[#$%&_{}]/g, character => '\\' + character);
  return [
    '\\documentclass[11pt]{article}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage[spanish,es-minimal]{babel}',
    '\\usepackage{amsmath}',
    '\\usepackage[a4paper,margin=20mm]{geometry}',
    '\\allowdisplaybreaks',
    '\\setlength{\\parskip}{0.45em}',
    '\\title{Memoria de cálculo de la prensa mecánica}',
    '\\author{}',
    '\\date{}',
    '\\begin{document}',
    '\\maketitle',
    ...entries.map(({type, value}) => {
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
    : 'Memoria calculada · ' + current.iterations.length + ' iteraciones de banda.';
  download.disabled = !current.belt;
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
