'use strict';

function calculateNotebookShaft() {
  const {entries, decisions, add, check, decision, trial}=createCalculationTrace();
  const heading=value=>add('heading',value);
  const text=value=>add('text',value);
  const eq=value=>add('eq',value);
  const n=number;
  const inchValue=(value,digits=4)=>display(value,'in',digits);
  const stress=value=>display(value,'kpsi',4);
  const loading={M:1200,T:1100};
  const existing={d:1.1,D:1.65,r:.01,kt:1.7,kts:1.4,q:.8,qs:.9};
  const target=1.35;
  const reliability=99;
  const temperature=20;
  const kc=shaftLoadFactors[2].value;
  const ke=referenceTables[6].rows.find(row=>row[0]===reliability)[1];
  const kd=referenceTables[7].rows.find(row=>row[0]===temperature)[1];
  const finish=referenceTables[5].rows.find(([name])=>name==='Maquinado/CD');
  check(finish,'Falta la fila de acabado maquinado de la tabla 6-2.');
  const [,coefficientMpa,exponent]=finish;
  const coefficientKsi=coefficientMpa*6.894757293**exponent;

  function material(grade, condition) {
    const row=referenceTables[1].rows.find(([name,shape])=>name===grade&&shape===condition);
    check(row,'Falta la fila AISI '+grade+' '+condition+' de la tabla A-20.');
    const [,,,sut,,sy]=row;
    const base=.5*sut;
    const ka=coefficientKsi*sut**exponent;
    text('AISI '+grade+' '+condition+' · tabla A-20. Para ambas partes se usa el acabado maquinado que emplea la libreta, con los coeficientes de la tabla 6-2.');
    eq(math`S_{ut}=${stress(sut)};\quad S_y=${stress(sy)};\quad S'_e=0.5(${n(sut)})=${stress(base)}`);
    eq(math`a_{\mathrm{kpsi}}=a_{\mathrm{MPa}}(6.894757293)^b=${n(coefficientMpa)}(6.894757293)^{${n(exponent)}}=${n(coefficientKsi,6)}`);
    eq(math`k_a=a_{\mathrm{kpsi}}S_{ut}^{b}=${n(coefficientKsi,6)}(${n(sut)})^{${n(exponent)}}=${n(ka,6)}`);
    return {sut,sy,base,ka};
  }

  function resistance(metal,section,sizeRule) {
    const {d,D,r,kt,kts,q,qs}=section;
    const kb=sizeRule==='large' ? .91*d**(-.157) : (d/.3)**(-.107);
    const se=metal.base*metal.ka*kb*kc*kd*ke;
    const kf=1+q*(kt-1);
    const kfs=1+qs*(kts-1);
    eq(math`d=${inchValue(d)};\quad D=${inchValue(D)};\quad r=${inchValue(r)};\quad D/d=${n(D/d,5)};\quad r/d=${n(r/d,5)}`);
    eq(sizeRule==='large'
      ? math`k_b=0.91d^{-0.157}=0.91(${n(d,6)})^{-0.157}=${n(kb,6)}`
      : math`k_b=(d/0.3)^{-0.107}=(${n(d,6)}/0.3)^{-0.107}=${n(kb,6)}`);
    eq(math`S_e=k_ak_bk_ck_dk_eS'_e=(${[metal.ka,kb,kc,kd,ke,metal.base].map(v=>n(v,6)).join(')(')})=${stress(se)}`);
    eq(math`K_f=1+q(K_t-1)=1+(${n(q)})(${n(kt)}-1)=${n(kf,5)}`);
    eq(math`K_{fs}=1+q_s(K_{ts}-1)=1+(${n(qs)})(${n(kts)}-1)=${n(kfs,5)}`);
    return {se,kf,kfs};
  }

  function verify(metal,section,limit) {
    const {d}=section;
    const scale=1000*Math.PI*d**3;
    const alternating=32*limit.kf*loading.M/scale;
    const mean=Math.sqrt(3)*16*limit.kfs*loading.T/scale;
    const invIndex=(alternating/limit.se)**2+(mean/metal.sut)**2;
    const index=1/invIndex;
    const conservative=alternating+mean;
    const staticFactor=metal.sy/conservative;
    const normalElastic=32*section.kt*loading.M/scale;
    const shearElastic=16*section.kts*loading.T/scale;
    const vm=Math.hypot(normalElastic,Math.sqrt(3)*shearElastic);
    eq(math`\sigma'_{a}=\frac{32K_fM_a}{1000\pi d^3}=\frac{32(${n(limit.kf,5)})(${loading.M})}{1000\pi(${n(d,6)})^3}=${stress(alternating)}`);
    eq(math`\sigma'_{m}=\frac{\sqrt{3}\,16K_{fs}T_m}{1000\pi d^3}=\frac{\sqrt{3}\,16(${n(limit.kfs,5)})(${loading.T})}{1000\pi(${n(d,6)})^3}=${stress(mean)}`);
    eq(math`\frac{1}{n_{\mathrm{HM}}}=\left(\frac{${n(alternating,6)}}{${n(limit.se,6)}}\right)^2+\left(\frac{${n(mean,6)}}{${n(metal.sut)}}\right)^2=${n(invIndex,6)};\quad n_{\mathrm{HM}}=\frac{1}{${n(invIndex,6)}}=${n(index,5)}`);
    text('Para el chequeo estático de la página 21 se usa la suma conservadora de magnitudes equivalentes.');
    eq(math`\sigma'_{\mathrm{max,apuntes}}=\sigma'_a+\sigma'_m=${n(alternating,5)}+${n(mean,5)}=${stress(conservative)};\quad n_{\mathrm{est,apuntes}}=\frac{${n(metal.sy)}}{${n(conservative,6)}}=${n(staticFactor,5)}`);
    text('Como verificación adicional de fluencia se combina la flexión máxima con la torsión sostenida, usando los concentradores elásticos del escalón.');
    eq(math`\sigma_{\mathrm{VM,max}}=\frac{\sqrt{(32K_tM_a)^2+3(16K_{ts}T_m)^2}}{1000\pi d^3}=\sqrt{(${n(normalElastic,5)})^2+3(${n(shearElastic,5)})^2}=${stress(vm)}`);
    eq(math`n_{\mathrm{fluencia}}=\frac{S_y}{\sigma_{\mathrm{VM,max}}}=\frac{${n(metal.sy)}}{${n(vm,6)}}=${n(metal.sy/vm,5)}`);
    return {index,staticFactor,yieldFactor:metal.sy/vm};
  }

  function shoulderSketch(title,{d,D,r},caption) {
    const smallHalf=25;
    const largeHalf=smallHalf*D/d;
    const center=60;
    const x0=48,x1=177,x2=364;
    const outline=[
      [x0,center-smallHalf],[x1,center-smallHalf],[x1,center-largeHalf],
      [x2,center-largeHalf],[x2,center+largeHalf],[x1,center+largeHalf],
      [x1,center+smallHalf],[x0,center+smallHalf],[x0,center-smallHalf]
    ];
    const marks=outline.slice(1).map(([x,y],i)=>['line',...outline[i],x,y]);
    for(let x=x0-10;x<x2+8;x+=12) marks.push(['line',x,center,x+6,center]);
    marks.push(
      ['line',83,center-smallHalf,83,center+smallHalf],['label',108,20,'d = '+n(d,4)+' in'],
      ['line',333,center-largeHalf,333,center+largeHalf],['label',300,13,'D = '+n(D,4)+' in'],
      ['line',x1,center+smallHalf,x1+34,108],['label',258,110,'r = '+n(r,4)+' in']
    );
    add('diagram',{title,caption,marks});
  }

  add('section','Caso resuelto · Flecha escalonada');
  heading('Enunciado y cargas');
  text('Páginas 20–22 de la libreta de Diseño de Elementos de Máquinas. Primero se comprueba el hombro de la flecha de acero AISI 1050 CD. Después se busca un diámetro en AISI 1020 HR con las mismas cargas y un índice objetivo de Hencky–Marin de 1.35.');
  eq(math`M_a=${display(loading.M,'lbf\\,in')};\quad T_m=${display(loading.T,'lbf\\,in')};\quad M_m=0;\quad T_a=0`);
  eq(math`k_c=${n(kc)};\quad k_d=${n(kd)};\quad k_e(99\,\%)=${n(ke)}`);
  text('Se usa el menor factor de carga, 0.59, tal como se indica en la libreta. Las resistencias se expresan en kpsi. Se conserva el índice de Hencky–Marin que los apuntes definen como el inverso de la suma de cuadrados.');
  shoulderSketch('Hombro de la flecha AISI 1050 CD',existing,'Sección crítica de diámetro menor en el escalón. El dibujo muestra las cotas de la página 20.');

  heading('Comprobación de la flecha existente · AISI 1050 CD');
  const originalSteel=material('1050','CD');
  text('Para este escalón se conservan las lecturas gráficas escritas: Kt = 1.7, Kts = 1.4, q = 0.8 y qs = 0.9.');
  const originalLimit=resistance(originalSteel,existing,'small');
  const originalCheck=verify(originalSteel,existing,originalLimit);
  const current=decision(5,'Diámetro comprobado de AISI 1050 CD','in',
    'La geometría es un dato del ejercicio y se verifica en el escalón.');
  trial(current,existing.d,'verified','Índice de Hencky–Marin de '+n(originalCheck.index,4)+' y factor estático con la estimación de la libreta de '+n(originalCheck.staticFactor,4)+'.');
  add('note','En la página 20 se anotan ka = 0.815 y n = 1.394. Con la fila original, el coeficiente de acabado y la sustitución completa se recalculan ka = '+n(originalSteel.ka,5)+' y n = '+n(originalCheck.index,5)+'. El factor estático anotado es aproximadamente 3.5.');

  heading('Diseño para las mismas cargas · AISI 1020 HR');
  const newSteel=material('1020','HR');
  eq(math`D/d=1.5;\quad r/d=0.1;\quad n_{\mathrm{HM,obj}}=${n(target)}`);
  eq(math`d_{\mathrm{req}}=\left[\frac{32\sqrt{n_{\mathrm{HM,obj}}}}{1000\pi}\sqrt{\left(\frac{K_fM_a}{S_e}\right)^2+\frac34\left(\frac{K_{fs}T_m}{S_{ut}}\right)^2}\right]^{1/3}`);
  const computed=decision(5,'Corridas de diámetro con AISI 1020 HR','in',
    'Se comienza con el diámetro de la página 21. La diferencia se calcula respecto al diámetro supuesto, como en esa página. El umbral de convergencia de la app se aplica a la última corrida.');
  const readings=[
    {q:.8,qs:.8,sizeRule:'large',page:21},
    {q:.8,qs:.7,sizeRule:'small',page:22}
  ];
  const geometry=(d,q,qs)=>({d,D:1.5*d,r:.1*d,kt:1.6,kts:1.4,q,qs});
  let next=2;
  let lastError;
  const diameters=readings.map(({q,qs,sizeRule,page},i)=>{
    const d=next;
    add('iteration','Corrida '+(i+1)+' · diámetro supuesto de '+n(d,4)+' in');
    text('Se usan los valores de la página '+page+': Kt = 1.6, Kts = 1.4, q = '+n(q)+' y qs = '+n(qs)+'.');
    if(i===0) text('Para el supuesto de exactamente 2 in se conserva la expresión de tamaño que usa la página 21 en ese punto de transición.');
    const limit=resistance(newSteel,geometry(d,q,qs),sizeRule);
    next=Math.cbrt(32*Math.sqrt(target)/(1000*Math.PI)*
      Math.hypot(limit.kf*loading.M/limit.se,Math.sqrt(.75)*limit.kfs*loading.T/newSteel.sut));
    lastError=100*Math.abs(next-d)/d;
    eq(math`d_{\mathrm{req}}=\left[\frac{32\sqrt{${n(target)}}}{1000\pi}\sqrt{\left(\frac{(${n(limit.kf,5)})(${loading.M})}{${n(limit.se,6)}}\right)^2+\frac34\left(\frac{(${n(limit.kfs,5)})(${loading.T})}{${n(newSteel.sut)}}\right)^2}\right]^{1/3}=${inchValue(next)}`);
    eq(math`\varepsilon=100\frac{|d_{\mathrm{req}}-d|}{d}=100\frac{|${n(next,6)}-${n(d,6)}|}{${n(d,6)}}=${display(lastError,'\\%',3)}`);
    text(lastError<tolerance?'El error queda por debajo de 3 %. Se verifica el diámetro calculado.':
      'El error supera 3 %. El diámetro despejado alimenta la siguiente corrida.');
    trial(computed,next,'calculated','Corrida '+(i+1)+' a partir de '+n(d,4)+' in. Diferencia respecto al supuesto de '+n(lastError,3)+' %. '+(lastError<tolerance?'Se verifica este diámetro.':'Se utiliza en la siguiente corrida.'));
    return next;
  });

  heading('Verificación del diámetro final');
  text('En la verificación se recalculan el radio y el factor de tamaño en el diámetro obtenido. Se conservan q y qs de la última corrida escrita como aproximaciones gráficas para esta comprobación.');
  const final=geometry(next,.8,.7);
  const finalLimit=resistance(newSteel,final,'small');
  const finalCheck=verify(newSteel,final,finalLimit);
  const approved=lastError<tolerance&&finalCheck.index>=target&&finalCheck.yieldFactor>=1;
  const finalDecision=decision(5,'Diámetro continuo verificado','in',
    'Resultado calculado con las cargas del ejercicio y el criterio de Hencky–Marin.');
  trial(finalDecision,next,approved?'verified':'rejected','Índice de Hencky–Marin de '+n(finalCheck.index,4)+' para un objetivo de '+n(target)+' y factor de fluencia de '+n(finalCheck.yieldFactor,4)+'.');
  text(approved?'Con estas lecturas, el diámetro calculado alcanza el índice de fatiga requerido y queda por debajo de la fluencia local.':
    'Con estas lecturas, el diámetro calculado requiere revisar el criterio de aceptación.');
  shoulderSketch('Hombro calculado de la flecha AISI 1020 HR',final,
    'El diámetro mayor y el radio se obtienen de D/d = 1.5 y r/d = 0.1, después de comprobar el diámetro menor.');
  add('note','Las páginas 21–22 anotan 1.282 y 1.253 in. La segunda corrida recalcula kb desde el diámetro supuesto con la ecuación de tamaño de la página 9. La cifra manuscrita de kb = 0.873 difiere de esa sustitución, además de los redondeos de las propiedades.');
  add('note','La tabla A-20 especifica el intervalo de 18 a 32 mm para sus estimaciones ASTM. El diámetro continuo del ejercicio es '+n(next*25.4,3)+' mm y el hombro mayor mide '+n(final.D*25.4,3)+' mm. La selección de suministro requiere comprobar el tamaño y el estado de la barra.');

  return {entries,decisions,metrics:[
    ['AISI 1050 CD · índice de Hencky–Marin',originalCheck.index,'',4],
    ['AISI 1050 CD · factor estático de la libreta',originalCheck.staticFactor,'',4],
    ['Corrida 1 · diámetro recalculado',diameters[0],'in',4],
    ['Corrida 2 · diámetro recalculado',diameters[1],'in',4],
    ['Diámetro final recalculado',next*25.4,'mm',3],
    ['AISI 1020 HR · índice verificado',finalCheck.index,'',4],
    ['AISI 1020 HR · factor de fluencia',finalCheck.yieldFactor,'',4]
  ]};
}
