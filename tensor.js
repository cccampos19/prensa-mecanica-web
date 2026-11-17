function tensorGeometry(c, driven, driver, tightAngle, check){
  const rad=Math.PI/180, L=.15, height=.18, r=c.idlerRadius/1000;
  const p=[c.centers*Math.cos(c.angle*rad),c.centers*Math.sin(c.angle*rad)];
  const a=[p[0]-L,p[1]-height];
  const unit=t=>[Math.cos(t),Math.sin(t)];
  const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
  const tangent=(v,offset)=>{
    check(Math.hypot(...v)>Math.abs(offset),'No existe tangente común para la geometría del tensor.');
    return Math.atan2(v[1],v[0])-Math.asin(offset/Math.hypot(...v));
  };
  function anchor(angle){
    const arm=[-L*Math.cos(angle),L*Math.sin(angle)], i=[p[0]+arm[0],p[1]+arm[1]];
    const vector=[a[0]-i[0],a[1]-i[1]], len=Math.hypot(...vector);
    return {arm,i,vector,len};
  }
  const initial=c.armAngle*rad;
  check(r>0&&c.travel>0&&initial>-Math.PI/3&&initial<0,'Revisa el radio, recorrido y ángulo del brazo tensor.');
  const target=anchor(initial).len+c.travel/1000;
  check(anchor(0).len>=target,'El recorrido propuesto supera la posición horizontal del brazo.');
  let low=initial,high=0;
  for(let i=0;i<48;i++){
    const mid=(low+high)/2;
    if(anchor(mid).len<target) low=mid; else high=mid;
  }
  function state(phi){
    const {arm,i,vector,len}=anchor(phi);
    const b=tangent(i,driven/2+r);
    const m=tangent(arm.map(v=>-v),-r-driver/2);
    const wrapMotor=Math.PI+m-tightAngle,wrapDriven=Math.PI+tightAngle-b;
    const [by,bz]=unit(b),[my,mz]=unit(m);
    const beltMoment=cross(arm,[my-by,mz-bz]);
    const springMoment=cross(arm,vector.map(v=>v/len));
    check(m>b&&m-b<Math.PI&&beltMoment<0&&springMoment>0&&wrapMotor>0&&wrapDriven>0,'La polea tensora pierde contacto o el resorte no se opone al momento de la banda.');
    check(Math.hypot(...i)>driven/2+r && L>driver/2+r,'Las poleas propuestas interfieren.');
    const length=Math.sqrt(c.centers**2-((driven-driver)/2)**2)+
      Math.sqrt(Math.hypot(...i)**2-(driven/2+r)**2)+Math.sqrt(L*L-(driver/2+r)**2)+
      driven/2*wrapDriven+driver/2*wrapMotor+r*(m-b);
    return {phi,b,m,wrapMotor,wrapDriven,len,length,by,bz,lever:-beltMoment/springMoment};
  }
  return Array.from({length:101},(_,i)=>state(initial+(high-initial)*i/100));
}

function tensorLoads(states,delta,centrifugal,friction,rate,tightAngle){
  const minimum=Math.max(...states.map(s=>{
    const required=centrifugal+delta/Math.expm1(friction*Math.min(s.wrapMotor,s.wrapDriven));
    return required*s.lever-rate*1000*(s.len-states[0].len);
  }));
  return states.map(s=>{
    const springForce=minimum+rate*1000*(s.len-states[0].len);
    const slack=springForce/s.lever,tight=slack+delta;
    return {...s,springForce,slack,tight,fy:tight*Math.cos(tightAngle)+slack*s.by,fz:tight*Math.sin(tightAngle)+slack*s.bz};
  });
}
