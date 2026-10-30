'use strict';
let recoveryResult=null;
const recoveryEl=id=>document.getElementById(id);
function invalidateRecovery(){recoveryResult=null;recoveryEl('download').disabled=true;recoveryEl('report').textContent='Choices changed. Check the backup again before downloading.';}
for(const id of ['backup','profile','home','appearance','confirm'])recoveryEl(id).addEventListener('input',invalidateRecovery);
recoveryEl('check').onclick=async()=>{
  invalidateRecovery();
  try{
    const file=recoveryEl('backup').files[0];if(!file)throw Error('Choose your working Kaptain backup first.');
    if(file.size>20*1024*1024)throw Error('Backup exceeds the 20 MiB limit. Export collections, Home and settings only.');
    const data=JSON.parse(await file.text());
    recoveryResult=NuvioRecovery.build(data,{profileId:Number(recoveryEl('profile').value),includeHome:recoveryEl('home').checked,includeAppearance:recoveryEl('appearance').checked,confirmed:recoveryEl('confirm').checked});
    const s=recoveryResult.summary;
    recoveryEl('report').textContent=`LAYOUT FILE READY — connections still need checking\nTarget: profile ${recoveryResult.profile.profileId}\n${s.collections} collections · ${s.folders} folders · ${s.sources} source positions\nIncluded: ${Object.keys(recoveryResult.profile.parts).join(', ')}\nExcluded: ALL addon URLs, provider settings, keys, playback and history.\n${s.redactedAddonCount} addon URL(s) in this backup contain a placeholder. Exports can redact valid live tokens; check the installed URL in Nuvio before changing it.\nNative TMDB sources: ${s.requiresTmdb?'yes — check the target profile connection':'not found'}. Trakt sources: ${s.requiresTrakt?'yes — check authorization':'not found'}.\n${s.addonIds.length} distinct addon IDs referenced. Keep/install the matching configured addons; matching display names alone are insufficient.\n${s.enabledLocalhost?'WARNING: an enabled localhost addon was found. Other devices cannot use your laptop’s localhost address.\n':''}No credentials were tested. Complete steps 4 and 5 after importing.`;
    recoveryEl('download').disabled=false;
  }catch(e){recoveryResult=null;recoveryEl('report').textContent=e instanceof SyntaxError?'This is not valid JSON. Choose an unedited Kaptain backup.':e.message;}
};
recoveryEl('download').onclick=()=>{
  if(!recoveryResult)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(recoveryResult.profile,null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`nuvio-safe-layout-profile-${recoveryResult.profile.profileId}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
