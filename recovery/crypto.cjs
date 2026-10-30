(function(root){'use strict';
 const encode=new TextEncoder(),decode=new TextDecoder();
 const b64=bytes=>{let text='';for(const b of new Uint8Array(bytes))text+=String.fromCharCode(b);return btoa(text);};
 const bytes=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
 async function key(password,salt,usages){const material=await crypto.subtle.importKey('raw',encode.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,usages);}
 async function seal(data,password){if(typeof password!=='string'||password.length<12)throw Error('Use a backup password of at least 12 characters.');const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encode.encode('nuvio-portable-v1')},await key(password,salt,['encrypt']),encode.encode(JSON.stringify(data)));return{format:'nuvio-portable-vault',version:1,kdf:'PBKDF2-SHA256',iterations:600000,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),data:b64(encrypted)};}
 async function open(value,password){
  if(value?.format!=='nuvio-portable-vault'||value.version!==1||value.kdf!=='PBKDF2-SHA256'||value.iterations!==600000||value.cipher!=='AES-256-GCM'||typeof value.data!=='string'||value.data.length>45000000)throw Error('Unsupported or oversized portable backup.');
  try{const salt=bytes(value.salt),iv=bytes(value.iv);if(salt.length!==16||iv.length!==12)throw Error();const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encode.encode('nuvio-portable-v1')},await key(password,salt,['decrypt']),bytes(value.data));const data=JSON.parse(decode.decode(plain));if(data?.format!=='nuvio-private-recovery'||data.version!==1||!Array.isArray(data.addons)||!data.layout?.parts?.collections)throw Error();return data;}catch{throw Error('Wrong password or damaged backup. Nothing was imported.');}
 }
 const api={seal,open};if(typeof module==='object'&&module.exports)module.exports=api;else root.NuvioVaultCrypto=api;
})(typeof globalThis!=='undefined'?globalThis:this);
