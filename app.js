const $ = id => document.getElementById(id);
let generated = [];
function lines(v){return v.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
function variants(w){const l=w.toLowerCase(), u=w.toUpperCase(), c=l.charAt(0).toUpperCase()+l.slice(1); return [...new Set([w,l,u,c])];}
function expandTemplate(t, pools){
  let out=[''];
  const re=/\{(word|num|sep|cap)\}/g;
  let last=0, m;
  while((m=re.exec(t))){
    const literal=t.slice(last,m.index);
    out=out.map(s=>s+literal);
    const arr=pools[m[1]]||[''];
    const next=[];
    for(const s of out){ for(const x of arr){ next.push(s+x); if(next.length>pools.limitHard) break; } if(next.length>pools.limitHard) break; }
    out=next; last=re.lastIndex;
  }
  out=out.map(s=>s+t.slice(last));
  return out;
}
function generate(){
  const wordsRaw=lines($('words').value);
  const nums=lines($('nums').value);
  const seps=$('seps').value.split(/\s+/).filter(Boolean);
  const templates=lines($('templates').value);
  const limit=Math.max(100, Math.min(parseInt($('limit').value||'250000',10), 2000000));
  const words=[...new Set(wordsRaw.flatMap(variants))];
  const caps='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const pools={word:words,num:nums,sep:seps,cap:caps,limitHard:limit};
  const set=new Set();
  outer: for(const t of templates){
    const batch=expandTemplate(t,pools);
    for(const p of batch){ if(p && !set.has(p)){ set.add(p); if(set.size>=limit) break outer; } }
  }
  generated=[...set];
  $('stats').textContent=`Generate ${generated.length.toLocaleString('it-IT')} combinazioni. Parole: ${wordsRaw.length}, Varianti parole: ${words.length}, Numeri: ${nums.length}, Separatori: ${seps.length}.`;
  $('preview').textContent=generated.slice(0,500).join('\n');
  $('download').disabled=generated.length===0; $('copy').disabled=generated.length===0;
}
function downloadWordlist(){
  const blob=new Blob([generated.join('\n')+'\n'],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='wordlist.txt'; a.click(); URL.revokeObjectURL(a.href);
}
async function copyWordlist(){ await navigator.clipboard.writeText(generated.join('\n')); $('stats').textContent+=' Copiata negli appunti.'; }
$('gen').addEventListener('click',generate);$('download').addEventListener('click',downloadWordlist);$('copy').addEventListener('click',copyWordlist);
generate();
