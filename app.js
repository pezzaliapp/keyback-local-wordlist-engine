const BUILTIN = {
  nomi_it: ['Alessandro','Andrea','Luca','Marco','Matteo','Paolo','Giovanni','Francesco','Giuseppe','Roberto','Stefano','Davide','Michele','Antonio','Anna','Maria','Giulia','Francesca','Sara','Laura','Elena','Chiara','Paola','Silvia','Carlotta'],
  cognomi_it: ['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','De Luca','Mancini','Costa','Giordano','Rizzo','Lombardi','Moretti','Barbieri','Fontana'],
  comuni_it: ['Parma','Prato','Milano','Roma','Torino','Bologna','Firenze','Napoli','Genova','Venezia','Livorno','Civitanova','Correggio','Modena','Reggio Emilia','Catania','Olbia','Palermo','Bari'],
  animali_it: ['Cane','Gatto','Lupo','Leone','Tigre','Aquila','Orso','Cavallo','Volpe','Falco','Delfino','Balena','Ragno','Fenicottero','Gabbiano'],
  parole_it: ['oggi','domani','estate','inverno','mare','luna','sole','lavoro','cliente','listino','prezzi','fattura','ordine','backup','archivio','documento','ufficio','azienda','fornitore']
};
let externalWords = [];

const WORDLIST_FILES = ['nomi_it.txt','cognomi_it.txt','comuni_it.txt','animali_it.txt','parole_it.txt','mesi_it.txt'];
async function autoLoadWordlistFiles(){
  if(location.protocol === 'file:'){
    $('dictStatus').textContent = 'Nota: aperta da file://. I dizionari nella cartella wordlists sono inclusi, ma Safari può bloccare il caricamento automatico. Usa Importa dizionario TXT/CSV oppure avvia un server locale.';
    return;
  }
  let total = 0;
  for(const name of WORDLIST_FILES){
    try{
      const r = await fetch('./wordlists/' + name, {cache:'no-store'});
      if(!r.ok) continue;
      const txt = await r.text();
      const arr = txt.split(/[\r\n,;]+/).map(x=>x.trim()).filter(Boolean);
      externalWords.push(...arr); total += arr.length;
    }catch(e){}
  }
  externalWords = [...new Set(externalWords)];
  $('dictStatus').textContent = `Caricati automaticamente ${total} termini dalla cartella wordlists.`;
  getWords();
autoLoadWordlistFiles();
}

let last = [];
const $ = id => document.getElementById(id);
const lines = txt => txt.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const tokens = txt => txt.split(/[\s,;]+/).map(x=>x.trim()).filter(Boolean);
function variants(w){ const clean=w.trim(); if(!clean) return []; return [clean, clean.toLowerCase(), clean.toUpperCase(), clean.charAt(0).toUpperCase()+clean.slice(1).toLowerCase()]; }
function getWords(){
  const base = [...lines($('customWords').value), ...externalWords];
  document.querySelectorAll('.dict:checked').forEach(cb => base.push(...(BUILTIN[cb.value]||[])));
  const out = [...new Set(base.map(x=>x.trim()).filter(Boolean))];
  $('dictCount').textContent = out.length;
  return out;
}
function fillTemplate(t, a, b, n, s){
  const upper = a.charAt(0).toUpperCase()+a.slice(1).toLowerCase();
  const lower = a.toLowerCase();
  return t.replaceAll('{word2}', b).replaceAll('{word}', a).replaceAll('{num}', n).replaceAll('{sym}', s).replaceAll('{upper}', upper).replaceAll('{Upper}', upper).replaceAll('{lower}', lower).replaceAll('{LOWER}', lower.toUpperCase());
}
async function readImported(files){
  let added=0;
  for(const file of files){
    const text = await file.text();
    const arr = text.split(/[\r\n,;]+/).map(x=>x.trim()).filter(Boolean);
    externalWords.push(...arr); added += arr.length;
  }
  externalWords = [...new Set(externalWords)];
  $('dictStatus').textContent = `Importate ${added} voci. Totale dizionario esterno: ${externalWords.length}.`;
  getWords();
autoLoadWordlistFiles();
}
$('importDict').addEventListener('change', e => readImported(e.target.files));
$('loadBuiltins').addEventListener('click', () => { const w=getWords(); $('dictStatus').textContent = `Dizionari selezionati pronti: ${w.length} parole base.`; });
$('generate').addEventListener('click', () => {
  const words = getWords(); const nums = lines($('numbers').value); const syms = tokens($('symbols').value); const templ = lines($('templates').value);
  const limit = Math.max(100, parseInt($('limit').value||'100000',10));
  const minLen = parseInt($('minLen').value||'1',10), maxLen=parseInt($('maxLen').value||'32',10);
  $('templateCount').textContent = templ.length;
  let result = [], seen = new Set();
  const add = p => { if(!p || p.length<minLen || p.length>maxLen) return; if($('dedupe').checked){ if(seen.has(p)) return; seen.add(p);} result.push(p); };
  outer: for(const t of templ){
    for(const w1 of words){
      const v1 = $('caseVariants').checked ? variants(w1) : [w1];
      for(const a of v1){
        for(const w2 of words){
          if(result.length>=limit) break outer;
          for(const n of nums.length?nums:['']) for(const s of syms.length?syms:['']){
            add(fillTemplate(t, a, w2, n, s));
            if(result.length>=limit) break outer;
          }
        }
      }
    }
  }
  last = result; $('count').textContent = result.length.toLocaleString('it-IT'); $('output').value = result.slice(0,50000).join('\n') + (result.length>50000?'\n... output visuale limitato, esporta TXT per tutto.':'');
});
$('exportTxt').addEventListener('click', () => { const blob=new Blob([last.join('\n')],{type:'text/plain;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='keyback-wordlist.txt'; a.click(); URL.revokeObjectURL(a.href); });
$('copy').addEventListener('click', async()=>{ await navigator.clipboard.writeText(last.join('\n')); alert('Copiato negli appunti'); });
$('clear').addEventListener('click',()=>{last=[];$('output').value='';$('count').textContent='0';});
if('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js');
getWords();
autoLoadWordlistFiles();
