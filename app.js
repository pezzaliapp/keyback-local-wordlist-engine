const $ = id => document.getElementById(id);
const state = { files: [], results: [], deferredPrompt: null, dicts: {}, imported: [], lastWordlist: [] };
const WORDLIST_FILES = {
  nomi_it:'nomi_it.txt', cognomi_it:'cognomi_it.txt', comuni_it:'comuni_it.txt', animali_it:'animali_it.txt',
  nomi_animali_it:'nomi_animali_it.txt', mesi_it:'mesi_it.txt', parole_it:'parole_it.txt'
};
const FALLBACK = {
  nomi_it:['Alessandro','Andrea','Luca','Marco','Matteo','Paolo','Giovanni','Francesco','Giuseppe','Roberto','Stefano','Davide','Michele','Antonio','Anna','Maria','Giulia','Francesca','Sara','Laura','Elena','Chiara','Paola','Silvia','Carlotta','Sofia','Martina','Greta','Giorgia','Elisa'],
  cognomi_it:['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','De Luca','Mancini','Costa','Giordano','Rizzo','Lombardi','Moretti','Barbieri','Fontana','Santoro','Mariani','Rinaldi'],
  comuni_it:['Parma','Prato','Milano','Roma','Torino','Bologna','Firenze','Napoli','Genova','Venezia','Livorno','Civitanova','Correggio','Modena','Reggio Emilia','Catania','Olbia','Palermo','Bari','Sardegna','Germania','Parigi'],
  animali_it:['Cane','Gatto','Lupo','Leone','Tigre','Aquila','Orso','Cavallo','Volpe','Falco','Delfino','Balena','Ragno','Fenicottero','Gabbiano','Coniglio','Criceto','Pappagallo','Tartaruga','Serpente','Pantera','Ghepardo','Elefante','Giraffa','Zebra','Koala','Panda'],
  nomi_animali_it:['Rex','Fido','Luna','Milo','Mia','Leo','Nala','Kira','Bella','Rocky','Toby','Briciola','Chicco','Lucky','Jack','Tommy','Nina','Stella','Maya','Zoe','Birba','Pippo','Pluto'],
  parole_it:['oggi','domani','estate','inverno','mare','luna','sole','lavoro','cliente','listino','prezzi','fattura','ordine','backup','archivio','documento','ufficio','azienda','fornitore','casa','viaggio','canon','musica','foto'],
  mesi_it:['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
};
window.addEventListener('DOMContentLoaded', init);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.deferredPrompt = e; $('installBtn').classList.remove('hidden'); });
async function init(){
  Object.keys(WORDLIST_FILES).forEach(k => state.dicts[k] = FALLBACK[k] || []);
  $('browseFilesBtn').onclick = () => $('fileInput').click(); $('browseFolderBtn').onclick = () => $('folderInput').click();
  $('fileInput').onchange = e => setFiles([...e.target.files]); $('folderInput').onchange = e => setFiles([...e.target.files]);
  $('scanBtn').onclick = () => startScan('files'); $('scanTextBtn').onclick = () => startScan('text'); $('clearBtn').onclick = clearResults;
  $('exportBtn').onclick = () => downloadText('keyback-report.json', JSON.stringify(state.results,null,2),'application/json'); $('exportCsvBtn').onclick = exportCSV;
  $('importDict').onchange = e => importDictionaries(e.target.files); $('loadDictBtn').onclick = updateCounts;
  document.querySelectorAll('.dict').forEach(cb => cb.onchange = updateCounts);
  ['yearStart','yearEnd','numStart','numEnd','padding','extraNumbers'].forEach(id => $(id).addEventListener('input', updateCounts));
  $('generateBtn').onclick = generateWordlist; $('exportWordlistBtn').onclick = () => downloadText('keyback-wordlist.txt', state.lastWordlist.join('\n'), 'text/plain;charset=utf-8');
  $('copyWordlistBtn').onclick = async () => { await navigator.clipboard.writeText(state.lastWordlist.join('\n')); alert('Wordlist copiata.'); };
  $('clearWordlistBtn').onclick = () => { state.lastWordlist=[]; $('wordlistOutput').value=''; $('generatorReport').textContent='Wordlist pulita.'; };
  $('installBtn').onclick = installApp;
  if('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js');
  await autoLoadWordlists(); updateCounts(); renderResults();
}
function setFiles(files){ state.files=files; $('fileInfo').textContent = `${files.length} elementi selezionati - ${formatBytes(files.reduce((s,f)=>s+f.size,0))}`; }
async function autoLoadWordlists(){
  if(location.protocol === 'file:'){ $('dictStatus').textContent='Da file:// i dizionari automatici possono essere bloccati; su GitHub Pages/localhost funzionano. Uso fallback interni.'; return; }
  let loaded=0;
  for(const [key,file] of Object.entries(WORDLIST_FILES)){
    try{ const r = await fetch(`./wordlists/${file}`,{cache:'no-store'}); if(r.ok){ const arr=parseWords(await r.text()); if(arr.length){ state.dicts[key]=unique([...state.dicts[key],...arr]); loaded+=arr.length; } } }catch(e){}
  }
  $('dictStatus').textContent = `Caricati ${loaded} termini dai file wordlists + fallback interni.`;
}
async function importDictionaries(files){ let added=0; for(const f of files){ const arr=parseWords(await f.text()); state.imported.push(...arr); added+=arr.length; } state.imported=unique(state.imported); $('dictStatus').textContent=`Importate ${added} voci. Totale importate: ${state.imported.length}.`; updateCounts(); }
function getCategory(key){ return unique([...(state.dicts[key]||[])]).filter(Boolean); }
function selectedWords(){ let arr=[...lines($('customWords').value), ...state.imported]; document.querySelectorAll('.dict:checked').forEach(cb => arr.push(...getCategory(cb.value))); return unique(arr.map(s=>s.trim()).filter(Boolean)); }
function getYears(){ const a=+($('yearStart').value||1950), b=+($('yearEnd').value||2035); const out=[]; for(let y=Math.min(a,b); y<=Math.max(a,b); y++) out.push(String(y)); lines($('extraNumbers').value).forEach(x=>/^\d{4}$/.test(x)&&out.push(x)); return unique(out); }
function getNumbers(){ const a=+($('numStart').value||0), b=+($('numEnd').value||9999), pad=$('padding').value; const out=[]; const maxSpan=20000; const end=Math.min(Math.max(a,b), Math.min(a,b)+maxSpan); for(let n=Math.min(a,b); n<=end; n++){ let s=String(n); if(pad!=='none') s=s.padStart(+pad,'0'); out.push(s); } lines($('extraNumbers').value).forEach(x=>out.push(x)); return unique(out); }
function getSymbols(){ return String($('symbols').value||'').split(/\s+/).filter(Boolean).map(s=>s==='vuoto'?'':s); }
function updateCounts(){ $('wordCount').textContent=selectedWords().length.toLocaleString('it-IT'); $('numberCount').textContent=getNumbers().length.toLocaleString('it-IT'); $('yearCount').textContent=getYears().length.toLocaleString('it-IT'); }
async function startScan(kind){ state.results=[]; showProgress(true); try{ if(kind==='text'){ scanText('testo-incollato', $('textInput').value||''); setProgress(100,'Analisi testo completata.'); } else { if(!state.files.length){ alert('Seleziona prima file o cartella.'); return; } await scanFiles(state.files); } }catch(e){ addResult({type:'ERRORE', severity:'critical', file:'app', message:e.message, evidence:String(e.stack||'')}); } renderResults(); }
async function scanFiles(files){ for(let i=0;i<files.length;i++){ const f=files[i]; setProgress(Math.round(i/files.length*100), `Analisi ${f.name}`); log(f.webkitRelativePath||f.name); const n=f.name.toLowerCase(); if(n.endsWith('.zip')) await analyzeZip(f); else if(isLikelyText(f)) scanText(f.webkitRelativePath||f.name, await f.text()); else addResult({type:'INFO',severity:'info',file:f.webkitRelativePath||f.name,message:'File binario/non testuale ignorato',evidence:formatBytes(f.size)}); } setProgress(100,'Scansione completata.'); }
function isLikelyText(file){ return /\.(txt|csv|json|xml|html|css|js|ts|py|env|ini|conf|config|log|md|yaml|yml)$/i.test(file.name) || (file.type||'').startsWith('text/'); }
function scanText(fileName,text){ const patterns=[{name:'PASSWORD',rx:/(password|passwd|pwd|pass)\s*[:=]\s*["']?([^\s"']{4,})/gi,severity:'warning'},{name:'TOKEN/API KEY',rx:/(api[_-]?key|token|secret|client_secret)\s*[:=]\s*["']?([^\s"']{8,})/gi,severity:'warning'},{name:'EMAIL',rx:/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,severity:'info'},{name:'PRIVATE KEY',rx:/-----BEGIN [A-Z ]*PRIVATE KEY-----/gi,severity:'critical'}]; let found=0; for(const p of patterns){ let m; while((m=p.rx.exec(text))!==null){ found++; addResult({type:p.name,severity:p.severity,file:fileName,message:'Possibile dato sensibile trovato',evidence:mask(snippet(text,m.index))}); } } if(!found) addResult({type:'INFO',severity:'info',file:fileName,message:'Nessun pattern evidente trovato',evidence:`${text.length} caratteri analizzati`}); }
async function analyzeZip(file){ const buffer=await file.arrayBuffer(), view=new DataView(buffer), entries=parseZip(view, buffer.byteLength); const enc=entries.filter(e=>e.encrypted).length; addResult({type:'ZIP',severity:enc?'warning':'info',file:file.name,message:`File interni trovati: ${entries.length}. File cifrati: ${enc}.`,evidence:entries.slice(0,40).map(e=>`${e.encrypted?'🔒':'📄'} ${e.name} metodo:${e.method}`).join('\n')}); for(const e of entries){ if(e.encrypted){ addResult({type:'ZIP CIFRATO',severity:'warning',file:`${file.name}/${e.name}`,message:'File protetto da password. La PWA genera wordlist, ma non verifica password nel browser.',evidence:'Flag ZIP cifrato rilevato.'}); continue; } if(e.uncompressedSize>1000000) continue; const data=await extractZipEntry(buffer,e); if(data && looksText(data)) scanText(`${file.name}/${e.name}`, new TextDecoder().decode(data)); } }
function parseZip(view,total){ const entries=[]; let off=0; while(off<total-30){ if(view.getUint32(off,true)!==0x04034b50){off++;continue;} const flags=view.getUint16(off+6,true),method=view.getUint16(off+8,true),compSize=view.getUint32(off+18,true),uncompSize=view.getUint32(off+22,true),nameLen=view.getUint16(off+26,true),extraLen=view.getUint16(off+28,true); const nameStart=off+30,dataStart=nameStart+nameLen+extraLen,dataEnd=dataStart+compSize; if(dataEnd>total||nameLen<1)break; const name=new TextDecoder().decode(new Uint8Array(view.buffer,nameStart,nameLen)); entries.push({name,encrypted:!!(flags&1),method,compressedSize:compSize,uncompressedSize:uncompSize,dataStart,dataEnd}); off=dataEnd; } return entries; }
async function extractZipEntry(buffer,e){ const c=new Uint8Array(buffer.slice(e.dataStart,e.dataEnd)); if(e.method===0)return c; if(e.method===8&&'DecompressionStream'in window){ try{ const ds=new DecompressionStream('deflate-raw'); const stream=new Blob([c]).stream().pipeThrough(ds); return new Uint8Array(await new Response(stream).arrayBuffer()); }catch(err){return null;} } return null; }
function looksText(bytes){ let bad=0,lim=Math.min(bytes.length,512); for(let i=0;i<lim;i++){ const b=bytes[i]; if(b===0||(b<7&&b!==9&&b!==10&&b!==13)) bad++; } return bad<5; }
function generateWordlist(){ updateCounts(); const templates=lines($('templates').value), limit=+($('limit').value||250000), dedupe=$('dedupe').checked; const ctx={ parola:selectedWords(), nome:getCategory('nomi_it'), persona:getCategory('nomi_it'), cognome:getCategory('cognomi_it'), comune:getCategory('comuni_it'), animale:getCategory('animali_it'), specie:getCategory('animali_it'), pet:getCategory('nomi_animali_it'), nomeanimale:getCategory('nomi_animali_it'), mese:getCategory('mesi_it'), anno:getYears(), numero:getNumbers(), simbolo:getSymbols(), maiuscola:['A','B','C','D','E','F','P','R','S','Z']}; Object.keys(ctx).forEach(k=>{ if(!ctx[k].length) ctx[k]=['']; }); const seen=new Set(), out=[]; const add=p=>{ if(!p || p.length>64) return; if(dedupe){ if(seen.has(p))return; seen.add(p); } out.push(p); };
  let i=0, guard=limit*4; while(out.length<limit && i<guard){ for(const t of templates){ const base=fill(t,ctx,i); add(base); if($('caseVariants').checked){ add(base.toLowerCase()); add(base.toUpperCase()); add(capSentence(base)); } if(out.length>=limit)break; } i++; }
  state.lastWordlist=out; $('wordlistOutput').value=out.slice(0,50000).join('\n')+(out.length>50000?'\n... output visuale limitato: esporta TXT per tutto.':'');
  $('generatorReport').innerHTML=`Generate <b>${out.length.toLocaleString('it-IT')}</b> combinazioni. Persone: ${ctx.nome.length}, Cognomi: ${ctx.cognome.length}, Specie animali: ${ctx.animale.length}, Nomi animali: ${ctx.pet.length}, Comuni: ${ctx.comune.length}, Numeri: ${ctx.numero.length}, Anni: ${ctx.anno.length}.`;
}
function fill(t,ctx,i){ const primes={parola:1,nome:3,persona:5,cognome:7,comune:11,animale:13,specie:17,pet:19,nomeanimale:23,mese:29,anno:31,numero:37,simbolo:41,maiuscola:43}; return t.replace(/\{([a-zA-Z]+)\}/g,(m,k)=>{ const key=k.toLowerCase(), arr=ctx[key]||['']; return arr[(i*(primes[key]||1))%arr.length]||''; }); }
function addResult(r){ state.results.push({...r,time:new Date().toISOString()}); }
function renderResults(){ const total=state.results.length, crit=state.results.filter(r=>r.severity==='critical').length, warn=state.results.filter(r=>r.severity==='warning').length, info=state.results.filter(r=>r.severity==='info').length; $('summaryStats').innerHTML=stat('totale',total)+stat('critici',crit)+stat('avvisi',warn)+stat('info',info); $('resultsList').innerHTML=state.results.map(r=>`<div class="result-card ${r.severity}"><div class="result-title"><span>${esc(r.type)}</span><small>${esc(r.file)}</small></div><p>${esc(r.message)}</p><div class="result-snippet">${esc(r.evidence||'')}</div></div>`).join('') || '<div class="status">Nessun risultato ancora. Carica un file/ZIP o analizza testo.</div>'; }
function stat(label,value){return `<div class="stat-item"><div class="stat-number">${value}</div><div class="stat-label">${label}</div></div>`}
function showProgress(show){ $('progressSection').classList.toggle('hidden',!show); if(show){ $('progressLog').textContent=''; setProgress(0,'Preparazione...'); } }
function setProgress(p,t){ $('progressFill').style.width=p+'%'; $('progressStatus').textContent=t; }
function log(t){ $('progressLog').textContent += t+'\n'; }
function clearResults(){ state.results=[]; renderResults(); $('progressSection').classList.add('hidden'); }
function exportCSV(){ const rows=['tipo,severita,file,messaggio,evidenza',...state.results.map(r=>[r.type,r.severity,r.file,r.message,r.evidence].map(csv).join(','))]; downloadText('keyback-report.csv',rows.join('\n'),'text/csv'); }
function downloadText(filename,text,type='text/plain'){ const blob=new Blob([text],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }
async function installApp(){ if(!state.deferredPrompt)return; state.deferredPrompt.prompt(); await state.deferredPrompt.userChoice; state.deferredPrompt=null; $('installBtn').classList.add('hidden'); }
function lines(text){ return String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean); }
function parseWords(text){ return String(text||'').split(/[\r\n,;]+/).map(s=>s.trim()).filter(Boolean); }
function unique(arr){ return [...new Set(arr)]; }
function capSentence(s){ return String(s).split(/([\-_.!@#\s]+)/).map(x=>/^[a-zà-ÿ]/i.test(x)?x.charAt(0).toUpperCase()+x.slice(1).toLowerCase():x).join(''); }
function snippet(text,index){ return text.slice(Math.max(0,index-70),Math.min(text.length,index+160)).replace(/\s+/g,' ').trim(); }
function mask(v){ return String(v).replace(/([:=]\s*["']?)([^\s"']{4,})/g,(_,a,b)=>a+b.slice(0,2)+'••••'+b.slice(-2)); }
function formatBytes(bytes){ if(!bytes)return'0 B'; const u=['B','KB','MB','GB'],i=Math.floor(Math.log(bytes)/Math.log(1024)); return `${(bytes/Math.pow(1024,i)).toFixed(1)} ${u[i]}`; }
function esc(v){ return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function csv(v){ return '"'+String(v||'').replace(/"/g,'""')+'"'; }
