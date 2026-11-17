'use strict';

const steels = [referenceTables[1], referenceTables[2]].flatMap(({rows}, table) =>
  rows.map(row => {
    const [aisi, process] = row;
    const i = table ? 3 : 2;
    const label = 'AISI ' + aisi + ' ' + process + (table ? ' · ' + row[2] + ' °C' : '');
    return {label, sut:row[i], sy:row[i+2], table:table ? 'A-21' : 'A-20'};
  }));
const finishes = referenceTables[5].rows;

function finishDesign(c, power, belt, add, check) {
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
  const rad = deg => deg*Math.PI/180;
  const zero = value => Math.abs(value)<1e-9 ? 0 : value;

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

  function notch(sut, radiusMm, kt, torsion, symbol, show = true) {
    const showEquation = show ? eq : () => {};
    const S = sut/6.894757293;
    let q = 1;
    if (S >= 60 && S <= 200) {
      const [a,b,d,e] = torsion ? [.190,.00251,.0000135,.0000000267] : [.246,.00308,.0000151,.0000000267];
      const root = a-b*S+d*S*S-e*S**3;
      q = 1/(1+root/Math.sqrt(radiusMm/25.4));
      showEquation(math`\sqrt{a_{${symbol}}}=${n(a)}-${n(b,5)}(${n(S)})+${n(d,8)}(${n(S)})^2-${n(e,11)}(${n(S)})^3=${n(root,6)}`);
      showEquation(math`q_{${symbol}}=\frac{1}{1+\sqrt{a_{${symbol}}}/\sqrt{r_{\mathrm{in}}}}=\frac{1}{1+${n(root,6)}/\sqrt{${n(radiusMm/25.4,6)}}}=${n(q,5)}`);
    } else if (show) {
      text('Fuera del intervalo de 60 a 200 kpsi de la figura de entalle, se adopta q = 1 como cota conservadora.');
    }
    const kf=1+q*(kt-1);
    showEquation(math`K_{f,${symbol}}=1+q_{${symbol}}(K_t-1)=1+${n(q,5)}(${n(kt)}-1)=${n(kf,5)}`);
    return kf;
  }

  function iterate(start, label, step) {
    let current = start;
    for (let k=1;k<=100;k++) {
      add('iteration', 'Iteración ' + k + ' · ' + label);
      const next = step(current);
      const error = 100*Math.abs(next-current)/next;
      check(Number.isFinite(error), 'La iteración produjo un valor inválido.');
      eq(math`\varepsilon=\frac{|${n(next,6)}-${n(current,6)}|}{${n(next,6)}}100=${n(error,5)}\,\%`);
      text(error < tolerance ? 'Converge con error menor al 3 %.' : 'Se usa el resultado en la siguiente iteración.');
      if (error<tolerance) return next;
      current=next;
    }
    check(false, 'La iteración de ' + label + ' no convergió en 100 pasos.');
  }

  section('Engranes rectos');
  text('Métodos de la libreta, pp. 28–39. Lewis para flexión del diente y verificación de fatiga pulsante con los factores del ejemplo.');
  check([c.np,c.ng].every(value=>Number.isInteger(value)&&value>0), 'Los dientes deben ser enteros positivos.');
  check(Math.abs(c.pinion/c.np-c.gear/c.ng)<1e-9, 'Los dos engranes deben tener el mismo módulo.');
  check(c.phi>0&&c.phi<90&&c.yp>0&&c.yg>0&&c.ktGear>=1&&c.gearFat>=1&&c.gearStatic>=1, 'Revisa el ángulo, los factores de Lewis, Kt y las seguridades de engranes.');
  const kd=interpolate(referenceTables[7].rows,c.temperature,'Temperatura');
  const ke=interpolate(referenceTables[6].rows,c.reliability,'Confiabilidad');
  const gear=useSteel(c.gearSteel,c.gearFinish);
  note('Los factores de Lewis y los concentradores son propuestas editables. Coteja los valores con el perfil real y las gráficas del curso.');
  const module=c.pinion/c.np, diametral=25.4/module;
  const pitch=Math.PI/diametral, minFace=3*pitch, maxFace=5*pitch;
  const wt=2000*power.shaftTorque/c.pinion, wr=wt*Math.tan(rad(c.phi));
  const speed=Math.PI*(c.pinion/25.4)*power.shaftRpm/12;
  const kv=1200/(1200+speed);
  eq(math`m_p=\frac{${n(c.pinion)}}{${c.np}}=m_g=\frac{${n(c.gear)}}{${c.ng}}=${mm(module)}`);
  eq(math`P_d=25.4/m=${n(diametral,5)}\,\mathrm{in}^{-1};\quad p=\pi/P_d=${mm(25.4*pitch)}`);
  eq(math`a=1/P_d=${mm(25.4/diametral)};\quad b=1.25/P_d=${mm(1.25*25.4/diametral)}`);
  eq(math`C=\frac{${n(c.pinion)}+${n(c.gear)}}{2}=${mm((c.pinion+c.gear)/2)}`);
  eq(math`W_t=2T_e/d_p=\frac{2(${n(power.shaftTorque)})}{${n(c.pinion/1000)}}=${force(wt)}`);
  eq(math`W_r=W_t\tan\phi=${n(wt)}\tan(${n(c.phi)}^\circ)=${force(wr)}`);
  eq(math`v=\frac{\pi(${n(c.pinion/25.4)})(${n(power.shaftRpm)})}{12}=${dual(speed,'ft/min',.3048/60,'m/s')}`);
  eq(math`K_v=\frac{1200}{1200+v}=\frac{1200}{1200+${n(speed)}}=${n(kv,5)}`);
  eq(math`3p=${mm(minFace*25.4)};\quad 5p=${mm(maxFace*25.4)};\quad k_d=${n(kd)};\quad k_e=${n(ke)}`);
  const radius=.3/diametral*25.4;
  eq(math`r=\frac{0.3}{P_d}=${mm(radius)}`);
  const gearKf=notch(gear.sut,radius,c.ktGear,false,'g');
  function faceCheck(width) {
    return [c.yp,c.yg].map((y,i)=>{
      const label=i===0?'p':'g';
      const t=Math.sqrt(4*(2.25/diametral)*(3*y/(2*diametral)));
      const equivalent=.808*Math.sqrt(width*t), kb=(equivalent/.3)**(-.107);
      const se=1.33*.5*gear.sut*gear.ka*kb*kd*ke;
      const lewis=wt/lbf*diametral/(y*kv);
      const sigma=lewis/width*.006894757293;
      eq(math`t_{${label}}=\sqrt{4\frac{2.25}{${n(diametral,5)}}\frac{3(${n(y)})}{2(${n(diametral,5)})}}=${display(t,'in',5)}`);
      eq(math`d_{eq,${label}}=0.808\sqrt{${n(width,5)}\cdot ${n(t,5)}}=${display(equivalent,'in',5)}`);
      eq(math`k_b=(${n(equivalent,5)}/0.3)^{-0.107}=${n(kb,5)}`);
      eq(math`S_e=1.33(0.5)(${n(gear.sut)})(${n(gear.ka,5)})(${n(kb,5)})(${n(kd)})(${n(ke)})=${stress(se)}`);
      return {label,y,se,lewis,sigma};
    });
  }
  heading('Dimensionamiento iterativo de la cara');
  const width=iterate(minFace,'ancho de cara (in)',current=>{
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
    return next;
  });
  heading('Comprobación de piñón y rueda');
  const faceMm=Math.ceil((width*25.4-1e-10)/5)*5;
  eq(math`F_{com}=5\left\lceil\frac{${n(width*25.4,5)}}{5}\right\rceil=${mm(faceMm)}`);
  check(faceMm <= maxFace*25.4,'La cara comercial supera el máximo de 5 pasos circulares.');
  for(const {label,y,se,sigma} of faceCheck(faceMm/25.4)){
    const nFat=se/(gearKf*sigma), nStat=gear.sy/sigma;
    eq(math`\sigma_{${label}}=\frac{W_tP_d}{FY K_v}=\frac{${n(wt/lbf)}\cdot ${n(diametral,5)}}{${n(faceMm/25.4,5)}\cdot ${n(y)}\cdot ${n(kv,5)}}\,\mathrm{psi}=${stress(sigma)}`);
    eq(math`n_{fat,${label}}=\frac{${n(se)}}{${n(gearKf,5)}\cdot ${n(sigma)}}=${n(nFat,4)};\quad n_{est,${label}}=\frac{${n(gear.sy)}}{${n(sigma)}}=${n(nStat,4)}`);
    check(nFat>=c.gearFat&&nStat>=c.gearStatic,'El ancho comercial no satisface ambas seguridades de engranes.');
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
    return {r1,r4,m2,m3};
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
  text('Apuntes, pp. 9–22. Flexión alternante, torsión media y criterio elíptico de Hencky–Marin. El entalle se aplica una vez al esfuerzo.');
  check(c.shaftStart>0&&c.fillet>0&&c.kc>0&&c.kc<=1&&c.ktFlex>=1&&c.ktTors>=1&&c.shaftFat>=1&&c.shaftStatic>=1,'Revisa el diámetro inicial, filete, factores y seguridades de flecha.');
  const shaft=useSteel(c.shaftSteel,c.shaftFinish);
  eq(math`S'_e=0.5(${n(shaft.sut)})=${stress(.5*shaft.sut)};\quad k_c=${n(c.kc)};\quad k_d=${n(kd)};\quad k_e=${n(ke)}`);
  const sectionRatios=[1,1.2];
  function shaftSection(base,i,show){
    const d=sectionRatios[i]*base;
    check(d>=2.79&&d<=254,'Diámetro fuera del intervalo de kᵦ (2.79 a 254 mm).');
    const r=c.fillet*d, M=moments[i]*1000, T=power.shaftTorque*1000;
    if(show) eq(math`d_{${i+2}}=${n(sectionRatios[i])}(${n(base,5)})=${mm(d)};\quad r=${n(c.fillet)}(${n(d,5)})=${mm(r)}`);
    const kb=d<=51?(d/7.62)**(-.107):1.51*d**(-.157);
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
  const continuous=iterate(c.shaftStart,'diámetro base (mm)',base=>{
    const needs=sectionRatios.map((ratio,i)=>{
      const {M,T,se,kf,kfs}=shaftSection(base,i,true);
      const local=Math.cbrt(32*Math.sqrt(c.shaftFat)/Math.PI*Math.hypot(kf*M/se,Math.sqrt(.75)*kfs*T/shaft.sut));
      eq(math`d_{req}=\left[\frac{32\sqrt n}{\pi}\sqrt{(K_fM/S_e)^2+\tfrac34(K_{fs}T/S_{ut})^2}\right]^{1/3}`);
      eq(math`d_{req}=\left[\frac{32\sqrt{${n(c.shaftFat)}}}{\pi}\sqrt{\left(\frac{${n(kf,5)}\cdot ${n(M)}}{${n(se)}}\right)^2+\tfrac34\left(\frac{${n(kfs,5)}\cdot ${n(T)}}{${n(shaft.sut)}}\right)^2}\right]^{1/3}`);
      eq(math`d_{req}=${mm(local)};\quad d_{\mathrm{base,req}}=\frac{${n(local,5)}}{${n(ratio)}}=${mm(local/ratio)}`);
      return local/ratio;
    });
    const next=Math.max(...needs);
    eq(math`d_{\mathrm{nuevo}}=\max(${needs.map(v=>n(v,5)).join(',')})=${mm(next)}`);
    return next;
  });

  section('Rodamientos y cierre');
  text('Apuntes, pp. 56–60, tablas 11-1 y 11-2. Engranes rectos y banda plana sin empuje axial externo: V = 1, X = 1, Y = 0. La vida L10 corresponde al 90 % de confiabilidad de rodamiento.');
  check(c.life>0&&c.bearingStatic>=1&&[0,1].includes(c.bearingType),'Revisa la vida, serie y seguridad estática de rodamientos.');
  const bearingType=c.bearingType===0?'Ranura profunda':'Contacto angular';
  text(bearingType+' · serie 02. Ambos apoyos usan el mismo diámetro base.');
  const life=60*power.shaftRpm*c.life/1e6;
  eq(math`L_{10}=\frac{60(${n(power.shaftRpm)})(${n(c.life)})}{10^6}=${n(life)}\quad\text{millones de revoluciones}`);
  const requirements=loads.map((load,i)=>{
    const side=i===0?1:4;
    const dynamic=load*Math.cbrt(life)/1000, staticLoad=c.bearingStatic*load/1000;
    eq(math`P_{${side}}=XVF_r+YF_a=(1)(1)(${n(load)})+0=${force(load)}`);
    eq(math`C_{10,req,${side}}=P L_{10}^{1/3}=${n(load/1000,5)}(${n(life)})^{1/3}=${kip(dynamic)}`);
    eq(math`C_{0,req,${side}}=n_0 F_r=${n(c.bearingStatic)}(${n(load/1000,5)})=${kip(staticLoad)}`);
    return [dynamic,staticLoad];
  });
  let chosen;
  const column=c.bearingType===0?6:8;
  for(const row of referenceTables[3].rows){
    const [d,,,rmax,shoulder]=row;
    const [C10,C0]=row.slice(column,column+2);
    add('iteration','Candidato · '+d+' mm');
    eq(math`d=${mm(d)};\quad C_{10}=${kip(C10)};\quad C_0=${kip(C0)}`);
    const results= requirements.map(([dynamic,staticLoad],i)=>{
      const dynamicPass=C10>=dynamic, staticPass=C0>=staticLoad;
      text('Apoyo '+(i===0?1:4)+'. Dinámica '+(dynamicPass?'cumple':'insuficiente')+', estática '+(staticPass?'cumple':'insuficiente')+'.');
      return dynamicPass&&staticPass;
    });
    const diameter=d+1e-9>=continuous;
    const geometry=1.2*d>=shoulder&&1.5*d>=shoulder;
    text('Diámetro base mínimo '+(diameter?'cumple':'insuficiente')+'. Hombros '+(geometry?'compatibles':'insuficientes')+'.');
    if(!diameter||!geometry||!results.every(Boolean)) continue;
    const verifications=sectionRatios.map((_,i)=>shaftSection(d,i,false));
    eq(math`n_{fat,2}=${n(verifications[0].nf,4)};\quad n_{est,2}=${n(verifications[0].ns,4)}`);
    eq(math`n_{fat,3}=${n(verifications[1].nf,4)};\quad n_{est,3}=${n(verifications[1].ns,4)}`);
    if(!verifications.every(v=>v.nf>=c.shaftFat&&v.ns>=c.shaftStatic)){
      text('El diámetro comercial no alcanza las seguridades de la flecha.');
      continue;
    }
    if(c.fillet*d>rmax&&rmax<1){
      text('El radio del borde propuesto del espaciador supera el máximo de catálogo.');
      continue;
    }
    chosen=row;
    break;
  }
  heading('Selección y verificación comercial');
  check(chosen,'No hay un diámetro común compatible con las cargas, la flecha y el montaje en la tabla 11-2.');
  const [diameter,outer,bearingWidth,rmax,shoulder,housing]=chosen;
  const [C10,C0]=chosen.slice(column,column+2);
  eq(math`d_{base}=${mm(diameter)};\quad D=${mm(outer)};\quad B=${mm(bearingWidth)}`);
  eq(math`d_{s,\min}=${mm(shoulder)};\quad d_{H,\max}=${mm(housing)};\quad r_{\max}=${mm(rmax)}`);
  eq(math`1.2d=${mm(1.2*diameter)};\quad 1.5d=${mm(1.5*diameter)}`);
  loads.forEach((load,i)=>{
    const hours=load ? 1e6*(C10*1000/load)**3/(60*power.shaftRpm) : Infinity;
    if(!load){text('Apoyo '+(i===0?1:4)+' sin carga radial en este modelo.');return;}
    eq(math`L_{10h,${i===0?1:4}}=\frac{10^6(${n(C10)}/${n(load/1000,6)})^3}{60(${n(power.shaftRpm)})}=${display(hours,'h')}`);
    eq(math`n_{0,${i===0?1:4}}=\frac{${n(C0)}}{${n(load/1000,6)}}=${n(C0*1000/load)}`);
  });
  sectionRatios.forEach((_,i)=>{
    const {d,M,T,se,kf,kfs,a,m,nf,ns}=shaftSection(diameter,i,true);
    eq(math`\sigma_a=\frac{32(${n(kf,5)})(${n(M)})}{\pi(${n(d)})^3}=${stress(a)}`);
    eq(math`\sigma_{m,eq}=\sqrt3\frac{16(${n(kfs,5)})(${n(T)})}{\pi(${n(d)})^3}=${stress(m)}`);
    eq(math`n_f=\frac{1}{(${n(a)}/${n(se)})^2+(${n(m)}/${n(shaft.sut)})^2}=${n(nf,4)}`);
    eq(math`n_{est}=\frac{${n(shaft.sy)}}{\sqrt{(${n(a)})^2+(${n(m)})^2}}=${n(ns,4)}`);
  });
  if(c.fillet*diameter>rmax){
    const fillet=c.fillet*diameter, chamfer=fillet+1, spacer=Math.max(10,chamfer+3);
    eq(math`r_{filete}=${mm(fillet)}>r_{\max}=${mm(rmax)}`);
    note('Interferencia de filete. Propuesta de montaje: espaciador de '+n(spacer)+' mm, chaflán interior de al menos '+n(chamfer)+' mm y radio de borde de 1 mm. Verificar el detalle en el plano.');
  }
  return {module,faceMm, wt, wr, loads, moments, continuous, diameter,kd,ke};
}
