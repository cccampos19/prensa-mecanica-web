'use strict';

const inch = 0.0254;
const lbf = 4.448221615;
const gravity = 9.80665;
const hp = 745.699872;
const tolerance = 3;
function number(value, digits = 3) {
  if (value !== 0 && (Math.abs(value) < 10 ** -digits || Math.abs(value) >= 1e9)) {
    const [mantissa, exponent] = value.toExponential(4).split('e');
    return mantissa + '\\times 10^{' + Number(exponent) + '}';
  }
  return Number(value.toFixed(digits)).toString();
}

const unit = name => '\\,\\mathrm{' + name + '}';
const display = (value, name, digits) => number(value, digits) + unit(name);
const dual = (value, si, factor, english) =>
  display(value, si) + '\\quad(' + display(value * factor, english) + ')';
const math = String.raw;

function calculate(c) {
  const entries = [];
  const add = (type, value) => entries.push({type, value});
  const eq = value => add('eq', value);
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const n = number;
  const kw = watts => dual(watts / 1000, 'kW', 1000 / hp, 'hp');
  const torque = value => dual(value, 'N\\,m', 1 / (lbf * inch * 12), 'lbf\\,ft');
  const mm = meters => dual(meters * 1000, 'mm', 1 / (1000 * inch), 'in');
  const force = value => dual(value, 'N', 1 / lbf, 'lbf');
  const iterations = [];
  let power;
  let belt;

  try {
    for (const [value, label] of [
      [c.rpm,'rpm del motor'], [c.ratio,'relación de banda'], [c.load,'torque de salida'],
      [c.pinion,'diámetro del piñón'], [c.gear,'diámetro del engrane'],
      [c.gearEff,'eficiencia de engranes'], [c.beltEff,'eficiencia de banda'],
      [c.nominal,'potencia nominal']
    ]) check(Number.isFinite(value) && value > 0, 'Ingresa un valor positivo para ' + label + '.');
    check(c.gearEff <= 100 && c.beltEff <= 100, 'Las eficiencias deben ser como máximo 100 %.');

    add('section', 'Potencia y velocidades');
    add('heading', 'Datos del enunciado y del plano');
    eq(math`n_m=${display(c.rpm,'rpm')};\quad i_b=${n(c.ratio)};\quad T_s=${display(c.load,'kgf\\,cm')}`);
    eq(math`d_p=${mm(c.pinion/1000)};\quad d_g=${mm(c.gear/1000)}`);
    add('heading', 'Hipótesis de pérdidas y propuesta de motor');
    add('text', 'El enunciado escrito especifica un torque de salida. Para el caso de la tarea se supone una transmisión sin pérdidas porque el texto no da eficiencias ni pérdidas. Si editas una eficiencia, se aplica el valor indicado a esa etapa.');
    eq(math`\eta_b=${n(c.beltEff/100)};\quad\eta_g=${n(c.gearEff/100)};\quad P_{nom}=${kw(c.nominal*1000)}`);
    add('text', 'Método de clase: relaciones de transmisión y potencia mecánica (apuntes, pp. 28, 30 y 41–42).');
    add('heading', 'Cadena de velocidades');
    const shaftRpm = c.rpm / c.ratio;
    const gearRatio = c.gear / c.pinion;
    const outRpm = shaftRpm / gearRatio;
    eq(math`n_e=\frac{n_m}{i_b}=\frac{${n(c.rpm)}}{${n(c.ratio)}}=${display(shaftRpm,'rpm')}`);
    eq(math`i_g=\frac{d_g}{d_p}=\frac{${n(c.gear)}}{${n(c.pinion)}}=${n(gearRatio)}`);
    eq(math`n_s=\frac{n_e}{i_g}=\frac{${n(shaftRpm)}}{${n(gearRatio)}}=${display(outRpm,'rpm')}`);
    add('heading', 'Torques y potencias');
    const outTorque = c.load * gravity / 100;
    const outPower = outTorque * 2 * Math.PI * outRpm / 60;
    const shaftPower = outPower / (c.gearEff / 100);
    const motorPower = shaftPower / (c.beltEff / 100);
    const shaftTorque = shaftPower * 60 / (2 * Math.PI * shaftRpm);
    const motorTorque = motorPower * 60 / (2 * Math.PI * c.rpm);
    eq(math`T_s=${n(c.load)}(0.0980665)=${torque(outTorque)}`);
    eq(math`P_s=T_s\frac{2\pi n_s}{60}=${n(outTorque)}\frac{2\pi(${n(outRpm)})}{60}=${kw(outPower)}`);
    eq(math`P_e=\frac{P_s}{\eta_g}=\frac{${n(outPower/1000)}}{${n(c.gearEff/100)}}=${kw(shaftPower)}`);
    eq(math`P_m=\frac{P_e}{\eta_b}=\frac{${n(shaftPower/1000)}}{${n(c.beltEff/100)}}=${kw(motorPower)}`);
    eq(math`T_e=\frac{60P_e}{2\pi n_e}=\frac{60(${n(shaftPower)})}{2\pi(${n(shaftRpm)})}=${torque(shaftTorque)}`);
    eq(math`T_m=\frac{60P_m}{2\pi n_m}=\frac{60(${n(motorPower)})}{2\pi(${n(c.rpm)})}=${torque(motorTorque)}`);
    add('heading', 'Comprobación del motor nominal');
    const motorFits = c.nominal * 1000 >= motorPower;
    eq(math`P_{nom}=${kw(c.nominal*1000)}${motorFits ? '\\ge ' : '<'}P_m=${kw(motorPower)}`);
    check(motorFits, 'La potencia nominal propuesta es insuficiente.');
    power = {shaftRpm, outRpm, motorPower, shaftTorque};

    add('section', 'Poleas y banda plana');
    for (const [value, label] of [[c.pulley,'diámetro conducido'], [c.centers,'distancia entre centros'], [c.start,'ancho inicial']]) {
      check(Number.isFinite(value) && value > 0, 'Ingresa un valor positivo para ' + label + '.');
    }
    check(Number.isFinite(c.angle), 'Ingresa la orientación de la carga.');
    const row = catalog[c.belt];
    check(row, 'Selecciona una banda del catálogo.');
    const [name, thicknessIn, minimumIn, allowableIn, listedWeight, friction] = row;
    const weightIn = Array.isArray(listedWeight) ? Math.max(...listedWeight) : listedWeight;
    check(minimumIn, name + (name.includes('redondo') ? ' requiere un método de banda redonda.' : ' requiere consultar el diámetro mínimo en la tabla 17-3.'));
    const thickness = thicknessIn * inch;
    const density = weightIn * lbf / inch ** 3 / gravity;
    const allowable = allowableIn * lbf / inch;
    const driven = c.pulley / 1000;
    const driver = driven / c.ratio;
    check(2 * c.centers > driven + driver, 'La distancia entre centros debe superar la suma de los radios.');
    const small = Math.min(driver, driven);
    const tightAngle=c.angle*Math.PI/180+Math.asin((driven-driver)/(2*c.centers));
    check(c.springRate>0,'La rigidez propuesta del resorte debe ser positiva.');
    add('heading','Selección del diámetro del rodillo');
    const minRoller=1000*minimumIn*inch;
    const proposed=2*c.idlerRadius;
    const alternatives=[];
    for(let trial=Math.ceil(minRoller/2)*2;trial<300-driver*1000;trial+=2) {
      if(trial!==proposed) alternatives.push(trial);
    }
    alternatives.sort((a,b)=>Math.abs(a-proposed)-Math.abs(b-proposed));
    const candidates=[proposed,...alternatives];
    let geometry, rollerDiameter, rejection;
    for(const trial of candidates){
      if(trial<minRoller){
        add('text','Rodillo propuesto de '+n(trial)+' mm. Inferior al mínimo de '+n(minRoller)+' mm de tabla 17-2.');
        continue;
      }
      try {
        geometry=tensorGeometry({...c,idlerRadius:trial/2},driven,driver,tightAngle,check);
      } catch(error) {
        rejection=error.message;
        add('text','Rodillo de '+n(trial)+' mm. '+rejection);
        continue;
      }
      rollerDiameter=trial;
      add('text','Rodillo de '+n(trial)+' mm. Cumple diámetro mínimo y contacto en el recorrido.');
      break;
    }
    check(geometry,'La selección del rodillo no tiene solución geométrica. '+(rejection||'El mínimo de tabla excede el espacio disponible.'));
    add('text','El texto del enunciado fija 2100 rpm y 18000 kgf·cm para el caso de la tarea. El plano se usa para la geometría y muestra rotulados 1800 rpm y 15000 kgf·cm.');
    const nominal=geometry[50], smallWrap=nominal.wrapMotor, largeWrap=nominal.wrapDriven;
    const length=nominal.length;
    const speed = Math.PI * driver * c.rpm / 60;
    const delta = motorPower / speed;
    const ratio=Math.exp(friction*Math.min(smallWrap,largeWrap));
    add('heading', 'Propuesta y datos de catálogo');
    add('text', name + ' · tabla 17-2. Distancia entre centros y orientación propuestas.');
    eq(math`D=${mm(driven)};\quad C=${mm(c.centers)};\quad \beta=${n(c.angle)}^\circ`);
    eq(math`t=${mm(thickness)};\quad \mu=${n(friction)};\quad d_{min}=${mm(minimumIn*inch)}`);
    eq(math`S_{perm}=${display(allowableIn,'lbf/in')}(4.448221615/0.0254)=${display(allowable,'N/m')}`);
    eq(math`\rho=\frac{\gamma}{g}=\frac{${n(weightIn,5)}(4.448221615)}{(0.0254)^3(9.80665)}=${dual(density,'kg/m^3',inch**3/.45359237,'lb/in^3')}`);
    add('note', 'La tensión permisible de la tabla 17-2 corresponde a 600 ft/min. Se emplea como referencia para iterar el ancho; el resultado es preliminar si la velocidad difiere o hay flexión inversa.');
    if (name.startsWith('Cuero')) add('note', 'Se utiliza el extremo superior de 0.045 lbf/in³ del intervalo de la tabla 17-2 para el cuero.');
    add('heading', 'Geometría y velocidad de la banda');
    add('note','El mínimo de la tabla 17-2 sirve de comparación geométrica. Para el rodillo de contraflexión hace falta el diámetro mínimo específico en flexión inversa.');
    add('text', 'Banda abierta, relación de tensiones con fuerza centrífuga y balance de potencia (apuntes, pp. 40–47).');
    eq(math`d=D/i_b=${n(driven)}/${n(c.ratio)}=${mm(driver)}`);
    eq(math`d_{menor}=${mm(small)}${small >= minimumIn*inch ? '\\ge ' : '<'}d_{min}=${mm(minimumIn*inch)}`);
    check(small >= minimumIn * inch, 'La polea menor queda por debajo del diámetro mínimo del material.');
    add('text','Plano, p. 3. Se interpreta el pivote en el eje de la polea motriz y el extremo del brazo como centro del rodillo y anclaje móvil. El radio del rodillo y el ángulo inicial son propuestas. Se usan 150 mm de pivote a anclaje móvil y 180 mm del pivote al nivel del anclaje fijo. Se supone el anclaje fijo bajo el extremo del brazo horizontal.');
    add('text','Se calculan tangentes internas a ambos lados del rodillo y una tangente exterior en el ramal tenso. Los ángulos del centro a centro y las longitudes se indican para la posición intermedia.');
    eq(math`\gamma_t=${n(tightAngle*180/Math.PI)}^\circ;\quad \gamma_{f,c}=${n(nominal.b*180/Math.PI)}^\circ;\quad \gamma_{f,m}=${n(nominal.m*180/Math.PI)}^\circ`);
    eq(math`\theta_m=\pi+\gamma_{f,m}-\gamma_t=${display(smallWrap,"rad",5)};\quad\theta_c=\pi+\gamma_t-\gamma_{f,c}=${display(largeWrap,"rad",5)}`);
    eq(math`L_{banda}=\sum L_{tangentes}+\sum r_i\theta_i=${dual(length,"m",1/(12*inch),"ft")}`);
    eq(math`v=\frac{\pi d n_m}{60}=\frac{\pi(${n(driver)})(${n(c.rpm)})}{60}=${dual(speed,'m/s',60/(12*inch),'ft/min')}`);
    eq(math`\Delta F=P_m/v=${n(motorPower)}/${n(speed)}=${force(delta)}`);
    eq(math`R_{\lim}=e^{\mu\min(\theta_m,\theta_c)}=e^{(${n(friction)})(${n(Math.min(smallWrap,largeWrap),5)})}=${n(ratio,5)}`);

    const tension = width => {
      const centrifugal = density * width * thickness * speed ** 2;
      const states=tensorLoads(geometry,delta,centrifugal,friction,c.springRate,tightAngle);
      const governing=states.reduce((worst,state)=>state.tight>worst.tight?state:worst);
      return {centrifugal,slack:governing.slack,tight:governing.tight,states};
    };
    function showTensions(width,{centrifugal,slack,tight,states}){
      eq(math`A=bt=(${n(width,8)})(${n(thickness,8)})=${display(width*thickness,"m^2",9)}`);
      eq(math`F_c=\rho Av^2=(${n(density)})(${n(width*thickness,9)})(${n(speed)})^2=${force(centrifugal)}`);
      eq(math`F_{2,\min}=F_c+\frac{\Delta F}{e^{\mu\min(\theta_m,\theta_c)}-1}`);
      eq(math`F_{r,0}=\max_j\left[a_j F_{2,\min,j}-k(L_j-L_0)\right]=${force(states[0].springForce)}`);
      eq(math`F_{2,j}=\frac{F_{r,0}+k(L_j-L_0)}{a_j};\quad \max_j F_{2,j}=${force(slack)}`);
      eq(math`F_{1,\max}=F_{2,\max}+\Delta F=${n(slack)}+${n(delta)}=${force(tight)}`);
    }
    add('text','a es la razón de brazos efectivos obtenida del equilibrio de momentos en el pivote. La precarga instalada mínima se escoge para transmitir la potencia sin deslizamiento en 101 posiciones del recorrido con la rigidez propuesta.');

    add('heading', 'Dimensionamiento iterativo del ancho');
    add('text', 'Se calcula con cifras completas y se muestran valores redondeados. El criterio de convergencia es un error relativo menor al 3 %.');
    let width = c.start / 1000;
    let error = Infinity;
    for (let k = 1; k <= 100 && error >= tolerance; k++) {
      const tensions = tension(width);
      const next = tensions.tight / allowable;
      error = 100 * Math.abs(next - width) / next;
      check(Number.isFinite(error), 'La propuesta produjo valores fuera del rango numérico.');
      iterations.push({width, next, error, centrifugal:tensions.centrifugal, slack:tensions.slack, tight:tensions.tight});
      add('iteration', 'Iteración ' + k);
      eq(math`b_{${k}}=${mm(width)}`);
      showTensions(width, tensions);
      eq(math`b_{nuevo}=\frac{F_1}{S_{perm}}=\frac{${n(tensions.tight)}}{${n(allowable)}}=${mm(next)}`);
      eq(math`\varepsilon=\left|\frac{b_{nuevo}-b_{${k}}}{b_{nuevo}}\right|100=\left|\frac{${n(next,8)}-${n(width,8)}}{${n(next,8)}}\right|100=${n(error,5)}\,\%`);
      add('text', error < tolerance ? 'Cumple el criterio de convergencia.' : 'Se usa el ancho calculado en la siguiente iteración.');
      width = next;
    }
    add('heading', 'Selección y comprobación final');
    check(error < tolerance, 'El ancho no convergió después de 100 iteraciones.');
    const fitsWidth = candidate => !(name.startsWith('Cuero') && [6,9].includes(minimumIn) &&
      candidate>=8*inch && Math.min(small,rollerDiameter/1000)<(minimumIn+2)*inch);
    let provisional = Math.ceil(width*100-1e-9);
    let final = tension(provisional/100);
    for(let attempt=0; final.tight>allowable*provisional/100+1e-9 && attempt<100;attempt++){
      add('text','Se prueba '+n(provisional*10)+' mm: la demanda supera la referencia de la tabla 17-2.');
      provisional++;
      final=tension(provisional/100);
    }
    check(fitsWidth(provisional/100),'La nota a de la tabla 17-2 exige aumentar 2 in el diámetro mínimo de esta banda de cuero ancha.');
    check(final.tight<=allowable*provisional/100+1e-9,'No se encontró ancho compatible tras redondear.');
    const nextWidth=(provisional+1)/100;
    const nextTension=tension(nextWidth);
    const useReserve=fitsWidth(nextWidth)&&nextTension.tight<=allowable*nextWidth+1e-9;
    const selected=useReserve?nextWidth:provisional/100;
    if(useReserve) final=nextTension;
    add('text',useReserve
      ? 'El ancho mínimo redondeado que cumple frente a la referencia es '+n(provisional*10)+' mm. Se adopta el siguiente incremento de 10 mm, '+n(selected*1000)+' mm, como reserva provisional.'
      : 'El incremento adicional de 10 mm incumple un criterio geométrico o de capacidad; se conserva el ancho mínimo compatible de '+n(selected*1000)+' mm.');
    add('note','La reserva de ancho reduce la demanda por unidad de ancho calculada. No sustituye la tensión admisible a la velocidad real ni la verificación de contraflexión.');
    showTensions(selected, final);
    eq(math`T_{mot}=\Delta F\frac{d}{2}=(${n(delta)})\frac{${n(driver)}}{2}=${torque(delta*driver/2)}`);
    eq(math`\frac{F_c}{F_1}100=\frac{${n(final.centrifugal)}}{${n(final.tight)}}100=${n(100*final.centrifugal/final.tight)}\,\%`);
    const capacity = allowable * selected;
    eq(math`F_{perm}=S_{perm}b=(${n(allowable)})(${n(selected)})=${force(capacity)}`);
    eq(math`F_1=${force(final.tight)}${final.tight <= capacity ? '\\le ' : '>'}F_{perm}=${force(capacity)}`);
    check(final.tight <= capacity + 1e-9, 'El ancho redondeado supera la tensión de referencia de la tabla 17-2.');
    add('heading','Carga sobre la polea conducida con el tensor');
    add('text','En la polea conducida actúan las dos tensiones en sus direcciones tangentes locales. La reacción de la polea auxiliar va a su pivote.');
    const mid=final.states[50];
    const maximumGrip=Math.max(...final.states.map(s=>(s.tight-final.centrifugal)/((s.slack-final.centrifugal)*Math.exp(friction*Math.min(s.wrapMotor,s.wrapDriven)))));
    check(maximumGrip>0&&maximumGrip<=1+1e-9,'La banda pierde condición de tracción en el recorrido.');
    eq(math`\max_j\frac{F_{1,j}-F_c}{(F_{2,j}-F_c)e^{\mu\min(\theta_{m,j},\theta_{c,j})}}=${n(maximumGrip,6)}\le 1`);
    eq(math`F_y=F_1\cos\gamma_t+F_2\cos\gamma_{f,c}=${n(mid.tight)}\cos(${n(tightAngle*180/Math.PI)}^\circ)+${n(mid.slack)}\cos(${n(mid.b*180/Math.PI)}^\circ)=${force(mid.fy)}`);
    eq(math`F_z=F_1\sin\gamma_t+F_2\sin\gamma_{f,c}=${n(mid.tight)}\sin(${n(tightAngle*180/Math.PI)}^\circ)+${n(mid.slack)}\sin(${n(mid.b*180/Math.PI)}^\circ)=${force(mid.fz)}`);
    eq(math`|\mathbf F|=\sqrt{(${n(mid.fy)})^2+(${n(mid.fz)})^2}=${force(Math.hypot(mid.fy,mid.fz))}`);
    add('heading','Alcance de la verificación de banda');
    const operatingFpm=speed*60/(12*inch), demand=final.tight/selected;
    const demandImperial=demand*inch/lbf, minDiameterMm=1000*minimumIn*inch;
    const lapsPerSecond=speed/length;
    eq(math`S_{\mathrm{req}}=\frac{F_{1,\max}}{b}=\frac{${n(final.tight)}}{${n(selected*1000)}}=${dual(demand/1000,"N/mm",1000*inch/lbf,"lbf/in")}`);
    eq(math`\frac{S_{\mathrm{req}}}{S_{17-2}}=\frac{${n(demandImperial)}}{${n(allowableIn)}}=${n(demandImperial/allowableIn,5)}`);
    eq(math`f_{\mathrm{vuelta}}=\frac{v}{L}=\frac{${n(speed)}}{${n(length)}}=${display(lapsPerSecond,"Hz")}`);
    add('text','Con la tabla se comprueban la demanda por ancho frente al valor de referencia y los diámetros frente al mínimo tabulado de '+n(minDiameterMm)+' mm. El cociente de tracción del modelo llega a '+n(maximumGrip,5)+'; un valor de 1 indica el límite teórico, con el coeficiente tabulado.');
    add('note','Dato faltante para tensión: tensión admisible por ancho de la banda '+name+' a '+n(operatingFpm)+' ft/min (o factor de corrección documentado desde 600 ft/min), en servicio con polea tensora exterior. Para este ancho debe ser al menos '+n(demandImperial,2)+' lbf/in, antes de cualquier margen adicional.');
    add('note','Dato faltante para contraflexión y vida: diámetro mínimo de rodillo exterior para la banda elegida y curva de duración frente a flexiones inversas, o ficha del fabricante que califique la configuración. El rodillo propuesto mide '+n(rollerDiameter)+' mm y cada punto de la banda pasa por él aproximadamente '+n(lapsPerSecond,2)+' veces por segundo en marcha continua. Hace falta definir la vida objetivo de banda y su ciclo de servicio.');
    const beltReview={demandImperial,allowableIn,operatingFpm,maximumGrip,lapsPerSecond};
    belt = {selected,speed,length,capacity,...final,fy:mid.fy,fz:mid.fz,rollerDiameter,driver,driven,review:beltReview};
    const design = finishDesign(c, power, belt, add, check);
    add('section','Brazo tensor y resorte de tensión');
    const spring = springDesign(c, belt, add, check);
    add('heading','Conclusión y especificaciones de la propuesta');
    add('text','Motor nominal de '+c.nominal+' kW para '+n(motorPower/1000)+' kW requeridos. Banda '+name+' de '+n(selected*1000)+' mm, longitud nominal '+n(length)+' m y poleas de '+n(driver*1000)+' y '+n(driven*1000)+' mm.');
    add('text','Engranes '+c.np+'/'+c.ng+' dientes, '+steels[c.gearSteel].label+', módulo '+n(design.module)+' mm y cara '+n(design.faceMm)+' mm. Flecha '+steels[c.shaftSteel].label+' de '+n(design.diameter)+' mm y rodamientos serie 02 de '+n(design.diameter)+' mm de agujero.');
    add('text','Resorte '+spring.name+' de '+n(spring.selected)+' mm de alambre y '+n(spring.free)+' mm de longitud libre. Verificación cíclica del resorte pendiente de los datos de resistencia de las tablas.');
    add('heading','Fuentes');
    add('text','Enunciado Prensa mecánica, pp. 2–3. Libreta de Diseño de Elementos de Máquinas, pp. 9–22, 28–60. Tablas de clase A-20, A-21, 6-2, 6-4, 10-4, 10-5, 11-1, 11-2 y 17-2.');
    add('text','Budynas y Nisbett, Diseño en ingeniería mecánica de Shigley, 10.ª ed., cap. 10, ecuaciones geométricas de esfuerzo en el gancho.');
    add('section','Diagramas de la propuesta');
    for(const diagram of designDiagrams(c,power,belt,design,spring)) add('diagram',diagram);
    return {entries, power, belt, design, spring, iterations};
  } catch (error) {
    add('note', error.message);
    return {entries, power, belt, iterations, error: error.message};
  }
}
