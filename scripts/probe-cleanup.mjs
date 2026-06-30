// Delete the 3 probe rants created during the create-body investigation.
const B='http://192.168.1.44:5000/api';
const T=(await (await fetch(B+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'hausenlot',password:'12341234'})})).json()).token;
const home=await (await fetch(B+'/timelines/home?page=1&pageSize=20',{headers:{Authorization:'Bearer '+T}})).json();
const probe = home.filter(r=>r.content==='multipart lowercase content'||r.content==='multipart capital Content'||r.content==='urlencoded capital');
console.log('probe rants to clean:',probe.length);
for(const r of probe){const res=await fetch(B+'/rants/'+r.id,{method:'DELETE',headers:{Authorization:'Bearer '+T}});console.log('delete',r.id.slice(0,8),'=>',res.status);}
