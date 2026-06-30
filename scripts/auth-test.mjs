/**
 * Auth path smoke test (no Angular).
 *
 * Mocks the persisted storage + decodes the real register JWT to confirm that
 * AuthService would rebuild a usable AuthUser from a { token: '...' } response
 * via the WSFederation claim-URI fallback path.
 */
let store;
try { store = globalThis.localStorage; store.setItem('__t','1'); store.removeItem('__t'); }
catch { store = (() => { const m = new Map(); return { getItem:k=>m.get(k)??null, setItem:(k,v)=>m.set(k,String(v)), removeItem:k=>m.delete(k) }; })(); }
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

/** Mirror of AuthService.decodeTokenPayload (with WSFederation fallback). */
function decodeTokenPayload(token){
  try{
    const json=Buffer.from(token.split('.')[1],'base64').toString('utf8');
    const p=JSON.parse(json);
    const id=p['nameid']||p['sub']||p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']||'';
    const username=p['unique_name']||p['name']||p['preferred_username']||p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']||'';
    const displayName=p['given_name']||p['unique_name']||p['name']||p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname']||'';
    return {id,username,displayName};
  }catch{return {};}
}

/** Mirror of AuthService.normalizeAndStore for the { token } case only. */
function normalizeAndStore(res){
  store.setItem(TOKEN_KEY,res.token);
  let user;
  if(res.user&&res.user.username){user={...res.user};}
  else if(res.username){user={id:res.id??'',username:res.username,displayName:res.displayName??res.username,profileImageUrl:res.profileImageUrl};}
  else{
    const d=decodeTokenPayload(res.token);
    user={id:d.id??'',username:d.username??'',displayName:d.displayName??d.username??'',profileImageUrl:res.profileImageUrl};
  }
  store.setItem(USER_KEY,JSON.stringify(user));
  return user;
}

console.log('--- Auth path smoke ---');
const fakeToken='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjJlNzFhNzMwLTVkMTMtNDg4NC1hM2EwLTg5NjYwZmUyNzM0MyIsImV4cCI6MTc1NDI0MDE0NiwiaXNzIjoiaHR0cDovLzE5Mi4xNjguMS40NDo1MDAwIiwiYXVkIjoiaHR0cDovLzE5Mi4xNjguMS40NDo1MDAwIn0.abc';
const user=normalizeAndStore({token:fakeToken});
console.log('Built user :',JSON.stringify(user,null,2));
console.log('Stored token present?',!!store.getItem(TOKEN_KEY));
console.log('Stored user present?',!!store.getItem(USER_KEY));
const ok = user.id==='2e71a730-5d13-4884-a3a0-89660fe27343';
if(!ok){console.error('ASSERT FAIL: id path broken');process.exit(1);}
console.log('WSFederation id-path  : OK');
console.log('Note: JWT-fallback only extracts id; username/displayName rely on backend returning `user`/`username`.');
console.log('------------------------');
