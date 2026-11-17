'use strict';

const moduleNav=document.querySelector('#modules');
const workspace=document.querySelector('#workspace');
const catalogsView=document.querySelector('#catalogos');
const form=document.querySelector('#proposal-form');
const fieldsHost=document.querySelector('#fields');
const materialDetails=document.querySelector('#material-properties');
const materialHost=document.querySelector('#material-cards');
const resultStatus=document.querySelector('#result-status');
const resultsHost=document.querySelector('#results');
const decisionSection=document.querySelector('#bitacora');
const decisionsHost=document.querySelector('#decision-log');
const development=document.querySelector('#desarrollo');
const memoryHost=document.querySelector('#memory');
const texButton=document.querySelector('#download');
const pdfButton=document.querySelector('#download-pdf');
const exportStatus=document.querySelector('#export-status');
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
  if(!states.has(key)) states.set(key,{values:example(components[key]),result:null});
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

function renderMemory(entries) {
  memoryHost.replaceChildren();
  let target=memoryHost;
  for(const {type,value} of entries){
    if(type==='section'){
      target=memoryHost;
      continue;
    }
    if(type==='diagram'){
      const figure=node('figure',null,'design-diagram');
      const canvas=node('canvas');
      canvas.width=840;
      canvas.height=250;
      canvas.setAttribute('role','img');
      canvas.setAttribute('aria-label',value.title+'. '+value.caption);
      figure.append(node('h3',value.title),canvas,node('figcaption',value.caption));
      memoryHost.append(figure);
      paintDiagram(canvas,value);
      continue;
    }
    if(type==='heading'){
      target=memoryHost;
    }else if(type==='iteration'){
      target=node('div',null,'iteration');
      memoryHost.append(target);
    }
    if(type==='eq'){
      const element=node('div',null,'eq');
      if(window.katex) window.katex.render(formatEquation(value),element,{displayMode:true,throwOnError:false});
      else element.textContent=value;
      target.append(element);
    }else{
      const tag=type==='heading'?'h3':type==='iteration'?'h4':'p';
      target.append(node(tag,plainNumberNotation(value),type==='note'?'note':''));
    }
  }
}

function updateDownloads() {
  const entries=states.get(activeKey)?.result?.entries;
  const available=Boolean(entries?.length);
  texButton.disabled=!available;
  pdfButton.disabled=!available||pdfInProgress;
}

function renderResults(result) {
  resultsHost.replaceChildren();
  resultStatus.textContent='';
  resultStatus.dataset.status='';
  updateDownloads();
  development.hidden=!result;
  renderDecisions(result?.decisions||[]);
  if(!result){
    resultsHost.append(node('p','Pulsa Calcular para ver las dimensiones y comprobaciones de este componente.'));
    memoryHost.replaceChildren();
    return;
  }
  if(result.error){
    resultStatus.textContent='Revisar datos';
    resultStatus.dataset.status='error';
    resultsHost.append(node('p',plainNumberNotation(result.error),'note'));
  }else{
    resultStatus.textContent='Calculado';
    const list=node('dl',null,'result-metrics');
    for(const [title,value,unit,digits=3] of result.metrics){
      const item=node('div');
      const formatted=plainNumberNotation(number(value,digits))+(unit?' '+unit:'');
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
  const requested=hash==='catalogos'||Object.hasOwn(components,hash)?hash:'engranes';
  catalogsView.hidden=requested!=='catalogos';
  workspace.hidden=requested==='catalogos';
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
  development.open=false;
  renderFields(component,state.values);
  renderMaterial(component,state);
  renderResults(state.result);
}

for(const [key,component] of Object.entries(components)){
  const link=node('a',component.nav,'module-link');
  link.href='#'+key;
  link.dataset.module=key;
  moduleNav.append(link);
}
renderCatalogs();

document.querySelector('.skip').addEventListener('click',event=>{
  event.preventDefault();
  document.querySelector('#contenido').focus();
});
window.addEventListener('hashchange',openModule);
window.addEventListener('DOMContentLoaded',openModule);

form.addEventListener('input',()=>{
  const state=stateFor(activeKey);
  state.values=inputValues();
  if(state.result){
    state.result=null;
    exportStatus.textContent='';
    renderResults(null);
  }
  renderMaterial(components[activeKey],state);
});

document.querySelector('#reset').addEventListener('click',()=>{
  const state=stateFor(activeKey);
  state.values=example(components[activeKey]);
  state.result=null;
  openModule();
});

form.addEventListener('submit',event=>{
  event.preventDefault();
  const component=components[activeKey];
  const state=stateFor(activeKey);
  state.values=inputValues();
  state.result=calculateComponent(component,numericValues(state.values));
  exportStatus.textContent='';
  renderMaterial(component,state);
  renderResults(state.result);
  development.open=Boolean(state.result.error);
  document.querySelector('#result-title').focus();
});

function saveDocument(blob, filename) {
  const url=URL.createObjectURL(blob);
  const link=node('a');
  link.href=url;
  link.download=filename;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

function filename(key,result,extension) {
  return 'memoria_'+key+(result.error?'_revision':'')+'.'+extension;
}

texButton.addEventListener('click',()=>{
  const {result}=stateFor(activeKey);
  if(!result) return;
  const source=tex(reportEntries(result),components[activeKey].title);
  saveDocument(new Blob([source],{type:'application/x-tex;charset=utf-8'}),filename(activeKey,result,'tex'));
});

pdfButton.addEventListener('click',async()=>{
  const key=activeKey;
  const {result}=stateFor(key);
  if(!result||pdfInProgress) return;
  pdfInProgress=true;
  updateDownloads();
  exportStatus.textContent='Preparando PDF…';
  try{
    const pdf=await buildMemoryPdf(reportEntries(result),formatEquation,(count,total)=>{
      if(activeKey===key) exportStatus.textContent='Generando PDF… '+Math.floor(100*count/total)+' %';
    },components[key].title);
    saveDocument(pdf,filename(key,result,'pdf'));
    if(activeKey===key) exportStatus.textContent='PDF listo.';
  }catch(error){
    if(activeKey===key) exportStatus.textContent=error.message||'No se pudo generar el PDF.';
  }finally{
    pdfInProgress=false;
    updateDownloads();
  }
});
