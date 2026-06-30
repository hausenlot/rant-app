// Test whether the create endpoint binds from multipart or expects a different wire shape.
const B = 'http://192.168.1.44:5000/api';
const T = (await ( await fetch(B + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'hausenlot', password:'12341234' }) }) ).json()).token;
const base = { Authorization:'Bearer '+T };
async function t(label,m,p,body,extraHeaders){
  const headers = { ...base, ...(extraHeaders||{}) };
  const res = await fetch(B+p,{method:m,headers,body});
  const raw = await res.text();
  console.log(label,'=>',res.status, raw.slice(0,260));
  return {status:res.status,raw};
}
// (A) multipart with field 'content' (lowercase)
const fdA = new FormData(); fdA.append('content','multipart lowercase content');
await t('[A] multipart content=lowercase','POST','/rants',fdA);
// (B) multipart with field 'Content' (capital)
const fdB = new FormData(); fdB.append('Content','multipart capital Content');
await t('[B] multipart Content=capital','POST','/rants',fdB);
// (C) x-www-form-urlencoded
const bodyC = new URLSearchParams({ Content:'urlencoded capital' }).toString();
await t('[C] urlencoded Content','POST','/rants',bodyC,{'Content-Type':'application/x-www-form-urlencoded'});
// (D) raw text/plain for Content
await t('[D] plain Content capital','POST','/rants',JSON.stringify({ Content:'raw json Content' }));
