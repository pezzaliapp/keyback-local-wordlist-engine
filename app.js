const $ = id => document.getElementById(id);
let deferredPrompt = null;
let dictionaries = {};
let importedWords = [];
let lastScan = [];
let lastWordlist = [];

const BUILTIN_FILES = {
  nomi_it: './wordlists/nomi_it.txt',
  cognomi_it: './wordlists/cognomi_it.txt',
  comuni_it: './wordlists/comuni_it.txt',
  animali_it: './wordlists/animali_it.txt',
  nomi_animali_it: './wordlists/nomi_animali_it.txt',
  mesi_it: './wordlists/mesi_it.txt',
  parole_it: './wordlists/parole_it.txt'
};
const SYMBOLS = ['!','!!','?','@','#','-','_','.','*'];
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LOWER = 'abcdefghijklmnopqrstuvwxyz'.split('');

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('installBtn').hidden = false; });
$('installBtn')?.addEventListener('click', async()=>{ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; $('installBtn').hidden=true; }});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});

function splitWords(text){ return text.split(/[\r\n,;]+/).map(x=>x.trim()).filter(Boolean); }
function uniq(arr){ return [...new Set(arr.filter(Boolean))]; }
function downloadText(name, text){ const blob=new Blob([text],{type:'text/plain;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function addLog(line){ lastScan.push(line); $('scanOutput').textContent = lastScan.join('\n'); }

async function readTextFile(file){ return await file.text(); }
async function readArrayBuffer(file){ return await file.arrayBuffer(); }

function inspectZip(buffer, name){
  const bytes = new Uint8Array(buffer); let pos=0, entries=0, encrypted=0, names=[];
  while(pos < bytes.length-30){
    const sig = bytes[pos] | bytes[pos+1]<<8 | bytes[pos+2]<<16 | bytes[pos+3]<<24;
    if(sig === 0x04034b50){
      const flags = bytes[pos+6] | (bytes[pos+7]<<8);
      const comp = bytes[pos+8] | (bytes[pos+9]<<8);
      const nameLen = bytes[pos+26] | (bytes[pos+27]<<8);
      const extraLen = bytes[pos+28] | (bytes[pos+29]<<8);
      const fname = new TextDecoder().decode(bytes.slice(pos+30, pos+30+nameLen));
      entries++; if(flags & 1) encrypted++; names.push(`${fname}  ${flags&1?'[cifrato]':'[non cifrato]'} metodo:${comp}`);
      const compSize = bytes[pos+18] | bytes[pos+19]<<8 | bytes[pos+20]<<16 | bytes[pos+21]<<24;
      pos += 30 + nameLen + extraLen + Math.max(0, compSize);
    } else pos++;
  }
  addLog(`\nZIP: ${name}`);
  addLog(`  File interni trovati: ${entries}`);
  addLog(`  File cifrati: ${encrypted}`);
  names.slice(0,80).forEach(n=>addLog(`  - ${n}`));
  if(names.length>80) addLog(`  ... altri ${names.length-80} file`);
  if(encrypted) addLog(`  Nota: ZIP cifrato. La PWA può segnalarlo e generare wordlist, non verificare la password nel browser.`);
}

function scanText(text, name){
  const patterns = [
    /password\s*[:=]\s*[^\s'\"]+/ig, /pass\s*[:=]\s*[^\s'\"]+/ig, /pwd\s*[:=]\s*[^\s'\"]+/ig,
    /token\s*[:=]\s*[^\s'\"]+/ig, /secret\s*[:=]\s*[^\s'\"]+/ig, /api[_-]?key\s*[:=]\s*[^\s'\"]+/ig
  ];
  let hits=[]; patterns.forEach(rx=>{ const m=text.match(rx); if(m) hits.push(...m.slice(0,50)); });
  addLog(`\nTESTO: ${name}`);
  addLog(`  Dimensione: ${text.length} caratteri`);
  addLog(`  Possibili credenziali trovate: ${hits.length}`);
  hits.slice(0,30).forEach(h=>addLog(`  ⚠ ${h}`));
}

async function handleFiles(files){
  for(const file of files){
    const lower=file.name.toLowerCase();
    $('scanSummary').textContent = `Analisi in corso: ${file.name}`;
    try{
      if(lower.endsWith('.zip')) inspectZip(await readArrayBuffer(file), file.webkitRelativePath || file.name);
      else if(/\.(txt|csv|json|env|log|md|html|js|css|xml|ini|conf|yml|yaml)$/i.test(lower)) scanText(await readTextFile(file), file.webkitRelativePath || file.name);
      else addLog(`\nSKIP: ${file.webkitRelativePath || file.name} (${file.type || 'tipo sconosciuto'})`);
    }catch(e){ addLog(`\nERRORE ${file.name}: ${e.message}`); }
  }
  $('scanSummary').textContent = `Analizzati ${files.length} elementi.`;
}
$('fileInput').addEventListener('change', e=>handleFiles([...e.target.files]));
$('folderInput').addEventListener('change', e=>handleFiles([...e.target.files]));
$('clearScan').addEventListener('click',()=>{lastScan=[];$('scanOutput').textContent='';$('scanSummary').textContent='Nessun file caricato.'});
$('exportScan').addEventListener('click',()=>downloadText('keyback-risultati.txt', lastScan.join('\n')));

function makeYears(){
  const a=Number($('yearStart').value), b=Number($('yearEnd').value); const out=[];
  for(let y=Math.min(a,b); y<=Math.max(a,b); y++) out.push(String(y));
  return out;
}
function makeNumbers(){
  const a=Number($('numStart').value), b=Number($('numEnd').value); const mode=$('paddingMode').value; const out=[];
  for(let n=Math.min(a,b); n<=Math.max(a,b); n++){
    if(mode==='plain') out.push(String(n));
    else if(mode==='pad2') out.push(String(n).padStart(2,'0'));
    else if(mode==='pad4') out.push(String(n).padStart(4,'0'));
    else { out.push(String(n)); out.push(String(n).padStart(2,'0')); out.push(String(n).padStart(3,'0')); out.push(String(n).padStart(4,'0')); }
  }
  return uniq(out);
}

async function loadDicts(){
  dictionaries = {}; const selected=[...document.querySelectorAll('.dictCheck:checked')].map(x=>x.value);
  for(const key of selected){
    if(BUILTIN_FILES[key]){
      try{ const txt=await fetch(BUILTIN_FILES[key], {cache:'no-store'}).then(r=>r.ok?r.text():Promise.reject(new Error(r.status))); dictionaries[key]=splitWords(txt); }
      catch{ dictionaries[key]=[]; }
    }
  }
  if(selected.includes('anni')) dictionaries.anni = makeYears();
  if(selected.includes('numeri')) dictionaries.numeri = makeNumbers();
  if(selected.includes('simboli')) dictionaries.simboli = SYMBOLS;
  dictionaries.importati = importedWords;
  const total=Object.values(dictionaries).reduce((s,a)=>s+a.length,0);
  $('dictStatus').textContent = `Categorie caricate: ${Object.entries(dictionaries).map(([k,v])=>`${k}:${v.length}`).join(' · ')} · Totale voci: ${total}`;
}
$('loadDicts').addEventListener('click', loadDicts);
$('dictImport').addEventListener('change', async e=>{ for(const f of e.target.files) importedWords.push(...splitWords(await f.text())); importedWords=uniq(importedWords); await loadDicts(); });

function pool(name){
  const map = { parola:['parole_it','importati','nomi_it','animali_it'], nome:['nomi_it'], cognome:['cognomi_it'], comune:['comuni_it'], animale:['animali_it'], specie:['animali_it'], pet:['nomi_animali_it'], nomeanimale:['nomi_animali_it'], mese:['mesi_it'], anno:['anni'], numero:['numeri'], simbolo:['simboli'], maiuscola:['UPPER'], minuscola:['LOWER'] };
  const keys = map[name] || [];
  let out=[]; for(const k of keys){ if(k==='UPPER') out.push(...UPPER); else if(k==='LOWER') out.push(...LOWER); else out.push(...(dictionaries[k]||[])); }
  return uniq(out).slice(0,50000);
}
function variants(s){
  if(!$('caseVariants').checked) return [s];
  const cap = s.charAt(0).toUpperCase()+s.slice(1).toLowerCase();
  return uniq([s, s.toLowerCase(), s.toUpperCase(), cap]);
}
async function generate(){
  await loadDicts();
  const templates=$('templates').value.split('\n').map(x=>x.trim()).filter(Boolean);
  const limit=Number($('limit').value); const seen=new Set(); const out=[];
  for(const tpl of templates){
    const fields=[...tpl.matchAll(/\{(\w+)\}/g)].map(m=>m[1]);
    if(!fields.length){ out.push(tpl); continue; }
    const lists=fields.map(f=>pool(f));
    if(lists.some(a=>!a.length)) continue;
    const idx=new Array(lists.length).fill(0);
    let guard=0;
    while(out.length<limit && guard<limit*20){
      guard++;
      let s=tpl;
      fields.forEach((f,i)=>{ s=s.replace(`{${f}}`, lists[i][idx[i]]); });
      for(const v of variants(s)){
        if(!$('dedupe').checked || !seen.has(v)){ seen.add(v); out.push(v); if(out.length>=limit) break; }
      }
      let p=lists.length-1;
      while(p>=0){ idx[p]++; if(idx[p]<lists[p].length) break; idx[p]=0; p--; }
      if(p<0) break;
    }
    if(out.length>=limit) break;
  }
  lastWordlist=out.slice(0,limit); $('wordlistOut').value=lastWordlist.join('\n');
  $('genStatus').textContent = `Generate ${lastWordlist.length} combinazioni. Numeri: ${(dictionaries.numeri||[]).length}; Anni: ${(dictionaries.anni||[]).length}.`;
}
$('generate').addEventListener('click', generate);
$('exportWordlist').addEventListener('click',()=>downloadText('keyback-wordlist.txt', lastWordlist.join('\n')));
$('copyWordlist').addEventListener('click',()=>navigator.clipboard.writeText($('wordlistOut').value));
loadDicts();
