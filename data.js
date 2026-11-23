// A hand-drawn schematic atlas for standard Diplomacy (1901), not a facsimile of the published map.
// Province graph and starting positions are separate from the rendered geography.
const POWERS = [
  {id:'eng', name:'England', short:'ENG', color:'#d4a44a', ink:'#3f3013'},
  {id:'fra', name:'France', short:'FRA', color:'#5c9cc2', ink:'#102d3b'},
  {id:'ger', name:'Germany', short:'GER', color:'#88949e', ink:'#17252c'},
  {id:'ita', name:'Italy', short:'ITA', color:'#75aa7c', ink:'#16371f'},
  {id:'aus', name:'Austria-Hungary', short:'AUS', color:'#d17c73', ink:'#47231f'},
  {id:'rus', name:'Russia', short:'RUS', color:'#9f91c5', ink:'#322547'},
  {id:'tur', name:'Turkey', short:'TUR', color:'#d1a36c', ink:'#50341c'},
];
// x and y are deliberately schematic positions on a roomy canvas.
// [name, x, y, kind, homePower?]  kind: 's' supply center, 'l' land, 'w' water
const RAW = {
 nao:['North Atlantic',80,210,'w'], nwg:['Norwegian Sea',335,95,'w'], bar:['Barents Sea',820,55,'w'],
 nth:['North Sea',380,260,'w'], ska:['Skagerrak',530,208,'w'], hel:['Heligoland Bight',493,332,'w'],
 bal:['Baltic Sea',674,277,'w'], bot:['Gulf of Bothnia',793,180,'w'],
 iri:['Irish Sea',118,375,'w'], eng:['English Channel',294,441,'w'], mao:['Mid-Atlantic Ocean',84,527,'w'],
 wes:['Western Mediterranean',448,760,'w'], lyo:['Gulf of Lyon',578,689,'w'], tys:['Tyrrhenian Sea',692,771,'w'],
 ion:['Ionian Sea',858,825,'w'], adr:['Adriatic Sea',827,672,'w'], aeg:['Aegean Sea',1002,795,'w'],
 eas:['Eastern Mediterranean',1165,840,'w'], bla:['Black Sea',1151,536,'w'],
 cly:['Clyde',245,161,'l','eng'], edi:['Edinburgh',289,204,'s','eng'], lvp:['Liverpool',233,283,'s','eng'],
 yor:['Yorkshire',292,283,'l','eng'], wal:['Wales',228,358,'l','eng'], lon:['London',320,356,'s','eng'],
 nor:['Norway',528,94,'s'], swe:['Sweden',657,121,'s'], fin:['Finland',812,129,'l','rus'],
 stp:['St Petersburg',1018,129,'s','rus'], lvn:['Livonia',844,287,'l','rus'], mos:['Moscow',1041,325,'s','rus'],
 bre:['Brest',305,489,'s','fra'], pic:['Picardy',406,438,'l','fra'], par:['Paris',410,516,'s','fra'],
 bur:['Burgundy',524,529,'l','fra'], gas:['Gascony',355,603,'l','fra'], mar:['Marseilles',481,643,'s','fra'],
 bel:['Belgium',460,398,'s'], hol:['Holland',509,374,'s'], den:['Denmark',583,275,'s'],
 kie:['Kiel',565,404,'s','ger'], ber:['Berlin',698,391,'s','ger'], mun:['Munich',640,495,'s','ger'],
 ruh:['Ruhr',551,451,'l','ger'], pru:['Prussia',778,347,'l','ger'], sil:['Silesia',763,433,'l','ger'],
 por:['Portugal',184,697,'s'], spa:['Spain',305,675,'s'], naf:['North Africa',265,822,'l'],
 tun:['Tunis',646,829,'s'],
 pie:['Piedmont',609,621,'l','ita'], ven:['Venice',738,580,'s','ita'], tus:['Tuscany',722,669,'l','ita'],
 rom:['Rome',758,707,'s','ita'], apu:['Apulia',818,696,'l','ita'], nap:['Naples',786,780,'s','ita'],
 tyr:['Tyrolia',702,523,'l','aus'], boh:['Bohemia',788,477,'l','aus'], vie:['Vienna',833,529,'s','aus'],
 tri:['Trieste',814,615,'s','aus'], bud:['Budapest',927,554,'s','aus'], gal:['Galicia',932,469,'l','aus'],
 war:['Warsaw',880,382,'s','rus'], ukr:['Ukraine',1046,460,'l','rus'], sev:['Sevastopol',1090,622,'s','rus'],
 alb:['Albania',896,701,'l'], ser:['Serbia',951,645,'s'], rum:['Rumania',1044,649,'s'],
 bul:['Bulgaria',1054,713,'s'], gre:['Greece',933,777,'s'],
 con:['Constantinople',1145,712,'s','tur'], ank:['Ankara',1200,636,'s','tur'],
 smy:['Smyrna',1179,787,'s','tur'], arm:['Armenia',1290,665,'l','tur'], syr:['Syria',1282,807,'l','tur'],
};
const PROVINCES = Object.fromEntries(Object.entries(RAW).map(([id,v])=> [id,{id,name:v[0],x:v[1],y:v[2],kind:v[3],home:v[4]||null}]));
const CENTERS = Object.keys(PROVINCES).filter(k=>PROVINCES[k].kind==='s');
const SEAS = Object.keys(PROVINCES).filter(k=>PROVINCES[k].kind==='w');

// Complete undirected ARMY graph of land borders; links from a water province are illegal.
const ARMY_PAIRS = `
 alb-tri alb-ser alb-gre
 ank-con ank-smy ank-arm
 apu-ven apu-rom apu-nap
 arm-smy arm-syr arm-sev
 bel-pic bel-bur bel-ruh bel-hol
 ber-kie ber-mun ber-sil ber-pru
 boh-mun boh-tyr boh-vie boh-gal boh-sil
 bre-par bre-pic bre-gas
 bud-vie bud-tri bud-ser bud-rum bud-gal
 bul-rum bul-ser bul-gre bul-con
 bur-par bur-pic bur-ruh bur-mun bur-mar bur-gas
 cly-edi cly-lvp
 con-smy
 den-kie den-swe
 edi-lvp edi-yor
 fin-nor fin-swe fin-stp
 gal-vie gal-rum gal-ukr gal-war gal-sil
 gas-par gas-mar gas-spa
 gre-ser
 hol-ruh hol-kie
 kie-ruh kie-mun
 lon-wal lon-yor
 lvn-pru lvn-war lvn-mos lvn-stp
 lvp-yor lvp-wal
 mar-spa mar-pie
 mos-stp mos-war mos-ukr mos-sev
 mun-ruh mun-sil mun-tyr
 naf-tun
 nap-rom
 nor-swe nor-stp
 par-pic par-bur
 pic-bel
 pie-ven pie-tyr pie-tus
 por-spa
 pru-sil pru-war
 rom-tus
 ruh-bel
 rum-ser rum-ukr rum-sev
 ser-tri ser-gre
 sev-ukr
 sil-war
 smy-syr
 spa-por
 stp-fin
 swe-fin
 tri-tyr tri-vie tri-ven
 tun-naf
 tus-ven
 tyr-vie tyr-ven
 ukr-war
 ven-tri
 vie-bud
 wal-yor
 war-gal
`;
// Uncoasted keys are sea spaces or single-coast land provinces.
// A fleet occupying a two-coast province carries the /nc, /sc or /ec qualifier.
const FLEET_PAIRS = `
 nao-nwg nao-iri nao-mao nao-cly nao-lvp
 nwg-bar nwg-nth nwg-nor nwg-cly nwg-edi
 bar-nor bar-stp/nc
 nth-ska nth-hel nth-eng nth-edi nth-yor nth-lon nth-bel nth-hol nth-den nth-nor
 ska-nor ska-swe ska-den
 hel-hol hel-kie hel-den
 bal-den bal-swe bal-bot bal-lvn bal-pru bal-ber bal-kie
 bot-swe bot-fin bot-stp/sc bot-lvn
 mao-iri mao-eng mao-wes mao-bre mao-gas mao-spa/nc mao-spa/sc mao-por mao-naf
 iri-eng iri-lvp iri-wal
 eng-lon eng-wal eng-pic eng-bre eng-bel
 wes-lyo wes-tys wes-spa/sc wes-naf wes-tun
 lyo-tys lyo-spa/sc lyo-mar lyo-pie lyo-tus
 tys-ion tys-tun tys-tus tys-rom tys-nap
 ion-adr ion-aeg ion-eas ion-tun ion-nap ion-apu ion-alb ion-gre
 adr-ven adr-tri adr-alb adr-apu
 aeg-eas aeg-gre aeg-bul/sc aeg-con aeg-smy
 eas-smy eas-syr
 bla-rum bla-bul/ec bla-con bla-ank bla-arm bla-sev
 cly-lvp cly-edi
 edi-yor
 lvp-wal
 wal-lon
 yor-lon
 nor-stp/nc nor-swe
 swe-fin swe-den
 fin-stp/sc
 den-kie
 kie-hol kie-ber
 hol-bel
 bel-pic
 pic-bre
 bre-gas
 gas-spa/nc
 spa/nc-por spa/sc-por spa/sc-mar
 mar-pie
 pie-tus
 tus-rom
 rom-nap
 nap-apu
 apu-ven
 ven-tri
 tri-alb
 alb-gre
 gre-bul/sc
 bul/sc-con bul/ec-con bul/ec-rum
 rum-sev
 sev-arm
 arm-ank
 ank-con
 con-smy
 smy-syr
 lvn-pru lvn-stp/sc
 pru-ber
 naf-tun
`;
function makeGraph(pairs){
 const out={};
 for(const [a,b] of pairs.trim().split(/\s+/).map(t=>t.split('-'))){
  if(!a||!b)continue;
  (out[a] ||= new Set()).add(b);
  (out[b] ||= new Set()).add(a);
 }
 return Object.fromEntries(Object.entries(out).map(([k,v])=>[k,[...v].sort()]));
}
const ARMY_GRAPH=makeGraph(ARMY_PAIRS), FLEET_GRAPH=makeGraph(FLEET_PAIRS);
const INITIAL_UNITS = [
 ['eng','f','lon'], ['eng','f','edi'], ['eng','a','lvp'],
 ['fra','f','bre'], ['fra','a','par'], ['fra','a','mar'],
 ['ger','f','kie'], ['ger','a','ber'], ['ger','a','mun'],
 ['ita','f','nap'], ['ita','a','ven'], ['ita','a','rom'],
 ['aus','f','tri'], ['aus','a','vie'], ['aus','a','bud'],
 ['rus','f','stp','sc'], ['rus','f','sev'], ['rus','a','mos'], ['rus','a','war'],
 ['tur','f','ank'], ['tur','a','con'], ['tur','a','smy'],
];
function toProvince(k){return (k||'').split('/')[0]}
function display(k){
 const [id,coast]=String(k).split('/');
 return (PROVINCES[id]?.name||id)+(coast?` (${coast.toUpperCase()})`:'');
}
function unitNode(unit){return unit.type==='f' && unit.coast?`${unit.at}/${unit.coast}`:unit.at}
function fleetNeighbors(unit){return FLEET_GRAPH[unitNode(unit)]||[]}
function destinations(unit){return unit.type==='a'?(ARMY_GRAPH[unit.at]||[]):fleetNeighbors(unit)}
function mayReach(unit,to){return destinations(unit).includes(to)}
function initialGame(){
 const owned=Object.fromEntries(CENTERS.map(id=>[id,PROVINCES[id].home||null]));
 return {year:1901,season:'Spring',phase:'orders',units:INITIAL_UNITS.map(([power,type,at,coast])=>({id:`${power}-${type}-${at}`,power,type,at,coast:coast||null})),owned,orders:{},result:null,history:[]};
}
