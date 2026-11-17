'use strict';

let pdfTools;

function loadPdfScript(url, integrity) {
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=url;
    script.integrity=integrity;
    script.crossOrigin='anonymous';
    script.onload=resolve;
    script.onerror=()=>{
      script.remove();
      reject(new Error('No se pudo cargar el generador de PDF. Comprueba tu conexión e inténtalo de nuevo.'));
    };
    document.head.append(script);
  });
}

function getPdfTools() {
  if (!pdfTools) {
    window.MathJax={startup:{typeset:false},svg:{fontCache:'none'}};
    pdfTools=Promise.all([
      window.jspdf || loadPdfScript('https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js',
        'sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3'),
      loadPdfScript('https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js',
        'sha384-KKWa9jJ1MZvssLeOoXG6FiOAZfAgmzsIIfw8BXwI9+kYm0lPCbC6yTQPBC00F1/L')
    ]).then(()=>window.MathJax.startup.promise).catch(error=>{
      pdfTools=undefined;
      throw error;
    });
  }
  return pdfTools;
}

async function equationImage(tex, maxWidth, maxHeight) {
  const rendered=await window.MathJax.tex2svgPromise(tex,{display:true});
  const svg=rendered.querySelector('svg');
  const invalid=rendered.querySelector('[data-mjx-error]');
  if (invalid || !svg) throw new Error('No se pudo componer una ecuación para el PDF.');
  const [, , w,h]=svg.getAttribute('viewBox').trim().split(/\s+/).map(Number);
  if(!(w>0&&h>0)) throw new Error('Una ecuación tiene dimensiones inválidas.');
  const scale=Math.min(.0115,maxWidth/w,maxHeight/h);
  const width=w*scale,height=h*scale;
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(width*3);
  canvas.height=Math.ceil(height*3);
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  svg.setAttribute('width',String(canvas.width));
  svg.setAttribute('height',String(canvas.height));
  svg.setAttribute('color','#202c26');
  const xml=new XMLSerializer().serializeToString(svg);
  const url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml;charset=utf-8'}));
  try {
    const image=new Image();
    image.src=url;
    await image.decode();
    const context=canvas.getContext('2d');
    context.fillStyle='#ffffff';
    context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(image,0,0,canvas.width,canvas.height);
    return {canvas,width,height};
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function buildMemoryPdf(entries,format,onProgress) {
  await getPdfTools();
  const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'pt',format:'a4',compress:true});
  pdf.setProperties({title:'Memoria de cálculo de la prensa mecánica',subject:'Sustituciones, iteraciones, decisiones y diagramas',language:'es'});
  const pageWidth=pdf.internal.pageSize.getWidth(), pageHeight=pdf.internal.pageSize.getHeight();
  const margin=46, width=pageWidth-2*margin, bottom=pageHeight-53;
  let y=54;

  function ensureRoom(height){
    if(y+height<=bottom) return;
    pdf.addPage();
    y=54;
  }

  const printText=value=>plainNumberNotation(value).replace(/₂/g,'2').replace(/ᵢ/g,'i');

  function paragraph(value,{size=10.5,bold=false,color='#202c26',gap=7,keep=0}={}){
    pdf.setFont('helvetica',bold?'bold':'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    const lineHeight=size*1.28;
    const lines=pdf.splitTextToSize(printText(value),width);
    ensureRoom(lines.length*lineHeight+gap+keep);
    for(const line of lines){
      ensureRoom(lineHeight);
      pdf.text(line,margin,y,{baseline:'top'});
      y+=lineHeight;
    }
    y+=gap;
  }

  function decisionTable({title,trials,summary}){
    const labels={selected:'Seleccionada',viable:'Viable',rejected:'Descartada'};
    const size=9.5, lineHeight=12, horizontalPad=8, verticalPad=6;
    const columns=[width*.20,width*.20,width*.60];

    function measureRow(values,bold=false){
      pdf.setFont('helvetica',bold?'bold':'normal');
      pdf.setFontSize(size);
      const cells=values.map((value,i)=>pdf.splitTextToSize(printText(value),columns[i]-2*horizontalPad));
      const height=Math.max(...cells.map(lines=>lines.length))*lineHeight+2*verticalPad;
      return {cells,bold,height};
    }

    function drawRow({cells,bold,height},fill){
      pdf.setFillColor(fill);
      pdf.setDrawColor('#ccd8d1');
      pdf.setLineWidth(.45);
      pdf.rect(margin,y,width,height,'FD');
      pdf.setFont('helvetica',bold?'bold':'normal');
      pdf.setFontSize(size);
      pdf.setTextColor('#202c26');
      let x=margin;
      cells.forEach((lines,i)=>{
        if(i>0) pdf.line(x,y,x,y+height);
        lines.forEach((line,j)=>pdf.text(line,x+horizontalPad,y+verticalPad+j*lineHeight,{baseline:'top'}));
        x+=columns[i];
      });
      y+=height;
    }

    const titleStyle={bold:true,size:12,gap:6,color:'#21594c'};
    if(!trials.length){
      paragraph(title,{...titleStyle,keep:24});
      paragraph(summary||'La corrida no llegó a probar una medida.');
      return;
    }

    const header=measureRow(['Medida','Resultado','Motivo'],true);
    const rows=trials.map(({measure,reason,status})=>{
      const selected=status==='selected';
      return {row:measureRow([measure,labels[status],reason],selected),fill:selected?'#eaf5ee':'#ffffff'};
    });
    paragraph(title,{...titleStyle,keep:header.height+rows[0].row.height});
    drawRow(header,'#edf2ee');
    for(const {row,fill} of rows){
      if(y+row.height>bottom){
        ensureRoom(row.height);
        paragraph(title+' · continuación',{...titleStyle,keep:header.height+row.height});
        drawRow(header,'#edf2ee');
      }
      drawRow(row,fill);
    }
    y+=9;
    if(summary) paragraph(summary,{size:9.5,color:'#4e655b'});
  }

  function vectorDiagram(diagram){
    const scale=Math.min(1.1,width/420);
    const pictureHeight=125*scale;
    const ends=pdf.splitTextToSize(diagram.caption,width);
    ensureRoom(pictureHeight+85+ends.length*14);
    paragraph(diagram.title,{bold:true,size:12,gap:8});
    const left=(pageWidth-420*scale)/2, top=y;
    const px=x=>left+x*scale, py=z=>top+(125-z)*scale;
    pdf.setDrawColor('#21594c');
    pdf.setTextColor('#202c26');
    pdf.setLineWidth(1);
    pdf.setFont('helvetica','normal');
    pdf.setFontSize(9);
    for(const [kind,x,z,a,b] of diagram.marks){
      if(kind==='line') pdf.line(px(x),py(z),px(a),py(b));
      else if(kind==='circle') pdf.circle(px(x),py(z),a*scale);
      else pdf.text(a,px(x),py(z),{align:'center',baseline:'middle'});
    }
    y+=pictureHeight+4;
    paragraph(diagram.caption,{size:9,color:'#4e655b',gap:14});
  }

  paragraph('Memoria de cálculo',{bold:true,size:27,gap:4});
  paragraph('Prensa mecánica',{bold:true,size:18,gap:15,color:'#21594c'});
  for(const [index,{type,value}] of entries.entries()){
    if(index%15===0) onProgress(index,entries.length);
    if(type==='eq'){
      const {canvas,width:w,height:h}=await equationImage(format(value),width-16,bottom-70);
      ensureRoom(h+14);
      pdf.addImage(canvas,'PNG',margin+7,y+2,w,h,undefined,'FAST');
      y+=h+8;
    }else if(type==='diagram'){
      vectorDiagram(value);
    }else if(type==='decision'){
      decisionTable(value);
    }else if(type==='section'){
      if(index>0&&y>54) pdf.addPage();
      if(index>0) y=54;
      pdf.outline.add(null,value,{pageNumber:pdf.getNumberOfPages()});
      paragraph(value,{bold:true,size:17,gap:12,color:'#21594c',keep:42});
    }else if(type==='heading'||type==='iteration'){
      paragraph(value,{bold:true,size:12,gap:6,color:'#21594c',keep:34});
    }else{
      paragraph(value,{color:type==='note'?'#674922':'#202c26'});
    }
  }

  const pages=pdf.getNumberOfPages();
  for(let i=1;i<=pages;i++){
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor('#4e655b');
    pdf.setFont('helvetica','normal');
    pdf.text('Prensa mecánica',margin,pageHeight-30);
    pdf.text(i+' / '+pages,pageWidth-margin,pageHeight-30,{align:'right'});
  }
  return pdf.output('blob');
}
