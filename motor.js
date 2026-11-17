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
    add('heading', 'Propuesta');
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
    power = {shaftRpm, outRpm, motorPower};

    add('section', 'Poleas y banda plana');
    for (const [value, label] of [[c.pulley,'diámetro conducido'], [c.centers,'distancia entre centros'], [c.start,'ancho inicial']]) {
      check(Number.isFinite(value) && value > 0, 'Ingresa un valor positivo para ' + label + '.');
    }
    check(Number.isFinite(c.angle), 'Ingresa la orientación de la carga.');
    const row = catalog[c.belt];
    check(row, 'Selecciona una banda del catálogo.');
    const [name, thicknessIn, minimumIn, allowableIn, weightIn, friction] = row;
    check(minimumIn, name + (name.includes('redondo') ? ' requiere un método de banda redonda.' : ' requiere consultar el diámetro mínimo en la tabla 17-3.'));
    const thickness = thicknessIn * inch;
    const density = weightIn * lbf / inch ** 3 / gravity;
    const allowable = allowableIn * lbf / inch;
    const driven = c.pulley / 1000;
    const driver = driven / c.ratio;
    check(2 * c.centers > driven + driver, 'La distancia entre centros debe superar la suma de los radios.');
    const small = Math.min(driver, driven);
    const large = Math.max(driver, driven);
    const alpha = Math.asin((large - small) / (2 * c.centers));
    const smallWrap = Math.PI - 2 * alpha;
    const largeWrap = Math.PI + 2 * alpha;
    const length = 2*c.centers*Math.cos(alpha) + (large*largeWrap + small*smallWrap)/2;
    const speed = Math.PI * driver * c.rpm / 60;
    const delta = motorPower / speed;
    const ratio = Math.exp(friction * smallWrap);
    add('heading', 'Propuesta y datos de catálogo');
    add('text', name + ' · tabla 17-2. Distancia entre centros y orientación propuestas.');
    eq(math`D=${mm(driven)};\quad C=${mm(c.centers)};\quad \beta=${n(c.angle)}^\circ`);
    eq(math`t=${mm(thickness)};\quad \mu=${n(friction)};\quad d_{min}=${mm(minimumIn*inch)}`);
    eq(math`S_{perm}=${display(allowableIn,'lbf/in')}(4.448221615/0.0254)=${display(allowable,'N/m')}`);
    eq(math`\rho=\frac{\gamma}{g}=\frac{${n(weightIn,5)}(4.448221615)}{(0.0254)^3(9.80665)}=${dual(density,'kg/m^3',inch**3/.45359237,'lb/in^3')}`);
    add('note', 'La tabla 17-2 da la tensión permisible a 600 ft/min. Se conserva la aplicación del ejemplo de clase a otra velocidad. Falta comprobar este criterio a la velocidad real.');
    if (name.startsWith('Cuero')) add('note', 'Se toma 0.040 lbf/in³ como peso específico representativo del rango de catálogo.');
    add('heading', 'Geometría y velocidad de la banda');
    add('text', 'Banda abierta, relación de tensiones con fuerza centrífuga y balance de potencia (apuntes, pp. 40–47).');
    eq(math`d=D/i_b=${n(driven)}/${n(c.ratio)}=${mm(driver)}`);
    eq(math`d_{menor}=${mm(small)}${small >= minimumIn*inch ? '\\ge ' : '<'}d_{min}=${mm(minimumIn*inch)}`);
    check(small >= minimumIn * inch, 'La polea menor queda por debajo del diámetro mínimo del material.');
    eq(math`\alpha=\arcsin\frac{d_{mayor}-d_{menor}}{2C}=\arcsin\frac{${n(large)}-${n(small)}}{2(${n(c.centers)})}=${display(alpha,'rad',5)}`);
    eq(math`\theta_{menor}=\pi-2\alpha=\pi-2(${n(alpha,5)})=${display(smallWrap,'rad',5)}`);
    eq(math`\theta_{mayor}=\pi+2\alpha=\pi+2(${n(alpha,5)})=${display(largeWrap,'rad',5)}`);
    eq(math`L=2C\cos\alpha+\frac{d_{mayor}\theta_{mayor}+d_{menor}\theta_{menor}}{2}`);
    eq(math`L=2(${n(c.centers)})\cos(${n(alpha,5)})+\frac{(${n(large)})(${n(largeWrap,5)})+(${n(small)})(${n(smallWrap,5)})}{2}=${dual(length,'m',1/(12*inch),'ft')}`);
    eq(math`v=\frac{\pi d n_m}{60}=\frac{\pi(${n(driver)})(${n(c.rpm)})}{60}=${dual(speed,'m/s',60/(12*inch),'ft/min')}`);
    eq(math`\Delta F=P_m/v=${n(motorPower)}/${n(speed)}=${force(delta)}`);
    eq(math`R=\frac{F_1-F_c}{F_2-F_c}=e^{\mu\theta_{menor}}=e^{(${n(friction)})(${n(smallWrap,5)})}=${n(ratio,5)}`);

    const tension = width => {
      const centrifugal = density * width * thickness * speed ** 2;
      const slack = centrifugal + delta / (ratio - 1);
      return {centrifugal, slack, tight: slack + delta};
    };
    function showTensions(width, {centrifugal, slack, tight}) {
      eq(math`A=bt=(${n(width,8)})(${n(thickness,8)})=${display(width*thickness,'m^2',9)}`);
      eq(math`F_c=\rho A v^2=(${n(density)})(${n(width*thickness,9)})(${n(speed)})^2=${force(centrifugal)}`);
      eq(math`F_2=F_c+\frac{\Delta F}{R-1}=${n(centrifugal)}+\frac{${n(delta)}}{${n(ratio,5)}-1}=${force(slack)}`);
      eq(math`F_1=F_2+\Delta F=${n(slack)}+${n(delta)}=${force(tight)}`);
    }

    add('heading', 'Dimensionamiento iterativo del ancho');
    add('text', 'Se calcula con cifras completas y se muestran valores redondeados. El criterio de convergencia es un error relativo menor al 3 %.');
    let width = c.start / 1000;
    let error = Infinity;
    for (let k = 1; k <= 100 && error >= tolerance; k++) {
      const tensions = tension(width);
      const next = tensions.tight / allowable;
      error = 100 * Math.abs(next - width) / next;
      check(Number.isFinite(error), 'La propuesta produjo valores fuera del rango numérico.');
      iterations.push({width, next, error, ...tensions});
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
    const selected = Math.ceil(width / .01) * .01;
    eq(math`b_{elegido}=10\left\lceil\frac{${n(width*1000,6)}}{10}\right\rceil=${mm(selected)}`);
    if (name.startsWith('Cuero') && selected >= 8 * inch) {
      const corrected = (minimumIn + 2) * inch;
      eq(math`d_{min,corr}=d_{min}+2\,\mathrm{in}=${mm(corrected)}`);
      check(small >= corrected, 'La banda de cuero de 8 in o más requiere aumentar el diámetro mínimo en 2 in.');
    }
    const final = tension(selected);
    showTensions(selected, final);
    eq(math`T_{mot}=\Delta F\frac{d}{2}=(${n(delta)})\frac{${n(driver)}}{2}=${torque(delta*driver/2)}`);
    eq(math`\frac{F_c}{F_1}100=\frac{${n(final.centrifugal)}}{${n(final.tight)}}100=${n(100*final.centrifugal/final.tight)}\,\%`);
    const capacity = allowable * selected;
    eq(math`F_{perm}=S_{perm}b=(${n(allowable)})(${n(selected)})=${force(capacity)}`);
    eq(math`F_1=${force(final.tight)}${final.tight <= capacity ? '\\le ' : '>'}F_{perm}=${force(capacity)}`);
    check(final.tight <= capacity, 'El ancho redondeado no satisface la tensión permisible. Revisa la propuesta.');
    eq(math`\frac{F_1-F_c}{F_2-F_c}=\frac{${n(final.tight)}-${n(final.centrifugal)}}{${n(final.slack)}-${n(final.centrifugal)}}=${n(ratio,5)}=R`);
    eq(math`F_0=\frac{F_1+F_2}{2}=\frac{${n(final.tight)}+${n(final.slack)}}{2}=${force((final.tight+final.slack)/2)}`);
    add('heading', 'Carga sobre la polea conducida');
    const axial = (final.tight + final.slack) * Math.cos(alpha);
    const transverse = delta * Math.sin(alpha) * Math.sign(driven-driver);
    const beta = c.angle * Math.PI / 180;
    const fy = axial*Math.cos(beta) - transverse*Math.sin(beta);
    const fz = axial*Math.sin(beta) + transverse*Math.cos(beta);
    eq(math`F_{\parallel}=(F_1+F_2)\cos\alpha=(${n(final.tight)}+${n(final.slack)})\cos(${n(alpha,5)})=${force(axial)}`);
    eq(math`F_{\perp}=\operatorname{sgn}(D-d)\Delta F\sin\alpha=(${Math.sign(driven-driver)})(${n(delta)})\sin(${n(alpha,5)})=${force(transverse)}`);
    eq(math`F_y=F_{\parallel}\cos\beta-F_{\perp}\sin\beta=(${n(axial)})\cos(${n(c.angle)}^\circ)-(${n(transverse)})\sin(${n(c.angle)}^\circ)=${force(fy)}`);
    eq(math`F_z=F_{\parallel}\sin\beta+F_{\perp}\cos\beta=(${n(axial)})\sin(${n(c.angle)}^\circ)+(${n(transverse)})\cos(${n(c.angle)}^\circ)=${force(fz)}`);
    eq(math`|\mathbf F|=\sqrt{F_y^2+F_z^2}=\sqrt{(${n(fy)})^2+(${n(fz)})^2}=${force(Math.hypot(fy,fz))}`);
    add('note', 'La carga corresponde a las tensiones de la banda abierta. El efecto del brazo tensor y del resorte queda pendiente.');
    belt = {selected, speed, length, capacity, ...final, fy, fz};
    return {entries, power, belt, iterations};
  } catch (error) {
    add('note', error.message);
    return {entries, power, iterations, error: error.message};
  }
}
