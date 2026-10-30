'use strict';
let privateData;
const key=location.hash.slice(1);history.replaceState(null,'',location.pathname);
const el=id=>document.getElementById(id);
async function api(path,body){const r=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${key}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed.');return data;}
async function copy(value,label){try{if(!value)throw Error('No value saved.');await navigator.clipboard.writeText(value);el('status').textContent=`${label} copied. Paste it only into the intended Nuvio setting.`;}catch(e){el('status').textContent=e.message==='No value saved.'?e.message:'Clipboard access was denied. Allow clipboard access for this local helper, then try again.';}}
function coverage(){el('coverage').textContent=`TMDB: ${privateData.credentials?.tmdb?'saved':'MISSING — add it once above'}. Real-Debrid: saved inside configured Torrentio links. Other service credentials are preserved only where embedded in a captured link; OAuth sign-ins and VM secrets are not captured.`;el('copy-tmdb').disabled=!privateData.credentials?.tmdb;}
el('save').onclick=async()=>{el('save').disabled=true;try{const tmdb=el('tmdb').value.trim();await api('/api/save',{tmdb});privateData.credentials.tmdb=tmdb;el('status').textContent='Encrypted local backup saved. Your Nuvio account was not changed.';coverage();}catch(e){el('status').textContent=e.message;}finally{el('save').disabled=false;}};
el('copy-tmdb').onclick=()=>copy(privateData.credentials.tmdb,'TMDB key');
el('copy-rd').onclick=()=>copy(privateData.credentials.realDebrid,'Real-Debrid token');
el('portable').onclick=async()=>{el('portable').disabled=true;try{if(!privateData.credentials.tmdb)throw Error('Save the working TMDB key first so the portable backup is complete for your TMDB folders.');const pass=el('password').value;if(pass!==el('password-confirm').value)throw Error('Backup passwords do not match.');const encrypted=await NuvioVaultCrypto.seal(privateData,pass);const url=URL.createObjectURL(new Blob([JSON.stringify(encrypted)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='my-nuvio-portable.encrypted.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);el('password').value='';el('password-confirm').value='';el('status').textContent='Portable encrypted backup downloaded. Keep the password separately. No account changes made.';}catch(e){el('status').textContent=e.message;}finally{el('portable').disabled=false;}};
el('layout').onclick=()=>{
 if(!privateData||!el('ack').checked){el('status').textContent='Confirm the target profile first.';return;}
 const id=Number(el('profile').value);if(!Number.isInteger(id)||id<1||id>6){el('status').textContent='Use a target profile ID from 1 to 6.';return;}
 const profile={...privateData.layout,profileId:id};
 const url=URL.createObjectURL(new Blob([JSON.stringify(profile,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`nuvio-private-layout-profile-${id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
(async()=>{try{
 privateData=await api('/api/state');el('tmdb').value=privateData.credentials?.tmdb||'';
 el('status').textContent='Opened your Windows-encrypted backup. No account changes made.';el('save').disabled=false;el('layout').disabled=false;el('portable').disabled=false;el('copy-rd').disabled=!privateData.credentials.realDebrid;coverage();
 privateData.addons.forEach((addon,i)=>{
  const row=document.createElement('div');row.className='row';const label=document.createElement('span');label.textContent=`${i+1}. ${addon.name}${addon.enabled===false?' — disabled in saved setup':''}`;
  const button=document.createElement('button');button.textContent='Copy configured URL';button.onclick=()=>copy(addon.url,'Configured addon URL');
  if(/REDACTED|PLACEHOLDER/i.test(addon.url)){button.disabled=true;label.textContent+=' — INVALID PLACEHOLDER, update the snapshot';}
  row.append(label,button);el('addons').append(row);
 });el('counts').textContent=`Snapshot: ${privateData.savedAt}. ${privateData.addons.length} addon entries. Keep private-backup.vault and this helper together; never publish the private folder.`;
}catch(e){el('status').textContent=e.message;}})();
