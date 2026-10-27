'use strict';
let result=null;
const $=id=>document.getElementById(id),status=$('status');
function reset(){result=null;$('download').disabled=true;$('collections').disabled=true;status.textContent='Choices changed. Click “Check my choices” again.';}
for(const id of ['template','profile','topx','betterposters','home','appearance'])$(id).addEventListener('change',reset);
for(const id of ['profile','topx'])$(id).addEventListener('input',reset);
$('generate').onclick=async()=>{
 reset();
 try{
  const file=$('template').files[0];if(!file)throw Error('Choose config/collections.template.json from the extracted simple-config ZIP.');if(file.size>10*1024*1024)throw Error('This file is too large for the supplied template.');
  const collections=JSON.parse(await file.text());
  result=window.NuvioSimplePreset.build({collections,...window.NuvioSimpleDefaults,profileId:Number($('profile').value),topxAddonId:$('topx').value,includeHome:$('home').checked,includeTvAppearance:$('appearance').checked,includeBetterPosters:$('betterposters').checked});
  const s=result.summary;status.textContent=`Ready: ${s.services} streaming services · ${s.collections} collections · ${s.folders} folders · ${s.sources} sources.\nNo More Browsing. No hosted addon.\nOptional sources omitted: ${s.omittedOptionalSources}.\nHome order: ${s.homeIncluded?'included — replaces Home preferences':'unchanged'}. TV appearance: ${s.tvAppearanceIncluded?'included':'unchanged'}.\nDownload and restore into profile ID ${result.profile.profileId}. Keep your pre-import backup.`;
  $('download').disabled=false;$('collections').disabled=false;
 }catch(e){status.textContent=e.message;}
};
function download(value,name){if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download').onclick=()=>download(result?.profile,'nuvio-simple-studio-import.json');
$('collections').onclick=()=>download(result?.collections,'nuvio-simple-collections.json');
