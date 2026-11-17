'use strict';

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
  if(!log.length) return result.entries;
  return [...result.entries,{type:'section',value:'Bitácora de decisiones'},...log];
}

function dataTex({headers,rows},escape) {
  const header=headers.map(value=>'\\textbf{'+escape(value)+'}').join(' & ')+' \\\\ \\hline';
  const body=rows.map(row=>row.map(escape).join(' & ')+' \\\\');
  return ['\\begin{longtable}{@{}p{.54\\linewidth}p{.40\\linewidth}@{}}',
    '\\hline',header,'\\endfirsthead','\\hline',header,'\\endhead',
    '\\hline','\\endfoot',...body,'\\end{longtable}'].join('\n');
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

function tex(entries, subject = 'Prensa mecánica') {
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
    '\\title{Memoria de cálculo · ' + escape(subject) + '}',
    '\\author{}',
    '\\date{}',
    '\\begin{document}',
    '\\maketitle',
    ...entries.map(({type, value}) => {
      if (type === 'diagram') return diagramTex(value,escape);
      if (type === 'decision') return decisionTex(value,escape);
      if (type === 'data') return dataTex(value,escape);
      if (type === 'eq') {
        return '\\[\n' + formatEquation(value) + '\n\\]';
      }
      const command = {section:'section', heading:'subsection*', iteration:'subsubsection*'}[type];
      return command ? '\\' + command + '{' + escape(value) + '}' : escape(value) + '\n';
    }),
    '\\end{document}', ''
  ].join('\n\n');
}
