'use strict';

const shaftInputDefaults = {
  mode: 'forces',
  length: 600,
  supportA: 100,
  supportB: 500,
  loads: [{x: 300, fy: -2000, fz: 0}]
};

function createShaftInputPanel(container, initialState, onChange, sources) {
  const initial = initialState ?? shaftInputDefaults;
  let mode = initial.mode;
  const modes = node('fieldset', null, 'shaft-input-modes');
  const modeButtons = node('div', null, 'shaft-mode-buttons');
  const loadDetails = node('fieldset', null, 'shaft-point-loads');
  const positionFields = node('div', null, 'shaft-position-fields');
  const plot = node('div', null, 'shaft-plot');
  const loadRows = node('div', null, 'shaft-load-rows');
  const loadListHeading = node('div', null, 'shaft-load-list-heading');
  const empty = node('p', 'Agrega una fuerza si hay cargas transversales.', 'field-hint');
  const add = node('button', 'Agregar fuerza', 'secondary');
  add.type = 'button';

  function numberField(key, label, value, nonnegative = false) {
    const wrapper = node('label', label);
    const input = node('input');
    Object.assign(input, {type: 'number', step: 'any', required: true, value});
    if (nonnegative) input.min = '0';
    input.dataset.shaftField = key;
    wrapper.append(input);
    return wrapper;
  }

  function readInputs(region) {
    return Object.fromEntries(Array.from(region.querySelectorAll('[data-shaft-field]'), input =>
      [input.dataset.shaftField, input.value]));
  }

  const origins=new WeakMap();
  function updatePreview() {
    const positions = readInputs(positionFields);
    const loads = Array.from(loadRows.children,row=>({...readInputs(row),...origins.get(row)}));
    const previewValues = values => Object.fromEntries(Object.entries(values).map(([key, value]) =>
      [key, value === '' ? NaN : Number(value)]));
    if (mode === 'forces') {
      plot.replaceChildren(shaftLoadPreview({
        ...previewValues(positions),
        loads: loads.map(({x,fy,fz})=>previewValues({x,fy,fz}))
      }));
    }
    return {mode, ...positions, loads};
  }

  function labelLoads() {
    empty.hidden = loadRows.children.length > 0;
    Array.from(loadRows.children).forEach((row, index) => {
      const name = 'F' + (index + 1);
      row.querySelector('strong').textContent = name+(origins.has(row)?' · '+origins.get(row).source:'');
      row.querySelector('button').setAttribute('aria-label', 'Quitar fuerza ' + name);
      row.querySelector('[data-shaft-field=x]').setAttribute('aria-label', 'Posición x de ' + name + ' (mm)');
      row.querySelector('[data-shaft-field=fy]').setAttribute('aria-label', 'Fy de ' + name + ' (N)');
      row.querySelector('[data-shaft-field=fz]').setAttribute('aria-label', 'Fz de ' + name + ' (N)');
    });
  }

  function appendLoad(load) {
    const row = node('div', null, 'shaft-load-row');
    if(load.source) origins.set(row,{source:load.source,magnitude:load.magnitude,angle:load.angle});
    const title = node('strong');
    const remove = node('button', 'Quitar', 'secondary');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      const neighbor = row.nextElementSibling ?? row.previousElementSibling;
      row.remove();
      labelLoads();
      onChange(updatePreview());
      (neighbor?.querySelector('input') ?? add).focus();
    });
    row.append(title, numberField('x', 'x (mm)', load.x, true),
      numberField('fy', 'Fy (N)', load.fy), numberField('fz', 'Fz (N)', load.fz), remove);
    loadRows.append(row);
    return row;
  }

  function showMode() {
    loadDetails.hidden = mode !== 'forces';
    loadDetails.disabled = loadDetails.hidden;
    for (const button of modeButtons.children) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    }
  }

  for (const [key, label] of [['forces', 'Fuerzas y apoyos'], ['direct', 'Momento y torque']]) {
    const button = node('button', label, 'secondary');
    button.type = 'button';
    button.dataset.mode = key;
    button.addEventListener('click', () => {
      if (mode === key) return;
      mode = key;
      showMode();
      onChange(updatePreview());
    });
    modeButtons.append(button);
  }

  modes.append(node('legend', 'Entrada de cargas'), modeButtons);
  positionFields.append(numberField('length', 'Longitud total (mm)', initial.length, true),
    numberField('supportA', 'Posición del apoyo A (mm)', initial.supportA, true),
    numberField('supportB', 'Posición del apoyo B (mm)', initial.supportB, true));
  loadListHeading.append(node('h4', 'Fuerzas puntuales'), add);
  loadDetails.append(node('legend', 'Geometría y cargas'), positionFields,
    node('p', 'Mide x desde el extremo izquierdo. El signo de Fy y Fz indica el sentido en cada plano. Captura el torque de la sección por separado.', 'field-hint'),
    plot, loadListHeading, loadRows, empty);

  loadDetails.append(shaftImportPanel(sources,()=>{
    const length=Number(readInputs(positionFields).length);
    return Number.isFinite(length)?length:0;
  },(loads,replace)=>{
    if(replace) loadRows.replaceChildren();
    loads.forEach(appendLoad);
    labelLoads();
    onChange(updatePreview());
  }));
  initial.loads.forEach(appendLoad);
  labelLoads();
  add.addEventListener('click', () => {
    const row = appendLoad({x: '', fy: 0, fz: 0});
    labelLoads();
    onChange(updatePreview());
    row.querySelector('input').focus();
  });
  loadDetails.addEventListener('input', event => {
    if(!event.target.matches('[data-shaft-field]')) return;
    const row=event.target.closest('.shaft-load-row');
    if(row && event.target.dataset.shaftField!=='x' && origins.delete(row)) labelLoads();
    event.stopPropagation();
    onChange(updatePreview());
  });
  container.replaceChildren(modes, loadDetails);
  showMode();
  updatePreview();
}

function shaftImportPanel(sources,getLength,insert){
  const details=node('details',null,'shaft-import');
  details.append(node('summary','Usar fuerzas de otra corrida'));
  if(!sources.length){
    details.append(node('p','Calcula tus engranes o tu banda. Sus fuerzas estarán disponibles aquí durante esta sesión.','field-hint'));
    return details;
  }
  function field(text,control){
    const label=node('label',text);label.append(control);details.append(label);return control;
  }
  const select=field('Corrida de origen',node('select'));
  sources.forEach((s,i)=>select.add(new Option(s.title,i)));
  select.value=String(sources.length-1);
  function entry(label,value){
    const input=field(label,node('input'));input.inputMode='decimal';input.value=value;
    return input;
  }
  const position=entry('Posición de montaje x (mm)','');
  const angle=entry('Ángulo de la primera fuerza desde +Y hacia +Z (°)','');
  const side=field('Sentido de la segunda fuerza respecto a la primera',node('select'));
  side.add(new Option('Giro positivo (+)',1));side.add(new Option('Giro negativo (−)',-1));
  const hint=node('p',null,'field-hint'), replace=node('input');
  replace.type='checkbox';
  const replaceLabel=node('label');replaceLabel.className='shaft-replace';
  replaceLabel.append(replace,document.createTextNode('Reemplazar las fuerzas que aparecen en el dibujo'));
  const button=node('button','Colocar ambas fuerzas','secondary');button.type='button';
  const status=node('p',null,'field-hint');status.setAttribute('role','status');
  details.append(hint,replaceLabel,button,status);
  function describe(){
    const s=sources[select.value];
    hint.textContent=s.names.map((name,i)=>name+' '+worksheetNumber(s.forces[i],'N',3)).join(' · ')+'. Separación angular '+worksheetNumber(s.angle,'°',3)+'.';
    status.textContent='';
  }
  select.addEventListener('change',describe);describe();
  button.addEventListener('click',()=>{
    const val=input=>input.value.trim()===''?NaN:Number(input.value.trim().replace(',','.'));
    const x=val(position),theta=val(angle);
    if(!Number.isFinite(x)||x<0||x>getLength()||!Number.isFinite(theta)){
      status.textContent='Indica una posición sobre la flecha y el ángulo de montaje.';return;
    }
    const s=sources[select.value];
    const loads=s.forces.map((magnitude,i)=>{
      const degrees=theta+i*Number(side.value)*s.angle;
      const radians=(degrees%360)*Math.PI/180;
      const project=v=>Math.abs(v)<1e-14?0:magnitude*v;
      return {x,fy:project(Math.cos(radians)),fz:project(Math.sin(radians)),
        source:s.title+' · '+s.names[i],magnitude,angle:degrees};
    });
    insert(loads,replace.checked);status.textContent='Fuerzas colocadas a '+worksheetNumber(x,'mm')+'.';
  });
  return details;
}
