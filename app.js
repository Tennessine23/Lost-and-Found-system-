/* ---------- Local data store ---------- */
const DB=(()=>{
 const KEY='eastlands_lost_found_v1',SESSION='eastlands_lost_found_session';
 let d=null,sessionId=null;
 const store={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v);return true}catch{return false}},del:k=>{try{localStorage.removeItem(k)}catch{}}};
 const fail=m=>{throw new Error(m)},save=()=>{if(!store.set(KEY,JSON.stringify(d)))fail('Your browser storage is full. Delete some reports or use smaller photos.')};
 const nextId=a=>a.reduce((m,x)=>Math.max(m,x.id||0),0)+1,iso=h=>new Date(Date.now()-h*36e5).toISOString();
 async function hash(p){
  try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('eastlands:'+p));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  catch{return 'p:'+btoa(unescape(encodeURIComponent(p)))}
 }
 const user=id=>d.users.find(u=>u.id===id),pub=u=>u&&{id:u.id,name:u.name,email:u.email,role:u.role},cur=()=>pub(user(sessionId));
 const needAdmin=()=>{const u=cur();if(!u||u.role!=='admin')fail('Administrators only.');return u},needUser=()=>cur()||fail('Please log in first.');
 const embed=i=>i&&{title:i.title,category:i.category,image_path:i.image_path,held_at:i.held_at},newest=(a,b)=>b.id-a.id;

 return{
  async init(){
   try{d=JSON.parse(store.get(KEY))}catch{}
   if(!d?.items||!d?.users){
    const it=(id,type,category,title,location,h,description='')=>({id,type,category,title,description,location,event_date:iso(h),held_at:type==='found'?'Security Desk':null,status:'open',user_id:'u0',reporter_name:'Campus Security',image_path:null,created_at:iso(h)});
    d={
     users:[{id:'u0',name:'Campus Security',email:'security@eastlands.ac.ke',role:'staff',hash:await hash(Math.random().toString(36)),created_at:iso(900)},{id:'u1',name:'Administrator',email:'admin@eastlands.ac.ke',role:'admin',hash:await hash('admin1234'),created_at:iso(900)}],
     items:[it(1,'lost','laptop','HP Laptop','Common Room',49),it(2,'lost','other','Blue water bottle','Cafeteria',48),it(3,'found','bag','Navy backpack','Electrical Workshop',31),it(4,'lost','keys','Car keys, red tag','Samsung Labs',30),it(5,'found','phone','Silver iPhone 13','Library',5),it(6,'found','wallet','Black leather wallet','Main Courtyard',2,'Brown-black wallet with a few cards inside. Details are kept private so only the real owner can describe them.')],
     claims:[]
    };
    store.set(KEY,JSON.stringify(d));
   }
   sessionId=store.get(SESSION);
  },
  currentUser:cur,
  async register({name,email,password,role}){
   if(d.users.some(u=>u.email===email))fail('An account with this email already exists.');
   const u={id:'u'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,email,role:role==='staff'?'staff':'student',hash:await hash(password),created_at:new Date().toISOString()};
   d.users.push(u);save();store.set(SESSION,sessionId=u.id);return pub(u);
  },
  async login(email,password){
   const u=d.users.find(x=>x.email===email);
   if(!u||u.hash!==await hash(password))fail('Incorrect email or password.');
   store.set(SESSION,sessionId=u.id);return pub(u);
  },
  logout(){sessionId=null;store.del(SESSION)},
  items({type='',category='',q='',limit=60}={}){
   const t=q.toLowerCase().trim();
   return d.items.filter(i=>i.status==='open'&&(!type||i.type===type)&&(!category||i.category===category)&&(!t||[i.title,i.description,i.location,i.category].some(v=>String(v||'').toLowerCase().includes(t)))).sort(newest).slice(0,limit);
  },
  item:id=>d.items.find(i=>i.id===id)||null,
  addItem(f){
   const u=needUser(),row={...f,id:nextId(d.items),description:'',status:'open',user_id:u.id,reporter_name:u.name,created_at:new Date().toISOString()};
   d.items.push(row);try{save()}catch(e){d.items.pop();throw e}return row;
  },
  myItems:uid=>d.items.filter(i=>i.user_id===uid).sort(newest),
  foundMatches:(uid,cats)=>d.items.filter(i=>i.type==='found'&&i.status==='open'&&i.user_id!==uid&&cats.includes(i.category)).sort(newest).slice(0,20),
  resolveItem(id){const u=needUser(),i=d.items.find(x=>x.id===id);if(!i||i.user_id!==u.id)fail('You do not have permission to do that.');i.status='returned';save()},
  claimFor:(itemId,uid)=>d.claims.find(c=>c.item_id===itemId&&c.user_id===uid)||null,
  myClaims:uid=>d.claims.filter(c=>c.user_id===uid).sort(newest).map(c=>({...c,items:embed(d.items.find(i=>i.id===c.item_id))})),
  submitClaim(itemId,message){
   const u=needUser(),i=d.items.find(x=>x.id===itemId);
   if(!i||i.type!=='found'||i.status!=='open')fail('This item is not available to claim.');
   if(i.user_id===u.id)fail('You cannot claim your own report.');
   if(message.trim().length<10)fail('Please write at least 10 characters.');
   if(d.claims.some(c=>c.item_id===itemId&&c.user_id===u.id))fail('You have already claimed this item.');
   d.claims.push({id:nextId(d.claims),item_id:itemId,user_id:u.id,message:message.trim(),status:'pending',admin_note:null,created_at:new Date().toISOString()});save();
  },
  profileStats:uid=>({reports:d.items.filter(i=>i.user_id===uid).length,open:d.items.filter(i=>i.user_id===uid&&i.status==='open').length,claims:d.claims.filter(c=>c.user_id===uid).length}),
  admin(){
   needAdmin();
   return{
    users:d.users.length,total:d.items.length,open:d.items.filter(i=>i.status==='open').length,returned:d.items.filter(i=>i.status==='returned').length,pending:d.claims.filter(c=>c.status==='pending').length,
    claims:[...d.claims].sort(newest).map(c=>{const u=user(c.user_id);return{...c,items:embed(d.items.find(i=>i.id===c.item_id)),profiles:u&&{name:u.name,email:u.email}}}),
    items:[...d.items].sort(newest).map(i=>{const u=user(i.user_id);return{...i,profiles:u&&{name:u.name,email:u.email}}})
   };
  },
  decideClaim(id,status,note){
   needAdmin();const c=d.claims.find(x=>x.id===id);
   if(!c)fail('Claim not found.');if(c.status!=='pending')fail('This claim has already been decided.');
   c.status=status;c.admin_note=note||null;
   if(status==='approved'){
    const i=d.items.find(x=>x.id===c.item_id);if(i)i.status='returned';
    d.claims.forEach(o=>{if(o.item_id===c.item_id&&o.status==='pending'&&o.id!==c.id){o.status='rejected';o.admin_note='Another claim for this item was approved.'}});
   }
   save();
  },
  setStatus(id,status){needAdmin();const i=d.items.find(x=>x.id===id);if(!i)fail('Item not found.');i.status=status==='returned'?'returned':'open';save()},
  deleteItem(id){needAdmin();d.items=d.items.filter(i=>i.id!==id);d.claims=d.claims.filter(c=>c.item_id!==id);save()}
 };
})();

const fileToDataUrl=file=>new Promise((res,rej)=>{
 const url=URL.createObjectURL(file),img=new Image();
 img.onload=()=>{
  const s=Math.min(1,800/img.width),c=document.createElement('canvas');
  c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',0.8));
 };
 img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('That image could not be read.'))};img.src=url;
});

/* ---------- Icons & Helpers ---------- */
const P={
 search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',pin:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
 plus:'<path d="M5 12h14M12 5v14"/>',home:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
 user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 back:'<path d="m15 18-6-6 6-6"/>',clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
 key:'<path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
 phone:'<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
 wallet:'<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
 bag:'<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
 other:'<path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4z"/><path d="M7 7h.01"/>',
 star:'<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
 camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
 help:'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
 shield:'<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
 check:'<path d="M20 6 9 17l-5-5"/>',bottle:'<path d="M10 2h4"/><path d="M10 2v3L8 8v13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V8l-2-3V2"/><path d="M8 12h8"/>',
 card:'<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
 laptop:'<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
 moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-15.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2M20 12h2m-15.07 7.07 1.41-1.41M17.66 6.34l1.41-1.41"/>'
};
const icon=(n,s=20,c='currentColor')=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||P.other}</svg>`;
const hydrate=(r=document)=>r.querySelectorAll('[data-icon]').forEach(e=>{e.insertAdjacentHTML('afterbegin',icon(e.dataset.icon,+e.dataset.size||20,e.dataset.color||'currentColor'));e.removeAttribute('data-icon')});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],cap=s=>s[0].toUpperCase()+s.slice(1);
const initials=n=>String(n||'?').split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();

function timeAgo(iso){
 const d=new Date(iso),s=(Date.now()-d)/1000;
 if(s<60)return 'Just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';
 if(s<172800)return 'Yesterday';if(s<2592000)return Math.floor(s/86400)+' days ago';
 return d.toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'});
}
function fmtWhen(iso){
 const d=new Date(iso),t=d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
 return d.toDateString()===new Date().toDateString()?'today · '+t:d.toLocaleDateString('en-KE',{weekday:'short',day:'numeric',month:'short'})+' · '+t;
}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2600)}

function askText({title,label,min=0,submit='Submit',placeholder=''}){
 return new Promise(res=>{
  const d=$('#dlg');
  d.innerHTML=`<form class="dlg-form"><h3>${esc(title)}</h3><label for="dlgText">${esc(label)}</label><textarea id="dlgText" maxlength="500" placeholder="${esc(placeholder)}"></textarea><p class="err" id="dlgErr"></p><div class="dlg-btns"><button type="button" class="btn outline" id="dlgCancel">Cancel</button><button class="btn primary" type="submit">${esc(submit)}</button></div></form>`;
  let done=false;const end=v=>{if(!done){done=true;res(v);if(d.open)d.close()}};
  d.querySelector('form').onsubmit=e=>{e.preventDefault();const v=$('#dlgText').value.trim();if(v.length<min)$('#dlgErr').textContent=`Please write at least ${min} characters.`;else end(v)};
  $('#dlgCancel').onclick=()=>end(null);d.addEventListener('close',()=>end(null),{once:true});d.showModal();$('#dlgText').focus();
 });
}

/* ---------- State & Views ---------- */
const CATS=[{k:'wallet',label:'Wallets',name:'Wallet',icon:'wallet'},{k:'phone',label:'Phones',name:'Phone',icon:'phone'},{k:'keys',label:'Keys',name:'Keys',icon:'key'},{k:'bag',label:'Bags',name:'Bag',icon:'bag'},{k:'laptop',label:'Laptops',name:'Laptop',icon:'laptop'},{k:'other',label:'Other',name:'Other',icon:'other'}];
const catBy=k=>CATS.find(c=>c.k===k)||CATS[5],HOME_CHIPS=[['','All'],['keys','Keys'],['phone','Phones'],['bag','Bags'],['wallet','Wallets']];
const NAV=[['home','Home','Home','home'],['browse','Browse items','Browse','search'],['report','Report an item','Report','plus'],['mine','My items','My items','list'],['profile','Profile','Profile','user']];
const mq=matchMedia('(min-width:900px)'),UP_HINT='Drag a file here or click to upload';
const state={hc:'',q:'',bt:'',bc:'',bq:'',kind:'found',cat:'wallet',am:'login',mt:'active',at:'claims',prefill:''};
let me=null,pendingNext=null,mineData={items:[],claims:[]},adminData={claims:[],items:[]};
const go=h=>location.hash==='#'+h?nav():location.hash=h;

const iconFor=i=>{const t=String(i.title||'').toLowerCase();return(!i.category||i.category==='other')?(/bottle|flask|tumbler/.test(t)?'bottle':/\bcard\b|\bid\b|atm/.test(t)?'card':'other'):catBy(i.category).icon};
const thumbHtml=(i,s)=>i.image_path?`<img src="${esc(i.image_path)}" alt="">`:icon(iconFor(i),s);
const card=i=>`<button class="card" data-open="${i.id}"><div class="thumb ${esc(i.type)}">${thumbHtml(i,32)}</div><div class="body"><div class="badge-line"><span class="badge ${esc(i.type)}">${cap(i.type)}</span><span class="when">${timeAgo(i.created_at)}</span></div><h3>${esc(i.title)}</h3><div class="meta">${icon('pin',14)}${esc(i.location)}<span class="mobile-time"> · ${timeAgo(i.created_at)}</span></div></div></button>`;

function setTheme(t){
 document.documentElement.dataset.theme=t;
 try{localStorage.setItem('eastlands_theme',t)}catch{}
 const dark=t==='dark';
 $('#themeBtn').innerHTML=`${icon(dark?'sun':'moon',18)}<span>${dark?'Light mode':'Dark mode'}</span>`;
 $('#themeBtnM').innerHTML=icon(dark?'sun':'moon',18);
}

function chrome(active){
 $('#helpTxt').textContent=active==='home'?'Visit the Operations office, Main Building. Open 8 AM – 6 PM.':'Visit the Security Office, Main Gate. Open 8 AM – 6 PM.';
 const lab=(k,l)=>k==='profile'&&!me?'Log in':l;
 $('#sideNav').innerHTML=NAV.map(([k,l,,i])=>`<a href="#${k}" class="${k===active?'on':''}">${icon(i,20)}${lab(k,l)}</a>`).join('')+(me?.role==='admin'?`<a href="#admin" class="${active==='admin'?'on':''}">${icon('shield',20)}Admin dashboard</a>`:'');
 $('#tabbar').innerHTML=NAV.map(([k,l,s,i])=>`<a href="#${k}" class="${k===active?'on':''} ${k==='report'?'report':''}"><span class="pill">${icon(i,22,k==='report'?'#fff':'currentColor')}</span>${lab(k,s)}</a>`).join('');
 $$('.user-slot').forEach(e=>e.innerHTML=me?`<a class="user" href="#profile"><span class="avatar">${esc(initials(me.name))}</span>${esc(me.name)}</a>`:'<a class="user" href="#profile"><span class="btn outline sm">Log in</span></a>');
 $('#greet').textContent=me?`Welcome back, ${me.name.split(' ')[0]}`:'Welcome to Eastlands College Lost & Found';
}

function loadHome(){
 const ch=HOME_CHIPS.map(([k,l])=>`<button class="chip ${k===state.hc?'on':''}" data-hc="${k}">${l}</button>`).join('');
 $('#chips').innerHTML=$('#chipsM').innerHTML=ch;
 const items=DB.items({category:state.hc,q:state.q,limit:6});
 const shown=(!mq.matches&&!state.q&&!state.hc)?items.slice(0,3):items;
 $('#list').innerHTML=shown.length?shown.map(card).join(''):`<p class="empty">${state.q||state.hc?'No items match your search.':'Nothing has been reported yet. Be the first!'}</p>`;
}

function loadBrowse(){
 $$('#typeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.type===state.bt));
 $('#bchips').innerHTML=[['','All'],...CATS.map(c=>[c.k,c.label])].map(([k,l])=>`<button class="chip ${k===state.bc?'on':''}" data-bc="${k}">${l}</button>`).join('');
 const items=DB.items({type:state.bt,category:state.bc,q:state.bq,limit:60});
 $('#bcount').textContent=`${items.length} item${items.length===1?'':'s'}`;
 $('#blist').innerHTML=items.length?items.map(card).join(''):'<p class="empty">No items match your search yet.</p>';
}

function showDetails(id){
 const box=$('#detailBody'),i=DB.item(+id);
 if(!i)return void(box.innerHTML='<p class="empty">This item could not be found.</p>');
 const found=i.type==='found',mine=me?.id===i.user_id,claim=(me&&found&&!mine)?DB.claimFor(i.id,me.id):null;
 let note='',action='';
 if(i.status==='returned')note=`<div class="note ok">${icon('check',20)}<span>This item has been returned to its owner.</span></div>`;
 else if(mine){note='<div class="note ok"><span>This is your report.</span></div>';action=`<button class="btn primary" data-act="resolve" data-id="${i.id}">${found?'Mark as returned':'I found it — close report'}</button>`;}
 else if(found&&claim){
  note=claim.status==='approved'?`<div class="note ok">${icon('check',20)}<span>Your claim was approved. Collect it from ${esc(i.held_at||'the Security Desk')} and bring your ID.${claim.admin_note?' Note: '+esc(claim.admin_note):''}</span></div>`
   :claim.status==='rejected'?`<div class="note"><span>Your claim was not approved.${claim.admin_note?' '+esc(claim.admin_note):''}</span></div>`
   :'<div class="note"><span>Your claim is waiting for an administrator to review it.</span></div>';
 }
 else if(found)action=`<button class="btn primary" data-act="claim" data-id="${i.id}">This is mine — Claim it</button><button class="btn ghost" data-act="message" aria-label="Message finder">${icon('msg',22)}<span>Message finder</span></button>`;
 else action=`<button class="btn primary" data-act="foundthis" data-id="${i.id}" data-title="${esc(i.title)}">I found this</button>`;

 const heldSub={'Security Desk':'Main Gate · Open until 6 PM','Library Front Desk':'Bring your student or staff ID','I still have it':'An administrator will arrange the handover'}[i.held_at]||'';
 const held=found&&i.held_at?`<div class="held"><span class="m-only">${icon('pin',20)}</span><span class="d-only">${icon('shield',24)}</span><div><b><span class="m-only">Held at ${esc(i.held_at)}</span><span class="d-only">Held safely at the ${esc(i.held_at)}</span></b><span>${esc(heldSub)}</span></div></div>`:'';
 box.innerHTML=`<div class="hero ${esc(i.type)}">${thumbHtml(i,100)}</div><div style="align-content:start"><div class="title-row"><h1>${esc(i.title)}</h1><span class="badge ${esc(i.type)}">${cap(i.type)}</span></div><div class="info"><div>${icon('pin',20)}${esc(i.location)}</div><div>${icon('clock',20)}${cap(i.type)} ${esc(fmtWhen(i.event_date))}</div><div>${icon('other',20)}${esc(catBy(i.category).label)}</div></div>${i.description?`<p class="desc">${esc(i.description)}</p>`:''}${held}${note}${action?`<div class="btns">${action}</div>`:''}</div>`;
 document.body.classList.toggle('on-details',!!action);
}

const localNow=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
function renderForm(){
 $$('#seg button').forEach(b=>b.classList.toggle('on',b.dataset.kind===state.kind));
 $('#whereLabel').textContent=state.kind==='lost'?'Where did you lose it?':'Where did you find it?';
 $('#catChips').innerHTML=CATS.map(c=>`<button type="button" class="chip ${c.k===state.cat?'on':''}" data-cat="${c.k}">${c.name}</button>`).join('');
}
function openReport(){
 renderForm();const w=$('#when');w.max=localNow();if(!w.value)w.value=localNow();
 if(state.prefill){$('#name').value=state.prefill;state.prefill=''}
 $('#formErr').textContent='';
}
async function submitReport(e){
 e.preventDefault();const btn=$('.submit'),err=$('#formErr');err.textContent='';
 if(!me)return void(pendingNext='report',go('profile'));
 const title=$('#name').value.trim(),loc=$('#where').value,file=$('#photo').files[0];
 if(title.length<2)return void(err.textContent='Please say what the item is.');
 if(!loc)return void(err.textContent='Please choose a campus location.');
 if(file&&!/^image\/(jpeg|png|webp)$/.test(file.type))return void(err.textContent='Only JPG, PNG or WebP images are allowed.');
 if(file&&file.size>3*1024*1024)return void(err.textContent='Image must be 3 MB or smaller.');
 btn.disabled=true;btn.textContent='Submitting…';
 try{
  const image_path=file?await fileToDataUrl(file):null;
  let when=new Date($('#when').value);if(isNaN(when)||when>new Date(Date.now()+864e5))when=new Date();
  const row=DB.addItem({type:state.kind,title,category:state.cat,location:loc,event_date:when.toISOString(),image_path,held_at:state.kind==='found'?'Security Desk':null});
  $('#form').reset();$('#upText').textContent='Add a photo';$('#upHint').textContent=UP_HINT;
  toast('Report submitted — thank you!');go('details/'+row.id);
 }catch(x){err.textContent=x.message}finally{btn.disabled=false;btn.textContent='Submit report'}
}

function loadMine(){
 const items=DB.myItems(me.id),claims=DB.myClaims(me.id),lostOpen=items.filter(i=>i.type==='lost'&&i.status==='open');
 const matches=lostOpen.length?DB.foundMatches(me.id,[...new Set(lostOpen.map(i=>i.category))]):[];
 mineData={items,claims,matches};
 const ok=claims.find(c=>c.status==='approved'),pend=claims.filter(c=>c.status==='pending').length;
 const words=t=>new Set(String(t||'').toLowerCase().match(/[a-z]{4,}/g)||[]);
 const pairs=matches.map(f=>({f,l:lostOpen.find(l=>l.category===f.category&&(f.category!=='other'||[...words(l.title)].some(w=>words(f.title).has(w))))})).filter(p=>p.l);
 const matchHtml=pairs.length?`<div class="match"><b>${icon('check',20)}${pairs.length} possible match${pairs.length>1?'es':''} found</b><p>Someone found an item that looks like your ${esc(pairs[0].l.title)}.</p><button class="btn" data-go="details/${pairs[0].f.id}">Review match</button></div>`:'';
 $('#mineBanner').innerHTML=matchHtml+(ok?`<div class="banner">${icon('check',20)}<div><b>Your claim was approved</b>Collect “${esc(ok.items?.title)}” from ${esc(ok.items?.held_at||'the Security Desk')}.</div></div>`:pend?`<div class="banner">${icon('clock',20)}<div><b>${pend} claim${pend>1?'s':''} awaiting review</b>An administrator will check your answers soon.</div></div>`:'');
 $$('[data-mt]').forEach(b=>b.classList.toggle('on',b.dataset.mt===state.mt));
 const list=items.filter(i=>(state.mt==='active')===(i.status==='open'));
 $('#mineList').innerHTML=list.length?list.map(i=>{const [t,k]=i.status==='returned'?['Returned','returned']:i.type==='lost'?['Searching','lost']:['Awaiting owner','found'];return `<button class="card flat" data-open="${i.id}"><div class="thumb ${esc(i.type)}">${thumbHtml(i,26)}</div><div class="body"><h3>${esc(i.title)}</h3><div class="meta">Reported ${timeAgo(i.created_at)}</div></div><span class="badge ${k}">${t}</span></button>`}).join(''):`<p class="empty">${state.mt==='active'?'You have no active reports.':'Nothing resolved yet.'}</p>`;
 $('#claimsWrap').innerHTML=claims.length?`<h2 class="sub-h">My claims</h2><div class="list">${claims.map(c=>`<button class="card flat" data-open="${c.item_id}"><div class="thumb found">${thumbHtml(c.items||{},26)}</div><div class="body"><h3>${esc(c.items?.title||'Item')}</h3><div class="meta">Claimed ${timeAgo(c.created_at)}</div></div><span class="badge ${esc(c.status)}">${cap(c.status)}</span></button>`).join('')}</div>`:'';
}

function loadProfile(){
 const box=$('#profileBody');
 if(!me){
  const reg=state.am==='register',f=(id,l,t,ex='')=>`<div class="field"><label for="${id}">${l}</label><div class="input"><input id="${id}" type="${t}" ${ex}></div></div>`;
  return void(box.innerHTML=`<div class="auth"><h1>${reg?'Create your account':'Welcome back'}</h1><p class="lead2">${reg?'Students and staff can report items and claim found ones.':'Log in to report items, claim belongings and track your reports.'}</p><div class="seg" id="authSeg"><button type="button" data-am="login" class="${reg?'':'on'}">Log in</button><button type="button" data-am="register" class="${reg?'on':''}">Create account</button></div><form id="authForm" class="form-col" novalidate>${reg?f('aname','Full name','text','autocomplete="name"'):''}${f('aemail','Email','email','autocomplete="email"')}${reg?'<div class="field"><label for="arole">I am a</label><div class="input"><select id="arole"><option value="student">Student</option><option value="staff">Staff member</option></select></div></div>':''}${f('apass','Password'+(reg?' (at least 8 characters)':''),'password',`autocomplete="${reg?'new-password':'current-password'}"`)}<p class="err" id="authErr" role="alert"></p><button class="btn primary" type="submit">${reg?'Create account':'Log in'}</button></form></div>`);
 }
 const st=DB.profileStats(me.id);
 box.innerHTML=`<div class="profile-wrap form-col"><div class="who"><span class="avatar big">${esc(initials(me.name))}</span><div><h1>${esc(me.name)}</h1><p class="lead2">${esc(me.email)}</p></div></div><span class="badge found role">${cap(me.role)}</span><div class="pstats"><div class="pstat"><b>${st.reports}</b>Reports</div><div class="pstat"><b>${st.open}</b>Still open</div><div class="pstat"><b>${st.claims}</b>Claims</div></div>${me.role==='admin'?'<button class="btn primary" data-go="admin">Admin dashboard</button>':''}<button class="btn ${me.role==='admin'?'outline':'primary'}" data-go="mine">My items &amp; claims</button><button class="btn outline" data-go="report">Report an item</button><button class="btn outline" data-act="logout">Log out</button></div>`;
}

async function submitAuth(e){
 e.preventDefault();const reg=state.am==='register',err=$('#authErr'),btn=$('#authForm button[type=submit]');err.textContent='';
 const email=$('#aemail').value.trim().toLowerCase(),password=$('#apass').value,name=reg?$('#aname').value.trim():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return void(err.textContent='Please enter a valid email address.');
 if(reg&&(name.length<2||name.length>80))return void(err.textContent='Please enter your full name.');
 if(reg&&password.length<8)return void(err.textContent='Password must be at least 8 characters.');
 if(!reg&&!password)return void(err.textContent='Please enter your password.');
 btn.disabled=true;
 try{
  if(reg)await DB.register({name,email,password,role:$('#arole').value});else await DB.login(email,password);
  me=DB.currentUser();toast(reg?'Welcome to Eastlands College Lost & Found!':'Logged in.');
  const next=pendingNext||'profile';pendingNext=null;go(next);
 }catch(x){err.textContent=x.message;btn.disabled=false}
}

function loadAdmin(){
 const A=DB.admin(),pc={};A.claims.forEach(c=>{if(c.status==='pending')pc[c.item_id]=(pc[c.item_id]||0)+1});
 A.claims.sort((a,b)=>(b.status==='pending')-(a.status==='pending'));
 adminData={claims:A.claims,items:A.items.map(i=>({...i,pending:pc[i.id]||0}))};
 const st=(n,l)=>`<div class="stat"><b>${n}</b>${l}</div>`;
 $('#aStats').innerHTML=st(A.pending,'Pending claims')+st(A.open,'Open reports')+st(A.returned,'Returned')+st(A.total,'Total reports')+st(A.users,'Users');
 $$('#aTabs button').forEach(b=>b.classList.toggle('on',b.dataset.atab===state.at));
 $('#aBody').innerHTML=state.at==='claims'
  ?(adminData.claims.length?adminData.claims.map(c=>`<div class="rowcard"><div class="thumb found sm">${thumbHtml(c.items||{},24)}</div><div class="main"><h3><a href="#details/${c.item_id}">${esc(c.items?.title||'Item')}</a> <span class="badge ${esc(c.status)}">${cap(c.status)}</span></h3><p class="meta2">Claimed by ${esc(c.profiles?.name||'Unknown')} (${esc(c.profiles?.email||'')}) · ${timeAgo(c.created_at)}</p><blockquote>${esc(c.message)}</blockquote>${c.admin_note?`<p class="meta2">Note: ${esc(c.admin_note)}</p>`:''}</div>${c.status==='pending'?`<div class="racts"><button class="btn primary sm" data-act="approve" data-id="${c.id}">Approve</button><button class="btn outline sm" data-act="reject" data-id="${c.id}">Reject</button></div>`:''}</div>`).join(''):'<p class="empty">No claims yet.</p>')
  :(adminData.items.length?adminData.items.map(i=>`<div class="rowcard"><div class="thumb ${esc(i.type)} sm">${thumbHtml(i,24)}</div><div class="main"><h3><a href="#details/${i.id}">${esc(i.title)}</a> <span class="badge ${esc(i.type)}">${cap(i.type)}</span></h3><p class="meta2">${esc(i.location)} · by ${esc(i.profiles?.name||'Unknown')} (${esc(i.profiles?.email||'')}) · ${timeAgo(i.created_at)}${i.pending?` · ${i.pending} pending claim${i.pending>1?'s':''}`:''}</p></div><div class="racts"><select class="sel" data-astatus="${i.id}" aria-label="Status"><option value="open" ${i.status==='open'?'selected':''}>Open</option><option value="returned" ${i.status==='returned'?'selected':''}>Returned</option></select><button class="btn danger sm" data-act="delete" data-id="${i.id}">Delete</button></div></div>`).join(''):'<p class="empty">No reports yet.</p>');
}

/* ---------- Router & Events ---------- */
function nav(){
 const raw=location.hash.slice(1)||'home';let [view,id]=raw.split('/');
 if(!['home','browse','details','report','mine','profile','admin'].includes(view)||(view==='details'&&!/^\d+$/.test(id||'')))view='home';
 if((view==='report'||view==='mine')&&!me)return void(pendingNext=raw,toast('Please log in first.'),go('profile'));
 if(view==='admin'&&me?.role!=='admin')return void(pendingNext=me?null:'admin',toast(me?'Administrators only.':'Please log in first.'),go(me?'home':'profile'));
 $$('.view').forEach(s=>s.classList.toggle('on',s.id===view));
 document.body.classList.remove('on-details');chrome(view==='details'?'browse':view);
 window.scrollTo(0,0);requestAnimationFrame(()=>window.scrollTo(0,0));
 ({home:loadHome,browse:()=>{$('#bq').value=state.bq;loadBrowse()},details:()=>showDetails(id),report:openReport,mine:loadMine,profile:loadProfile,admin:loadAdmin})[view]();
}

document.addEventListener('click',async e=>{
 const t=e.target.closest('[data-go],[data-open],[data-hc],[data-bc],[data-type],[data-cat],[data-kind],[data-am],[data-mt],[data-atab],[data-act]');if(!t)return;
 const d=t.dataset;
 try{
  if(d.kind&&(t.closest('#seg')||d.go)){state.kind=d.kind;renderForm()}
  if(d.go)go(d.go);else if(d.open)go('details/'+d.open);
  else if(d.hc!==undefined){state.hc=d.hc;loadHome()}else if(d.bc!==undefined){state.bc=d.bc;loadBrowse()}
  else if(d.type!==undefined){state.bt=d.type;loadBrowse()}else if(d.cat){state.cat=d.cat;renderForm()}
  else if(d.am){state.am=d.am;loadProfile()}else if(d.mt){state.mt=d.mt;loadMine()}else if(d.atab){state.at=d.atab;loadAdmin()}
  else if(d.act==='theme')setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
  else if(d.act==='message')toast('Direct messages are not available yet. Tap “This is mine — Claim it” and an administrator will connect you with the finder.');
  else if(d.act==='claim'){
   if(!me)return void(pendingNext='details/'+d.id,toast('Log in to claim an item.'),go('profile'));
   const msg=await askText({title:'Claim this item',label:'Describe something only the owner would know (colour, contents, marks).',min:10,submit:'Send claim',placeholder:'e.g. Brown leather, a student ID card and a 500 shilling note inside'});
   if(msg!==null){DB.submitClaim(+d.id,msg);toast('Claim sent. An administrator will review it.');nav()}
  }
  else if(d.act==='resolve'&&confirm('Close this report?')){DB.resolveItem(+d.id);toast('Report closed.');nav()}
  else if(d.act==='foundthis'){state.kind='found';state.prefill=d.title||'';go('report')}
  else if(d.act==='approve'){DB.decideClaim(+d.id,'approved',null);toast('Claim approved. Item marked returned.');loadAdmin()}
  else if(d.act==='reject'){const n=await askText({title:'Reject this claim',label:'Reason shown to the claimant (optional).',submit:'Reject claim'});if(n!==null){DB.decideClaim(+d.id,'rejected',n||null);toast('Claim rejected.');loadAdmin()}}
  else if(d.act==='delete'&&confirm('Delete this report and its claims permanently?')){DB.deleteItem(+d.id);toast('Report deleted.');loadAdmin()}
  else if(d.act==='logout'){DB.logout();me=null;pendingNext=null;toast('Logged out.');go('home')}
 }catch(err){toast(err.message)}
});

document.addEventListener('change',e=>{if(e.target.dataset?.astatus){try{DB.setStatus(+e.target.dataset.astatus,e.target.value);toast('Status updated.');loadAdmin()}catch(err){toast(err.message)}}});
let tq,tb;
$('#q').oninput=e=>{clearTimeout(tq);tq=setTimeout(()=>{state.q=e.target.value.trim();loadHome()},250)};
$('#bq').oninput=e=>{clearTimeout(tb);tb=setTimeout(()=>{state.bq=e.target.value.trim();loadBrowse()},250)};
$('#form').onsubmit=submitReport;
document.addEventListener('submit',e=>{if(e.target.id==='authForm')submitAuth(e)});
$('#photo').onchange=e=>{const f=e.target.files[0];$('#upText').textContent=f?f.name:'Add a photo';$('#upHint').textContent=f?`${Math.max(1,Math.round(f.size/1024))} KB · click to change`:UP_HINT};

history.scrollRestoration='manual';
addEventListener('load',()=>{scrollTo(0,0);setTimeout(()=>scrollTo(0,0),0)});

const box=$('.upload');
['dragenter','dragover'].forEach(t=>box.addEventListener(t,e=>{e.preventDefault();box.classList.add('drag')}));
['dragleave','drop'].forEach(t=>box.addEventListener(t,e=>{e.preventDefault();box.classList.remove('drag')}));
box.ondrop=e=>{const f=e.dataTransfer?.files[0];if(f){const dt=new DataTransfer();dt.items.add(f);$('#photo').files=dt.files;$('#photo').dispatchEvent(new Event('change'))}};

const ph=()=>{$('#q').placeholder=mq.matches?'Search':'Search keys, phone, wallet…'};
mq.addEventListener('change',()=>{ph();if($('#home').classList.contains('on'))loadHome()});

(async()=>{
 hydrate();
 setTheme((()=>{try{return localStorage.getItem('eastlands_theme')}catch{}})()||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'));
 ph();renderForm();
 try{await DB.init();me=DB.currentUser()}catch(e){console.error(e)}
 addEventListener('hashchange',nav);nav();
})();
