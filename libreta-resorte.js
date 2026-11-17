'use strict';

function calculateNotebookSpring() {
  const {entries,decisions,add,check,decision,trial}=createCalculationTrace();
  const heading=value=>add('heading',value);
  const text=value=>add('text',value);
  const eq=value=>add('eq',value);
  const n=number;
  const mm=value=>display(value,'mm',4);
  const wire=springWires.find(value=>value.name.startsWith('ASTM A228'));
  check(wire,'Falta la fila ASTM A228 de las tablas 10-4 y 10-5.');
  const fmin=120, fmax=400, deflectionLimit=12, index=8, targetSafety=2, seed=(wire.min+wire.max)/2;
  const tensileYield=.75, shearRatio=.577, shearYieldRatio=tensileYield*shearRatio;
  const Ks=(2*index+1)/(2*index);
  const stressConstant=8*fmax*index*Ks/Math.PI;
  const stiffness=fmax/deflectionLimit;
  const safetyAt=d=>shearYieldRatio*wire.A*d**(2-wire.m)/stressConstant;

  add('section','Ejercicio de la libreta · Resorte de compresión');
  heading('Enunciado y datos');
  text('Diseñar un resorte de compresión que trabaje de 120 a 400 N con una deformación máxima de 12 mm. La p. 52 mide la deformación máxima desde la posición libre y usa la fuerza máxima para calcular la rigidez.');
  add('data',{headers:['Dato','Valor usado'],rows:[
    ['Fuerzas de trabajo',fmin+' a '+fmax+' N'],
    ['Deformación máxima desde la posición libre',deflectionLimit+' mm'],
    ['Material de la tabla 10-4',wire.name],
    ['Índice del resorte propuesto',String(index)],
    ['Factor de seguridad estático',String(targetSafety)],
    ['Intervalo tabulado del alambre',n(wire.min)+' a '+n(wire.max)+' mm']
  ]});
  text('Fuente: libreta de Diseño de Elementos de Máquinas, pp. 48–52, y tablas de resortes 10-4 y 10-5.');
  add('diagram',{
    title:'Croquis del resorte de compresión',
    caption:'D es el diámetro medio de la hélice y d el del alambre. La recta representa el modelo lineal desde la posición libre.',
    marks:[
      ['line',42,99,156,99],['line',42,25,156,25],
      ['line',99,99,99,92],['line',99,92,132,85],['line',132,85,66,76],
      ['line',66,76,132,67],['line',132,67,66,58],['line',66,58,132,49],
      ['line',132,49,66,40],['line',66,40,99,32],['line',99,32,99,25],
      ['line',99,121,99,103],['line',99,103,94,109],['line',99,103,104,109],
      ['line',99,5,99,21],['line',99,21,94,15],['line',99,21,104,15],
      ['label',117,114,'F'],['label',116,10,'F'],
      ['line',66,55,66,44],['line',132,55,132,44],['line',66,46,132,46],
      ['label',98,53,'D'],['label',149,67,'d'],
      ['line',236,24,374,24],['line',236,24,236,113],
      ['line',236,24,358,99],['line',358,24,358,99],['line',236,99,358,99],
      ['circle',272.6,46.5,2],['line',236,46.5,272.6,46.5],
      ['label',208,99,'400 N'],['label',208,46.5,'120 N'],
      ['label',358,13,'12 mm'],['label',240,117,'Carga'],['label',300,5,'Deformación']
    ]
  });

  heading('Modelo estático y datos del alambre');
  text('La p. 50 incluye torsión y cortante directo. Las pp. 51–52 estiman la fluencia en torsión con la aproximación de von Mises y el valor superior de fluencia en tensión de la fila A228.');
  eq(math`C=\frac{D}{d}=${index};\quad K_s=1+\frac{1}{2C}=1+\frac{1}{2(${index})}=${n(Ks,5)}`);
  eq(math`\tau_{\max}=K_s\frac{8F_{\max}D}{\pi d^3}=\frac{8F_{\max}CK_s}{\pi d^2}=\frac{8(${fmax})(${index})(${n(Ks,5)})}{\pi d^2}`);
  eq(math`S_{ut}=\frac{A}{d^m}=\frac{${n(wire.A)}}{d^{${n(wire.m)}}};\quad S_{sy}=${n(shearRatio)}(${n(tensileYield)})S_{ut}=${n(shearYieldRatio,5)}S_{ut}`);
  eq(math`d_{\mathrm{inicio}}=\frac{d_{\mathrm{inferior}}+d_{\mathrm{superior}}}{2}=\frac{${n(wire.min)}+${n(wire.max)}}{2}=${mm(seed)}`);

  heading('Corridas del diámetro');
  const diameterDecision=decision(7,'Diámetro del alambre','mm',
    'La libreta compara el diámetro calculado con el supuesto y detiene la iteración cuando la diferencia es menor a 5 %. La fluencia se verifica al final con el diámetro usado.');
  let assumed=seed, error=Infinity;
  for(let run=1;run<=100&&error>=5;run++){
    const sut=wire.A/assumed**wire.m;
    const shearYield=shearYieldRatio*sut;
    const computed=Math.sqrt(targetSafety*stressConstant/shearYield);
    error=100*Math.abs(computed-assumed)/assumed;
    const staticSafety=safetyAt(computed);
    add('iteration','Corrida '+run+' · diámetro supuesto '+n(assumed,4)+' mm');
    eq(math`S_{ut}=\frac{${n(wire.A)}}{(${n(assumed,6)})^{${n(wire.m)}}}=${display(sut,'MPa',4)}`);
    eq(math`S_{sy}=(${n(shearRatio)})(${n(tensileYield)})(${n(sut,6)})=${display(shearYield,'MPa',4)}`);
    eq(math`d_{\mathrm{calc}}=\sqrt{\frac{8CF_{\max}K_s n_s}{\pi S_{sy}}}=\sqrt{\frac{8(${index})(${fmax})(${n(Ks,5)})(${targetSafety})}{\pi(${n(shearYield,6)})}}=${mm(computed)}`);
    eq(math`\varepsilon=100\frac{|d_{\mathrm{calc}}-d_{\mathrm{sup}}|}{d_{\mathrm{sup}}}=100\frac{|${n(computed,6)}-${n(assumed,6)}|}{${n(assumed,6)}}=${n(error,4)}\,\%`);
    const convergence=error<5?'Cumple la tolerancia de iteración.':'Se usa el diámetro calculado en la corrida siguiente.';
    text(convergence);
    trial(diameterDecision,computed,staticSafety>=targetSafety?'viable':'rejected',
      'Corrida '+run+'. '+convergence+' Factor de seguridad al sustituir el nuevo diámetro: '+n(staticSafety,4)+'.');
    assumed=computed;
  }
  check(error<5,'El diámetro del ejercicio no converge con el criterio de la libreta.');

  heading('Verificación de la resistencia estática');
  const d=(targetSafety*stressConstant/(shearYieldRatio*wire.A))**(1/(2-wire.m));
  check(d>=wire.min&&d<=wire.max,'El diámetro requerido queda fuera de la fila de alambre ASTM A228.');
  const meanDiameter=index*d;
  const safety=safetyAt(d);
  text('La libreta obtiene cerca de 4.75 mm después de la segunda corrida. Con precisión completa ese resultado todavía queda ligeramente por debajo de la seguridad solicitada. Se despeja el mínimo continuo con Ssy evaluado en el mismo diámetro.');
  eq(math`n_s=\frac{S_{sy}}{\tau_{\max}}=\frac{(${n(shearYieldRatio,5)})A\,d^{2-m}}{8CF_{\max}K_s/\pi}`);
  eq(math`d_{\min}=\left[\frac{8CF_{\max}K_s n_s}{\pi(${n(shearYieldRatio,5)})A}\right]^{1/(2-m)}=\left[\frac{8(${index})(${fmax})(${n(Ks,5)})(${targetSafety})}{\pi(${n(shearYieldRatio,5)})(${n(wire.A)})}\right]^{1/(2-${n(wire.m)})}=${mm(d)}`);
  eq(math`D=Cd=${index}(${n(d,6)})=${mm(meanDiameter)};\quad n_s=${n(safety,4)}`);
  trial(diameterDecision,d,'calculated','Mínimo continuo dentro del intervalo ASTM A228. El factor estático en este diámetro es '+n(safety,4)+'.');

  heading('Rigidez y comprobación de tres espiras');
  const diameterInches=d/25.4;
  check(diameterInches>.125,'Verifica el intervalo del módulo de corte para este alambre.');
  const shearModulus=1000*wire.G.at(-1);
  const activeTurns=shearModulus*d**4/(8*meanDiameter**3*stiffness);
  const proposedTurns=3;
  const proposedStiffness=shearModulus*d/(8*index**3*proposedTurns);
  const proposedDeflection=fmax/proposedStiffness;
  const coilDecision=decision(7,'Espiras activas','',
    'La rigidez debe limitar la deformación desde la posición libre a 12 mm bajo 400 N. Se comprueba el redondeo a tres espiras del apunte.');
  eq(math`k_{\min}=\frac{F_{\max}}{\delta_{\max}}=\frac{${fmax}}{${deflectionLimit}}=${display(stiffness,'N/mm',4)}`);
  eq(math`d=\frac{${n(d,6)}}{25.4}=${display(diameterInches,'in',5)}>0.125\,\mathrm{in};\quad G=${display(shearModulus/1000,'GPa')}`);
  text('La libreta sustituye G = 82.7 GPa. Para el diámetro calculado se usa la banda de la tabla 10-5 de A228 mayor a 0.125 pulgadas, con G = 80.0 GPa.');
  eq(math`N_a=\frac{Gd^4}{8D^3k_{\min}}=\frac{(${n(shearModulus)})(${n(d,6)})^4}{8(${n(meanDiameter,6)})^3(${n(stiffness,6)})}=${n(activeTurns,4)}`);
  trial(coilDecision,activeTurns,'calculated','Máximo continuo de espiras activas para este diámetro de alambre y la rigidez mínima.');
  add('iteration','Comprobación con tres espiras activas');
  eq(math`k_3=\frac{Gd}{8 C^3N_a}=\frac{(${n(shearModulus)})(${n(d,6)})}{8(${index})^3(${proposedTurns})}=${display(proposedStiffness,'N/mm',4)}`);
  eq(math`\delta_3=\frac{F_{\max}}{k_3}=\frac{${fmax}}{${n(proposedStiffness,6)}}=${mm(proposedDeflection)}>${mm(deflectionLimit)}`);
  trial(coilDecision,proposedTurns,'rejected','Al redondear a tres espiras y conservar el diámetro mínimo estático, la deformación llega a '+n(proposedDeflection,4)+' mm.');

  heading('Diámetro requerido al conservar las tres espiras');
  const diameterAtThree=Math.max(d,8*index**3*proposedTurns*stiffness/shearModulus);
  const meanAtThree=index*diameterAtThree;
  const safetyAtThree=safetyAt(diameterAtThree);
  const stiffnessAtThree=shearModulus*diameterAtThree/(8*index**3*proposedTurns);
  const deflectionAtThree=fmax/stiffnessAtThree;
  check(diameterAtThree<=wire.max,'Con tres espiras se supera el intervalo tabulado de A228.');
  eq(math`d_{3}=\max\left(d_{\min},\frac{8C^3N_a k_{\min}}{G}\right)=\max\left(${n(d,6)},\frac{8(${index})^3(${proposedTurns})(${n(stiffness,6)})}{${n(shearModulus)}}\right)=${mm(diameterAtThree)}`);
  eq(math`D_3=Cd_3=${index}(${n(diameterAtThree)})=${mm(meanAtThree)}`);
  eq(math`\delta_{\max,3}=\frac{8(${index})^3(${proposedTurns})(${fmax})}{(${n(shearModulus)})(${n(diameterAtThree)})}=${mm(deflectionAtThree)};\quad n_{s,3}=${n(safetyAtThree,4)}`);
  trial(diameterDecision,diameterAtThree,'calculated','Diámetro continuo compatible con tres espiras activas, la deformación máxima y la seguridad estática del ejercicio.');
  add('note','Esta corrida verifica el modelo estático de las pp. 50–52. La selección de un alambre comercial y la revisión de altura sólida, pandeo y vida cíclica requieren datos adicionales.');

  return {
    entries,decisions,
    metrics:[
      ['Diámetro mínimo por resistencia estática',d,'mm',4],
      ['Rigidez mínima',stiffness,'N/mm',4],
      ['Espiras activas calculadas con el diámetro mínimo',activeTurns,'',4],
      ['Deformación al redondear a tres espiras',proposedDeflection,'mm',4],
      ['Diámetro necesario con tres espiras',diameterAtThree,'mm',4],
      ['Factor de seguridad con tres espiras y diámetro ajustado',safetyAtThree,'',4],
      ['Deformación máxima con tres espiras y diámetro ajustado',deflectionAtThree,'mm',4]
    ]
  };
}
