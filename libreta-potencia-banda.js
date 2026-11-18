'use strict';

function notebookBeltMaterial(name, check) {
  const row=catalog.find(entry=>entry[0]===name);
  check(row&&row[7]==='plana'&&Number.isFinite(row[2]),'Falta la fila '+name+' de la tabla 17-2.');
  const [,thickness,minimum,allowable,weight,friction]=row;
  return {name,thickness,minimum,allowable,weight,friction};
}

function notebookOpenBelt(d,D,C,rpm) {
  const alpha=Math.asin((D-d)/(2*C));
  const wrap=Math.PI-2*alpha;
  const speed=Math.PI*d*rpm/(12*60);
  return {d,D,C,rpm,alpha,wrap,speed};
}

function notebookBeltSketch({d,D,C,alpha}, title) {
  const scale=Math.min(305/(C+(d+D)/2),70/D);
  const first=54+d*scale/2, second=first+C*scale, y=60;
  const r1=d*scale/2, r2=D*scale/2;
  const marks=[['circle',first,y,r1],['circle',second,y,r2],['line',first,y,second,y]];
  for(const side of [-1,1]){
    const x=-Math.sin(alpha), z=side*Math.cos(alpha);
    marks.push(['line',first+r1*x,y+r1*z,second+r2*x,y+r2*z]);
  }
  marks.push(['label',87,114,'Motriz '+number(d)+' in'],['label',328,114,'Conducida '+number(D)+' in'],
    ['label',207,11,'Centros '+number(C,3)+' in']);
  return {title,caption:'Vista de la banda abierta con sus tangentes exteriores. Las dos poleas giran en el mismo sentido.',marks};
}

function notebookCentrifugalPerWidth(material, speed) {
  // Peso específico en lbf/in³, velocidad en in/s y g en in/s².
  return material.weight*material.thickness*(12*speed)**2/(12*32.2);
}

function calculateNotebookBelt() {
  const {entries,decisions,add,check,decision,trial}=createCalculationTrace();
  const n=number;
  const eq=value=>add('eq',value);
  const dim=(value,name,digits=4)=>display(value,name,digits);
  const power=30, rpm=4500, ratio=5, centersM=1.8, centersIn=centersM/inch;
  const shaftSpeed=2*Math.PI*rpm/60;
  const work=550*power, torque=work/shaftSpeed;

  add('section','Caso resuelto · Banda plana');
  add('heading','Enunciado y datos');
  add('text','Dimensionar una banda plana para transmitir 30 hp a 4500 rpm. La relación es 5 a 1 y la distancia entre centros es de 1.8 m. Las páginas 45 y 47 proponen poliamida A-2 y F-1, respectivamente.');
  eq(math`H=${dim(power,'hp')};\quad n_m=${dim(rpm,'rpm')};\quad i=${ratio};\quad C=\frac{${centersM}}{0.0254}=${dim(centersIn,'in',5)}`);
  eq(math`P=H(550)=(${power})(550)=${dim(work,'lbf\,ft/s')};\quad n_c=\frac{${rpm}}{${ratio}}=${dim(rpm/ratio,'rpm')}`);

  const widthDecision=decision(2,'Anchos de las dos propuestas','in',
    'Comparación de las pp. 45 y 47 con las propiedades de la tabla 17-2. La columna de tensión permisible tiene referencia de 600 ft/min.');
  const metrics=[];
  for(const [index,name] of ['Poliamida A-2','Poliamida F-1'].entries()){
    const run=index+1;
    const material=notebookBeltMaterial(name,check);
    const {thickness,minimum,allowable,weight,friction}=material;
    const d=minimum, D=ratio*d;
    const geometry=notebookOpenBelt(d,D,centersIn,rpm);
    const {wrap,speed}=geometry;
    const traction=Math.exp(friction*wrap);
    const net=work/speed;
    const slack0=net/(traction-1), tight0=slack0+net;
    const width0=tight0/allowable;
    const slope=notebookCentrifugalPerWidth(material,speed);
    const centrifugal0=slope*width0;
    check(allowable>slope,'La tensión de referencia es insuficiente para esta velocidad.');

    add('heading','Corrida '+run+' · '+name);
    add('text','Se toma el diámetro mínimo de la polea menor indicado en la fila del material. La relación fija el diámetro de la conducida.');
    eq(math`t=${dim(thickness,'in')};\quad d_{\min}=${dim(minimum,'in')};\quad S_{\mathrm{ref}}=${dim(allowable,'lbf/in')};\quad \gamma=${dim(weight,'lbf/in^3')};\quad \mu=${n(friction)}`);
    eq(math`d=d_{\min}=${dim(d,'in')};\quad D=id=(${ratio})(${n(d)})=${dim(D,'in')}`);
    add('diagram',notebookBeltSketch(geometry,'Croquis · '+name));
    eq(math`\theta_s=\pi-2\arcsin\frac{D-d}{2C}=\pi-2\arcsin\frac{${n(D)}-${n(d)}}{2(${n(centersIn,5)})}=${dim(wrap,'rad',5)}`);
    eq(math`v=\frac{\pi d n_m}{12(60)}=\frac{\pi(${n(d)})(${rpm})}{12(60)}=${dim(speed,'ft/s',5)}`);
    eq(math`R=e^{\mu\theta_s}=e^{(${n(friction)})(${n(wrap,6)})}=${n(traction,6)}`);

    add('text','El desarrollo de la libreta despeja primero las tensiones sin fuerza centrífuga y utiliza ese ancho para evaluar su efecto.');
    eq(math`F_{2,0}=\frac{P}{v(R-1)}=\frac{${n(work)}}{(${n(speed,6)})(${n(traction,6)}-1)}=${dim(slack0,'lbf')}`);
    eq(math`F_{1,0}=RF_{2,0}=(${n(traction,6)})(${n(slack0,6)})=${dim(tight0,'lbf')}`);
    eq(math`b_0=\frac{F_{1,0}}{S_{\mathrm{ref}}}=\frac{${n(tight0,6)}}{${n(allowable)}}=${dim(width0,'in')}`);
    eq(math`F_{c,0}=\frac{\gamma(tb_0)(12v)^2}{12g}=\frac{(${n(weight)})(${n(thickness)})(${n(width0,6)})(12\cdot${n(speed,6)})^2}{12(32.2)}=${dim(centrifugal0,'lbf')}`);
    eq(math`\frac{F_{c,0}}{F_{1,0}}\,100=\frac{${n(centrifugal0,6)}}{${n(tight0,6)}}\,100=${n(100*centrifugal0/tight0,4)}\,\%`);

    add('text','Ahora se usa la relación con fuerza centrífuga de la p. 42. Como la diferencia de tensiones permanece en P/v, la corrección suma Fc a ambos ramales.');
    eq(math`\frac{F_1-F_c}{F_2-F_c}=R;\quad F_1-F_2=\frac{P}{v};\quad F_1(b)=F_{1,0}+F_c(b)`);
    eq(math`F_c(b)=B\,b;\quad B=\frac{\gamma t(12v)^2}{12g}=\frac{(${n(weight)})(${n(thickness)})(12\cdot${n(speed,6)})^2}{12(32.2)}=${dim(slope,'lbf/in',5)}`);
    let width=width0;
    for(let i=1;i<=100;i++){
      const centrifugal=slope*width, tight=tight0+centrifugal;
      const next=tight/allowable;
      const error=100*Math.abs(next-width)/next;
      add('iteration','Corrida '+run+' · Iteración '+i+' de ancho');
      eq(math`F_c=(${n(slope,6)})(${n(width,6)})=${dim(centrifugal,'lbf')};\quad F_1=${n(tight0,6)}+${n(centrifugal,6)}=${dim(tight,'lbf')}`);
      eq(math`b_{${i}}=\frac{F_1}{S_{\mathrm{ref}}}=\frac{${n(tight,6)}}{${n(allowable)}}=${dim(next,'in',5)}`);
      eq(math`\varepsilon=\frac{|${n(next,6)}-${n(width,6)}|}{${n(next,6)}}\,100=${n(error,5)}\,\%`);
      width=next;
      if(error<tolerance) break;
    }

    add('heading','Comprobación de la corrida '+run);
    const exact=tight0/(allowable-slope);
    const centrifugal=slope*exact;
    const tight=tight0+centrifugal, slack=slack0+centrifugal;
    eq(math`b_{\min}=\frac{F_{1,0}}{S_{\mathrm{ref}}-B}=\frac{${n(tight0,6)}}{${n(allowable)}-${n(slope,6)}}=${dim(exact,'in',5)}`);
    eq(math`F_c=${dim(centrifugal,'lbf')};\quad F_1=${dim(tight,'lbf')};\quad F_2=${dim(slack,'lbf')}`);
    eq(math`S_{\mathrm{ref}}b_{\min}=(${n(allowable)})(${n(exact,6)})=${dim(allowable*exact,'lbf')}=F_1`);
    trial(widthDecision,exact,'calculated','Corrida '+run+' con '+name+'. Ancho preliminar '+n(width0,4)+' in. Al incorporar fuerza centrífuga, la tensión del ramal tenso es '+n(tight,3)+' lbf a '+n(60*speed,2)+' ft/min.');
    metrics.push(['Corrida '+run+' · ancho preliminar ('+name+')',width0,'in',4],
      ['Corrida '+run+' · ancho con fuerza centrífuga ('+name+')',exact,'in',4]);
  }
  add('heading','Torque y comparación');
  eq(math`\omega=\frac{2\pi n_m}{60}=\frac{2\pi(${rpm})}{60}=${dim(shaftSpeed,'rad/s')};\quad T_m=\frac{P}{\omega}=\frac{${n(work)}}{${n(shaftSpeed,6)}}=${dim(torque,'lbf\,ft')}`);
  add('text','La poliamida A-2 requiere el menor ancho continuo de las dos propuestas con la tensión de referencia. En la p. 45, el cociente anotado de 0.061 corresponde a aproximadamente 0.056 al dividir las cifras de fuerza. El ancho preliminar de la p. 47 es aproximadamente 30.55 in, frente a 30.54 in con las sustituciones a precisión completa.');
  add('note','La tabla 17-2 refiere su tensión permisible a 600 ft/min. Los anchos calculados comparan propuestas a esa referencia tabulada. La capacidad de servicio a las velocidades del ejercicio queda pendiente de corrección o datos del fabricante.');
  metrics.push(['Torque de la motriz',12*torque,'lbf·in',3]);
  return {entries,decisions,metrics};
}

function calculateNotebookPower() {
  const {entries,decisions,add,check,decision,trial}=createCalculationTrace();
  const n=number;
  const eq=value=>add('eq',value);
  const dim=(value,name,digits=4)=>display(value,name,digits);
  const material=notebookBeltMaterial('Poliamida A-3',check);
  const width=6, d=6, D=18, centersFt=8, centersIn=12*centersFt, rpm=1750;
  const {thickness,minimum,allowable,weight,friction}=material;
  const geometry=notebookOpenBelt(d,D,centersIn,rpm);
  const {wrap,speed}=geometry;
  const traction=Math.exp(friction*wrap);
  const tight=allowable*width, slack=tight/traction;
  const work=(tight-slack)*speed, angularSpeed=2*Math.PI*rpm/60;
  const torque=12*work/angularSpeed, power=work/550;
  const centrifugal=notebookCentrifugalPerWidth(material,speed)*width;

  add('section','Caso resuelto · Potencia de una banda');
  add('heading','Enunciado y datos de la p. 44');
  add('text','Una banda poliamida A-3 de 6 in de ancho trabaja a plena carga. Las poleas miden 6 y 18 in, con 8 ft entre sus centros. La motriz gira a 1750 rpm. Se buscan las tensiones, el torque, la potencia y la fuerza centrífuga.');
  eq(math`b=${dim(width,'in')};\quad d=${dim(d,'in')};\quad D=${dim(D,'in')};\quad C=(${centersFt})(12)=${dim(centersIn,'in')};\quad n_m=${dim(rpm,'rpm')}`);
  eq(math`t=${dim(thickness,'in')};\quad d_{\min}=${dim(minimum,'in')};\quad S_{\mathrm{ref}}=${dim(allowable,'lbf/in')};\quad \gamma=${dim(weight,'lbf/in^3')};\quad \mu=${n(friction)}`);
  add('diagram',notebookBeltSketch(geometry,'Croquis de las poleas del ejercicio'));

  add('heading','Abrazamiento y tensiones');
  eq(math`d=${dim(d,'in')}\ge d_{\min}=${dim(minimum,'in')};\quad F_1=S_{\mathrm{ref}}b=(${n(allowable)})(${width})=${dim(tight,'lbf')}`);
  eq(math`\theta_s=\pi-2\arcsin\frac{D-d}{2C}=\pi-2\arcsin\frac{${D}-${d}}{2(${centersIn})}=${dim(wrap,'rad',6)}`);
  eq(math`\frac{F_1}{F_2}=R=e^{\mu\theta_s}=e^{(${n(friction)})(${n(wrap,6)})}=${n(traction,6)};\quad F_2=\frac{${n(tight)}}{${n(traction,6)}}=${dim(slack,'lbf')}`);
  add('text','La página 44 toma inicialmente la relación de Euler sin fuerza centrífuga.');

  add('heading','Sustitución de potencia y torque');
  eq(math`v=\frac{\pi d n_m}{12(60)}=\frac{\pi(${d})(${rpm})}{12(60)}=${dim(speed,'ft/s',5)}`);
  eq(math`P=(F_1-F_2)v=(${n(tight)}-${n(slack,6)})(${n(speed,6)})=${dim(work,'lbf\,ft/s',3)}`);
  eq(math`H=\frac{P}{550}=\frac{${n(work,5)}}{550}=${dim(power,'hp')};\quad \omega=\frac{2\pi(${rpm})}{60}=${dim(angularSpeed,'rad/s')}`);
  eq(math`T=\frac{12P}{\omega}=\frac{12(${n(work,5)})}{${n(angularSpeed,6)}}=${dim(torque,'lbf\,in')}`);

  add('heading','Comprobación de fuerza centrífuga');
  eq(math`F_c=\frac{\gamma(tb)(12v)^2}{12g}=\frac{(${n(weight)})(${n(thickness)})(${width})(12\cdot${n(speed,6)})^2}{12(32.2)}=${dim(centrifugal,'lbf')}`);
  eq(math`\frac{F_c}{F_1}\,100=\frac{${n(centrifugal,6)}}{${n(tight)}}\,100=${n(100*centrifugal/tight,4)}\,\%`);
  const correctedSlack=centrifugal+(tight-centrifugal)/traction;
  const correctedWork=(tight-correctedSlack)*speed;
  const correctedPower=correctedWork/550;
  const correctedTorque=12*correctedWork/angularSpeed;
  add('text','Con la misma tensión total permisible, la relación corregida de la p. 42 permite estimar cuánto cambia la potencia.');
  eq(math`F_{2,c}=F_c+\frac{F_1-F_c}{R}=${n(centrifugal,6)}+\frac{${n(tight)}-${n(centrifugal,6)}}{${n(traction,6)}}=${dim(correctedSlack,'lbf')}`);
  eq(math`H_c=\frac{(F_1-F_{2,c})v}{550}=\frac{(${n(tight)}-${n(correctedSlack,6)})(${n(speed,6)})}{550}=${dim(correctedPower,'hp')}`);
  eq(math`T_c=\frac{12(550)H_c}{\omega}=\frac{12(550)(${n(correctedPower,6)})}{${n(angularSpeed,6)}}=${dim(correctedTorque,'lbf\,in')}`);
  const comparison=decision(1,'Potencia estimada a plena carga','hp','La comparación parte del ancho fijo del enunciado y de la tensión por unidad de ancho de la tabla 17-2.');
  trial(comparison,power,'calculated','Aproximación de la p. 44. Al conservar la precisión en el abrazamiento se obtienen '+n(slack,4)+' lbf en el ramal flojo.');
  trial(comparison,correctedPower,'calculated','Estimación con fuerza centrífuga según la p. 42, manteniendo la tensión total permisible de referencia.');
  add('note','La libreta redondea la potencia a 45.5 hp. La tabla indica tensión permisible a 600 ft/min y la velocidad calculada es de '+n(60*speed,1)+' ft/min. La capacidad a esa velocidad queda pendiente de datos del fabricante.');
  return {entries,decisions,metrics:[
    ['Potencia de la libreta',power,'hp',4],
    ['Potencia con fuerza centrífuga',correctedPower,'hp',4],
    ['Torque de la libreta',torque,'lbf·in',3],
    ['Tensión del ramal tenso',tight,'lbf',3],
    ['Tensión del ramal flojo de la libreta',slack,'lbf',3],
    ['Fuerza centrífuga',centrifugal,'lbf',4]
  ]};
}
