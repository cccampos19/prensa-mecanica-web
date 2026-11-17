'use strict';

const steels = [referenceTables[1], referenceTables[2]].flatMap(({rows}, table) =>
  rows.map(row => {
    const [aisi, process] = row;
    const i = table ? 3 : 2;
    const label = 'AISI ' + aisi + ' ' + process + (table ? ' · ' + row[2] + ' °C' : '');
    return {label, sut:row[i], sy:row[i+2], table:table ? 'A-21' : 'A-20'};
  }));
const finishes = referenceTables[5].rows;
const shaftLoadFactors = [
  {label:'Flexión · 1.00',value:1},
  {label:'Axial · 0.85',value:.85},
  {label:'Torsión · 0.59',value:.59}
];

function transmissionMath({add,check}) {
  const n=number;
  const eq=value=>add('eq',value);
  const text=value=>add('text',value);
  const mm=value=>dual(value,'mm',1/25.4,'in');
  const stress=value=>dual(value,'MPa',1/6.894757293,'kpsi');

  function interpolate(rows, x, label) {
    const i = rows.findIndex(([value]) => value >= x);
    check(Number.isFinite(x) && i >= 0 && x >= rows[0][0], label + ' fuera de tabla.');
    const [x1,y1] = rows[i];
    if (x === x1) return y1;
    const [x0,y0] = rows[i-1];
    return y0+(x-x0)*(y1-y0)/(x1-x0);
  }

  function useSteel(steelIndex, finishIndex) {
    const steel = steels[steelIndex];
    const finish = finishes[finishIndex];
    check(steel && finish, 'Selecciona un acero y un acabado del catálogo.');
    const [label,a,b] = finish;
    const ka = a*steel.sut**b;
    text(steel.label + ' · tabla ' + steel.table + '. Acabado ' + label + ' · tabla 6-2.');
    eq(math`S_{ut}=${stress(steel.sut)};\quad S_y=${stress(steel.sy)}`);
    eq(math`k_a=aS_{ut}^{\,b}=${n(a)}(${n(steel.sut)})^{${n(b)}}=${n(ka,5)}`);
    return {...steel,ka};
  }

  function sizeFactor(d) {
    check(d>=2.79&&d<=254,'Diámetro fuera del intervalo de kᵦ (2.79 a 254 mm).');
    return d<=51?(d/7.62)**(-.107):1.51*d**(-.157);
  }

  function notch(sut, radiusMm, kt, torsion, symbol, show = true) {
    const showEquation = show ? eq : () => {};
    const S = sut/6.894757293;
    let q = 1;
    if (S >= 60 && S <= 200) {
      const [a,b,d,e] = torsion ? [.190,.00251,.0000135,.0000000267] : [.246,.00308,.0000151,.0000000267];
      const root = a-b*S+d*S*S-e*S**3;
      const chartRadius=Math.min(radiusMm,.16*25.4)/25.4;
      q = 1/(1+root/Math.sqrt(chartRadius));
      showEquation(math`\sqrt{a_{${symbol}}}=${n(a)}-${n(b,5)}(${n(S)})+${n(d,8)}(${n(S)})^2-${n(e,11)}(${n(S)})^3=${n(root,6)}`);
      showEquation(math`q_{${symbol}}=\frac{1}{1+\sqrt{a_{${symbol}}}/\sqrt{r_{\mathrm{in}}}}=\frac{1}{1+${n(root,6)}/\sqrt{${n(chartRadius,6)}}}=${n(q,5)}`);
    } else if (show) {
      text('Fuera del intervalo de 60 a 200 kpsi de la figura de entalle, se adopta q = 1 como cota conservadora.');
    }
    const kf=1+q*(kt-1);
    showEquation(math`K_{f,${symbol}}=1+q_{${symbol}}(K_t-1)=1+${n(q,5)}(${n(kt)}-1)=${n(kf,5)}`);
    return kf;
  }

  function iterate(start, label, step, allowFailure = false, precision = tolerance) {
    let current = start;
    for (let k=1;k<=100;k++) {
      add('iteration', 'Iteración ' + k + ' · ' + label);
      const next = step(current);
      const error = 100*Math.abs(next-current)/next;
      if(!Number.isFinite(error)){
        if(allowFailure){
          text('La iteración sale del intervalo de tamaño del modelo.');
          return null;
        }
        check(false,'La iteración produjo un valor inválido.');
      }
      eq(math`\varepsilon=\frac{|${n(next,6)}-${n(current,6)}|}{${n(next,6)}}100=${n(error,5)}\,\%`);
      text(error < precision ? 'Converge con error menor al '+precision+' %.' : 'Se usa el resultado en la siguiente iteración.');
      if (error<precision) return next;
      current=next;
    }
    if(allowFailure){
      text('La iteración no convergió en 100 pasos.');
      return null;
    }
    check(false, 'La iteración de ' + label + ' no convergió en 100 pasos.');
  }

  return {interpolate,useSteel,sizeFactor,notch,iterate,eq,text,mm,stress};
}

function shaftStress(c,shaft,{d,M,T,kd,ke},{sizeFactor,notch,eq,stress},show=true){
  const n=number;
  const r=c.fillet*d;
  const kb=sizeFactor(d);
  const kf=notch(shaft.sut,r,c.ktFlex,false,'b',show);
  const kfs=notch(shaft.sut,r,c.ktTors,true,'s',show);
  const se=.5*shaft.sut*shaft.ka*kb*c.kc*kd*ke;
  if(show){
    eq(d<=51 ? math`k_b=(${n(d,5)}/7.62)^{-0.107}=${n(kb,5)}` : math`k_b=1.51(${n(d,5)})^{-0.157}=${n(kb,5)}`);
    eq(math`S_e=k_ak_bk_ck_dk_eS'_e=(${[shaft.ka,kb,c.kc,kd,ke,.5*shaft.sut].map(v=>n(v,5)).join(')(')})=${stress(se)}`);
  }
  const a=kf*32*M/(Math.PI*d**3), m=Math.sqrt(3)*kfs*16*T/(Math.PI*d**3);
  const nf=1/((a/se)**2+(m/shaft.sut)**2), ns=shaft.sy/Math.hypot(a,m);
  return {d,M,T,se,kf,kfs,a,m,nf,ns};
}

function sizeSpurGears(c,{torque,rpm},ctx,sizing=transmissionMath(ctx)){
  const {add,check,decision,trial}=ctx;
  const {interpolate,useSteel,sizeFactor,notch,iterate,eq,text,mm,stress}=sizing;
  const n=number;
  const heading=value=>add('heading',value);
  const note=value=>add('note',value);
  const force=value=>dual(value,'N',1/lbf,'lbf');
  const rad=deg=>deg*Math.PI/180;

  text('Métodos de la libreta, pp. 28–39. Lewis para flexión del diente y verificación de fatiga pulsante con los factores del ejemplo.');
  check(Number.isFinite(torque)&&torque>0&&Number.isFinite(rpm)&&rpm>0,'Ingresa torque y velocidad positivos para el piñón.');
  check([c.np,c.ng].every(z=>Number.isSafeInteger(z)&&z>0),'Ingresa cantidades enteras positivas de dientes.');
  check(Number.isFinite(c.pd)&&c.pd>0,'El paso diametral propuesto debe ser positivo.');
  check(Number.isFinite(c.faceStart)&&c.faceStart>=0,'El ancho inicial de cara debe ser cero o positivo.');
  check(c.phi>0&&c.phi<90&&c.yp>0&&c.yg>0&&c.ktGear>=1&&c.gearFat>=1&&c.gearStatic>=1, 'Revisa el ángulo, los factores de Lewis, Kt y las seguridades de engranes.');
  const kd=interpolate(referenceTables[7].rows,c.temperature,'Temperatura');
  const ke=interpolate(referenceTables[6].rows,c.reliability,'Confiabilidad');
  const gear=useSteel(c.gearSteel,c.gearFinish);
  note('Los factores de Lewis y los concentradores son propuestas geométricas editables del perfil, no propiedades de la fila de material. El factor dinámico sigue el caso maquinado de la libreta.');
  if(gear.table==='A-20') {
    note('La tabla A-20 indica un intervalo de 18–32 mm para sus estimaciones ASTM de resistencia. Confirma que el tamaño y la condición del material de partida de los engranes sean representativos.');
  }
  const diametral=c.pd, module=25.4/diametral;
  const pinion=c.np*module, gearDiameter=c.ng*module;
  const centerDistance=(pinion+gearDiameter)/2;
  const pitch=Math.PI/diametral, minFace=3*pitch, maxFace=5*pitch;
  const wt=2000*torque/pinion, wr=wt*Math.tan(rad(c.phi));
  const speed=Math.PI*(pinion/25.4)*rpm/12;
  const kv=1200/(1200+speed);
  text('Se mantienen el acero, el paso diametral y los números de dientes propuestos. La dimensión que se busca es el ancho de cara.');
  eq(math`m=\frac{25.4}{P_d}=\frac{25.4}{${n(diametral,5)}}=${mm(module)};\quad p=\pi/P_d=${mm(25.4*pitch)}`);
  eq(math`d_p=N_p m=${c.np}(${n(module,5)})=${mm(pinion)};\quad d_g=N_g m=${c.ng}(${n(module,5)})=${mm(gearDiameter)}`);
  eq(math`a=1/P_d=${mm(25.4/diametral)};\quad b=1.25/P_d=${mm(1.25*25.4/diametral)}`);
  eq(math`C=\frac{${n(pinion)}+${n(gearDiameter)}}{2}=${mm(centerDistance)}`);
  eq(math`W_t=2T_e/d_p=\frac{2(${n(torque)})}{${n(pinion/1000,6)}}=${force(wt)}`);
  eq(math`W_r=W_t\tan\phi=${n(wt)}\tan(${n(c.phi)}^\circ)=${force(wr)}`);
  eq(math`v=\frac{\pi(${n(pinion/25.4)})(${n(rpm)})}{12}=${dual(speed,'ft/min',.3048/60,'m/s')}`);
  eq(math`K_v=\frac{1200}{1200+v}=\frac{1200}{1200+${n(speed)}}=${n(kv,5)}`);
  eq(math`3p=${mm(minFace*25.4)};\quad 5p=${mm(maxFace*25.4)};\quad k_d=${n(kd)};\quad k_e=${n(ke)}`);
  text('Se sigue la aproximación pulsante de Goodman del ejemplo de clase. La resistencia base pulsante es 1.33 veces 0.5 Sut, corregida con los factores de Marin. El entalle se aplica una vez en la comprobación.');
  const radius=.3/diametral*25.4;
  eq(math`r=\frac{0.3}{P_d}=${mm(radius)}`);
  const gearKf=notch(gear.sut,radius,c.ktGear,false,'g');
  function faceCheck(width) {
    return [c.yp,c.yg].map((y,i)=>{
      const label=i===0?'p':'g';
      const t=Math.sqrt(4*(2.25/diametral)*(3*y/(2*diametral)));
      const equivalent=.808*Math.sqrt(width*t), kb=sizeFactor(equivalent*25.4);
      const se=1.33*.5*gear.sut*gear.ka*kb*kd*ke;
      const lewis=wt/lbf*diametral/(y*kv);
      const sigma=lewis/width*.006894757293;
      eq(math`t_{${label}}=\sqrt{4\frac{2.25}{${n(diametral,5)}}\frac{3(${n(y)})}{2(${n(diametral,5)})}}=${display(t,'in',5)}`);
      eq(math`d_{eq,${label}}=0.808\sqrt{${n(width,5)}\cdot ${n(t,5)}}=${display(equivalent,'in',5)}`);
      eq(equivalent*25.4<=51 ? math`k_b=(${n(equivalent*25.4,5)}/7.62)^{-0.107}=${n(kb,5)}` : math`k_b=1.51(${n(equivalent*25.4,5)})^{-0.157}=${n(kb,5)}`);
      eq(math`S_{puls}=1.33(0.5)(${n(gear.sut)})(${n(gear.ka,5)})(${n(kb,5)})(${n(kd)})(${n(ke)})=${stress(se)}`);
      return {label,y,se,lewis,sigma};
    });
  }
  heading('Dimensionamiento iterativo de la cara');
  const faceDecision=decision(3,'Ancho de cara de los engranes','mm',
    gear.label+' con paso diametral '+n(diametral,5)+' dientes/in. Intervalo de diseño de '+n(minFace*25.4,2)+' a '+n(maxFace*25.4,2)+' mm según la libreta. Las tablas entregadas no enumeran anchos comerciales.');
  const startFace=Math.min(maxFace,Math.max(minFace,c.faceStart/25.4));
  if(c.faceStart>0&&Math.abs(startFace-c.faceStart/25.4)>1e-9){
    text('El ancho inicial propuesto queda fuera de 3 a 5 pasos circulares. La iteración comienza en el límite más cercano.');
  }
  const width=iterate(startFace,'ancho de cara (in)',current=>{
    eq(math`F=${mm(current*25.4)}`);
    const requirements=faceCheck(current).flatMap(({label,y,se,lewis})=>{
      const allowable=se/(gearKf*c.gearFat);
      const stat=gear.sy/c.gearStatic;
      const fatigue=lewis*.006894757293/allowable, elastic=lewis*.006894757293/stat;
      eq(math`S_{adm,${label}}=\frac{${n(se)}}{${n(gearKf,5)}\cdot ${n(c.gearFat)}}=${stress(allowable)}`);
      eq(math`F_{fat,${label}}=\frac{W_t P_d}{Y K_v S_{adm}}=\frac{${n(wt/lbf)}\cdot ${n(diametral,5)}}{${n(y)}\cdot ${n(kv,5)}\cdot ${n(allowable/.006894757293)}}=${mm(fatigue*25.4)}`);
      eq(math`F_{est,${label}}=\frac{${n(wt/lbf)}\cdot ${n(diametral,5)}}{${n(y)}\cdot ${n(kv,5)}\cdot ${n(stat/.006894757293)}}=${mm(elastic*25.4)}`);
      return [fatigue,elastic];
    });
    const next=Math.max(minFace,...requirements);
    eq(math`F_{\mathrm{nuevo}}=\max(${[minFace,...requirements].map(v=>n(v,5)).join(',')})=${display(next,'in',5)}`);
    const bounded=Math.min(next,maxFace);
    if(next>maxFace) {
      text('El ancho requerido en este paso supera 5 pasos circulares. Se evalúa directamente el límite geométrico.');
      eq(math`F_{\mathrm{siguiente}}=\min(F_{\mathrm{nuevo}},5p)=\min(${n(next,5)},${n(maxFace,5)})=${display(bounded,'in',5)}`);
    }
    return bounded;
  },false,0.000001);
  heading('Comprobación del ancho calculado');
  const faceMm=width*25.4;
  eq(math`F=${mm(faceMm)}`);
  const gearFatigue=[], gearStatic=[];
  for(const {label,y,se,sigma} of faceCheck(width)){
    const fatigue=se/(gearKf*sigma), stat=gear.sy/sigma;
    eq(math`\sigma_{${label}}=\frac{W_tP_d}{FY K_v}=\frac{${n(wt/lbf)}\cdot ${n(diametral,5)}}{${n(width,5)}\cdot ${n(y)}\cdot ${n(kv,5)}}\,\mathrm{psi}=${stress(sigma)}`);
    eq(math`n_{fat,${label}}=\frac{${n(se)}}{${n(gearKf,5)}\cdot ${n(sigma)}}=${n(fatigue,4)};\quad n_{est,${label}}=\frac{${n(gear.sy)}}{${n(sigma)}}=${n(stat,4)}`);
    gearFatigue.push(fatigue);
    gearStatic.push(stat);
  }
  const minFatigue=Math.min(...gearFatigue), minStatic=Math.min(...gearStatic);
  const fatigueOk=minFatigue>=c.gearFat*(1-1e-8), staticOk=minStatic>=c.gearStatic*(1-1e-8);
  const reason='Factor mínimo de fatiga '+n(minFatigue,4)+' frente a '+n(c.gearFat)+' requerido. Factor estático mínimo '+n(minStatic,4)+' frente a '+n(c.gearStatic)+' requerido. ';
  trial(faceDecision,faceMm,fatigueOk&&staticOk?'calculated':'rejected',
    reason+(fatigueOk&&staticOk?'El ancho calculado cumple en el piñón y la rueda.':'El ancho evaluado queda por debajo de uno o ambos requisitos.'));
  check(fatigueOk&&staticOk,gear.label+' con paso diametral '+n(diametral,5)+' no alcanza las seguridades con el ancho evaluado de '+n(faceMm,2)+' mm. El límite de 5 pasos circulares es '+n(maxFace*25.4,2)+' mm.');

  return {module,diametral,pinion,gearDiameter,centerDistance,wt,wr,faceMm,kd,ke,gearFatigue,gearStatic};
}

function finishDesign(c, power, belt, entries, check, {decision,trial}) {
  const add = (type,value) => entries.push({type,value});
  const n = number;
  const eq = value => add('eq', value);
  const heading = value => add('heading', value);
  const text = value => add('text', value);
  const note = value => add('note', value);
  const section = value => add('section', value);
  const mm = value => dual(value, 'mm', 1/25.4, 'in');
  const stress = value => dual(value, 'MPa', 1/6.894757293, 'kpsi');
  const force = value => dual(value, 'N', 1/lbf, 'lbf');
  const moment = value => dual(value, 'N\\,m', 1/(lbf*12*inch), 'lbf\\,ft');
  const kip = value => dual(value, 'kN', 1000/lbf, 'lbf');
  const zero = value => Math.abs(value)<1e-9 ? 0 : value;

  const ctx={add,check,decision,trial};
  const sizing=transmissionMath(ctx);
  const {useSteel,iterate}=sizing;
  section('Engranes rectos');
  const {module,diametral,pinion,gearDiameter,faceMm,wt,wr,kd,ke,gearFatigue,gearStatic}=
    sizeSpurGears(c,{torque:power.shaftTorque,rpm:power.shaftRpm},ctx,sizing);
  if(Math.abs(pinion-160)>1e-9||Math.abs(gearDiameter-640)>1e-9){
    note('La geometría propuesta da diámetros primitivos distintos de los 160 y 640 mm del plano de la tarea. Esta corrida dimensiona la nueva geometría.');
  }

  section('Equilibrio de la flecha');
  text('Apoyos 1 y 4, piñón en 2 y polea en 3. Se conserva el convenio del proyecto para las componentes del piñón y la banda. Apuntes, p. 14.');
  const {x2,x3,span}=c;
  check(x2>0&&x3>x2&&span>x3,'Las posiciones deben cumplir 0 < x₂ < x₃ < distancia entre apoyos.');
  eq(math`x_2=${mm(x2)};\quad x_3=${mm(x3)};\quad L=${mm(span)}`);
  const planes=[['y',-wt,belt.fy],['z',-wr,belt.fz]].map(([axis,g,b])=>{
    const r4=-(g*x2+b*x3)/span, r1=-g-b-r4;
    const m2=r1*x2/1000, m3=(r1*x3+g*(x3-x2))/1000;
    heading('Plano '+axis.toUpperCase());
    eq(math`F_{g${axis}}=${force(g)};\quad F_{b${axis}}=${force(b)}`);
    eq(math`\sum M_1=R_{4${axis}}L+F_g x_2+F_b x_3=0`);
    eq(math`R_{4${axis}}=-\frac{(${n(g)})(${n(x2)})+(${n(b)})(${n(x3)})}{${n(span)}}=${force(r4)}`);
    eq(math`R_{1${axis}}=-F_g-F_b-R_4=-(${n(g)})-(${n(b)})-(${n(r4)})=${force(r1)}`);
    eq(math`V_{1-2}=${force(r1)};\quad V_{2-3}=${force(r1+g)};\quad V_{3-4}=${force(r1+g+b)}`);
    eq(math`M_{2${axis}}=(${n(r1)})(${n(x2/1000)})=${moment(m2)}`);
    eq(math`M_{3${axis}}=(${n(r1)})(${n(x3/1000)})+(${n(g)})(${n((x3-x2)/1000)})=${moment(m3)}`);
    eq(math`\sum F_{${axis}}=${force(zero(r1+r4+g+b))};\quad M_{4${axis}}=${moment(zero((r1*span+g*(span-x2)+b*(span-x3))/1000))}`);
    return {r1,r4,m2,m3,v:[r1,r1+g,r1+g+b],m:[0,m2,m3,0]};
  });
  const resultant=(key)=>Math.hypot(...planes.map(plane=>plane[key]));
  const envelope=belt.states.map(state=>{
    const pair=[[-wt,state.fy],[-wr,state.fz]].map(([g,b])=>{
      const r4=-(g*x2+b*x3)/span, r1=-g-b-r4;
      return [r1,r4,r1*x2/1000,(r1*x3+g*(x3-x2))/1000];
    });
    return {angle:state.phi*180/Math.PI,values:pair[0].map((v,i)=>Math.hypot(v,pair[1][i]))};
  });
  const critical=[0,1,2,3].map(i=>envelope.reduce((a,b)=>b.values[i]>a.values[i]?b:a));
  const loads=critical.slice(0,2).map((s,i)=>s.values[i]);
  const moments=critical.slice(2).map((s,i)=>s.values[i+2]);
  heading('Resultantes y torsión');
  for(const [key,label,formatter] of [['r1','F_{r1}',force],['r4','F_{r4}',force],['m2','M_2',moment],['m3','M_3',moment]]){
    eq(math`${label}=\sqrt{(${n(planes[0][key])})^2+(${n(planes[1][key])})^2}=${formatter(resultant(key))}`);
  }
  eq(math`T_{2-3}=T_e=${moment(power.shaftTorque)}`);
  text('El momento por plano es lineal entre puntos de carga. El torque se aplica en el tramo entre polea y piñón.');

  heading('Envolvente con el tensor');
  text('Se repite el equilibrio anterior en 101 posiciones. La selección de rodamientos y el dimensionamiento usan los máximos de reacción y momento de cada sección.');
  critical.forEach((state,i)=>{
    const label=['F_{r1,\\max}','F_{r4,\\max}','M_{2,\\max}','M_{3,\\max}'][i];
    eq(math`${label}=${i<2?force(state.values[i]):moment(state.values[i])};\quad \phi=${n(state.angle)}^\circ`);
  });

  section('Dimensionamiento de la flecha');
  text('Apuntes, pp. 9–22. Flexión alternante, torsión media y criterio elíptico de Hencky–Marin. La libreta usa el inverso de la suma de cuadrados como índice; su raíz cuadrada es el multiplicador de carga sobre la misma trayectoria. El entalle se aplica una vez al esfuerzo.');
  check(shaftLoadFactors.some(({value})=>value===c.kc),'Selecciona un factor de carga de la tabla.');
  check(c.shaftStart>0&&c.fillet>0&&c.ktFlex>=1&&c.ktTors>=1&&c.shaftFat>=1&&c.shaftStatic>=1,'Revisa el diámetro inicial, filete, factores y seguridades de flecha.');
  const shaftSteelIndex=c.shaftSteel;
  const shaft=useSteel(shaftSteelIndex,c.shaftFinish);
  text('Las figuras 6-20 y 6-21 indican usar la ordenada de r = 0.16 in para radios mayores.');
  text('El factor k_c se aplica como hipótesis de tipo de carga. Los valores tabulados son 1 para flexión, 0.85 para carga axial y 0.59 para torsión. Usar 0.59 para el término de flexión es una elección conservadora del modelo.');
  const sectionRatios=[1,1.2];
  function shaftSection(shaft,base,i,show){
    const d=sectionRatios[i]*base;
    const M=moments[i]*1000, T=power.shaftTorque*1000;
    if(show) eq(math`d_{${i+2}}=${n(sectionRatios[i])}(${n(base,5)})=${mm(d)};\quad r=${n(c.fillet)}(${n(d,5)})=${mm(c.fillet*d)}`);
    return shaftStress(c,shaft,{d,M,T,kd,ke},sizing,show);
  }
  check(c.shaftStart>=2.79&&1.2*c.shaftStart<=254,'El diámetro inicial debe quedar en el intervalo de la tabla de tamaño.');
  function solveDiameter(shaft){
    return iterate(c.shaftStart,'diámetro base (mm)',base=>{
      if(base<2.79||base*1.2>254) return NaN;
      const needs=sectionRatios.map((ratio,i)=>{
        const {M,T,se,kf,kfs}=shaftSection(shaft,base,i,true);
        const local=Math.cbrt(32*Math.sqrt(c.shaftFat)/Math.PI*Math.hypot(kf*M/se,Math.sqrt(.75)*kfs*T/shaft.sut));
        eq(math`d_{req}=\left[\frac{32\sqrt n}{\pi}\sqrt{(K_fM/S_e)^2+\tfrac34(K_{fs}T/S_{ut})^2}\right]^{1/3}`);
        eq(math`d_{req}=\left[\frac{32\sqrt{${n(c.shaftFat)}}}{\pi}\sqrt{\left(\frac{${n(kf,5)}\cdot ${n(M)}}{${n(se)}}\right)^2+\tfrac34\left(\frac{${n(kfs,5)}\cdot ${n(T)}}{${n(shaft.sut)}}\right)^2}\right]^{1/3}`);
        eq(math`d_{req}=${mm(local)};\quad d_{\mathrm{base,req}}=\frac{${n(local,5)}}{${n(ratio)}}=${mm(local/ratio)}`);
        return local/ratio;
      });
      const next=Math.max(...needs);
      eq(math`d_{\mathrm{nuevo}}=\max(${needs.map(v=>n(v,5)).join(',')})=${mm(next)}`);
      return next;
    },true);
  }

  check(c.life>0&&c.bearingStatic>=1&&[0,1].includes(c.bearingType),'Revisa la vida, serie y seguridad estática de rodamientos.');
  const bearingType=c.bearingType===0?'Ranura profunda':'Contacto angular';
  const life=60*power.shaftRpm*c.life/1e6;
  const requirements=loads.map(load=>[load*Math.cbrt(life)/1000,c.bearingStatic*load/1000]);
  const column=c.bearingType===0?6:8;
  const bearingOptions=referenceTables[3].rows.map(row=>{
    const [d,,,rmax,shoulder]=row;
    const [C10,C0]=row.slice(column,column+2);
    const passes=requirements.map(([dynamic,staticLoad])=>[C10>=dynamic,C0>=staticLoad]);
    const shoulders=1.2*d>=shoulder&&1.5*d>=shoulder;
    const directMount=c.fillet*d<=rmax;
    return {row,passes,shoulders,directMount,fit:shoulders&&passes.every(pair=>pair.every(Boolean))};
  });

  heading('Dimensionamiento con el acero propuesto');
  text('Todos los candidatos usan '+shaft.label+' y las propiedades de su fila. El diámetro inicial es el punto de partida del cálculo continuo. Se prueban agujeros de la tabla 11-2 en orden creciente y se verifican fatiga, estática, vida, hombros e interferencia del filete.');
  eq(math`d_{\mathrm{inicial}}=${mm(c.shaftStart)};\quad S'_e=0.5(${n(shaft.sut)})=${stress(.5*shaft.sut)};\quad k_c=${n(c.kc)};\quad k_d=${n(kd)};\quad k_e=${n(ke)}`);
  eq(math`n_{f,\min}=${n(c.shaftFat)};\quad n_{est,\min}=${n(c.shaftStatic)}`);
  const continuous=solveDiameter(shaft);
  heading('Verificación por diámetro de catálogo');
  text('La medida final se decide con las comprobaciones directas de cada diámetro. El resultado continuo sirve como referencia de dimensionamiento.');
  const shaftDecision=decision(5,'Diámetro base de la flecha','mm',
    shaft.label+'. Se prueban agujeros compatibles con la vida, la carga y los hombros de los rodamientos.'
    +(continuous===null?'':' El cálculo continuo dio '+n(continuous,2)+' mm.'));
  const shaftTrials=[];
  let chosen;
  for(const {row,fit} of bearingOptions){
    if(!fit) continue;
    const d=row[0];
    add('iteration','Flecha candidata · '+n(d)+' mm · '+shaft.label);
    const sections=sectionRatios.map((_,i)=>shaftSection(shaft,d,i,false));
    const fatigue=Math.min(...sections.map(value=>value.nf));
    const staticSafety=Math.min(...sections.map(value=>value.ns));
    const fatigueOk=fatigue>=c.shaftFat, staticOk=staticSafety>=c.shaftStatic;
    const accepted=fatigueOk&&staticOk;
    eq(math`n_{f,2}=${n(sections[0].nf,4)};\quad n_{est,2}=${n(sections[0].ns,4)};\quad n_{f,3}=${n(sections[1].nf,4)};\quad n_{est,3}=${n(sections[1].ns,4)}`);
    const reason='Fatiga '+(fatigueOk?'cumple':'insuficiente')+' para el objetivo '+n(c.shaftFat)+'. Estática '+(staticOk?'cumple':'insuficiente')+' para el objetivo '+n(c.shaftStatic)+'.';
    text(reason);
    trial(shaftDecision,d,accepted?'selected':'rejected',reason+' Índice mínimo de Hencky–Marin de '+n(fatigue,4)+' y factor estático mínimo de '+n(staticSafety,4)+'.');
    shaftTrials.push({index:shaftSteelIndex,continuous,diameter:d,fatigue,static:staticSafety,reason,accepted});
    if(accepted){
      chosen=row;
      break;
    }
  }
  if(shaftTrials.length&&!chosen) note('Los diámetros compatibles con los rodamientos se agotaron con '+shaft.label+'.');

  const bearingStageStart=entries.length;
  section('Rodamientos y cierre');
  text('Apuntes, pp. 56–60, tablas 11-1 y 11-2. Engranes rectos y banda plana sin empuje axial externo: V = 1, X = 1, Y = 0. La vida L10 corresponde al 90 % de confiabilidad de rodamiento.');
  text(bearingType+' · serie 02. Ambos apoyos usan el mismo diámetro base.');
  const bearingDecision=decision(6,'Agujero de los rodamientos','mm',
    bearingType+' de la serie 02, tabla 11-2. Se busca un agujero común que cubra '+n(c.life)+' h de vida L10, estática y hombros en ambos apoyos. El radio de montaje directo se comprueba para cada medida.');
  eq(math`L_{10}=\frac{60(${n(power.shaftRpm)})(${n(c.life)})}{10^6}=${n(life)}\quad\text{millones de revoluciones}`);
  requirements.forEach(([dynamic,staticLoad],i)=>{
    const load=loads[i], side=i===0?1:4;
    eq(math`P_{${side}}=XVF_r+YF_a=(1)(1)(${n(load)})+0=${force(load)}`);
    eq(math`C_{10,req,${side}}=P L_{10}^{1/3}=${n(load/1000,5)}(${n(life)})^{1/3}=${kip(dynamic)}`);
    eq(math`C_{0,req,${side}}=n_0 F_r=${n(c.bearingStatic)}(${n(load/1000,5)})=${kip(staticLoad)}`);
  });

  for(const option of bearingOptions){
    const {row,passes,shoulders,directMount}=option;
    const [d]=row;
    const [C10,C0]=row.slice(column,column+2);
    add('iteration','Candidato · '+d+' mm');
    eq(math`d=${mm(d)};\quad C_{10}=${kip(C10)};\quad C_0=${kip(C0)}`);
    const failures=[];
    passes.forEach(([dynamicPass,staticPass],i)=>{
      text('Apoyo '+(i===0?1:4)+'. Dinámica '+(dynamicPass?'cumple':'insuficiente')+', estática '+(staticPass?'cumple':'insuficiente')+'.');
      const support=i===0?' en el apoyo 1':' en el apoyo 4';
      if(!dynamicPass) failures.push('Capacidad dinámica insuficiente'+support+'.');
      if(!staticPass) failures.push('Capacidad estática insuficiente'+support+'.');
    });
    const mount=directMount?'El radio del filete permite montaje directo.':'El radio del filete requiere resolver la interferencia de montaje.';
    text('Hombros '+(shoulders?'compatibles':'insuficientes')+'. '+mount);
    if(!shoulders) failures.push('Hombros insuficientes.');
    if(row===chosen){
      trial(bearingDecision,d,'selected','Cumple vida, estática y hombros. Coincide con el diámetro aprobado de la flecha. '+mount);
      text('Diámetro seleccionado en conjunto con '+shaft.label+'.');
      break;
    }
    if(option.fit){
      const reason='Cumple vida, estática y hombros. Se descarta en la comprobación de la flecha con '+shaft.label+'. '+mount;
      text('Se descartó este diámetro en la comprobación de la flecha con '+shaft.label+'.');
      trial(bearingDecision,d,'viable',reason);
    } else {
      trial(bearingDecision,d,'rejected',failures.join(' '));
    }
  }
  check(shaftTrials.length,'La tabla 11-2 no ofrece agujeros compatibles con la vida, las cargas y los hombros de la serie propuesta.',6);
  check(chosen,'Con '+shaft.label+', ningún diámetro compatible de la tabla 11-2 alcanza las seguridades de la flecha.',5);
  heading('Selección y verificación comercial');
  const [diameter,outer,bearingWidth,rmax,shoulder,housing]=chosen;
  const [C10,C0]=chosen.slice(column,column+2);
  eq(math`d_{base}=${mm(diameter)};\quad D=${mm(outer)};\quad B=${mm(bearingWidth)}`);
  eq(math`d_{s,\min}=${mm(shoulder)};\quad d_{H,\max}=${mm(housing)};\quad r_{\max}=${mm(rmax)}`);
  eq(math`1.2d=${mm(1.2*diameter)};\quad 1.5d=${mm(1.5*diameter)}`);
  const bearingLife=loads.map(load=>load ? 1e6*(C10*1000/load)**3/(60*power.shaftRpm) : Infinity);
  loads.forEach((load,i)=>{
    const hours=bearingLife[i];
    if(!load){text('Apoyo '+(i===0?1:4)+' sin carga radial en este modelo.');return;}
    eq(math`L_{10h,${i===0?1:4}}=\frac{10^6(${n(C10)}/${n(load/1000,6)})^3}{60(${n(power.shaftRpm)})}=${display(hours,'h')}`);
    eq(math`n_{0,${i===0?1:4}}=\frac{${n(C0)}}{${n(load/1000,6)}}=${n(C0*1000/load)}`);
  });
  const shaftVerificationStart=entries.length;
  heading('Fatiga y resistencia del diámetro comercial');
  text('La comprobación utiliza el diámetro común que se selecciona en la etapa de rodamientos.');
  eq(math`d_{base}=${mm(diameter)}`);
  const stockReview={
    base:diameter,
    section:1.2*diameter,
    shoulder:1.5*diameter,
    a20CoversFinishedSizes:diameter>=18&&1.5*diameter<=32
  };
  heading('Alcance de las tablas de acero');
  text('Tabla A-20, p. 1004: mínimos ASTM estimados para tamaños de 18 a 32 mm, sujetos a los requisitos de suministro indicados en la tabla.');
  text('Tabla A-21, pp. 1005–1006: propiedades medias de probetas de 0.505 in (12.83 mm) mecanizadas de barras redondas de 1 in (25.4 mm). Los valores de temple y revenido proceden de una sola colada. Las filas no garantizan mínimos para la barra de esta flecha.');
  eq(math`d_{base}=${mm(stockReview.base)};\quad d_3=${mm(stockReview.section)};\quad d_{hombro}=${mm(stockReview.shoulder)}`);
  if(!stockReview.a20CoversFinishedSizes) {
    note('El acero elegido cumple el modelo con la fila tabulada. La comprobación es provisional porque estas tablas no garantizan resistencias mínimas para el tamaño de suministro de la flecha.');
  } else {
    note('Los tamaños acabados quedan dentro del intervalo dimensional de A-20. Se debe comprobar que el tamaño de suministro y la especificación ASTM correspondan a la fila usada. A-21 sigue aportando valores medios.');
  }
  text('Para cerrar la selección, solicita el certificado del lote con los mínimos de Sut y Sy para el grado, el estado de suministro o tratamiento y el diámetro real de partida. Si la flecha se mecaniza de una sola barra, el diámetro de partida debe cubrir el hombro de '+n(stockReview.shoulder)+' mm más el sobrematerial de mecanizado.');
  const shaftFatigue=[],shaftStatic=[];
  sectionRatios.forEach((_,i)=>{
    const {d,M,T,se,kf,kfs,a,m,nf,ns}=shaftSection(shaft,diameter,i,true);
    shaftFatigue.push(nf);
    shaftStatic.push(ns);
    eq(math`\sigma_a=\frac{32(${n(kf,5)})(${n(M)})}{\pi(${n(d)})^3}=${stress(a)}`);
    eq(math`\sigma_{m,eq}=\sqrt3\frac{16(${n(kfs,5)})(${n(T)})}{\pi(${n(d)})^3}=${stress(m)}`);
    eq(math`n_f=\frac{1}{(${n(a)}/${n(se)})^2+(${n(m)}/${n(shaft.sut)})^2}=${n(nf,4)}`);
    eq(math`n_{est}=\frac{${n(shaft.sy)}}{\sqrt{(${n(a)})^2+(${n(m)})^2}}=${n(ns,4)}`);
  });
  const shaftVerification=entries.splice(shaftVerificationStart);
  entries.splice(bearingStageStart,0,...shaftVerification);
  const fillet=c.fillet*diameter;
  const bearingMountPending=fillet>rmax;
  if(bearingMountPending){
    eq(math`r_{filete}=${mm(fillet)}>r_{\max}=${mm(rmax)}`);
    note('El montaje directo presenta interferencia. Queda por definir en el plano la interfaz que libre el filete de '+n(fillet)+' mm y apoye en el rodamiento con el radio límite de '+n(rmax)+' mm de la tabla 11-2.');
  }
  return {module,diametral,pinion,gear:gearDiameter,faceMm,wt,wr,loads,moments,continuous,diameter,planes,kd,ke,gearFatigue,gearStatic,shaftFatigue,shaftStatic,bearingLife,bearingMountPending,stockReview,shaftSteelIndex,shaftTrials};
}

function solveComponentGears(c,ctx){
  const {add}=ctx;
  const result=sizeSpurGears(c,{torque:c.torque,rpm:c.rpm},ctx);
  const ratio=c.ng/c.np;
  const outputSpeed=c.rpm/ratio;
  const bigger=Math.max(result.pinion,result.gearDiameter);
  const r1=45*result.pinion/bigger, r2=45*result.gearDiameter/bigger;
  add('heading','Relación y velocidad de salida');
  add('eq',math`i=\frac{N_g}{N_p}=\frac{${c.ng}}{${c.np}}=${number(ratio,4)};\quad n_g=\frac{n_p}{i}=\frac{${number(c.rpm)}}{${number(ratio,4)}}=${display(outputSpeed,'rpm')}`);
  add('diagram',{
    title:'Engrane recto exterior',
    caption:'Vista esquemática de los círculos primitivos. Las fuerzas tangencial y radial actúan en el punto de contacto.',
    marks:[
      ['circle',155-r1,60,r1], ['circle',155+r2,60,r2],
      ['line',155,60,155,111], ['line',155,111,151,105], ['line',155,111,159,105],
      ['line',155,60,106,60], ['line',106,60,112,56], ['line',106,60,112,64],
      ['label',168,111,'Wt'], ['label',99,73,'Wr'],
      ['label',67,15,'Piñón · '+c.np+' dientes'], ['label',199,7,'Rueda · '+c.ng+' dientes'],
      ['label',329,84,'Cara '+number(result.faceMm,2)+' mm'],
      ['label',329,50,'Entre centros '+number(result.centerDistance,2)+' mm']
    ]
  });
  return {metrics:[
    ['Ancho de cara',result.faceMm,'mm',3],
    ['Módulo',result.module,'mm',3],
    ['Distancia entre centros',result.centerDistance,'mm',3],
    ['Velocidad de la rueda',outputSpeed,'rpm',2],
    ['Fuerza tangencial',result.wt,'N',2],
    ['Fuerza radial',result.wr,'N',2],
    ['Factor mínimo a fatiga',Math.min(...result.gearFatigue),'',4],
    ['Factor estático mínimo',Math.min(...result.gearStatic),'',4]
  ]};
}

function solveComponentShaft(c,ctx){
  const {add,check,decision,trial}=ctx;
  const sizing=transmissionMath(ctx);
  const {eq,text,mm,stress,useSteel,interpolate,iterate}=sizing;
  const n=number;
  const dMin=2.79, dMax=254;
  check(Number.isFinite(c.moment)&&c.moment>=0&&Number.isFinite(c.torque)&&c.torque>=0&&(c.moment>0||c.torque>0),
    'Ingresa magnitudes de momento y torque no negativas, con al menos una mayor que cero.');
  check(Number.isFinite(c.shaftStart)&&c.shaftStart>=dMin&&c.shaftStart<=dMax,
    'El diámetro inicial debe estar en el intervalo de 2.79 a 254 mm del factor de tamaño.');
  check(Number.isFinite(c.fillet)&&c.fillet>0&&[c.ktFlex,c.ktTors,c.shaftFat,c.shaftStatic].every(v=>Number.isFinite(v)&&v>=1),
    'Revisa el filete, los concentradores y los objetivos de seguridad. Los concentradores y objetivos deben ser al menos 1.');
  check(shaftLoadFactors.some(({value})=>value===c.kc),'Selecciona un factor de carga de la tabla de clase.');
  const shaft=useSteel(c.shaftSteel,c.shaftFinish);
  const kd=interpolate(referenceTables[7].rows,c.temperature,'Temperatura');
  const ke=interpolate(referenceTables[6].rows,c.reliability,'Confiabilidad');
  const M=c.moment*1000, T=c.torque*1000;
  const elasticBend=32*c.ktFlex*M/Math.PI, elasticShear=16*c.ktTors*T/Math.PI;
  const elasticEquivalent=Math.hypot(elasticBend,Math.sqrt(3)*elasticShear);
  const staticDiameter=Math.cbrt(c.shaftStatic*elasticEquivalent/shaft.sy);

  add('heading','Cargas de la sección crítica');
  text('Se comprueba una sección circular maciza con flexión completamente alternante y torsión constante. El índice de Hencky–Marin sigue la definición de la libreta. Para la fluencia se usan los concentradores elásticos propuestos y el esfuerzo equivalente de von Mises.');
  eq(math`M_a=${n(c.moment)}\,\mathrm{N\,m}=${display(M,'N\\,mm')};\quad T_m=${n(c.torque)}\,\mathrm{N\,m}=${display(T,'N\\,mm')}`);
  eq(math`S'_e=0.5(${n(shaft.sut)})=${stress(.5*shaft.sut)};\quad k_c=${n(c.kc)};\quad k_d=${n(kd)};\quad k_e=${n(ke)}`);
  text('El radio se calcula a partir de la relación r/d ingresada. Las figuras 6-20 y 6-21 usan la ordenada de r = 0.16 in para radios mayores.');
  add('heading','Diámetro por fluencia');
  eq(math`d_{\mathrm{est}}=\left[\frac{n_{\mathrm{est,obj}}}{S_y}\sqrt{\left(\frac{32K_t M_a}{\pi}\right)^2+3\left(\frac{16K_{ts}T_m}{\pi}\right)^2}\right]^{1/3}`);
  eq(math`d_{\mathrm{est}}=\left[\frac{${n(c.shaftStatic)}}{${n(shaft.sy)}}\sqrt{\left(\frac{32(${n(c.ktFlex)})(${n(M)})}{\pi}\right)^2+3\left(\frac{16(${n(c.ktTors)})(${n(T)})}{\pi}\right)^2}\right]^{1/3}=${mm(staticDiameter)}`);

  add('heading','Iteración por fatiga y selección del diámetro continuo');
  const log=decision(5,'Diámetro de la sección crítica','mm',shaft.label+'. El diámetro continuo se verifica con las cargas dadas y el intervalo del factor de tamaño.');
  const diameter=iterate(c.shaftStart,'diámetro de la flecha (mm)',d=>{
    eq(math`d=${mm(d)};\quad r=(${n(c.fillet)})(${n(d,5)})=${mm(c.fillet*d)}`);
    const {kf,kfs,se}=shaftStress(c,shaft,{d,M,T,kd,ke},sizing);
    const fatigueDiameter=Math.cbrt(32*Math.sqrt(c.shaftFat)/Math.PI*Math.hypot(kf*M/se,Math.sqrt(.75)*kfs*T/shaft.sut));
    eq(math`d_{\mathrm{fat}}=\left[\frac{32\sqrt{n_{\mathrm{fat,obj}}}}{\pi}\sqrt{\left(\frac{K_f M_a}{S_e}\right)^2+\tfrac34\left(\frac{K_{fs}T_m}{S_{ut}}\right)^2}\right]^{1/3}`);
    eq(math`d_{\mathrm{fat}}=\left[\frac{32\sqrt{${n(c.shaftFat)}}}{\pi}\sqrt{\left(\frac{${n(kf,5)}(${n(M)})}{${n(se,4)}}\right)^2+\tfrac34\left(\frac{${n(kfs,5)}(${n(T)})}{${n(shaft.sut)}}\right)^2}\right]^{1/3}=${mm(fatigueDiameter)}`);
    const next=Math.max(dMin,staticDiameter,fatigueDiameter);
    eq(math`d_{\mathrm{req}}=\max(${n(dMin)},${n(staticDiameter,5)},${n(fatigueDiameter,5)})=${mm(next)}`);
    if(next>dMax) text('Se verifica el extremo superior del intervalo del factor de tamaño.');
    return Math.min(dMax,next);
  },false,0.000001);

  add('heading','Comprobación de fatiga y fluencia');
  const {a,m,nf,se,kf,kfs}=shaftStress(c,shaft,{d:diameter,M,T,kd,ke},sizing);
  const sigma=elasticBend/diameter**3, tau=elasticShear/diameter**3;
  const equivalent=Math.hypot(sigma,Math.sqrt(3)*tau);
  const staticFactor=shaft.sy/equivalent;
  eq(math`\sigma_a=\frac{32(${n(kf,5)})(${n(M)})}{\pi(${n(diameter,5)})^3}=${stress(a)};\quad \sigma_{m,eq}=\frac{\sqrt3 16(${n(kfs,5)})(${n(T)})}{\pi(${n(diameter,5)})^3}=${stress(m)}`);
  eq(math`n_{\mathrm{fat}}=\frac{1}{\left(${n(a,4)}/${n(se,4)}\right)^2+\left(${n(m,4)}/${n(shaft.sut)}\right)^2}=${n(nf,5)}`);
  eq(math`\sigma_{\mathrm{VM}}=\sqrt{(${n(sigma,4)})^2+3(${n(tau,4)})^2}=${stress(equivalent)};\quad n_{\mathrm{est}}=\frac{${n(shaft.sy)}}{${n(equivalent,4)}}=${n(staticFactor,5)}`);
  const qualifies=nf>=c.shaftFat*(1-1e-8)&&staticFactor>=c.shaftStatic*(1-1e-8);
  trial(log,diameter,qualifies?'calculated':'rejected',
    'Índice de fatiga '+n(nf,4)+' frente a '+n(c.shaftFat)+' requerido. Factor de fluencia '+n(staticFactor,4)+' frente a '+n(c.shaftStatic)+' requerido.');
  check(qualifies,'El diámetro evaluado de '+n(diameter,3)+' mm queda por debajo de los objetivos de seguridad de la sección.');
  add('note',shaft.table==='A-20'
    ?'La tabla A-20 indica un intervalo de 18–32 mm para sus estimaciones ASTM. La aplicación a la barra suministrada depende de su tamaño y condición.'
    :'La tabla A-21 reporta valores medios para probetas de barras de 25.4 mm. La aplicación a la barra suministrada depende de su tamaño y condición.');
  add('diagram',{
    title:'Sección crítica de una flecha circular',
    caption:'Esquema de la sección y magnitudes aplicadas. El diámetro mostrado corresponde al cálculo continuo.',
    marks:[
      ['circle',210,63,34], ['line',176,63,244,63],
      ['line',176,63,181,66], ['line',176,63,181,60], ['line',244,63,239,66], ['line',244,63,239,60],
      ['label',210,109,'d = '+n(diameter,2)+' mm'],
      ['label',84,64,'Flexión '+n(c.moment,2)+' N·m'],
      ['label',333,64,'Torsión '+n(c.torque,2)+' N·m'],
      ['label',210,13,'Filete r = '+n(c.fillet*diameter,2)+' mm']
    ]
  });
  return {metrics:[
    ['Diámetro calculado',diameter,'mm',3],
    ['Diámetro por fluencia',staticDiameter,'mm',3],
    ['Índice de Hencky–Marin',nf,'',4],
    ['Factor de fluencia',staticFactor,'',4],
    ['Radio de filete',c.fillet*diameter,'mm',3]
  ]};
}
