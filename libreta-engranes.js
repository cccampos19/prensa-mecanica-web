'use strict';

function calculateNotebookGears() {
  const {entries,decisions,add,check,decision,trial}=createCalculationTrace();
  const text=value=>add('text',value);
  const heading=value=>add('heading',value);
  const eq=value=>add('eq',value);
  const n=number;
  const dim=(value,unit,digits=4)=>display(value,unit,digits);

  const steel=referenceTables[1].rows.find(([grade,condition])=>grade==='1040'&&condition==='CD');
  const finish=referenceTables[5].rows.find(([name])=>name==='Maquinado/CD');
  check(steel&&finish,'Faltan la fila AISI 1040 CD de la tabla A-20 o el acabado de la tabla 6-2.');
  const [,,,sut,,sy]=steel;
  const [,finishMpa,finishExponent]=finish;
  const powerHp=100, speedRpm=1120, ratio=4, pressureAngle=20, safety=4;
  const powerWatts=powerHp*746;
  const omega=2*Math.PI*speedRpm/60;
  const torqueNm=powerWatts/omega;
  const torqueFtLb=torqueNm/(lbf*12*inch);
  const allowableStatic=sy/safety;
  const proposals=[
    {pd:2, pinion:12, gear:48, lewis:.245},
    {pd:3, pinion:14, gear:56, lewis:.277}
  ];

  add('section','Ejercicio de la libreta · Engranes rectos');
  heading('Enunciado y datos');
  text('Transmitir 100 hp a 1120 rpm con relación 4 a 1. Se proponen dos juegos de dientes de altura completa, con ángulo de presión de 20° y acero AISI 1040 CD. La libreta da el factor Lewis para el piñón en ambas corridas. Las comprobaciones de ancho y fatiga corresponden al piñón.');
  text('Los datos provienen de la libreta de Diseño de Elementos de Máquinas, pp. 37–39, y de las tablas aportadas A-20 y 6-2. Se usan los valores tabulados con su precisión original y la conversión 746 W/hp del ejercicio.');
  eq(math`H=${dim(powerHp,'hp')};\quad n_p=${dim(speedRpm,'rpm')};\quad i=${ratio};\quad \phi=${pressureAngle}^\circ;\quad n_{\mathrm{seg}}=${safety}`);
  eq(math`S_{ut}=${dim(sut,'kpsi')};\quad S_y=${dim(sy,'kpsi')}`);
  add('diagram',{
    title:'Croquis del par de engranes',
    caption:'Esquema de los círculos primitivos en relación 4 a 1 y de las componentes de la fuerza sobre el piñón.',
    marks:[
      ['circle',62,63,12],['circle',122,63,48],['line',62,63,122,63],
      ['circle',74,63,2],['label',63,29,'Piñón'],['label',123,6,'Rueda'],
      ['label',106,116,'Contacto'],
      ['line',106,107,77,68],
      ['line',310,61,310,111],['line',310,111,305,103],['line',310,111,315,103],
      ['line',310,61,254,61],['line',254,61,262,56],['line',254,61,262,66],
      ['line',310,61,291.8,111],
      ['label',326,105,'Wt'],['label',255,48,'Wr'],['label',281,108,'W'],
      ['label',335,77,'20°']
    ]
  });
  heading('Torque y velocidad de salida');
  eq(math`\omega_p=\frac{2\pi n_p}{60}=\frac{2\pi(${speedRpm})}{60}=${dim(omega,'rad/s')}`);
  eq(math`T_p=\frac{H}{\omega_p}=\frac{(${powerHp})(746)}{${n(omega,5)}}=${dim(torqueNm,'N\\,m',3)}\quad(${dim(torqueFtLb,'lbf\\,ft',3)})`);
  eq(math`n_g=\frac{n_p}{i}=\frac{${speedRpm}}{${ratio}}=${dim(speedRpm/ratio,'rpm')}`);
  eq(math`\sigma_{\mathrm{est,adm}}=\frac{S_y}{n_{\mathrm{seg}}}=\frac{${n(sy)}}{${safety}}=${dim(allowableStatic,'kpsi')}`);

  heading('Dos propuestas y comprobación estática de Lewis');
  const staticDecision=decision(3,'Anchos de cara por estática','in',
    'Las corridas son las dos propuestas de las pp. 37–38. Se compara el ancho despejado con el intervalo de 3 a 5 pasos circulares.');
  const [first,second]=proposals.map(({pd,pinion,gear,lewis},index)=>{
    const diameter=pinion/pd;
    const drivenDiameter=gear/pd;
    const velocity=Math.PI*diameter*speedRpm/12;
    const dynamicFactor=1200/(1200+velocity);
    const force=2*torqueFtLb*12/diameter;
    const radial=force*Math.tan(pressureAngle*Math.PI/180);
    const minWidth=3*Math.PI/pd;
    const maxWidth=5*Math.PI/pd;
    const face=force*pd/(1000*allowableStatic*lewis*dynamicFactor);
    const inside=face>=minWidth&&face<=maxWidth;

    add('iteration','Corrida '+(index+1)+' · '+pinion+'/'+gear+' dientes, paso diametral '+pd);
    eq(math`P_d=${dim(pd,'in^{-1}')};\quad N_p=${pinion};\quad N_g=${gear};\quad Y_p=${n(lewis)}`);
    eq(math`d_p=\frac{N_p}{P_d}=\frac{${pinion}}{${pd}}=${dim(diameter,'in')};\quad d_g=\frac{N_g}{P_d}=\frac{${gear}}{${pd}}=${dim(drivenDiameter,'in')}`);
    eq(math`v=\frac{\pi d_p n_p}{12}=\frac{\pi(${n(diameter,6)})(${speedRpm})}{12}=${dim(velocity,'ft/min',3)}`);
    eq(math`K_v=\frac{1200}{1200+v}=\frac{1200}{1200+${n(velocity)}}=${n(dynamicFactor,6)}`);
    eq(math`W_t=\frac{2(12)T_p}{d_p}=\frac{2(12)(${n(torqueFtLb,5)})}{${n(diameter,6)}}=${dim(force,'lbf',3)}`);
    eq(math`W_r=W_t\tan\phi=(${n(force,3)})\tan(${pressureAngle}^\circ)=${dim(radial,'lbf',3)}`);
    eq(math`F_{\mathrm{est}}=\frac{W_t P_d}{(1000\sigma_{\mathrm{est,adm}})Y_pK_v}=\frac{(${n(force,5)})(${pd})}{(1000)(${n(allowableStatic,5)})(${n(lewis)})(${n(dynamicFactor,6)})}=${dim(face,'in')}`);
    eq(math`F_{\min}=\frac{3\pi}{${pd}}=${dim(minWidth,'in')};\quad F_{\max}=\frac{5\pi}{${pd}}=${dim(maxWidth,'in')}`);
    eq(inside
      ? math`F_{\min}=${dim(minWidth,'in')} \le F_{\mathrm{est}}=${dim(face,'in')} \le F_{\max}=${dim(maxWidth,'in')}`
      : math`F_{\mathrm{est}}=${dim(face,'in')} < F_{\min}=${dim(minWidth,'in')}`);
    const reason=inside
      ? 'Corrida '+(index+1)+' dentro del intervalo geométrico en estática. Se continúa con fatiga.'
      : 'Corrida '+(index+1)+' con ancho despejado por debajo de 3 pasos circulares. La libreta continúa con la segunda propuesta. Probar un ancho mayor dentro del intervalo exigiría comprobarlo de nuevo.';
    text(reason);
    trial(staticDecision,face,inside?'viable':'rejected',reason);
    return {pd,lewis,dynamicFactor,force,face,maxWidth};
  });

  heading('Fatiga de la corrida 2 · Goodman');
  text('La libreta usa carga pulsante, factores adicionales de Marin iguales a 1, Kt = 1.8 y q = 0.8 leído en la gráfica. El cálculo conserva esas hipótesis. Se cambia el coeficiente de acabado a unidades kpsi mediante la equivalencia de la tabla.');
  const ksiToMpa=6.894757293;
  const finishKsi=finishMpa*ksiToMpa**finishExponent;
  const ka=finishKsi*sut**finishExponent;
  const toothHeight=2.25/second.pd;
  const lever=3*second.lewis/(2*second.pd);
  const toothThickness=Math.sqrt(4*toothHeight*lever);
  const equivalent=.808*Math.sqrt(second.face*toothThickness);
  const kb=(equivalent/.3)**(-.107);
  const base=.5*sut;
  const corrected=1.33*base*ka*kb;
  const radius=.3/second.pd;
  const kt=1.8, q=.8, kf=1+q*(kt-1);
  const endurance=corrected/(kf*safety);
  eq(math`a_{\mathrm{kpsi}}=a_{\mathrm{MPa}}(6.894757293)^b=${n(finishMpa)}(6.894757293)^{${n(finishExponent)}}=${n(finishKsi,5)}`);
  eq(math`k_a=a_{\mathrm{kpsi}}S_{ut}^{b}=${n(finishKsi,5)}(${n(sut)})^{${n(finishExponent)}}=${n(ka,5)}`);
  eq(math`\ell=\frac{2.25}{P_d}=\frac{2.25}{${second.pd}}=${dim(toothHeight,'in')};\quad x=\frac{3Y_p}{2P_d}=\frac{3(${n(second.lewis)})}{2(${second.pd})}=${dim(lever,'in')}`);
  eq(math`t=\sqrt{4\ell x}=\sqrt{4(${n(toothHeight,5)})(${n(lever,5)})}=${dim(toothThickness,'in')}`);
  eq(math`d_{\mathrm{eq}}=0.808\sqrt{F_{\mathrm{est}}t}=0.808\sqrt{(${n(second.face,5)})(${n(toothThickness,5)})}=${dim(equivalent,'in')}`);
  eq(math`k_b=\left(\frac{d_{\mathrm{eq}}}{0.3}\right)^{-0.107}=\left(\frac{${n(equivalent,5)}}{0.3}\right)^{-0.107}=${n(kb,5)}`);
  eq(math`S'_e=0.5S_{ut}=0.5(${n(sut)})=${dim(base,'kpsi')}`);
  eq(math`\frac{\sigma_a}{S'_e}+\frac{\sigma_m}{S_{ut}}=1;\quad \sigma_a=\sigma_m=\frac{\sigma}{2}`);
  eq(math`\sigma=\frac{2S'_eS_{ut}}{S'_e+S_{ut}}=\frac{4}{3}S'_e\approx 1.33S'_e`);
  eq(math`S_{\mathrm{puls}}=1.33 k_ak_b S'_e=1.33(${n(ka,5)})(${n(kb,5)})(${n(base,5)})=${dim(corrected,'kpsi')}`);
  eq(math`r=\frac{0.3}{P_d}=\frac{0.3}{${second.pd}}=${dim(radius,'in')};\quad K_f=1+q(K_t-1)=1+${n(q)}(${n(kt)}-1)=${n(kf)}`);
  eq(math`\sigma_{\infty,\mathrm{adm}}=\frac{S_{\mathrm{puls}}}{K_fn_{\mathrm{seg}}}=\frac{${n(corrected,5)}}{(${n(kf)})(${safety})}=${dim(endurance,'kpsi')}`);

  heading('Estimación de vida con la recta S–N');
  text('Se reproduce la recta de diseño trazada en la libreta. Sus extremos son 0.9 Sut a mil ciclos y el esfuerzo admisible corregido a un millón de ciclos. Esta estimación corresponde al criterio del ejercicio.');
  const s3=.9*sut;
  const s6=endurance;
  const slope=Math.log10(s3/s6)/3;
  const intercept=Math.log10(s3**2/s6);
  const logLife=(intercept-Math.log10(allowableStatic))/slope;
  const life=10**logLife;
  eq(math`\sigma_{\mathrm{trab}}=\frac{W_tP_d}{(1000)F_{\mathrm{est}}Y_pK_v}=\frac{(${n(second.force,4)})(${second.pd})}{(1000)(${n(second.face,5)})(${n(second.lewis)})(${n(second.dynamicFactor,6)})}=${dim(allowableStatic,'kpsi')}`);
  eq(math`S_3=0.9S_{ut}=${dim(s3,'kpsi')};\quad S_6=\sigma_{\infty,\mathrm{adm}}=${dim(s6,'kpsi')}`);
  eq(math`m=\frac{1}{3}\log_{10}\left(\frac{S_3}{S_6}\right)=\frac{1}{3}\log_{10}\left(\frac{${n(s3,5)}}{${n(s6,5)}}\right)=${n(slope,6)}`);
  eq(math`b=\log_{10}\left(\frac{S_3^2}{S_6}\right)=\log_{10}\left(\frac{(${n(s3,5)})^2}{${n(s6,5)}}\right)=${n(intercept,6)}`);
  eq(math`N=\left(\frac{10^b}{\sigma_{\mathrm{trab}}}\right)^{1/m}=\left(\frac{10^{${n(intercept,6)}}}{${n(allowableStatic,5)}}\right)^{1/${n(slope,6)}}=${n(life,0)}\,\mathrm{ciclos}`);
  const roundedLife=(10**2.97/17.75)**(1/.36);
  add('note','Con m = 0.36, b = 2.97 y 17.75 kpsi, los valores redondeados de la p. 38 dan '+n(roundedLife,0)+' ciclos. La cifra manuscrita parece decir 6025 ciclos.');
  const pointX=91+(logLife-3)*(287/3);
  const pointY=36+(Math.log10(allowableStatic)-Math.log10(s6))*68/(3*slope);
  add('diagram',{
    title:'Recta S–N de diseño',
    caption:'Ejes logarítmicos. El cruce de la recta con el esfuerzo de trabajo estima la vida de la segunda corrida.',
    marks:[
      ['line',91,26,395,26],['line',91,26,91,114],
      ['line',91,104,378,36],['line',378,36,392,36],
      ['line',91,pointY,pointX,pointY],['line',pointX,pointY,pointX,26],
      ['line',378,36,378,26],['circle',pointX,pointY,2.5],
      ['label',46,114,'Esfuerzo'],
      ['label',57,103,n(s3,2)+' kpsi'],
      ['label',55,pointY,n(allowableStatic,2)+' kpsi'],
      ['label',54,36,n(s6,2)+' kpsi'],
      ['label',91,14,'1 000'],
      ['label',pointX,14,n(life,0)],
      ['label',375,14,'1 000 000'],
      ['label',365,4,'Ciclos']
    ]
  });

  heading('Nuevo ancho y decisión');
  const fatigueFace=second.force*second.pd/(1000*endurance*second.lewis*second.dynamicFactor);
  const widthDecision=decision(3,'Ancho de cara por fatiga','in',
    'Se despeja el ancho de la p. 39 manteniendo los factores de la corrida 2. Al cambiar el ancho correspondería recalcular el factor de tamaño.');
  eq(math`F_{\mathrm{fat}}=\frac{W_t P_d}{(1000\sigma_{\infty,\mathrm{adm}})Y_pK_v}=\frac{(${n(second.force,5)})(${second.pd})}{(1000)(${n(endurance,5)})(${n(second.lewis)})(${n(second.dynamicFactor,6)})}=${dim(fatigueFace,'in')}`);
  eq(math`F_{\mathrm{fat}}=${dim(fatigueFace,'in')} > F_{\max}=\frac{5\pi}{${second.pd}}=${dim(second.maxWidth,'in')}`);
  const equivalentAtMax=.808*Math.sqrt(second.maxWidth*toothThickness);
  const kbAtMax=(equivalentAtMax/.3)**(-.107);
  const allowableAtMax=1.33*base*ka*kbAtMax/(kf*safety);
  const stressAtMax=second.force*second.pd/(1000*second.maxWidth*second.lewis*second.dynamicFactor);
  text('Se vuelve a comprobar el extremo del intervalo actualizando el factor de tamaño.');
  eq(math`k_b(F_{\max})=\left(\frac{0.808\sqrt{(${n(second.maxWidth,5)})(${n(toothThickness,5)})}}{0.3}\right)^{-0.107}=${n(kbAtMax,5)}`);
  eq(math`\sigma_{\mathrm{trab}}(F_{\max})=${dim(stressAtMax,'kpsi')} > \sigma_{\infty,\mathrm{adm}}(F_{\max})=${dim(allowableAtMax,'kpsi')}`);
  text('La segunda propuesta pasa en estática y requiere un ancho por fatiga superior a cinco pasos circulares. El ejercicio termina sin una propuesta aceptada para ambos criterios.');
  trial(widthDecision,fatigueFace,'rejected','El ancho estimado excede '+n(second.maxWidth,4)+' in. Queda pendiente una nueva propuesta de geometría.');
  add('note','Como referencias del manuscrito, los dos anchos estáticos son aproximadamente 2.15 y 3.152 in, y el ancho por fatiga es 8.98 in. Los resultados anteriores se recalculan con las propiedades tabuladas y sin redondeos intermedios.');

  return {
    entries,decisions,
    metrics:[
      ['Corrida 1 · ancho estático',first.face,'in',4],
      ['Corrida 2 · ancho estático',second.face,'in',4],
      ['Corrida 2 · ancho estimado por fatiga',fatigueFace,'in',4],
      ['Corrida 2 · máximo de cinco pasos',second.maxWidth,'in',4],
      ['Vida estimada según la recta del ejercicio',life,'ciclos',0]
    ]
  };
}
