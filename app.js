const $ = id => document.getElementById(id);
const state = { files: [], results: [], deferredPrompt: null, externalWords: [], lastWordlist: [] };
const WORDLIST_FILES = ['nomi_it.txt','cognomi_it.txt','comuni_it.txt','animali_it.txt','parole_it.txt','mesi_it.txt'];
const BUILTIN = {
  nomi_it:['Alessandro','Andrea','Luca','Marco','Matteo','Paolo','Giovanni','Francesco','Giuseppe','Roberto','Stefano','Davide','Michele','Antonio','Anna','Maria','Giulia','Francesca','Sara','Laura','Elena','Chiara','Paola','Silvia','Carlotta'],
  cognomi_it:['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','De Luca','Mancini','Costa','Giordano','Rizzo','Lombardi','Moretti','Barbieri','Fontana'],
  comuni_it:['Parma','Prato','Milano','Roma','Torino','Bologna','Firenze','Napoli','Genova','Venezia','Livorno','Civitanova','Correggio','Modena','Reggio Emilia','Catania','Olbia','Palermo','Bari'],
  animali_it:['Cane','Gatto','Lupo','Leone','Tigre','Aquila','Orso','Cavallo','Volpe','Falco','Delfino','Balena','Ragno','Fenicottero','Gabbiano'],
  parole_it:['oggi','domani','estate','inverno','mare','luna','sole','lavoro','cliente','listino','prezzi','fattura','ordine','backup','archivio','documento','ufficio','azienda','fornitore'],
  mesi_it:['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
};

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.deferredPrompt = e; $('installBtn').classList.remove('hidden'); });

function init(){
  document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  $('browseFilesBtn').addEventListener('click', () => $('fileInput').click());
  $('browseFolderBtn').addEventListener('click', () => $('folderInput').click());
  $('fileInput').addEventListener('change', e => setFiles([...e.target.files]));
  $('folderInput').addEventListener('change', e => setFiles([...e.target.files]));
  $('scanBtn').addEventListener('click', () => startScan('files'));
  $('scanTextBtn').addEventListener('click', () => startScan('text'));
  $('generateBtn').addEventListener('click', generateWordlist);
  $('exportWordlistBtn').addEventListener('click', exportWordlist);
  $('copyWordlistBtn').addEventListener('click', copyWordlist);
  $('clearWordlistBtn').addEventListener('click', clearWordlist);
  $('importDict').addEventListener('change', e => importDictionaries(e.target.files));
  $('loadDictBtn').addEventListener('click', updateDictionaryCount);
  document.querySelectorAll('.dict').forEach(cb => cb.addEventListener('change', updateDictionaryCount));
  $('exportBtn').addEventListener('click', exportResults);
  $('exportCsvBtn').addEventListener('click', exportResultsCSV);
  $('clearBtn').addEventListener('click', clearResults);
  $('installBtn').addEventListener('click', installApp);
  if('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js');
  autoLoadWordlists(); updateDictionaryCount();
}

function setMode(mode){
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  ['files','text','generator','info'].forEach(m => $(m+'Options').classList.toggle('hidden', m !== mode));
}
function setFiles(files){ state.files = files; const total = files.reduce((s,f)=>s+f.size,0); $('fileInfo').textContent = `${files.length} file selezionati - ${formatBytes(total)}`; }

async function startScan(kind){
  showProgress(true); state.results = [];
  try{
    if(kind === 'text'){
      const text = $('textInput').value || ''; scanText('testo-incollato', text); setProgress(100,'Analisi testo completata.');
    } else {
      if(!state.files.length){ alert('Seleziona prima uno o più file.'); showProgress(false); return; }
      await scanFiles(state.files);
    }
  }catch(e){ log('Errore: ' + e.message, 'critical'); }
  renderResults();
}

async function scanFiles(files){
  for(let i=0;i<files.length;i++){
    const file = files[i]; setProgress(Math.round((i/files.length)*100), `Analisi ${file.name}...`); log(`Controllo: ${file.webkitRelativePath || file.name}`);
    const name = file.name.toLowerCase();
    if(name.endsWith('.zip')) await analyzeZip(file);
    else if(isLikelyText(file)) scanText(file.webkitRelativePath || file.name, await file.text());
    else addResult({type:'INFO', severity:'info', file:file.webkitRelativePath||file.name, message:'File binario/non testuale ignorato', evidence:formatBytes(file.size)});
  }
  setProgress(100,'Scansione completata.');
}
function isLikelyText(file){
  const n=file.name.toLowerCase(); return /\.(txt|csv|json|xml|html|css|js|ts|py|env|ini|conf|config|log|md|yaml|yml)$/i.test(n) || (file.type && file.type.startsWith('text/'));
}
function scanText(fileName,text){
  const patterns = [
    {name:'PASSWORD', rx:/(password|passwd|pwd|pass)\s*[:=]\s*["']?([^\s"']{4,})/gi, severity:'warning'},
    {name:'TOKEN/API KEY', rx:/(api[_-]?key|token|secret|client_secret)\s*[:=]\s*["']?([^\s"']{8,})/gi, severity:'warning'},
    {name:'EMAIL', rx:/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, severity:'info'},
    {name:'PRIVATE KEY', rx:/-----BEGIN [A-Z ]*PRIVATE KEY-----/gi, severity:'critical'}
  ];
  let found=0;
  for(const p of patterns){ let m; while((m=p.rx.exec(text))!==null){ found++; addResult({type:p.name,severity:p.severity,file:fileName,message:'Possibile dato sensibile trovato',evidence:mask(snippet(text,m.index))}); } }
  if(!found) addResult({type:'INFO',severity:'info',file:fileName,message:'Nessun pattern evidente trovato',evidence:`${text.length} caratteri analizzati`});
}

async function analyzeZip(file){
  const buffer = await file.arrayBuffer(); const view = new DataView(buffer); const entries = parseZipEntries(view, buffer.byteLength);
  const protectedCount = entries.filter(e=>e.encrypted).length;
  addResult({type:'ZIP',severity:protectedCount?'warning':'info',file:file.name,message:`Trovati ${entries.length} elementi. Protetti: ${protectedCount}.`,evidence:entries.slice(0,20).map(e=>`${e.encrypted?'🔒':'📄'} ${e.name}`).join('\n')});
  for(const e of entries){
    if(e.encrypted){ addResult({type:'ZIP CIFRATO',severity:'warning',file:`${file.name}/${e.name}`,message:'File protetto da password. Usa il Wordlist Engine per creare una lista personale; la PWA non forza password nel browser.',evidence:'Cifratura rilevata nel flag ZIP.'}); continue; }
    if(e.uncompressedSize > 1000000) continue;
    const data = await extractZipEntry(buffer, e);
    if(data && looksText(data)) scanText(`${file.name}/${e.name}`, new TextDecoder().decode(data));
  }
}
function parseZipEntries(view,total){
  const entries=[]; let off=0;
  while(off < total-30){
    if(view.getUint32(off,true) !== 0x04034b50){ off++; continue; }
    const flags=view.getUint16(off+6,true), method=view.getUint16(off+8,true), compSize=view.getUint32(off+18,true), uncompSize=view.getUint32(off+22,true);
    const nameLen=view.getUint16(off+26,true), extraLen=view.getUint16(off+28,true);
    const nameStart=off+30, dataStart=nameStart+nameLen+extraLen, dataEnd=dataStart+compSize;
    if(dataEnd>total || nameLen<1) break;
    const name=new TextDecoder().decode(new Uint8Array(view.buffer,nameStart,nameLen));
    entries.push({name,encrypted:!!(flags&1),method,compressedSize:compSize,uncompressedSize:uncompSize,dataStart,dataEnd});
    off=dataEnd;
  }
  return entries;
}
async function extractZipEntry(buffer,e){
  const compressed = new Uint8Array(buffer.slice(e.dataStart,e.dataEnd));
  if(e.method===0) return compressed;
  if(e.method===8 && 'DecompressionStream' in window){
    try{ const ds = new DecompressionStream('deflate-raw'); const stream = new Blob([compressed]).stream().pipeThrough(ds); return new Uint8Array(await new Response(stream).arrayBuffer()); }catch(err){ return null; }
  }
  return null;
}
function looksText(bytes){ let bad=0; const lim=Math.min(bytes.length,512); for(let i=0;i<lim;i++){ const b=bytes[i]; if(b===0 || (b<7 && b!==9 && b!==10 && b!==13)) bad++; } return bad < 5; }

async function autoLoadWordlists(){
  if(location.protocol === 'file:'){ $('dictStatus').textContent='Aperta da file://: Safari/Chrome possono bloccare il caricamento automatico. Su GitHub Pages o localhost carica anche la cartella wordlists.'; return; }
  let total=0;
  for(const name of WORDLIST_FILES){ try{ const r=await fetch('./wordlists/'+name,{cache:'no-store'}); if(!r.ok) continue; const arr=parseWords(await r.text()); state.externalWords.push(...arr); total+=arr.length; }catch(e){} }
  state.externalWords=unique(state.externalWords); $('dictStatus').textContent=`Caricati automaticamente ${total} termini dalla cartella wordlists.`; updateDictionaryCount();
}
async function importDictionaries(files){ let added=0; for(const f of files){ const arr=parseWords(await f.text()); state.externalWords.push(...arr); added+=arr.length; } state.externalWords=unique(state.externalWords); $('dictStatus').textContent=`Importate ${added} voci. Totale dizionario esterno: ${state.externalWords.length}.`; updateDictionaryCount(); }
function getWords(){
  const base=[...lines($('customWords').value), ...state.externalWords];
  document.querySelectorAll('.dict:checked').forEach(cb => base.push(...(BUILTIN[cb.value] || [])));
  return unique(base.map(x=>x.trim()).filter(Boolean));
}
function updateDictionaryCount(){ const w=getWords(); $('wordCount').textContent=w.length.toLocaleString('it-IT'); return w; }
function generateWordlist(){
  const words=updateDictionaryCount(), nums=lines($('numbers').value), syms=tokens($('symbols').value), templ=lines($('templates').value);
  const limit=clamp(parseInt($('limit').value||'100000',10),100,2000000), minLen=parseInt($('minLen').value||'1',10), maxLen=parseInt($('maxLen').value||'32',10);
  const seen=new Set(), out=[]; const add=p=>{ if(!p || p.length<minLen || p.length>maxLen) return; if($('dedupe').checked){ if(seen.has(p)) return; seen.add(p); } out.push(p); };
  if($('includeDirect').checked){ for(const w of words){ add(w); for(const n of nums) add(w+n); } }
  outer: for(const t of templ){
    for(const w1 of words){ const v1=$('caseVariants').checked?caseVariants(w1):[w1];
      for(const a of v1){ for(const w2 of words){ const v2=$('caseVariants').checked?caseVariants(w2):[w2];
        for(const b of v2){ for(const n of (nums.length?nums:[''])){ for(const s of (syms.length?syms:[''])){ add(fillTemplate(t,a,b,n,s)); if(out.length>=limit) break outer; }}}
      }}
    }
  }
  state.lastWordlist=out; $('generatedCount').textContent=out.length.toLocaleString('it-IT'); $('templateCount').textContent=templ.length.toLocaleString('it-IT'); $('wordlistOutput').value=out.slice(0,50000).join('\n') + (out.length>50000?'\n... output visuale limitato: esporta TXT per tutto.':'');
}
function fillTemplate(t,a,b,n,s){ const upper=cap(a), lower=a.toLowerCase(); return t.replaceAll('{word2}',b).replaceAll('{word}',a).replaceAll('{num}',n).replaceAll('{sym}',s).replaceAll('{upper}',upper).replaceAll('{Upper}',upper).replaceAll('{lower}',lower).replaceAll('{LOWER}',lower.toUpperCase()); }
function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1).toLowerCase() : ''; }
function lines(text){ return String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean); }
function tokens(text){ return String(text||'').split(/\s+/).map(s=>s.trim()).filter(Boolean).map(s=>s==='vuoto'?'':s); }
function parseWords(text){ return String(text||'').split(/[\r\n,;]+/).map(s=>s.trim()).filter(Boolean); }
function caseVariants(w){ return unique([w,w.toLowerCase(),w.toUpperCase(),cap(w)]); }
function unique(arr){ return [...new Set(arr)]; }
function clamp(n,min,max){ return Math.min(max,Math.max(min,Number.isFinite(n)?n:min)); }

function addResult(r){ state.results.push({...r,time:new Date().toISOString()}); }
function renderResults(){ $('resultsSection').classList.remove('hidden'); const total=state.results.length, crit=state.results.filter(r=>r.severity==='critical').length, warn=state.results.filter(r=>r.severity==='warning').length, info=state.results.filter(r=>r.severity==='info').length; $('summaryStats').innerHTML=stat('totale',total)+stat('critici',crit)+stat('avvisi',warn)+stat('info',info); $('resultsList').innerHTML=state.results.map(r=>`<div class="result-card ${r.severity}"><div class="result-title"><span>${escapeHtml(r.type)}</span><small>${escapeHtml(r.file)}</small></div><p>${escapeHtml(r.message)}</p><div class="result-snippet">${escapeHtml(r.evidence||'')}</div></div>`).join(''); }
function stat(label,value){ return `<div class="stat-item"><div class="stat-number">${value}</div><div class="stat-label">${label}</div></div>`; }
function showProgress(show){ $('progressSection').classList.toggle('hidden',!show); if(show){ $('progressLog').innerHTML=''; setProgress(0,'Preparazione...'); } }
function setProgress(p,t){ $('progressFill').style.width=p+'%'; $('progressStatus').textContent=t; }
function log(t,cls=''){ $('progressLog').insertAdjacentHTML('beforeend',`<div class="log-entry ${cls}">${escapeHtml(t)}</div>`); $('progressLog').scrollTop=$('progressLog').scrollHeight; }
function clearResults(){ state.results=[]; $('resultsSection').classList.add('hidden'); $('progressSection').classList.add('hidden'); }
function clearWordlist(){ state.lastWordlist=[]; $('wordlistOutput').value=''; $('generatedCount').textContent='0'; }
function downloadText(filename,text,type='text/plain'){ const blob=new Blob([text],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }
function exportResults(){ downloadText('keyback-local-report.json',JSON.stringify(state.results,null,2),'application/json'); }
function exportResultsCSV(){ const rows=['tipo,severita,file,messaggio,evidenza',...state.results.map(r=>[r.type,r.severity,r.file,r.message,r.evidence].map(csv).join(','))]; downloadText('keyback-local-report.csv',rows.join('\n'),'text/csv'); }
function exportWordlist(){ downloadText('keyback-wordlist.txt',state.lastWordlist.join('\n'),'text/plain;charset=utf-8'); }
async function copyWordlist(){ await navigator.clipboard.writeText(state.lastWordlist.join('\n')); alert('Wordlist copiata negli appunti.'); }
async function installApp(){ if(!state.deferredPrompt) return; state.deferredPrompt.prompt(); await state.deferredPrompt.userChoice; state.deferredPrompt=null; $('installBtn').classList.add('hidden'); }
function formatBytes(bytes){ if(!bytes) return '0 B'; const u=['B','KB','MB','GB']; const i=Math.floor(Math.log(bytes)/Math.log(1024)); return `${(bytes/Math.pow(1024,i)).toFixed(1)} ${u[i]}`; }
function snippet(text,index){ return text.slice(Math.max(0,index-70),Math.min(text.length,index+160)).replace(/\s+/g,' ').trim(); }
function mask(value){ return String(value).replace(/([:=]\s*["']?)([^\s"']{4,})/g,(_,a,b)=>a+b.slice(0,2)+'••••'+b.slice(-2)); }
function escapeHtml(v){ return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function csv(v){ return '"'+String(v||'').replace(/"/g,'""')+'"'; }
