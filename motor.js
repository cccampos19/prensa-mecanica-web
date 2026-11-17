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
  const fixed = value.toFixed(digits);
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

const unit = name => '\\,\\mathrm{' + name + '}';
const display = (value, name, digits) => number(value, digits) + unit(name);
const dual = (value, si, factor, english) =>
  display(value, si) + '\\quad(' + display(value * factor, english) + ')';
const math = String.raw;
const plainNumberNotation = value => value.replace(/\\times 10\^\{(-?\d+)\}/g, 'e$1');

function createCalculationTrace() {
  const entries = [];
  const decisions = [];
  const add = (type, value) => entries.push({type, value});
  const check = (condition, message, stage) => {
    if (!condition) throw Object.assign(new Error(message), {stage});
  };
  function decision(stage, title, unit, summary = '') {
    const group = {stage, title, unit, summary:plainNumberNotation(summary), trials:[]};
    decisions.push(group);
    return group;
  }
  function trial(group, value, status, reason) {
    const candidate = {measure:plainNumberNotation(number(value))+' '+group.unit, status, reason:plainNumberNotation(reason)};
    group.trials.push(candidate);
    return candidate;
  }
  return {entries, decisions, add, check, decision, trial};
}

function calculate(c) {
  const {entries, decisions, add, check, decision, trial} = createCalculationTrace();
  const eq = value => add('eq', value);
  const n = number;
  const kw = watts => dual(watts / 1000, 'kW', 1000 / hp, 'hp');
  const torque = value => dual(value, 'N\\,m', 1 / (lbf * inch * 12), 'lbf\\,ft');
  const mm = meters => dual(meters * 1000, 'mm', 1 / (1000 * inch), 'in');
  const force = value => dual(value, 'N', 1 / lbf, 'lbf');
  const iterations = [];
  const decisionLog = {decision, trial};
  let power;
  let belt;
  let design;

  try {
    add('section', 'Potencia y velocidades');
    for (const [value, label, stage] of [
      [c.rpm,'rpm del motor',1], [c.load,'torque de salida',1], [c.nominal,'potencia nominal',1],
      [c.ratio,'relación de banda',2], [c.beltEff,'eficiencia de banda',2], [c.gearEff,'eficiencia de engranes',3]
    ]) check(Number.isFinite(value) && value > 0, 'Ingresa un valor positivo para ' + label + '.', stage);
    check(c.beltEff<=100,'La eficiencia de la banda debe ser como máximo 100 %.',2);
    check(c.gearEff<=100,'La eficiencia de los engranes debe ser como máximo 100 %.',3);

    check([c.np,c.ng].every(value=>Number.isSafeInteger(value)&&value>0), 'Propón números enteros positivos de dientes para el piñón y la rueda.', 3);
    add('heading', 'Datos del enunciado y del plano');
    eq(math`n_m=${display(c.rpm,'rpm')};\quad i_b=${n(c.ratio)};\quad T_s=${display(c.load,'kgf\\,cm')}`);
    add('heading', 'Hipótesis de pérdidas y propuesta de motor');
    add('text', 'El enunciado escrito especifica un torque de salida. Para el caso de la tarea se supone una transmisión sin pérdidas porque el texto no da eficiencias ni pérdidas. Si editas una eficiencia, se aplica el valor indicado a esa etapa.');
    eq(math`\eta_b=${n(c.beltEff/100)};\quad\eta_g=${n(c.gearEff/100)};\quad P_{nom}=${kw(c.nominal*1000)}`);
    add('text', 'Método de clase: relaciones de transmisión y potencia mecánica (apuntes, pp. 28, 30 y 41–42).');
    add('heading', 'Cadena de velocidades');
    const shaftRpm = c.rpm / c.ratio;
    const gearRatio = c.ng / c.np;
    const outRpm = shaftRpm / gearRatio;
    eq(math`n_e=\frac{n_m}{i_b}=\frac{${n(c.rpm)}}{${n(c.ratio)}}=${display(shaftRpm,'rpm')}`);
    eq(math`i_g=\frac{N_g}{N_p}=\frac{${c.ng}}{${c.np}}=${n(gearRatio)}`);
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
    const motorDecision=decision(1,'Potencia nominal del motor','kW','Potencia mecánica requerida de '+n(motorPower/1000)+' kW.');
    trial(motorDecision,c.nominal,motorFits?'verified':'rejected',motorFits
      ?'La potencia nominal cubre la potencia calculada.'
      :'La potencia nominal queda por debajo de la potencia calculada.');
    eq(math`P_{nom}=${kw(c.nominal*1000)}${motorFits ? '\\ge ' : '<'}P_m=${kw(motorPower)}`);
    power = {shaftRpm,outRpm,motorPower,shaftTorque,outPower,outTorque,motorTorque,motorFits};
    check(motorFits, 'El motor propuesto entrega '+n(c.nominal)+' kW nominales y el cálculo requiere al menos '+n(motorPower/1000)+' kW.');

    add('section', 'Poleas y banda plana');
    for (const [value, label] of [[c.pulley,'diámetro conducido'], [c.centers,'distancia entre centros'], [c.start,'ancho inicial'], [c.idlerRadius,'radio inicial del rodillo']]) {
      check(Number.isFinite(value) && value > 0, 'Ingresa un valor positivo para ' + label + '.');
    }
    check(Number.isFinite(c.angle), 'Ingresa la orientación de la carga.');
    const row = catalog[c.belt];
    check(row, 'Selecciona una banda del catálogo.');
    const [name, thicknessIn, minimumIn, allowableIn, listedWeight, friction, fixedWidthIn, shape] = row;
    const weightIn = Array.isArray(listedWeight) ? Math.max(...listedWeight) : listedWeight;
    check(shape==='plana', name+' requiere un método de banda redonda.');
    check(minimumIn, name+' requiere consultar el diámetro mínimo en la tabla 17-3.');
    const thickness = thicknessIn * inch;
    const density = weightIn * lbf / inch ** 3 / gravity;
    const allowable = allowableIn * lbf / inch;
    const driven = c.pulley / 1000;
    const driver = driven / c.ratio;
    check(2 * c.centers > driven + driver, 'La distancia entre centros debe superar la suma de los radios.');
    const small = Math.min(driver, driven);
    const tightAngle=c.angle*Math.PI/180+Math.asin((driven-driver)/(2*c.centers));
    check(Number.isFinite(c.springRate)&&c.springRate>0,'La rigidez propuesta del resorte debe ser positiva.');
    add('heading', 'Propuesta y datos de catálogo');
    add('text', name + ' · tabla 17-2. Se verifican las poleas y el rodillo propuestos. El ancho se toma de la fila si es fijo o se dimensiona con la tensión por unidad de ancho.');
    eq(math`D=${mm(driven)};\quad C=${mm(c.centers)};\quad \beta=${n(c.angle)}^\circ`);
    eq(math`t=${mm(thickness)};\quad \mu=${n(friction)};\quad d_{min}=${mm(minimumIn*inch)}`);
    eq(math`S_{perm}=${display(allowableIn,'lbf/in')}(4.448221615/0.0254)=${display(allowable,'N/m')}`);
    eq(math`\rho=\frac{\gamma}{g}=\frac{${n(weightIn,5)}(4.448221615)}{(0.0254)^3(9.80665)}=${dual(density,'kg/m^3',inch**3/.45359237,'lb/in^3')}`);
    add('note', 'La tensión permisible de la tabla 17-2 corresponde a 600 ft/min. Se emplea como referencia para iterar el ancho. El resultado es preliminar si la velocidad difiere o hay flexión inversa.');
    if (name.startsWith('Cuero')) add('note', 'Se utiliza el extremo superior de 0.045 lbf/in³ del intervalo de la tabla 17-2 para el cuero.');
    eq(math`d=D/i_b=${n(driven)}/${n(c.ratio)}=${mm(driver)}`);
    eq(math`d_{menor}=${mm(small)}${small >= minimumIn*inch ? '\\ge ' : '<'}d_{min}=${mm(minimumIn*inch)}`);
    const pulleyDecision=decision(2,'Diámetro de la polea menor','mm','Polea motriz de '+n(driver*1000)+' mm y conducida de '+n(driven*1000)+' mm con '+name+'.');
    trial(pulleyDecision,small*1000,small>=minimumIn*inch?'verified':'rejected',
      (small>=minimumIn*inch?'Cumple el mínimo de ':'Queda por debajo del mínimo de ')+n(minimumIn*inch*1000)+' mm de la tabla 17-2.');
    if(small<minimumIn*inch){
      const minimumDriven=minimumIn*inch*Math.max(1,c.ratio);
      check(false,'La polea menor queda por debajo del mínimo de la tabla 17-2 para '+name+'. A esta relación se requiere una polea conducida de al menos '+n(minimumDriven*1000)+' mm, antes de verificar el espacio del tensor.');
    }
    add('heading','Comprobación del diámetro del rodillo propuesto');
    const minRoller=1000*minimumIn*inch;
    const maxRoller=300-driver*1000;
    const rollerDiameter=2*c.idlerRadius;
    const rollerRange='La referencia geométrica de la tabla 17-2 es '+n(minRoller)+' mm. El montaje exige un diámetro inferior a '+n(maxRoller)+' mm.';
    const rollerDecision=decision(2,'Diámetro del rodillo tensor','mm',rollerRange+' La contraflexión está pendiente de verificación.');
    add('text','El diámetro propuesto es '+n(rollerDiameter)+' mm. '+rollerRange);
    if(rollerDiameter<minRoller||rollerDiameter>=maxRoller){
      const reason='El rodillo de '+n(rollerDiameter)+' mm queda fuera del intervalo de referencia y montaje. '+rollerRange;
      trial(rollerDecision,rollerDiameter,'rejected',reason);
      check(false,reason);
    }
    let geometry;
    try {
      geometry=tensorGeometry(c,driven,driver,tightAngle,check);
    } catch(error) {
      trial(rollerDecision,rollerDiameter,'rejected',error.message+' '+rollerRange);
      throw error;
    }
    const rollerFits='El diámetro propuesto cumple la referencia geométrica y conserva contacto en el recorrido.';
    add('text',rollerFits);
    trial(rollerDecision,rollerDiameter,'verified',rollerFits);
    add('text','El texto del enunciado fija 2100 rpm y 18000 kgf·cm para el caso de la tarea. El plano se usa para la geometría y muestra rotulados 1800 rpm y 15000 kgf·cm.');
    const nominal=geometry[50], smallWrap=nominal.wrapMotor, largeWrap=nominal.wrapDriven;
    const length=nominal.length;
    const speed = Math.PI * driver * c.rpm / 60;
    const delta = motorPower / speed;
    const ratio=Math.exp(friction*Math.min(smallWrap,largeWrap));
    add('heading', 'Geometría y velocidad de la banda');
    add('note','El mínimo de la tabla 17-2 sirve de comparación geométrica. Para el rodillo de contraflexión hace falta el diámetro mínimo específico en flexión inversa.');
    add('text', 'Banda abierta, relación de tensiones con fuerza centrífuga y balance de potencia (apuntes, pp. 40–47).');
    add('text','Plano, p. 3. Se interpreta el pivote en el eje de la polea motriz y el extremo del brazo como centro del rodillo y anclaje móvil. El radio del rodillo y el ángulo inicial son propuestas. Se usan 150 mm de pivote a anclaje móvil y 180 mm del pivote al nivel del anclaje fijo. Se supone el anclaje fijo bajo el extremo del brazo horizontal.');
    add('text','Se calculan tangentes internas a ambos lados del rodillo y una tangente exterior en el ramal tenso. Los ángulos del centro a centro y las longitudes se indican para la posición intermedia.');
    eq(math`\gamma_t=${n(tightAngle*180/Math.PI)}^\circ;\quad \gamma_{f,c}=${n(nominal.b*180/Math.PI)}^\circ;\quad \gamma_{f,m}=${n(nominal.m*180/Math.PI)}^\circ`);
    eq(math`\theta_m=\pi+\gamma_{f,m}-\gamma_t=${display(smallWrap,"rad",5)};\quad\theta_c=\pi+\gamma_t-\gamma_{f,c}=${display(largeWrap,"rad",5)}`);
    eq(math`L_{banda}=\sum L_{tangentes}+\sum r_i\theta_i=${dual(length,"m",1/(12*inch),"ft")}`);
    eq(math`v=\frac{\pi d n_m}{60}=\frac{\pi(${n(driver)})(${n(c.rpm)})}{60}=${dual(speed,'m/s',60/(12*inch),'ft/min')}`);
    eq(math`\Delta F=P_m/v=${n(motorPower)}/${n(speed)}=${force(delta)}`);
    eq(math`R_{\lim}=e^{\mu\min(\theta_m,\theta_c)}=e^{(${n(friction)})(${n(Math.min(smallWrap,largeWrap),5)})}=${n(ratio,5)}`);

    const centrifugalPerWidth=density*thickness*speed**2;
    const fixedWidth=fixedWidthIn==null?null:fixedWidthIn*inch;
    const widthDecision=decision(2,'Ancho de la banda','mm',name+'. La referencia de tensión de la tabla 17-2 corresponde a 600 ft/min. '
      +(fixedWidth==null?'La fila da tensión por unidad de ancho. El resultado es un mínimo calculado para consultar disponibilidad.':'Se verifica el ancho fijo de la fila.'));
    if(fixedWidth==null){
      check(centrifugalPerWidth<allowable,'Para '+name+', la tensión centrífuga por unidad de ancho supera o iguala la referencia de la tabla 17-2. Aumentar el ancho no resuelve la propuesta.');
    }
    const tension = width => {
      const centrifugal = centrifugalPerWidth * width;
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

    let selected=fixedWidth;
    if(fixedWidth==null){
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
      check(error < tolerance, 'El ancho no convergió después de 100 iteraciones.');

      add('heading', 'Ancho mínimo de cálculo');
      add('text','Para comprobar la aproximación iterativa se despeja el límite exacto del modelo en las 101 posiciones. La precarga inicial es el máximo de las demandas de montaje de cada posición j. En cada posición i, la tensión del ramal tenso debe cumplir incluso para la demanda de precarga que gobierne.');
      const positions=geometry.map(({lever,len,wrapMotor,wrapDriven})=>{
        const springIncrement=c.springRate*1000*(len-geometry[0].len);
        const slackWithoutCentrifugal=delta/Math.expm1(friction*Math.min(wrapMotor,wrapDriven));
        return {lever,springIncrement,preloadIntercept:lever*slackWithoutCentrifugal-springIncrement};
      });
      let lower=0, upper=Infinity, governingIntercept, governingSlope;
      for(const loaded of positions){
        for(const preload of positions){
          const intercept=(preload.preloadIntercept+loaded.springIncrement)/loaded.lever+delta;
          const slope=centrifugalPerWidth*preload.lever/loaded.lever;
          const margin=allowable-slope;
          if(margin>0){
            const bound=intercept/margin;
            if(bound>lower){
              lower=bound;
              governingIntercept=intercept;
              governingSlope=slope;
            }
          }else if(margin<0){
            upper=Math.min(upper,intercept/margin);
          }else{
            check(intercept<=0,'La tensión de referencia es insuficiente para la geometría del tensor.');
          }
        }
      }
      check(Number.isFinite(lower)&&lower>0&&lower<=upper,'La tensión de referencia no admite un ancho compatible con todo el recorrido del tensor.');
      selected=lower;
      eq(math`F_{1,ij}(b)=A_{ij}+B_{ij}b\le S_{perm}b;\quad B_{ij}=\rho tv^2\frac{a_j}{a_i}`);
      eq(math`A_{ij}=\frac{a_j\Delta F/(e^{\mu\theta_j}-1)-k(L_j-L_0)+k(L_i-L_0)}{a_i}+\Delta F;\quad\theta_j=\min(\theta_{m,j},\theta_{c,j})`);
      eq(math`b_{\min}=\frac{A_{ij}}{S_{perm}-B_{ij}}=\frac{${n(governingIntercept,5)}}{${n(allowable,5)}-${n(governingSlope,5)}}=${mm(selected)}`);
      add('note','La tabla 17-2 aporta las propiedades de esta banda y la tensión de referencia. Consulta al proveedor por los anchos disponibles que cubran el mínimo calculado.');
    }

    add('heading', 'Comprobación final del ancho');
    const final=tension(selected);
    const capacity=allowable*selected;
    const tensionOk=final.tight<=capacity+1e-9;
    const geometryOk=!(name.startsWith('Cuero') && [6,9].includes(minimumIn)
      && selected>=8*inch && Math.min(small,rollerDiameter/1000)<(minimumIn+2)*inch);
    const selectedWidthTrial=trial(widthDecision,selected*1000,
      tensionOk&&geometryOk?(fixedWidth==null?'calculated':'selected'):'rejected',
      'Demanda de '+n(final.tight,1)+' N frente a '+n(capacity,1)+' N de capacidad de referencia. '
      +(tensionOk?'Cumple tensión.':'Capacidad insuficiente.')+' '
      +(geometryOk?'Cumple la geometría de referencia.':'La nota a de la tabla 17-2 exige un diámetro de polea mayor.'));
    check(geometryOk,'La nota a de la tabla 17-2 exige aumentar 2 in el diámetro mínimo de esta banda de cuero ancha.');
    showTensions(selected, final);
    eq(math`T_{mot}=\Delta F\frac{d}{2}=(${n(delta)})\frac{${n(driver)}}{2}=${torque(delta*driver/2)}`);
    eq(math`\frac{F_c}{F_1}100=\frac{${n(final.centrifugal)}}{${n(final.tight)}}100=${n(100*final.centrifugal/final.tight)}\,\%`);
    eq(math`F_{perm}=S_{perm}b=(${n(allowable)})(${n(selected)})=${force(capacity)}`);
    eq(math`F_1=${force(final.tight)}${tensionOk ? '\\le ' : '>'}F_{perm}=${force(capacity)}`);
    check(tensionOk, 'El ancho supera la tensión de referencia de la tabla 17-2.');
    add('heading','Carga sobre la polea conducida con el tensor');
    add('text','En la polea conducida actúan las dos tensiones en sus direcciones tangentes locales. La reacción de la polea auxiliar va a su pivote.');
    const mid=final.states[50];
    const maximumGrip=Math.max(...final.states.map(s=>(s.tight-final.centrifugal)/((s.slack-final.centrifugal)*Math.exp(friction*Math.min(s.wrapMotor,s.wrapDriven)))));
    const gripOk=maximumGrip>0&&maximumGrip<=1+1e-9;
    if(!gripOk) {
      selectedWidthTrial.status='rejected';
      selectedWidthTrial.reason+=' La banda pierde tracción en el recorrido.';
    }
    check(gripOk,'La banda pierde condición de tracción en el recorrido.');
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
    const beltReview={demandImperial,allowableIn,operatingFpm,maximumGrip,lapsPerSecond,fixedWidth:fixedWidth!=null};
    belt = {selected,speed,length,capacity,...final,fy:mid.fy,fz:mid.fz,rollerDiameter,driver,driven,review:beltReview};
    design = finishDesign(c, power, belt, entries, check, decisionLog);
    add('section','Brazo tensor y resorte de tensión');
    const spring = springDesign(c, belt, add, check, decisionLog);
    add('heading','Conclusión y especificaciones de la propuesta');
    add('text','Motor propuesto de '+c.nominal+' kW para '+n(motorPower/1000)+' kW requeridos. Banda '+name+', '+(fixedWidth==null?'ancho mínimo calculado de ':'ancho fijo de tabla de ')+n(selected*1000)+' mm, longitud geométrica de '+n(length)+' m y poleas propuestas de '+n(driver*1000)+' y '+n(driven*1000)+' mm.');
    add('text','Engranes '+c.np+'/'+c.ng+' dientes, '+steels[c.gearSteel].label+', diámetros primitivos de '+n(design.pinion)+' y '+n(design.gear)+' mm, módulo '+n(design.module)+' mm y ancho de cara calculado de '+n(design.faceMm)+' mm. Flecha '+steels[design.shaftSteelIndex].label+' ajustada a los rodamientos seleccionados de la tabla 11-2, serie 02, con agujero de '+n(design.diameter)+' mm.');
    add('text','Resorte '+spring.name+', diámetro de alambre calculado de '+n(spring.selected)+' mm y longitud libre de '+n(spring.free)+' mm. Quedan por verificar el tamaño disponible y la resistencia cíclica.');
    add('heading','Fuentes');
    add('text','Enunciado Prensa mecánica, pp. 2–3. Libreta de Diseño de Elementos de Máquinas, pp. 9–22, 28–60. Tablas de clase A-20, A-21, 6-2, 6-4, 10-4, 10-5, 11-1, 11-2 y 17-2.');
    add('text','Budynas y Nisbett, Diseño en ingeniería mecánica de Shigley, 10.ª ed., cap. 10, ecuaciones geométricas de esfuerzo en el gancho.');
    add('section','Diagramas de la propuesta');
    for(const diagram of designDiagrams(c,power,belt,design,spring)) add('diagram',diagram);
    return {entries, power, belt, design, spring, iterations, decisions};
  } catch (error) {
    const errorStage=error.stage??entries.filter(entry=>entry.type==='section').length;
    add('note', 'Propuesta sin cierre en esta corrida. '+error.message);
    return {entries, power, belt, design, iterations, decisions, error: error.message, errorStage};
  }
}
