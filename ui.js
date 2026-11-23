const $=sel=>document.querySelector(sel);
const STORAGE_KEY='diplomacy-1901-prototype-v1';
let game=loadSaved();
let activePower='aus', selectedId=null, mapScale=1;
const SVGNS='http://www.w3.org/2000/svg';
let atlasCache=null;
function loadSaved(){
 try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY));
  if(value && Array.isArray(value.units) && value.owned && ['orders','retreats','adjust'].includes(value.phase) && ['Spring','Fall','Winter'].includes(value.season))return value;
 }catch(_){}
 return initialGame();
}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(game))}catch(_){} }
function power(p){return POWERS.find(x=>x.id===p)}
function ownedCount(p){return Object.values(game.owned).filter(id=>id===p).length}
function byID(id){return game.units.find(u=>u.id===id)}
function abbrev(id){return id.toUpperCase()}
function orderText(order){
 if(!order || order.kind==='hold') return 'HOLD';
 if(order.kind==='move')return `→ ${display(order.to)}`;
 const target=byID(order.target);
 if(order.kind==='support-hold')return `SUPPORT ${target?display(target.at):'?'} HOLD`;
 if(order.kind==='support-move')return `SUPPORT ${target?display(target.at):'?'} → ${display(order.to)}`;
 return 'HOLD';
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function render(){
 if(game.phase==='orders' && !game.units.some(u=>u.id===selectedId && u.power===activePower))selectedId=game.units.find(u=>u.power===activePower)?.id||null;
 $('#mainTitle').textContent=game.phase==='orders'?'The Great Powers':game.phase==='retreats'?'After the Battle':'Winter Council';
 $('#phasePill').textContent=game.phase==='orders'?'MOVEMENT':game.phase==='retreats'?'RETREATS':'ADJUSTMENTS';
 $('#dateLabel').innerHTML=`${game.season.toUpperCase()} <span>${game.year}</span>`;
 $('#powerTitle').textContent=power(activePower).name.toUpperCase();
 renderPowers();renderUnits();renderEditor();renderAdvance();renderReport();drawMap();persist();
}
function renderPowers(){
 $('#powerList').innerHTML=POWERS.map(p=>`<button type="button" class="power-button ${activePower===p.id?'active':''}" data-power="${p.id}"><span class="dot" style="background:${p.color}"></span><span><div class="power-name">${escapeHTML(p.name)}</div><div class="power-count">${game.units.filter(u=>u.power===p.id).length} units · ${ownedCount(p.id)} SC</div></span></button>`).join('');
 $('#powerList').querySelectorAll('[data-power]').forEach(btn=>btn.onclick=()=>{activePower=btn.dataset.power;selectedId=game.units.find(u=>u.power===activePower)?.id||null;render()});
}
function renderUnits(){
 const root=$('#unitList');
 if(game.phase==='adjust'){
  const diff=difference(game,activePower),current=game.adjustOrders?.[activePower]||[];
  if(!diff){root.innerHTML='<p class="stat-note">No adjustment necessary for this power.</p>';return;}
  if(diff>0){
   root.innerHTML=`<p class="stat-note">${diff} new unit${diff>1?'s':''} permitted. Selected: ${current.length}. Empty eligible home centers only.</p>`+
    (current.map((o,i)=>`<div class="choice-row"><span>${o.type==='a'?'Army':'Fleet'} ${escapeHTML(display(o.at+(o.coast?'/'+o.coast:'')))}</span><button data-remove-build="${i}">×</button></div>`).join(''))+
    '<div class="choice-row"><select class="order-select" id="buildChoice"><option value="">Choose build…</option>'+buildOptions(game,activePower).filter(o=>!current.some(x=>x.at===o.at)).map(o=>`<option value="${o.type}|${o.at}|${o.coast||''}">${o.type==='a'?'Army':'Fleet'} ${escapeHTML(display(o.at+(o.coast?'/'+o.coast:'')))}</option>`).join('')+'</select><button id="addBuild">Add</button></div>';
   root.querySelectorAll('[data-remove-build]').forEach(b=>b.onclick=()=>{game.adjustOrders[activePower].splice(+b.dataset.removeBuild,1);render()});
   $('#addBuild').onclick=()=>{let val=$('#buildChoice').value;if(!val || current.length>=diff)return;let [type,at,coast]=val.split('|');game.adjustOrders[activePower] ||= [];game.adjustOrders[activePower].push({type,at,coast:coast||null});render()};
  }else{
   const selected=new Set(current);
   root.innerHTML=`<p class="stat-note">Disband ${-diff} unit${diff<-1?'s':''}. Selected: ${current.length}. All disbands must be designated.</p>`+
    game.units.filter(u=>u.power===activePower).map(u=>`<button class="unit-row ${selected.has(u.id)?'active':''}" data-disband="${u.id}"><span class="unit-icon">${u.type.toUpperCase()}</span><span class="unit-info"><span class="unit-place">${escapeHTML(display(u.at))}</span><span class="unit-command">${selected.has(u.id)?'MARKED FOR DISBAND':'Keep unit'}</span></span></button>`).join('');
   root.querySelectorAll('[data-disband]').forEach(b=>b.onclick=()=>{let cur=game.adjustOrders[activePower]||[];cur=cur.includes(b.dataset.disband)?cur.filter(x=>x!==b.dataset.disband):cur.length< -diff?[...cur,b.dataset.disband]:cur;game.adjustOrders[activePower]=cur;render()});
  }
  return;
 }
 if(game.phase==='retreats'){
  const retreats=(game.retreats||[]).filter(u=>u.power===activePower);
  root.innerHTML=retreats.length?retreats.map(u=>`<div class="unit-row"><span class="unit-icon">${u.type.toUpperCase()}</span><div class="unit-info"><div class="unit-place">${escapeHTML(display(u.from))} dislodged</div><div class="unit-command">Attacked from ${escapeHTML(display(u.attackedFrom))}</div></div></div><label class="field-label">Retreat or disband</label><select class="order-select" data-retreat="${u.id}"><option value="">Disband</option>${u.choices.map(c=>`<option value="${c}" ${game.retreatOrders?.[u.id]===c?'selected':''}>${escapeHTML(display(c))}</option>`).join('')}</select>`).join(''):'<p class="stat-note">No dislodged units from this power.</p>';
  root.querySelectorAll('[data-retreat]').forEach(s=>s.onchange=()=>{game.retreatOrders ||= {};game.retreatOrders[s.dataset.retreat]=s.value||null;persist()});return;
 }
 const units=game.units.filter(u=>u.power===activePower);
 root.innerHTML=units.length?units.map(u=>`<button class="unit-row ${u.id===selectedId?'active':''}" data-unit="${u.id}"><span class="unit-icon">${u.type.toUpperCase()}</span><span class="unit-info"><div class="unit-place">${escapeHTML(display(u.at))}</div><div class="unit-command">${escapeHTML(orderText(game.orders[u.id]))}</div></span><span class="unit-chevron">›</span></button>`).join(''):'<p class="stat-note">This power has no units.</p>';
 root.querySelectorAll('[data-unit]').forEach(b=>b.onclick=()=>{selectedId=b.dataset.unit;render()});
}
function renderEditor(){
 const root=$('#editor');
 if(game.phase==='retreats'){root.innerHTML='<p class="editor-help">Choose retreats in the panel above for any dislodged units. A unit may not retreat to its attacker’s origin, an occupied province, or a standoff province.</p>';return;}
 if(game.phase==='adjust'){root.innerHTML='<p class="editor-help">The number of builds or disbands for each power is determined by the difference between its supply centers and units. Builds are allowed only in vacant, controlled original home centers.</p>';return;}
 const u=byID(selectedId);
 if(!u){root.innerHTML='<p class="editor-help">Select a country with at least one unit.</p>';return;}
 const allowed=availableOrders(game,u), order=game.orders[u.id]||{kind:'hold'};
 const kinds=[['hold','Hold'],['move','Move'],['support-hold','Support hold'],['support-move','Support move']];
 root.innerHTML=`<div class="editor-title">${u.type==='a'?'Army':'Fleet'} in ${escapeHTML(display(u.at+(u.coast?'/'+u.coast:'')))}</div><div class="order-modes">${kinds.map(([kind,label])=>`<button class="mode-btn ${order.kind===kind?'active':''}" data-kind="${kind}" ${!allowed.some(o=>o.kind===kind)?'disabled':''}>${label}</button>`).join('')}</div><div id="orderDetails"></div>`;
 root.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{
  const o=allowed.find(o=>o.kind===b.dataset.kind);
  if(o){game.orders[u.id]={...o};render()}
 });
 const choices=allowed.filter(o=>o.kind===order.kind);
 if(order.kind==='hold'){$('#orderDetails').innerHTML='<p class="editor-help">This unit will defend its province, but will not advance.</p>';return;}
 const label=order.kind==='move'?'MOVE TO':order.kind==='support-hold'?'SUPPORT UNIT HOLDING':'SUPPORT THE FOLLOWING MOVE';
 const itemLabel=o=>o.kind==='move'?display(o.to):o.kind==='support-hold'?display(byID(o.target)?.at):`${display(byID(o.target)?.at)} → ${display(o.to)}`;
 const idx=Math.max(0,choices.findIndex(o=>o.to===order.to&&o.target===order.target));
 $('#orderDetails').innerHTML=`<label class="field-label" for="orderChoice">${label}</label><select id="orderChoice" class="order-select">${choices.map((o,i)=>`<option value="${i}" ${idx===i?'selected':''}>${escapeHTML(itemLabel(o))}</option>`).join('')}</select><p class="editor-help">${order.kind==='move'?'You can also click a highlighted adjacent province on the map.':'A supporting unit gives strength if its support is valid and not cut by an enemy attack.'}</p>`;
 $('#orderChoice').onchange=()=>{game.orders[u.id]={...choices[Number($('#orderChoice').value)]};render()};
}
function renderAdvance(){
 const button=$('#advanceBtn'), hint=$('#advanceHint');
 if(game.phase==='orders'){
  const total=game.units.length,issued=Object.keys(game.orders).length;
  $('#ordersCount').textContent=`${issued} of ${total} units issued orders`;
  button.innerHTML=`Resolve ${game.season} ${game.year} <span>→</span>`;
  hint.textContent='All powers resolve simultaneously. Units without orders hold.';
  button.disabled=false;
 }else if(game.phase==='retreats'){
  $('#ordersCount').textContent=`${game.retreats.length} dislodged unit${game.retreats.length===1?'':'s'}`;
  button.innerHTML='Resolve retreats <span>→</span>';
  hint.textContent='Missing retreat choices disband automatically.';
  button.disabled=false;
 }else{
  $('#ordersCount').textContent='Year-end supply center adjustments';
  button.innerHTML=`Complete winter ${game.year} <span>→</span>`;
  const pending=POWERS.filter(p=>difference(game,p.id)<0 && (game.adjustOrders?.[p.id]||[]).length < -difference(game,p.id));
  hint.textContent=pending.length?'Required disbands still needed for: '+pending.map(p=>p.name).join(', ')+'.':'Unchosen builds are waived.';
  button.disabled=pending.length>0;
 }
}
function renderReport(){
 const root=$('#reportBody'), r=game.result;
 if(!r || !r.logs || !r.logs.length){root.innerHTML='<p class="empty-report">No orders have been resolved. Europe is holding its breath.</p>';return;}
 const lines=r.logs;
 root.innerHTML=`<div class="report-heading">${r.season} ${r.year} · ${lines.length} dispatches</div><div class="report-list">${lines.map(s=>`<div class="report-entry ${s.includes('SUCCESS')?'success':s.includes('FAILED')||s.includes('BOUNCE')||s.includes('DISBAND')?'fail':''}">${escapeHTML(s)}</div>`).join('')}</div>`;
}
// Voronoi regions by half-plane clipping produce a legible, self-contained schematic
// board without a licensed third-party map image or a network connection.
function computeAtlas(){
 const pts=Object.values(PROVINCES),all=[];
 for(const p of pts){
  let poly=[[12,12],[1378,12],[1378,882],[12,882]];
  for(const q of pts){if(p===q)continue;
   const dx=2*(q.x-p.x),dy=2*(q.y-p.y),bound=q.x*q.x+q.y*q.y-p.x*p.x-p.y*p.y;
   const inside=pt=>pt[0]*dx+pt[1]*dy-bound<=0.001;
   const next=[];
   for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ia=inside(a),ib=inside(b);
    if(ia)next.push(a);
    if(ia!==ib){const va=a[0]*dx+a[1]*dy-bound,vb=b[0]*dx+b[1]*dy-bound,t=va/(va-vb);
     next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
   }
   poly=next;
   if(!poly.length)break;
  }
  all.push({id:p.id,poly:poly.map(pt=>pt.map(v=>Math.round(v*10)/10).join(',')).join(' ')});
 }
 return all;
}
function mix(hexA,hexB,t){
 const a=hexA.match(/[\da-f]{2}/gi).map(v=>parseInt(v,16));const b=hexB.match(/[\da-f]{2}/gi).map(v=>parseInt(v,16));
 return '#'+a.map((v,i)=>Math.round(v*(1-t)+b[i]*t).toString(16).padStart(2,'0')).join('');
}
function drawMap(){
 if(!atlasCache)atlasCache=computeAtlas();
 const unitAt=Object.fromEntries(game.units.map(u=>[u.at,u]));
 const retreatAt=Object.fromEntries((game.retreats||[]).map(u=>[u.from,u]));
 const selected=byID(selectedId);
 const legal=game.phase==='orders' && selected && selected.power===activePower?new Set(destinations(selected).map(toProvince)):new Set();
 let svg='<defs><marker id="arrow-head" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#aa682e"/></marker></defs><rect x="0" y="0" width="1390" height="895" fill="#d8e6e6"/>';
 for(const cell of atlasCache){
  const p=PROVINCES[cell.id],pwr=power(p.home);
  let fill=p.kind==='w'?'#d8e6e8':pwr?mix('#f7f1e6',pwr.color,p.kind==='s'?.32:.19):p.kind==='s'?'#f0e4cc':'#ede9db';
  if(game.owned[p.id] && game.owned[p.id]!==p.home)fill=mix('#f5eee3',power(game.owned[p.id]).color,.4);
  svg+=`<polygon data-province="${p.id}" class="province ${selected?.at===p.id?'selected-cell':''} ${legal.has(p.id)?'legal-cell':''}" points="${cell.poly}" fill="${fill}"><title>${escapeHTML(p.name)}${p.kind==='s'?' · Supply center':''}</title></polygon>`;
 }
 // Province abbreviations and centers are under the pieces.
 for(const p of Object.values(PROVINCES)){
  const u=unitAt[p.id],retreat=retreatAt[p.id];
  if(p.kind==='s')svg+=`<circle class="center-dot" cx="${p.x+19}" cy="${p.y-18}" r="7"/>`;
  let y=p.y+(u||retreat?31:6);
  const font=p.kind==='w'?'sea-label':'map-label';
  svg+=`<text class="${font}" x="${p.x}" y="${y}">${p.id.toUpperCase()}</text>`;
 }
 if(game.phase==='orders')for(const u of game.units){
  if(u.power!==activePower)continue;
  const order=game.orders[u.id];if(order?.kind!=='move')continue;
  const p=PROVINCES[u.at],q=PROVINCES[toProvince(order.to)];
  svg+=`<path class="unit-order-arrow" opacity="${u.id===selectedId?'1':'.48'}" d="M${p.x} ${p.y-13} L${q.x} ${q.y-13}"/>`;
 }
 for(const u of [...game.units,...(game.retreats||[])]){
  const isRetreat=Boolean(u.from); const p=PROVINCES[isRetreat?u.from:u.at];
  const x=p.x,y=p.y-12;let color=power(u.power).color;
  svg+=`<g data-unit="${u.id}" data-unit-power="${u.power}" style="cursor:pointer;opacity:${isRetreat?'.6':'1'}"><circle class="unit-token ${selectedId===u.id?'unit-selected':''}" cx="${x}" cy="${y}" r="22" fill="${color}" ${isRetreat?'stroke-dasharray="4 3"':''}/><text class="unit-letter" x="${x}" y="${y+1}" fill="${power(u.power).ink}">${u.type.toUpperCase()}</text><title>${escapeHTML(power(u.power).name)} ${u.type==='a'?'army':'fleet'} in ${escapeHTML(display(p.id))}</title></g>`;
 }
 $('#gameMap').innerHTML=svg;
 $('#gameMap').querySelectorAll('[data-province]').forEach(el=>el.addEventListener('click',()=>mapClick(el.dataset.province)));
 $('#gameMap').querySelectorAll('[data-unit]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();const u=byID(el.dataset.unit);if(u?.power===activePower){selectedId=u.id;render()}else mapClick(u?.at||'')}));
 $('#gameMap').style.width=`${1320*mapScale}px`;
 $('#zoomPct').textContent=`${Math.round(mapScale*100)}%`;
}
function mapClick(at){
 if(game.phase!=='orders')return;
 const occupant=game.units.find(u=>u.at===at);
 if(occupant?.power===activePower){selectedId=occupant.id;render();return;}
 const selected=byID(selectedId);
 if(selected?.power!==activePower)return;
 const choices=destinations(selected).filter(x=>toProvince(x)===at);
 if(choices.length){
  game.orders[selected.id]={kind:'move',to:choices[0]};render();return;
 }
}
$('#advanceBtn').onclick=()=>{
 if(game.phase==='orders')applyMovement(game);
 else if(game.phase==='retreats')resolveRetreats(game);
 else finishWinter(game);
 render();$('#reportBody').scrollIntoView({behavior:'smooth',block:'nearest'});
};
$('#resetBtn').onclick=()=>{if(confirm('Start a new game and replace the autosaved position? Export a save first if you want to keep it.')){game=initialGame();activePower='aus';selectedId=null;render()}};
$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(game,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`diplomacy-${game.season.toLowerCase()}-${game.year}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('#importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;
 try{const loaded=JSON.parse(await file.text());if(!Array.isArray(loaded.units)||!loaded.owned||!['orders','retreats','adjust'].includes(loaded.phase)||!['Spring','Fall','Winter'].includes(loaded.season))throw Error('Not a valid game save');game=loaded;selectedId=null;render();}catch(err){alert('Unable to import this game save: '+err.message)}e.target.value='';
};
$('#zoomOut').onclick=()=>{mapScale=Math.max(.65,Math.round((mapScale-.15)*100)/100);drawMap()};
$('#zoomIn').onclick=()=>{mapScale=Math.min(1.85,Math.round((mapScale+.15)*100)/100);drawMap()};
$('#clearReport').onclick=()=>{game.result=null;renderReport();persist()};
$('#helpBtn').onclick=()=>$('#helpDialog').showModal();
$('#closeHelp').onclick=()=>$('#helpDialog').close();
$('#startBtn').onclick=()=>$('#helpDialog').close();
render();
// Fit the whole schematic on desktop; keep touch screens scrollable at readable size.
if(innerWidth>980){mapScale=Math.min(1,Math.max(.66,($('#mapViewport').clientWidth-3)/1320));drawMap();}
// Scroll toward the centre of the board in narrow viewports.
if(innerWidth<900){const vp=$('#mapViewport');vp.scrollLeft=Math.max(0,Math.round((1320-vp.clientWidth)*.45));}
