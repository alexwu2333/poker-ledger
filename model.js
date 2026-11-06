(function(root){
'use strict';
const SCALE=100000;
function number(value, decimals, min, max){
 const s=String(value).trim();
 if(!new RegExp('^\\d+(?:\\.\\d{1,'+decimals+'})?$').test(s)) throw Error('请输入有效数字，最多 '+decimals+' 位小数');
 const n=Number(s); if(!Number.isFinite(n)||n<min||n>max)throw Error('数值须在 '+min+' 到 '+max+' 之间');
 return Math.round(n*10**decimals);
}
function summary(s){
 const rows=s.players.map(p=>({...p,buy:0,sell:0,buyUnits:0,sellUnits:0,remaining:null,departed:false}));
 const by=Object.fromEntries(rows.map(p=>[p.id,p]));
 let externalIn=0,externalOut=0;
 for(const t of s.entries){if(t.void)continue;
  if(t.kind==='settle'){const p=by[t.player];p.remaining=t.units;p.departed=!!t.departed;continue;}
  const units=t.hands*s.rate;
  if(t.kind==='buy'){const p=by[t.player];p.buy+=t.hands;p.buyUnits+=units;p.remaining=null;p.departed=false;externalIn+=units;}
  if(t.kind==='cashout'){const p=by[t.player];p.sell+=t.hands;p.sellUnits+=units;p.remaining=null;p.departed=false;externalOut+=units;}
  if(t.kind==='transfer'){
   const a=by[t.from],b=by[t.to];a.sell+=t.hands;a.sellUnits+=units;b.buy+=t.hands;b.buyUnits+=units;
   a.remaining=b.remaining=null;a.departed=b.departed=false;
  }
 }
 for(const p of rows){p.net=p.buy-p.sell;p.profit=p.remaining===null?null:p.remaining+p.sellUnits-p.buyUnits;}
 const total=rows.reduce((a,p)=>({buy:a.buy+p.buy,sell:a.sell+p.sell,settled:a.settled+(p.remaining!==null?1:0),remaining:a.remaining+(p.remaining??0),departedUnits:a.departedUnits+(p.departed?p.remaining:0)}),{buy:0,sell:0,settled:0,remaining:0,departedUnits:0});
 total.expected=externalIn-externalOut;total.onTable=total.expected-total.departedUnits;total.difference=total.remaining-total.expected;
 total.complete=rows.length>0&&rows.every(p=>p.remaining!==null);total.balanced=total.complete&&total.difference===0;
 return {rows,total};
}
function validate(data){
 if(!data||data.version!==1||!Array.isArray(data.sessions)||!data.sessions.length||data.sessions.length>1000)throw Error('不是有效的牌桌账本备份');
 const ids=new Set(),validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);
 for(const s of data.sessions){
  if(!validId(s.id)||ids.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>80||!Number.isSafeInteger(s.rate)||s.rate<=0||s.rate>100000000||!Array.isArray(s.players)||s.players.length>200||!Array.isArray(s.entries)||s.entries.length>10000||typeof s.closed!=='boolean'||typeof s.created!=='string')throw Error('场次资料格式不正确');ids.add(s.id);
  const players=new Set();for(const p of s.players){if(!validId(p.id)||players.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>30)throw Error('玩家资料不正确');players.add(p.id);}
  const es=new Set();for(const t of s.entries){
   if(!validId(t.id)||es.has(t.id)||typeof t.at!=='string'||!['buy','cashout','transfer','settle'].includes(t.kind)||(t.void!==undefined&&typeof t.void!=='boolean'))throw Error('流水资料不正确');es.add(t.id);
   if(t.kind==='transfer'){if(!players.has(t.from)||!players.has(t.to)||t.from===t.to)throw Error('转手对象不正确');}else if(!players.has(t.player))throw Error('找不到玩家');
   if(t.kind==='settle'){if(!Number.isSafeInteger(t.units)||t.units<0||t.units>1e14||typeof t.departed!=='boolean')throw Error('结算数值不正确');}
   else if(!Number.isSafeInteger(t.hands)||t.hands<=0||t.hands>1000000)throw Error('手数不正确');
  }
  const v=summary(s);if(v.total.expected<0||v.total.onTable<0||!Number.isSafeInteger(v.total.expected)||Math.abs(v.total.expected)>1e14||v.rows.reduce((n,p)=>n+p.buyUnits+p.sellUnits,0)>1e14)throw Error('场次筹码总量超出范围或小于零');
  if(s.closed&&!v.total.balanced)throw Error('已完成的场次必须平账');
 }
 if(!ids.has(data.current))throw Error('当前场次不存在');return data;
}
root.Poker={SCALE,number,summary,validate};
})(typeof module!=='undefined'?module.exports:globalThis);
