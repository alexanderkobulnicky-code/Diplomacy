// Rules engine for hold/move/support (including support cuts, bounces,
// head-to-head battles, cycles, retreats, and winter adjustments).
// Deliberate prototype limitation: fleets cannot yet issue convoy orders.
function unique(a){return [...new Set(a)]}
function legalSupportLocations(unit){return destinations(unit)}
function availableOrders(game,unit){
 const occupancy=Object.fromEntries(game.units.map(u=>[u.at,u]));
 const options=[{kind:'hold'}];
 for(const to of destinations(unit)) options.push({kind:'move',to});
 for(const to of legalSupportLocations(unit)){
  const candidate=occupancy[toProvince(to)];
  if(candidate && candidate.id!==unit.id) options.push({kind:'support-hold',target:candidate.id});
 }
 for(const candidate of game.units){
  if(candidate.id===unit.id) continue;
  for(const to of destinations(candidate)){
   if(legalSupportLocations(unit).some(dest=>dest===to || (toProvince(dest)===toProvince(to) && unit.type==='a'))){
    options.push({kind:'support-move',target:candidate.id,to});
   }
  }
 }
 return options;
}
function resolveMovement(game){
 const units=game.units, byId=Object.fromEntries(units.map(u=>[u.id,u]));
 const occupies=Object.fromEntries(units.map(u=>[u.at,u]));
 const submitted=game.orders||{}, orders={};
 const invalid=[];
 for(const u of units){
  const o=submitted[u.id]||{kind:'hold'};
  const allowed=availableOrders(game,u);
  const valid=allowed.some(allowedOrder=>allowedOrder.kind===o.kind && (allowedOrder.to||null)===(o.to||null) && (allowedOrder.target||null)===(o.target||null));
  orders[u.id]=valid?{...o}:{kind:'hold'};
  if(!valid) invalid.push(`${u.power.toUpperCase()} ${u.type.toUpperCase()} ${display(u.at)}: illegal order becomes HOLD`);
 }
 // An order to support an army that isn't actually moving there contributes no strength.
 const supportList=units.filter(u=>orders[u.id].kind.startsWith('support')).filter(u=>{
  const o=orders[u.id], target=byId[o.target];
  if(!target)return false;
  if(o.kind==='support-move')return orders[target.id].kind==='move' && orders[target.id].to===o.to;
  return orders[target.id].kind!=='move';
 });
 const moveUnits=units.filter(u=>orders[u.id].kind==='move');
 const sameSet=(a,b)=>a.size===b.size&&[...a].every(v=>b.has(v));
 // Dislodged attackers do not cut support. Repeat until this is self-consistent.
 let dislodged=new Set(), outcome=null, activeSupports=[];
 for(let iteration=0;iteration<20;iteration++){
  activeSupports=supportList.filter(s=>{
   const o=orders[s.id];
   if(dislodged.has(s.id))return false;
   return !moveUnits.some(attacker=>{
    if(attacker.power===s.power || dislodged.has(attacker.id)) return false;
    const attack=orders[attacker.id];
    if(toProvince(attack.to)!==s.at)return false;
    // Attack from province the support is directed against doesn't cut it.
    if(o.kind==='support-move' && attacker.at===toProvince(o.to))return false;
    return true;
   });
  });
  const attackers={};
  const attackStrength={};
  const defenseStrength={};
  for(const u of units){
   if(orders[u.id].kind==='move'){
    const to=toProvince(orders[u.id].to);
    (attackers[to] ||= []).push(u);
    attackStrength[u.id]=1+activeSupports.filter(s=>orders[s.id].kind==='support-move' && orders[s.id].target===u.id).length;
   }
   defenseStrength[u.id]=1+activeSupports.filter(s=>orders[s.id].kind==='support-hold' && orders[s.id].target===u.id).length;
  }
  // Only the unique strongest incoming attack can capture a space.
  const winner={}; const standoffs=new Set();
  for(const [province,arr] of Object.entries(attackers)){
   const highest=Math.max(...arr.map(a=>attackStrength[a.id]));
   const leaders=arr.filter(a=>attackStrength[a.id]===highest);
   if(leaders.length===1)winner[province]=leaders[0];
   else standoffs.add(province);
  }
  const moveSuccess={}; const inProgress=new Set();
  function succeeds(u){
   if(Object.hasOwn(moveSuccess,u.id))return moveSuccess[u.id];
   if(inProgress.has(u.id))return true; // unopposed rotation of 3+ units is allowed
   if(orders[u.id].kind!=='move')return false;
   const to=toProvince(orders[u.id].to), enemy=occupies[to], power=attackStrength[u.id];
   if(!winner[to] || winner[to].id!==u.id) return moveSuccess[u.id]=false;
   if(!enemy) return moveSuccess[u.id]=true;
   const opposing=orders[enemy.id];
   // Equal-strength head-to-head moves bounce. A 2-cycle cannot rotate.
   if(opposing.kind==='move' && toProvince(opposing.to)===u.at){
    if(enemy.power===u.power)return moveSuccess[u.id]=false;
    return moveSuccess[u.id]=power>attackStrength[enemy.id] && power>1;
   }
   inProgress.add(u.id);
   const vacates=opposing.kind==='move' && succeeds(enemy);
   inProgress.delete(u.id);
   if(vacates) return moveSuccess[u.id]=true;
   // No self-dislodgement, even with foreign support.
   if(enemy.power===u.power) return moveSuccess[u.id]=false;
   return moveSuccess[u.id]=power>defenseStrength[enemy.id];
  }
  for(const u of moveUnits)succeeds(u);
  // Dislodged defenders whose moves fail. Invaders cannot dislodge compatriots.
  const nowDislodged=new Set(); const dislodgers={};
  for(const u of moveUnits){
   if(!moveSuccess[u.id])continue;
   const dest=toProvince(orders[u.id].to), original=occupies[dest];
   if(original && !moveSuccess[original.id] && u.power!==original.power){
    nowDislodged.add(original.id);dislodgers[original.id]=u.at;
   }
  }
  outcome={moveSuccess,attackStrength,defenseStrength,activeSupports,standoffs,dislodgers,dislodged:nowDislodged,orders};
  if(sameSet(nowDislodged,dislodged))break;
  dislodged=nowDislodged;
 }
 const {moveSuccess,standoffs,dislodgers}=outcome;
 const positions=game.units.map(u=>({...u}));
 for(const u of positions){
  if(moveSuccess[u.id]){
   const to=orders[u.id].to;
   u.at=toProvince(to);u.coast=u.type==='f'?(to.split('/')[1]||null):null;
  }
 }
 const retreating=positions.filter(u=>outcome.dislodged.has(u.id));
 const onBoard=positions.filter(u=>!outcome.dislodged.has(u.id));
 const occupied=new Set(onBoard.map(u=>u.at));
 const retreats=retreating.map(u=>{
  const banned=dislodgers[u.id];
  const choices=destinations(u).filter(t=>!occupied.has(toProvince(t)) && toProvince(t)!==banned && !standoffs.has(toProvince(t)));
  return {...u,from:byId[u.id].at,attackedFrom:banned,choices};
 });
 const descriptions=[];
 for(const u of game.units){
  const o=orders[u.id];
  if(o.kind==='move'){
   descriptions.push(`${u.power.toUpperCase()} ${u.type.toUpperCase()} ${display(u.at)} → ${display(o.to)}: ${moveSuccess[u.id]?'SUCCESS':'BOUNCE / FAILED'}`);
  }else if(o.kind==='support-hold' || o.kind==='support-move'){
   const live=outcome.activeSupports.some(s=>s.id===u.id);
   descriptions.push(`${u.power.toUpperCase()} ${u.type.toUpperCase()} ${display(u.at)}: ${live?'SUPPORT VALID':'SUPPORT CUT / VOID'}`);
  }
 }
 return {positions:onBoard,retreats,standoffs:[...standoffs],logs:[...invalid,...descriptions],strengths:outcome.attackStrength};
}
function applyMovement(game){
 if(game.phase!=='orders')return false;
 const summary=resolveMovement(game);
 game.units=summary.positions;
 game.result={season:game.season,year:game.year,logs:summary.logs,standoffs:summary.standoffs,retreats:summary.retreats.map(x=>({power:x.power,at:x.from,choices:x.choices.map(display)}))};
 game.history.push({year:game.year,season:game.season,logs:summary.logs});
 game.orders={};
 if(summary.retreats.length){game.phase='retreats';game.retreats=summary.retreats;game.retreatOrders={};}
 else endSeason(game);
 return true;
}
function resolveRetreats(game){
 if(game.phase!=='retreats')return false;
 const selected=game.retreats.map(u=>({unit:u,to:game.retreatOrders?.[u.id]||null}));
 const count={};for(const r of selected){if(r.to && r.unit.choices.includes(r.to))(count[toProvince(r.to)] ||= 0,count[toProvince(r.to)]++);}
 const logs=[];
 for(const r of selected){
  const good=r.to && r.unit.choices.includes(r.to) && count[toProvince(r.to)]===1;
  if(good){game.units.push({...r.unit,at:toProvince(r.to),coast:r.unit.type==='f'?(r.to.split('/')[1]||null):null,from:undefined,choices:undefined,attackedFrom:undefined});}
  logs.push(`${r.unit.power.toUpperCase()} ${r.unit.type.toUpperCase()} ${display(r.unit.from)}: ${good?'retreat to '+display(r.to):'DISBAND'}`);
 }
 game.history.push({year:game.year,season:game.season,logs});
 game.result={season:game.season,year:game.year,logs};
 delete game.retreats;delete game.retreatOrders;
 endSeason(game);return true;
}
function endSeason(game){
 if(game.season==='Spring'){game.season='Fall';game.phase='orders';}
 else{
  for(const u of game.units){if(PROVINCES[u.at].kind==='s')game.owned[u.at]=u.power;}
  game.season='Winter';game.phase='adjust';game.adjustOrders={};
  if(POWERS.every(p=>difference(game,p.id)===0))finishWinter(game);
 }
}
function difference(game,power){return Object.values(game.owned).filter(x=>x===power).length-game.units.filter(u=>u.power===power).length}
function buildOptions(game,power){
 const occupied=new Set(game.units.map(u=>u.at));
 return CENTERS.filter(id=>PROVINCES[id].home===power && game.owned[id]===power && !occupied.has(id)).flatMap(id=>{
  const arr=[{type:'a',at:id,coast:null}];
  if(FLEET_GRAPH[id])arr.push({type:'f',at:id,coast:null});
  for(const coast of ['nc','sc','ec']) if(FLEET_GRAPH[`${id}/${coast}`])arr.push({type:'f',at:id,coast});
  return arr;
 });
}
function finishWinter(game){
 if(game.phase!=='adjust')return false;
 // Disbands are compulsory. Do not quietly make arbitrary disbands for the player.
 for(const power of POWERS){
  const delta=difference(game,power.id);
  if(delta<0 && unique((game.adjustOrders?.[power.id]||[]).filter(x=>typeof x==='string' && game.units.some(u=>u.id===x&&u.power===power.id))).length< -delta)return false;
 }
 const logs=[];
 for(const power of POWERS){
  const delta=difference(game,power.id), chosen=game.adjustOrders?.[power.id]||[];
  if(delta>0){
   let count=0;
   for(const spec of chosen){
    if(count>=delta)break;
    if(!buildOptions(game,power.id).some(x=>x.at===spec.at&&x.type===spec.type&&x.coast===spec.coast))continue;
    game.units.push({id:`${power.id}-${spec.type}-${spec.at}-${game.year}`,power:power.id,type:spec.type,at:spec.at,coast:spec.coast||null});
    logs.push(`${power.name} builds ${spec.type.toUpperCase()} ${display(spec.at)}`);count++;
   }
  }else if(delta<0){
   const ids=new Set(chosen.filter(s=>typeof s==='string'));
   let needed=-delta;
   for(const id of ids){if(needed<=0)break; const i=game.units.findIndex(u=>u.id===id&&u.power===power.id);
    if(i>=0){logs.push(`${power.name} disbands ${display(game.units[i].at)}`);game.units.splice(i,1);needed--;}
   }
  }
 }
 game.history.push({year:game.year,season:'Winter',logs});
 game.year++;game.season='Spring';game.phase='orders';game.orders={};game.adjustOrders={};game.result={year:game.year-1,season:'Winter',logs};return true;
}
