'use strict';

const moduleNav=document.querySelector('#modules');
const workspace=document.querySelector('#workspace');
const catalogsView=document.querySelector('#catalogos');
const form=document.querySelector('#proposal-form');
const fieldsHost=document.querySelector('#fields');
const shaftHost=document.querySelector('#shaft-inputs');
const materialDetails=document.querySelector('#material-properties');
const materialHost=document.querySelector('#material-cards');
const resultStatus=document.querySelector('#result-status');
const resultsHost=document.querySelector('#results');
const decisionSection=document.querySelector('#bitacora');
const decisionsHost=document.querySelector('#decision-log');
const development=document.querySelector('#desarrollo');
const worksheetTitle=document.querySelector('#worksheet-title');
const memoryHost=document.querySelector('#memory');
const historyHost=document.querySelector('#run-history');
const runList=document.querySelector('#run-list');
const home=document.querySelector('#inicio');
const loader=document.querySelector('#problem-loader');
const problemChoice=document.querySelector('#problem-choice');
const texButton=document.querySelector('#download');
const pdfButton=document.querySelector('#download-pdf');
const includeRunsOption=document.querySelector('#include-runs-option');
const includeRuns=document.querySelector('#include-runs');
const exportStatus=document.querySelector('#export-status');
const notebookExercises={
  engranes:calculateNotebookGears,
  banda:calculateNotebookBelt,
  flecha:calculateNotebookShaft,
  equilibrio:calculateNotebookBalance,
  rodamientos:calculateNotebookBearings,
  resorte:calculateNotebookSpring,
  potencia:calculateNotebookPower
};
const moduleCases={
  engranes:['Calcular el ancho de cara y verificar los dientes.','Transmisión de engranes de 100 hp'],
  banda:['Calcular el ancho y la tensión de los ramales.','Selección de una banda plana'],
  flecha:['Calcular el diámetro por fatiga y fluencia.','Rediseño de una flecha escalonada'],
  equilibrio:['Obtener reacciones, cortantes y momentos.','Flecha con carga puntual'],
  rodamientos:['Seleccionar un rodamiento por carga y vida.','Rodamiento con cargas radial y axial'],
  resorte:['Dimensionar el alambre y comprobar los ganchos.','Resorte de compresión'],
  potencia:['Relacionar torque, velocidad y potencia.','Potencia transmitida por una banda']
};
const states=new Map();
let activeKey='engranes';
let pdfInProgress=false;

function node(tag, text, className) {
  const element=document.createElement(tag);
  if(text!=null) element.textContent=text;
  if(className) element.className=className;
  return element;
}

function example(component) {
  return Object.fromEntries(component.groups.flatMap(([,fields])=>fields.map(([name,,value])=>[name,value])));
}

function stateFor(key) {
  if(!states.has(key)) states.set(key,{values:example(components[key]),result:null,runs:[],
    shaft:key==='flecha'?structuredClone(shaftInputDefaults):undefined});
  return states.get(key);
}

function inputValues() {
  return Object.fromEntries(new FormData(form));
}

function numericValues(values) {
  return Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value===''?NaN:Number(value)]));
}

function renderFields(component, values) {
  const groups=component.groups.map(([title,rows,hint])=>{
    const box=node('fieldset');
    const grid=node('div',null,'field-grid');
    box.append(node('legend',title),grid);
    for(const [name,label,initial,options] of rows){
      const field=node('label',label);
      let control;
      if(options){
        control=node('select');
        options.forEach((item,index)=>{
          const [value,text]=Array.isArray(item)?item:[index,item];
          control.add(new Option(text,value));
        });
      }else{
        control=node('input');
        Object.assign(control,{type:'number',step:'any',required:true});
      }
      Object.assign(control,{name,value:values[name]??initial});
      field.append(control);
      grid.append(field);
    }
    if(hint) box.append(node('p',hint,'field-hint'));
    return box;
  });
  fieldsHost.replaceChildren(...groups);
}

function toggleShaftMoment(shaft) {
  const control=form.elements.namedItem('moment');
  const fromForces=shaft.mode==='forces';
  control.disabled=fromForces;
  control.closest('label').hidden=fromForces;
}

function renderProposal(component,state) {
  renderFields(component,state.values);
  shaftHost.hidden=!state.shaft;
  shaftHost.replaceChildren();
  if(!state.shaft) return;
  const sources=['engranes','banda'].flatMap(key=>(states.get(key)?.runs||[])
    .filter(({result})=>result.shaftForces&&!result.error)
    .map(({result})=>({title:components[key].nav+' · corrida '+result.run,...result.shaftForces})));
  createShaftInputPanel(shaftHost,state.shaft,shaft=>{
    state.shaft=shaft;
    toggleShaftMoment(shaft);
    updateProposal(state);
  },sources);
  toggleShaftMoment(state.shaft);
}

function updateProposal(state) {
  state.values={...state.values,...inputValues()};
  if(state.result){
    state.result=null;
    exportStatus.textContent='';
    renderResults(null);
    renderRunHistory(state);
  }
  renderMaterial(components[activeKey],state);
}

function renderMaterial(component, state) {
  const cards=stageMaterial(component.materialStage,numericValues(state.values),state.result);
  materialDetails.hidden=!cards.length;
  materialHost.replaceChildren();
  for(const {title,source,rows,note} of cards){
    const card=node('section',null,'material-card');
    const list=node('dl',null,'material-grid');
    for(const [label,value] of rows){
      const item=node('div');
      item.append(node('dt',label),node('dd',value));
      list.append(item);
    }
    card.append(node('h4',title),node('p',source),list);
    if(note) card.append(node('p',note));
    materialHost.append(card);
  }
}

function renderDecisions(decisions) {
  decisionSection.hidden=!decisions.length;
  const cards=decisions.map(({title,summary,trials})=>{
    const card=node('article',null,'decision-card');
    const heading=node('div',null,'decision-heading');
    heading.append(node('h4',title));
    card.append(heading);
    if(summary) card.append(node('p',summary));
    if(!trials.length) return card;
    const frame=node('div',null,'decision-trials');
    const table=node('table');
    table.setAttribute('aria-label',title);
    const head=table.createTHead().insertRow();
    for(const label of ['Medida','Resultado','Motivo']){
      const cell=node('th',label);
      cell.scope='col';
      head.append(cell);
    }
    const body=table.createTBody();
    for(const {measure,status,reason} of trials){
      const row=body.insertRow();
      row.dataset.status=status;
      row.insertCell().textContent=measure;
      const tag=node('span',decisionLabels[status],'trial-status');
      tag.dataset.status=status;
      row.insertCell().append(tag);
      row.insertCell().textContent=reason;
    }
    frame.append(table);
    card.append(frame);
    return card;
  });
  decisionsHost.replaceChildren(...cards);
}

function worksheetTable({headers,rows}) {
  const frame=node('div',null,'worksheet-table');
  const table=node('table');
  const head=table.createTHead().insertRow();
  for(const label of headers){
    const cell=node('th',label);
    cell.scope='col';
    head.append(cell);
  }
  const body=table.createTBody();
  for(const values of rows){
    const row=body.insertRow();
    for(const value of values) row.insertCell().textContent=value;
  }
  frame.append(table);
  return frame;
}

function renderMemory(entries) {
  memoryHost.replaceChildren();
  let step=memoryHost;
  let target=memoryHost;
  for(const {type,value} of entries){
    if(type==='section') continue;
    if(type==='heading'){
      step=node('section',null,'worksheet-step');
      step.append(node('h4',value));
      memoryHost.append(step);
      target=step;
    }else if(type==='iteration'){
      target=node('div',null,'iteration');
      target.append(node('h5',value));
      step.append(target);
    }else if(type==='data'){
      target.append(worksheetTable(value));
    }else if(type==='diagram'){
      const figure=node('figure',null,'design-diagram');
      const canvas=node('canvas');
      canvas.width=840;
      canvas.height=250;
      canvas.setAttribute('role','img');
      canvas.setAttribute('aria-label',value.title+'. '+value.caption);
      figure.append(node('h5',value.title),canvas,node('figcaption',value.caption));
      target.append(figure);
      paintDiagram(canvas,value);
    }else if(type==='eq'){
      const element=node('div',null,'eq');
      if(window.katex) window.katex.render(formatEquation(value),element,{displayMode:true,throwOnError:false});
      else element.textContent=value;
      target.append(element);
    }else{
      target.append(node('p',plainNumberNotation(value),type==='note'?'note':''));
    }
  }
}

function updateDownloads() {
  const state=states.get(activeKey);
  const available=Boolean(state?.result?.entries.length);
  includeRunsOption.hidden=!available||state.result.notebook||state.runs.length<2;
  texButton.disabled=!available;
  pdfButton.disabled=!available||pdfInProgress;
}

function renderResults(result) {
  resultsHost.replaceChildren();
  resultStatus.textContent='';
  resultStatus.dataset.status='';
  updateDownloads();
  development.hidden=!result;
  development.classList.toggle('worksheet-class',Boolean(result?.notebook));
  renderDecisions(result?.decisions||[]);
  if(!result){
    resultsHost.append(node('p','Pulsa Calcular para ver las dimensiones y comprobaciones de este componente.'));
    memoryHost.replaceChildren();
    return;
  }
  worksheetTitle.textContent=result.notebook?result.entries[0].value:
    'Corrida '+result.run+' · '+components[activeKey].title;
  if(result.error){
    resultStatus.textContent=result.nonconvergence?'No convergió':'Revisar datos';
    resultStatus.dataset.status='error';
    resultsHost.append(node('p',plainNumberNotation(result.error),'note'));
  }else{
    resultStatus.textContent=result.notebook?'Caso resuelto':'Calculado';
    const list=node('dl',null,'result-metrics');
    for(const [title,value,unit,digits=3] of result.metrics){
      const item=node('div');
      const formatted=worksheetNumber(value,unit,digits);
      item.append(node('dt',title),node('dd',formatted));
      list.append(item);
    }
    resultsHost.append(list);
    for(const entry of result.entries){
      if(entry.type==='note') resultsHost.append(node('p',plainNumberNotation(entry.value),'note'));
    }
  }
  renderMemory(result.entries);
}

function showWorksheet() {
  development.scrollIntoView({block:'start'});
  worksheetTitle.focus({preventScroll:true});
}

function renderRunHistory(state) {
  historyHost.hidden=!state.runs.length;
  const buttons=state.runs.map(run=>{
    const button=node('button','Corrida '+run.result.run,'secondary');
    button.type='button';
    button.setAttribute('aria-pressed',String(run.result===state.result));
    button.append(node('small',run.result.nonconvergence?'No convergió':run.result.error?'Revisar datos':runSummary(run.result)));
    button.addEventListener('click',()=>{
      state.values={...run.values};
      if(run.shaft) state.shaft=structuredClone(run.shaft);
      state.result=run.result;
      exportStatus.textContent='';
      renderProposal(components[activeKey],state);
      renderMaterial(components[activeKey],state);
      renderResults(state.result);
      renderRunHistory(state);
      showWorksheet();
    });
    return button;
  });
  runList.replaceChildren(...buttons);
}

function renderCatalogs() {
  const host=document.querySelector('#catalog-tables');
  for(const {label,columns,rows} of referenceTables){
    const details=node('details');
    const frame=node('div',null,'table-wrap');
    const table=node('table');
    table.setAttribute('aria-label',label);
    const head=table.createTHead().insertRow();
    for(const column of columns){
      const cell=node('th',column);
      cell.scope='col';
      head.append(cell);
    }
    const body=table.createTBody();
    for(const values of rows){
      const row=body.insertRow();
      for(const value of values) row.insertCell().textContent=value??'—';
    }
    frame.append(table);
    details.append(node('summary',label),frame);
    host.append(details);
  }
}

function openModule() {
  const hash=location.hash.slice(1);
  const requested=hash==='catalogos'||Object.hasOwn(components,hash)?hash:'inicio';
  catalogsView.hidden=requested!=='catalogos';
  home.hidden=requested!=='inicio';
  document.querySelector('.workbench').classList.toggle('solver-home',!home.hidden);
  workspace.hidden=!home.hidden||requested==='catalogos';
  for(const link of document.querySelectorAll('[data-module]')){
    if(link.dataset.module===requested) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  if(workspace.hidden) return;
  activeKey=requested;
  const component=components[activeKey];
  const state=stateFor(activeKey);
  document.querySelector('#module-type').textContent=component.type;
  document.querySelector('#module-title').textContent=component.title;
  document.querySelector('#module-description').textContent=component.description;
  exportStatus.textContent='';
  materialDetails.open=false;
  renderProposal(component,state);
  renderMaterial(component,state);
  renderResults(state.result);
  renderRunHistory(state);
}

const editableCases=node('optgroup'), solvedCases=node('optgroup');
editableCases.label='Problemas editables';
solvedCases.label='Casos resueltos';
for(const [key,component] of Object.entries(components)){
  const link=node('a',component.nav,'module-link');
  link.href='#'+key;
  link.dataset.module=key;
  moduleNav.append(link);
  const [description,caseName]=moduleCases[key];
  const card=node('a');
  card.href='#'+key;
  card.append(node('strong',component.title),node('span',description));
  document.querySelector('#component-grid').append(card);
  editableCases.append(new Option(component.title,'edit/'+key));
  solvedCases.append(new Option(caseName,'case/'+key));
}
problemChoice.append(editableCases,solvedCases);
renderCatalogs();

document.querySelector('.skip').addEventListener('click',event=>{
  event.preventDefault();
  document.querySelector('#contenido').focus();
});
window.addEventListener('hashchange',openModule);
window.addEventListener('DOMContentLoaded',openModule);

form.addEventListener('input',event=>{
  if(!shaftHost.contains(event.target)) updateProposal(stateFor(activeKey));
});

function resetProblem(key){
  const state=stateFor(key);
  state.values=example(components[key]);
  if(state.shaft) state.shaft=structuredClone(shaftInputDefaults);
  state.result=null;
}
document.querySelector('#reset').addEventListener('click',()=>{
  resetProblem(activeKey);
  openModule();
});

form.addEventListener('submit',event=>{
  event.preventDefault();
  const component=components[activeKey];
  const state=stateFor(activeKey);
  state.values={...state.values,...inputValues()};
  if(!state.result||state.result.notebook){
    const values=numericValues(inputValues());
    const shaft=state.shaft?structuredClone(state.shaft):undefined;
    const inputs=shaft?{...numericValues({length:shaft.length,supportA:shaft.supportA,supportB:shaft.supportB}),
      mode:shaft.mode,loads:shaft.loads.map(({x,fy,fz,...origin})=>({...origin,...numericValues({x,fy,fz})}))}:undefined;
    state.result={...calculateComponent(component,values,inputs),run:state.runs.length+1};
    state.runs.push({values:{...state.values},shaft,result:state.result});
  }
  exportStatus.textContent='';
  renderMaterial(component,state);
  renderResults(state.result);
  renderRunHistory(state);
  showWorksheet();
});

function describeProblem(){
  const editable=problemChoice.value.startsWith('edit/');
  document.querySelector('#load-hint').textContent=editable
    ?'Carga los valores iniciales en el formulario. Podrás editarlos y conservarás tus corridas anteriores.'
    :'Abre la memoria de este caso con sus datos, ecuaciones y diagramas.';
  document.querySelector('#apply-problem').textContent=editable?'Cargar datos':'Ver resolución';
}
document.querySelector('#open-loader').addEventListener('click',()=>{
  problemChoice.value='edit/'+(workspace.hidden?'engranes':activeKey);
  describeProblem();
  loader.showModal();
  problemChoice.focus();
});
document.querySelector('#close-loader').addEventListener('click',()=>loader.close());
problemChoice.addEventListener('change',describeProblem);
document.querySelector('#problem-picker').addEventListener('submit',event=>{
  event.preventDefault();
  const [mode,key]=problemChoice.value.split('/');
  const solved=mode==='case';
  if(solved) stateFor(key).result={...notebookExercises[key](),notebook:true};
  else resetProblem(key);
  loader.close();
  const focusProblem=()=>{
    if(solved) showWorksheet();
    else document.querySelector('#input-title').focus();
  };
  if(location.hash==='#'+key){
    openModule();
    focusProblem();
  }else{
    window.addEventListener('hashchange',focusProblem,{once:true});
    location.hash=key;
  }
});

document.querySelector('#result-jump').addEventListener('click',()=>document.querySelector('#result-title').focus());
document.querySelector('#input-jump').addEventListener('click',()=>document.querySelector('#input-title').focus());

function saveDocument(blob, filename) {
  const url=URL.createObjectURL(blob);
  const link=node('a');
  link.href=url;
  link.download=filename;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

function prepareReport(key,extension) {
  const {result,runs}=stateFor(key);
  if(!result) return null;
  const all=!result.notebook&&runs.length>1&&includeRuns.checked;
  const title=components[key].title;
  const variant=all?'_corridas':result.notebook?'_libreta':result.run>1?'_corrida_'+result.run:'';
  return {
    entries:all?reportSession(runs):reportEntries(result),
    subject:all?'Corridas · '+title:result.notebook?result.entries[0].value:'Corrida '+result.run+' · '+title,
    filename:'memoria_'+key+variant+(!all&&result.error?'_revision':'')+'.'+extension
  };
}

texButton.addEventListener('click',()=>{
  const report=prepareReport(activeKey,'tex');
  if(!report) return;
  const source=tex(report.entries,report.subject);
  saveDocument(new Blob([source],{type:'application/x-tex;charset=utf-8'}),report.filename);
});

pdfButton.addEventListener('click',async()=>{
  const key=activeKey;
  const report=prepareReport(key,'pdf');
  if(!report||pdfInProgress) return;
  pdfInProgress=true;
  updateDownloads();
  exportStatus.textContent='Preparando PDF…';
  try{
    const pdf=await buildMemoryPdf(report.entries,formatEquation,(count,total)=>{
      if(activeKey===key) exportStatus.textContent='Generando PDF… '+Math.floor(100*count/total)+' %';
    },report.subject);
    saveDocument(pdf,report.filename);
    if(activeKey===key) exportStatus.textContent='PDF listo.';
  }catch(error){
    if(activeKey===key) exportStatus.textContent=error.message||'No se pudo generar el PDF.';
  }finally{
    pdfInProgress=false;
    updateDownloads();
  }
});
