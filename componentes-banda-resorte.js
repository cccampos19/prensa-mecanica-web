'use strict';

function solveComponentBelt(c,{add,check,decision,trial}){
  const n=number;
  const mm=meters=>dual(meters*1000,'mm',1/0.0254,'in');
  const N=force=>dual(force,'N',1/lbf,'lbf');
  const eq=value=>add('eq',value);
  for(const [value,label] of [[c.powerKw,'potencia'],[c.rpm,'velocidad de la motriz'],
    [c.driverMm,'diámetro de la motriz'],[c.drivenMm,'diámetro de la conducida'],
    [c.centersMm,'distancia entre centros']]){
    check(Number.isFinite(value)&&value>0,'Ingresa un valor positivo para '+label+'.');
  }
  const row=catalog[c.belt];
  check(row,'Selecciona un material de la tabla 17-2.');
  const [name,thicknessIn,minimumIn,allowableIn,listedWeight,friction,fixedWidthIn,shape]=row;
  check(shape==='plana',name+' requiere un método de banda redonda.');
  check(minimumIn,name+' requiere el diámetro mínimo de la tabla 17-3.');
  const fixedWidth=fixedWidthIn==null?null:fixedWidthIn*inch;
  check(fixedWidth!==null||(Number.isFinite(c.startWidthMm)&&c.startWidthMm>0),'Ingresa un ancho inicial positivo.');

  const driver=c.driverMm/1000, driven=c.drivenMm/1000, centers=c.centersMm/1000;
  const small=Math.min(driver,driven), minDiameter=minimumIn*inch;
  const weightIn=Array.isArray(listedWeight)?Math.max(...listedWeight):listedWeight;
  const thickness=thicknessIn*inch, allowable=allowableIn*lbf/inch;
  const density=weightIn*lbf/(gravity*inch**3);
  add('heading','Material y diámetros de las poleas');
  add('text',name+' · tabla 17-2. El cálculo usa una banda plana abierta entre dos poleas.');
  if(Array.isArray(listedWeight)) add('note','Se usa el extremo superior del intervalo de peso específico de la fila.');
  eq(math`t=${mm(thickness)};\quad \mu=${n(friction)};\quad d_{\min}=${mm(minDiameter)}`);
  eq(math`S_{\mathrm{ref}}=${display(allowableIn,'lbf/in')}\frac{4.448221615}{0.0254}=${display(allowable,'N/m')}`);
  eq(math`\rho=\frac{${n(weightIn,5)}(4.448221615)}{(0.0254)^3(9.80665)}=${display(density,'kg/m^3')}`);
  const pulleyDecision=decision(2,'Diámetro de la polea menor','mm','Diámetros propuestos de '+n(c.driverMm)+' y '+n(c.drivenMm)+' mm con '+name+'.');
  const diameterOK=small>=minDiameter;
  eq(math`d_{\mathrm{menor}}=\min(${n(c.driverMm)},${n(c.drivenMm)})=${mm(small)}`);
  trial(pulleyDecision,small*1000,diameterOK?'verified':'rejected',
    (diameterOK?'Cumple el mínimo tabulado de ':'Queda por debajo del mínimo tabulado de ')+n(minDiameter*1000)+' mm.');
  check(diameterOK,'La polea menor debe medir al menos '+n(minDiameter*1000)+' mm con '+name+'.');
  const sumRadii=driver/2+driven/2;
  check(centers>sumRadii,'Para evitar interferencia, la distancia entre centros debe superar '+n(sumRadii*1000)+' mm.');

  add('heading','Geometría, velocidad y fuerza transmitida');
  const offset=(driven-driver)/2, alpha=Math.asin(offset/centers);
  const wrapDriver=Math.PI-2*alpha, wrapDriven=Math.PI+2*alpha;
  const wrapSmall=Math.min(wrapDriver,wrapDriven);
  const span=centers*Math.cos(alpha);
  const length=2*span+driver/2*wrapDriver+driven/2*wrapDriven;
  const speed=Math.PI*driver*(c.rpm/60), ratio=driven/driver, drivenRpm=c.rpm/ratio;
  const deltaForce=(c.powerKw/speed)*1000;
  const frictionRatioMinusOne=Math.expm1(friction*wrapSmall);
  const tractionLimit=1+frictionRatioMinusOne;
  const slackAtZeroWidth=deltaForce/frictionRatioMinusOne;
  const tightAtZeroWidth=slackAtZeroWidth+deltaForce;
  const centrifugalPerWidth=density*thickness*speed**2;
  check([length,speed,drivenRpm,deltaForce,tightAtZeroWidth,centrifugalPerWidth]
    .every(value=>Number.isFinite(value)&&value>0),'Los datos producen valores fuera del intervalo numérico del modelo.');
  eq(math`i=\frac{D}{d}=\frac{${n(c.drivenMm)}}{${n(c.driverMm)}}=${n(ratio,5)};\quad n_D=\frac{${n(c.rpm)}}{${n(ratio,5)}}=${display(drivenRpm,'rpm')}`);
  eq(math`\alpha=\arcsin\frac{D-d}{2C}=\arcsin\frac{${n(c.drivenMm)}-${n(c.driverMm)}}{2(${n(c.centersMm)})}=${n(alpha*180/Math.PI,5)}^\circ`);
  eq(math`\theta_d=\pi-2\alpha=${display(wrapDriver,'rad',5)};\quad\theta_D=\pi+2\alpha=${display(wrapDriven,'rad',5)}`);
  eq(math`L=2C\cos\alpha+\frac{d}{2}\theta_d+\frac{D}{2}\theta_D=${display(length,'m',5)}`);
  eq(math`v=\frac{\pi d n_m}{60}=\frac{\pi(${n(driver)})(${n(c.rpm)})}{60}=${dual(speed,'m/s',60/(12*inch),'ft/min')}`);
  eq(math`\Delta F=\frac{P}{v}=\frac{${n(c.powerKw*1000)}}{${n(speed,6)}}=${N(deltaForce)}`);
  eq(math`R_{\lim}=e^{\mu\theta_{\mathrm{menor}}}=e^{(${n(friction)})(${n(wrapSmall,6)})}=${n(tractionLimit,6)}`);
  eq(math`F_2-F_c=\frac{\Delta F}{R_{\lim}-1}=\frac{${n(deltaForce,6)}}{${n(frictionRatioMinusOne,6)}}=${N(slackAtZeroWidth)}`);
  eq(math`F_c(b)=\rho tv^2b=Bb;\quad B=(${n(density,6)})(${n(thickness,8)})(${n(speed,6)})^2=${display(centrifugalPerWidth,'N/m')}`);
  add('text','La tensión calculada corresponde al límite de tracción de Euler. La comprobación usa fuerza centrífuga y la potencia mecánica indicada.');

  const widthDecision=decision(2,'Ancho de la banda','mm',name+'. La tensión permisible de la tabla 17-2 tiene como referencia 600 ft/min. '
    +(fixedWidth===null?'Se busca el ancho mínimo continuo.':'Se comprueba el ancho fijo de la fila.'));
  const marginByWidth=allowable-centrifugalPerWidth;
  let width=fixedWidth;
  if(fixedWidth===null){
    check(marginByWidth>0,'La tensión centrífuga por unidad de ancho alcanza '+n(centrifugalPerWidth)+' N/m, frente a '+n(allowable)+' N/m de referencia. Aumentar el ancho no cierra la propuesta.');
    add('heading','Iteración del ancho');
    let previous=c.startWidthMm/1000;
    let converged=false;
    for(let i=1;i<=100;i++){
      const centrifugal=centrifugalPerWidth*previous;
      const tight=centrifugal+tightAtZeroWidth;
      const next=tight/allowable;
      const error=Math.abs(next-previous)/next*100;
      check([centrifugal,tight,next,error].every(Number.isFinite)&&next>0,'La iteración del ancho sale del intervalo numérico.');
      add('iteration','Iteración '+i+' · ancho de banda');
      eq(math`b_i=${mm(previous)};\quad F_c=(${n(centrifugalPerWidth,6)})(${n(previous,8)})=${N(centrifugal)}`);
      eq(math`F_1=F_c+\frac{\Delta F}{R_{\lim}-1}+\Delta F=${n(centrifugal,6)}+${n(slackAtZeroWidth,6)}+${n(deltaForce,6)}=${N(tight)}`);
      eq(math`b_{i+1}=\frac{F_1}{S_{\mathrm{ref}}}=\frac{${n(tight,6)}}{${n(allowable,6)}}=${mm(next)}`);
      eq(math`\varepsilon=\frac{|${n(next,8)}-${n(previous,8)}|}{${n(next,8)}}100=${n(error,5)}\,\%`);
      if(error<tolerance){converged=true;break;}
      previous=next;
    }
    add('heading','Ancho mínimo continuo');
    add('text',converged?'La iteración alcanzó un error relativo menor a 3 %. Se verifica el límite por despeje directo.':
      'La aproximación se detuvo tras 100 pasos. El despeje directo de la misma ecuación permite comprobar el mínimo continuo.');
    width=tightAtZeroWidth/marginByWidth;
    check(Number.isFinite(width)&&width>0,'El ancho mínimo continuo sale del intervalo numérico.');
    eq(math`b_{\min}=\frac{\Delta F+\Delta F/(R_{\lim}-1)}{S_{\mathrm{ref}}-\rho tv^2}=\frac{${n(tightAtZeroWidth,6)}}{${n(allowable,6)}-${n(centrifugalPerWidth,6)}}=${mm(width)}`);
  }

  add('heading','Comprobación de la propuesta');
  const centrifugal=centrifugalPerWidth*width, slack=centrifugal+slackAtZeroWidth, tight=slack+deltaForce;
  const capacity=allowable*width;
  check([centrifugal,slack,tight,capacity].every(Number.isFinite),'Las tensiones calculadas salen del intervalo numérico.');
  const leatherIncrease=name.startsWith('Cuero')&&[6,9].includes(minimumIn)&&width>=8*inch;
  const requiredPulley=(minimumIn+(leatherIncrease?2:0))*inch;
  const pulleyOK=small>=requiredPulley, tensionOK=tight<=capacity*(1+1e-12);
  if(leatherIncrease) {
    const leatherReason='Para este ancho, la nota a de la tabla 17-2 exige una polea menor de al menos '+n(requiredPulley*1000)+' mm.';
    add('text',leatherReason);
    trial(pulleyDecision,small*1000,pulleyOK?'verified':'rejected',leatherReason);
  }
  eq(math`F_2=${n(centrifugal,6)}+${n(slackAtZeroWidth,6)}=${N(slack)};\quad F_1=${n(slack,6)}+${n(deltaForce,6)}=${N(tight)}`);
  eq(math`F_{\mathrm{perm}}=(${n(allowable,6)})(${n(width,8)})=${N(capacity)}`);
  trial(widthDecision,width*1000,tensionOK&&pulleyOK?(fixedWidth===null?'calculated':'selected'):'rejected',
    'Demanda de '+n(tight)+' N frente a '+n(capacity)+' N de referencia. '
    +(tensionOK?'Cumple tensión de referencia. ':'Capacidad de referencia insuficiente. ')
    +(pulleyOK?'Cumple diámetro mínimo de polea.':'El diámetro de polea incumple la nota a.'));
  check(pulleyOK,'Para este ancho de cuero, el diámetro de la polea menor debe alcanzar '+n(requiredPulley*1000)+' mm por la nota a de la tabla 17-2.');
  check(tensionOK,'El ancho fijo tabulado supera la tensión de referencia con esta potencia.');
  const speedFpm=speed*60/(12*inch), demandImperial=tight/width*inch/lbf;
  if(fixedWidth===null) add('note','El ancho calculado es un mínimo continuo. La tabla 17-2 aporta propiedades y tensión de referencia para esta fila. La selección comercial depende de los anchos del proveedor.');
  add('note','La tabla 17-2 indica tensión a 600 ft/min. La banda trabajaría a '+n(speedFpm,2)+' ft/min y requiere '+n(demandImperial,2)+' lbf/in. Para confirmar servicio a otra velocidad hace falta una tensión admisible o corrección documentada. La verificación de vida requiere datos cíclicos y ciclos de trabajo.');

  const r0=driver/2, r1=driven/2;
  const scale=Math.min(294/(centers+r0+r1),72/Math.max(driver,driven));
  const x0=63+r0*scale, x1=x0+centers*scale, y=62;
  const marks=[['circle',x0,y,r0*scale],['circle',x1,y,r1*scale]];
  for(const sign of [-1,1]){
    const nx=-Math.sin(alpha)*scale, ny=sign*Math.cos(alpha)*scale;
    marks.push(['line',x0+r0*nx,y+r0*ny,x1+r1*nx,y+r1*ny]);
  }
  marks.push(['label',100,112,'Motriz '+n(c.driverMm,2)+' mm'],
    ['label',320,112,'Conducida '+n(c.drivenMm,2)+' mm'],
    ['label',210,11,'Entre centros '+n(c.centersMm,2)+' mm · ancho '+n(width*1000,2)+' mm']);
  add('diagram',{title:'Banda abierta de dos poleas',caption:'Radios y centros a la misma escala. Los segmentos representan las tangentes exteriores.',marks});
  return {shaftForces:{names:['Ramal tenso','Ramal flojo'],forces:[tight,slack],angle:2*Math.abs(alpha)*180/Math.PI},belt:{selected:width,review:{fixedWidth:fixedWidth!==null,operatingFpm:speedFpm}},
    metrics:[[fixedWidth===null?'Ancho mínimo continuo':'Ancho de tabla',width*1000,'mm',3],
    ['Longitud de banda',length,'m',3],['Velocidad de banda',speed,'m/s',2],
    ['Velocidad de salida',drivenRpm,'rpm',2],['Tensión del ramal tenso',tight,'N',2],
    ['Tensión del ramal flojo',slack,'N',2]]};
}

function solveComponentSpring(c,ctx){
  const {add,check}=ctx;
  check([c.fmin,c.fmax,c.springInstalledLength].every(Number.isFinite),'Ingresa las dos fuerzas y la longitud instalada.');
  const mm=value=>dual(value,'mm',1/25.4,'in');
  const N=value=>dual(value,'N',1/lbf,'lbf');
  add('heading','Cargas propuestas');
  add('text','La longitud instalada corresponde a la carga mínima. La carga máxima se alcanza al extender el resorte con la rigidez propuesta.');
  add('eq',math`F_{\min}=${N(c.fmin)};\quad F_{\max}=${N(c.fmax)};\quad L_{\mathrm{inst,min}}=${mm(c.springInstalledLength)}`);
  const spring=sizeExtensionSpring(c,{fmin:c.fmin,fmax:c.fmax,mount:c.springInstalledLength},ctx);
  const travel=spring.xmax-spring.xmin;
  const maxLength=spring.free+spring.xmax;
  check(Number.isFinite(maxLength),'La longitud instalada máxima sale del intervalo numérico del modelo.');
  add('heading','Recorrido y longitud máxima');
  add('eq',math`\Delta x=\frac{F_{\max}-F_{\min}}{k}=\frac{${number(c.fmax)}-${number(c.fmin)}}{${number(spring.k)}}=${mm(travel)}`);
  add('eq',math`L_{\mathrm{inst,max}}=L_0+x_{\max}=${number(spring.free)}+${number(spring.xmax)}=${mm(maxLength)}`);
  const x1=88, y1=23, width=249, height=77;
  const xAt=value=>x1+(spring.xmax?value/spring.xmax:0)*width;
  const yAt=value=>y1+value/spring.fmax*height;
  const minX=xAt(spring.xmin), minY=yAt(spring.fmin);
  const maxX=xAt(spring.xmax), maxY=yAt(spring.fmax);
  const marks=[['line',x1,y1,363,y1],['line',x1,y1,x1,110],
    ['line',x1,yAt(spring.fi),maxX,maxY],['circle',minX,minY,3],['circle',maxX,maxY,3],
    ['label',50,109,'F (N)'],['label',371,10,'x (mm)'],
    ['label',46,100,'Fmax '+number(spring.fmax,2)],
    ['label',210,10,'Recorrido '+number(travel,2)+' mm']];
  if(minY<=90) marks.push(['label',50,minY,'Fmin '+number(spring.fmin,2)]);
  add('diagram',{title:'Curva carga–extensión del resorte',
    caption:'La recta empieza en la tensión inicial. Los puntos corresponden a las cargas mínima y máxima propuestas.',marks});
  return {spring,metrics:[['Diámetro mínimo de alambre',spring.selected,'mm',3],['Diámetro medio',spring.D,'mm',2],
    ['Longitud libre',spring.free,'mm',2],['Recorrido',travel,'mm',2],
    ['Espiras activas calculadas',spring.active,'',2],['Factor estático mínimo',Math.min(...spring.elasticFactors),'',2]]};
}
