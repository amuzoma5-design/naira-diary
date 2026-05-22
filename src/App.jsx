import { useState, useEffect, useRef } from "react";

/* ── Supabase config ───────────────────────────────────────── */
const URL_BASE = "https://kprlkyrdwoizegtyvpkf.supabase.co";
const ANON_KEY = "sb_publishable_he1ER6NX7fya6FoJztTOng_LhDoxBWx";

const authHeaders = (token) => ({
  "Content-Type": "application/json",
  "apikey": ANON_KEY,
  "Authorization": `Bearer ${token || ANON_KEY}`,
});

/* ── Supabase Auth helpers ─────────────────────────────────── */
const supa = {
  async signUp(email, password) {
    const r = await fetch(`${URL_BASE}/auth/v1/signup`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },
  async signIn(email, password) {
    const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },
  async signOut(token) {
    await fetch(`${URL_BASE}/auth/v1/logout`, {
      method: "POST",
      headers: authHeaders(token),
    });
  },
  async getTxns(token, userId) {
    const r = await fetch(
      `${URL_BASE}/rest/v1/transactions?user_id=eq.${userId}&order=date.desc`,
      { headers: authHeaders(token) }
    );
    return r.json();
  },
  async insertTxn(token, entry) {
    const r = await fetch(`${URL_BASE}/rest/v1/transactions`, {
      method: "POST",
      headers: { ...authHeaders(token), "Prefer": "return=representation" },
      body: JSON.stringify(entry),
    });
    const data = await r.json();
    return Array.isArray(data) ? data[0] : data;
  },
  async deleteTxn(token, id) {
    await fetch(`${URL_BASE}/rest/v1/transactions?id=eq.${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
  },
};

/* ── Session storage ───────────────────────────────────────── */
const SESSION_KEY = "nd_session";
const saveSession = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
const loadSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } };
const clearSession = () => localStorage.removeItem(SESSION_KEY);

/* ── Global styles ─────────────────────────────────────────── */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
    body{background:#F0F2F5;}
    textarea:focus,input:focus{outline:none;}
    button{cursor:pointer;font-family:inherit;}
    ::-webkit-scrollbar{width:0;}
    @keyframes slideUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
    @keyframes pop{0%{transform:scale(0.93);opacity:0;}60%{transform:scale(1.03);}100%{transform:scale(1);opacity:1;}}
    @keyframes toastIn{from{opacity:0;transform:translate(-50%,10px);}to{opacity:1;transform:translate(-50%,0);}}
    @keyframes spin{to{transform:rotate(360deg);}}
    .slide-up{animation:slideUp 0.3s ease both;}
    .pop-in{animation:pop 0.26s ease both;}
  `}</style>
);

/* ── Colours ───────────────────────────────────────────────── */
const C = {
  bg:"#F0F2F5", white:"#FFFFFF",
  blue:"#1877F2", blueLight:"#E7F0FF",
  text:"#1C1E21", sub:"#65676B", border:"#E4E6EB",
  green:"#31A24C", red:"#FA3E3E",
};

/* ── Categorisation ────────────────────────────────────────── */
const RULES = [
  {kw:["transport","taxi","uber","bolt","bus","keke","okada","ride","fare","fuel","petrol"],cat:"Transport",icon:"🚌"},
  {kw:["food","eat","lunch","dinner","breakfast","rice","chicken","suya","puff","buka","restaurant","snack","drink","soup","eba","amala","shawarma","indomie"],cat:"Food",icon:"🍛"},
  {kw:["data","airtime","recharge","glo","mtn","airtel","9mobile","internet","wifi","netflix","dstv","gotv"],cat:"Data/Airtime",icon:"📱"},
  {kw:["give","gave","sent","send","transfer","lend","help","borrow","support"],cat:"Giving",icon:"🤲"},
  {kw:["church","tithe","offering","seed","mosque","prayer","pastor"],cat:"Church",icon:"🙏"},
  {kw:["hair","salon","braids","weave","locs","barber","cut","nails","beauty","makeup","spa"],cat:"Hair/Beauty",icon:"💇"},
  {kw:["shop","clothes","shoe","bag","dress","shirt","trouser","market","fashion","fabric","bought"],cat:"Shopping",icon:"🛍️"},
  {kw:["bill","rent","light","nepa","electricity","water","tax","school","fee"],cat:"Bills",icon:"🧾"},
  {kw:["medicine","pharmacy","doctor","hospital","drugs","clinic","health"],cat:"Health",icon:"💊"},
];
function categorise(text) {
  const t = text.toLowerCase();
  for (const r of RULES) if (r.kw.some(k=>t.includes(k))) return {cat:r.cat,icon:r.icon};
  return {cat:"Miscellaneous",icon:"📦"};
}
function parseInput(raw) {
  const text = raw.trim();
  const m = text.match(/[\d,]+(?:\.\d+)?/);
  const amount = m ? parseFloat(m[0].replace(/,/g,"")) : null;
  const note = text.replace(/[\d,]+(?:\.\d+)?/,"").replace(/\b(spent|on|for|bought)\b/gi,"").replace(/[₦#]/g,"").trim() || text;
  const {cat,icon} = categorise(text);
  return {amount,note,cat,icon};
}

/* ── Helpers ───────────────────────────────────────────────── */
const sameDay  = (a,b) => new Date(a).toDateString()===new Date(b).toDateString();
const weekStart = d=>{const x=new Date(d);const day=x.getDay();x.setDate(x.getDate()-(day===0?6:day-1));x.setHours(0,0,0,0);return x;};
const sameWeek = (a,b) => weekStart(a).getTime()===weekStart(b).getTime();
const fmtNaira = n=>"₦"+Number(n).toLocaleString("en-NG",{maximumFractionDigits:0});
const fmtTime  = iso=>new Date(iso).toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit"});
const fmtDate  = iso=>new Date(iso).toLocaleDateString("en-NG",{weekday:"short",month:"short",day:"numeric"});

/* ── Spinner ───────────────────────────────────────────────── */
const Spinner = ({size=20,color=C.blue})=>(
  <div style={{width:size,height:size,border:`2.5px solid ${color}33`,borderTopColor:color,borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>
);

/* ── Toast ─────────────────────────────────────────────────── */
function Toast({msg,visible,isError}){
  if(!visible) return null;
  return(
    <div style={{position:"fixed",bottom:100,left:"50%",background:isError?C.red:C.green,color:"#fff",padding:"10px 22px",borderRadius:30,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,fontWeight:700,boxShadow:"0 4px 16px rgba(0,0,0,0.2)",zIndex:200,whiteSpace:"nowrap",animation:"toastIn 0.25s ease both"}}>
      {isError?"⚠️ ":"✓ "}{msg}
    </div>
  );
}

/* ── AUTH SCREEN ───────────────────────────────────────────── */
function AuthScreen({onAuth}){
  const [mode,setMode]     = useState("login");
  const [email,setEmail]   = useState("");
  const [pass,setPass]     = useState("");
  const [loading,setLoad]  = useState(false);
  const [msg,setMsg]       = useState({text:"",ok:false});
  const [focusF,setFocusF] = useState("");

  const handle = async()=>{
    if(!email||!pass) return setMsg({text:"Please fill in all fields.",ok:false});
    setLoad(true); setMsg({text:"",ok:false});
    if(mode==="signup"){
      const res = await supa.signUp(email,pass);
      if(res.error) setMsg({text:res.error.message||"Sign up failed.",ok:false});
      else setMsg({text:"Check your email to confirm, then log in.",ok:true});
      setMode("login");
    } else {
      const res = await supa.signIn(email,pass);
      if(res.error||!res.access_token) setMsg({text:res.error?.message||"Login failed. Check your credentials.",ok:false});
      else {
        const session = {token:res.access_token, user:{id:res.user.id, email:res.user.email}};
        saveSession(session);
        onAuth(session);
      }
    }
    setLoad(false);
  };

  const inp = focused=>({
    width:"100%",background:focused?"#F0F7FF":C.bg,
    border:`2px solid ${focused?C.blue:C.border}`,
    borderRadius:12,padding:"13px 14px",
    fontSize:15,color:C.text,
    fontFamily:"'DM Sans',sans-serif",fontWeight:500,
    transition:"border-color 0.2s,background 0.2s",
  });

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",fontFamily:"'DM Sans',sans-serif"}}>
      <GlobalStyles/>
      <div style={{marginBottom:32,textAlign:"center"}}>
        <p style={{fontFamily:"'Plus Jakarta Sans'",fontSize:32,fontWeight:800,color:C.text,letterSpacing:"-1px"}}>
          Naira<span style={{color:C.blue}}>Diary</span>
        </p>
        <p style={{fontSize:14,color:C.sub,marginTop:6}}>Your daily money journal</p>
      </div>

      <div style={{width:"100%",maxWidth:400,background:C.white,borderRadius:20,padding:"28px 24px",boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
        <h2 style={{fontFamily:"'Plus Jakarta Sans'",fontSize:20,fontWeight:800,color:C.text,marginBottom:22}}>
          {mode==="login"?"Welcome back 👋":"Create account"}
        </h2>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:600,color:C.sub,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.6px"}}>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onFocus={()=>setFocusF("e")} onBlur={()=>setFocusF("")} placeholder="you@example.com" style={inp(focusF==="e")}/>
        </div>

        <div style={{marginBottom:20}}>
          <label style={{fontSize:12,fontWeight:600,color:C.sub,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.6px"}}>Password</label>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onFocus={()=>setFocusF("p")} onBlur={()=>setFocusF("")} onKeyDown={e=>e.key==="Enter"&&handle()} placeholder="••••••••" style={inp(focusF==="p")}/>
        </div>

        {msg.text&&<p style={{fontSize:13,color:msg.ok?C.green:C.red,marginBottom:14,fontWeight:500}}>{msg.text}</p>}

        <button onClick={handle} disabled={loading} style={{width:"100%",padding:"15px",background:loading?C.border:C.blue,border:"none",borderRadius:12,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:15,fontWeight:700,color:loading?"#999":"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:10,transition:"background 0.2s"}}>
          {loading&&<Spinner size={18} color="#999"/>}
          {loading?"Please wait…":mode==="login"?"Log In":"Sign Up"}
        </button>

        <p style={{textAlign:"center",marginTop:18,fontSize:14,color:C.sub}}>
          {mode==="login"?"Don't have an account? ":"Already have an account? "}
          <span onClick={()=>{setMode(mode==="login"?"signup":"login");setMsg({text:"",ok:false});}} style={{color:C.blue,fontWeight:700,cursor:"pointer"}}>
            {mode==="login"?"Sign Up":"Log In"}
          </span>
        </p>
      </div>
    </div>
  );
}

/* ── TXN ROW ───────────────────────────────────────────────── */
function TxnRow({t,onDelete}){
  const [hover,setHover]     = useState(false);
  const [deleting,setDel]    = useState(false);
  return(
    <div className="slide-up" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{display:"flex",alignItems:"center",gap:12,background:hover?"#F7F8FA":C.white,borderRadius:14,padding:"13px 14px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",transition:"background 0.15s"}}>
      <div style={{width:44,height:44,borderRadius:12,background:C.blueLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{t.icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize:14,fontWeight:600,color:C.text,textTransform:"capitalize",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.note}</p>
        <div style={{display:"flex",gap:8,marginTop:3,alignItems:"center"}}>
          <span style={{fontSize:12,color:C.blue,fontWeight:500}}>{t.cat}</span>
          <span style={{fontSize:11,color:C.sub}}>·</span>
          <span style={{fontSize:11,color:C.sub}}>{fmtTime(t.date)}</span>
        </div>
      </div>
      <p style={{fontFamily:"'Plus Jakarta Sans'",fontSize:15,fontWeight:700,color:C.text,flexShrink:0}}>{fmtNaira(t.amount)}</p>
      <button onClick={async()=>{setDel(true);await onDelete(t.id);}} style={{background:"none",border:"none",color:hover?C.red:C.border,fontSize:16,padding:"4px 2px",transition:"color 0.15s",flexShrink:0}}>
        {deleting?<Spinner size={14} color={C.red}/>:"✕"}
      </button>
    </div>
  );
}

/* ── ADD SCREEN ────────────────────────────────────────────── */
function AddScreen({session,onSave}){
  const [text,setText]       = useState("");
  const [focused,setFocused] = useState(false);
  const [preview,setPreview] = useState(null);
  const [saving,setSaving]   = useState(false);
  const ref = useRef();

  useEffect(()=>{
    if(text.trim().length>2){const p=parseInput(text);setPreview(p.amount?p:null);}
    else setPreview(null);
  },[text]);

  const examples=["Spent 2000 on transport","Bought rice 5500","Airtime 500 MTN","Tithe 10000","Suya 1500"];

  const handleSave=async()=>{
    if(!preview||saving) return;
    setSaving(true);
    await onSave({user_id:session.user.id,amount:preview.amount,note:preview.note,cat:preview.cat,icon:preview.icon,raw:text,date:new Date().toISOString()});
    setText(""); setPreview(null); setSaving(false);
    ref.current?.focus();
  };

  return(
    <div style={{padding:"0 16px"}}>
      <div style={{background:C.white,borderRadius:18,padding:"22px 18px 18px",boxShadow:"0 2px 12px rgba(0,0,0,0.07)",marginBottom:14}}>
        <p style={{fontSize:11,fontWeight:700,color:C.blue,letterSpacing:"1.2px",textTransform:"uppercase",marginBottom:12}}>What did you spend on?</p>
        <textarea ref={ref} autoFocus value={text} onChange={e=>setText(e.target.value)} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSave();}}} placeholder="e.g. Spent 2000 on transport" rows={3}
          style={{width:"100%",background:focused?"#F0F7FF":C.bg,border:`2px solid ${focused?C.blue:C.border}`,borderRadius:12,padding:"13px 14px",fontSize:16,color:C.text,fontFamily:"'DM Sans',sans-serif",fontWeight:500,lineHeight:1.55,resize:"none",transition:"border-color 0.2s,background 0.2s"}}/>

        {preview&&(
          <div className="pop-in" style={{display:"flex",alignItems:"center",gap:12,background:C.blueLight,borderRadius:12,padding:"12px 14px",marginTop:12}}>
            <span style={{fontSize:24}}>{preview.icon}</span>
            <div>
              <p style={{fontFamily:"'Plus Jakarta Sans'",fontSize:18,fontWeight:800,color:C.blue}}>{fmtNaira(preview.amount)}</p>
              <p style={{fontSize:12,color:"#4A80D4",marginTop:1,textTransform:"capitalize"}}>{preview.cat} · {preview.note}</p>
            </div>
          </div>
        )}

        <button onClick={handleSave} disabled={!preview||saving} style={{width:"100%",marginTop:14,padding:"15px",background:preview&&!saving?C.blue:C.border,border:"none",borderRadius:12,fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:15,fontWeight:700,color:preview&&!saving?"#fff":C.sub,display:"flex",alignItems:"center",justifyContent:"center",gap:10,transition:"background 0.2s"}}>
          {saving&&<Spinner size={18} color={C.sub}/>}
          {saving?"Saving…":"Log Expense"}
        </button>
      </div>

      <p style={{fontSize:11,fontWeight:600,color:C.sub,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:10,paddingLeft:4}}>Quick examples</p>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {examples.map(ex=>(
          <button key={ex} onClick={()=>setText(ex)} style={{background:C.white,border:`1.5px solid ${C.border}`,borderRadius:20,padding:"7px 13px",fontSize:12,color:C.sub,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>{ex}</button>
        ))}
      </div>
    </div>
  );
}

/* ── TODAY SCREEN ──────────────────────────────────────────── */
function TodayScreen({txns,onDelete,loading}){
  const now=new Date();
  const todayTxns=txns.filter(t=>sameDay(t.date,now)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const total=todayTxns.reduce((s,t)=>s+t.amount,0);
  return(
    <div style={{padding:"0 16px"}}>
      <div style={{background:C.blue,borderRadius:18,padding:"20px",marginBottom:16,boxShadow:"0 4px 16px rgba(24,119,242,0.3)"}}>
        <p style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.75)",letterSpacing:"0.8px",textTransform:"uppercase"}}>Today's Total</p>
        <p style={{fontFamily:"'Plus Jakarta Sans'",fontSize:36,fontWeight:800,color:"#fff",letterSpacing:"-1px",marginTop:4}}>{fmtNaira(total)}</p>
        <p style={{fontSize:12,color:"rgba(255,255,255,0.65)",marginTop:4}}>
          {todayTxns.length} transaction{todayTxns.length!==1?"s":""} · {now.toLocaleDateString("en-NG",{weekday:"long",month:"long",day:"numeric"})}
        </p>
      </div>
      {loading?<div style={{display:"flex",justifyContent:"center",padding:"40px"}}><Spinner size={32}/></div>
      :todayTxns.length===0?
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <p style={{fontSize:44,marginBottom:14}}>📭</p>
          <p style={{fontFamily:"'Plus Jakarta Sans'",fontSize:18,fontWeight:700,color:C.sub}}>Nothing logged yet</p>
          <p style={{fontSize:13,color:C.sub,marginTop:6}}>Tap ➕ Add to log your first expense today</p>
        </div>
      :todayTxns.map(t=><TxnRow key={t.id} t={t} onDelete={onDelete}/>)}
    </div>
  );
}

/* ── INSIGHTS SCREEN ───────────────────────────────────────── */
function InsightsScreen({txns,loading}){
  const now=new Date();
  const todayTotal=txns.filter(t=>sameDay(t.date,now)).reduce((s,t)=>s+t.amount,0);
  const weekTxns=txns.filter(t=>sameWeek(t.date,now));
  const weekTotal=weekTxns.reduce((s,t)=>s+t.amount,0);
  const catMap={};
  for(const t of weekTxns){if(!catMap[t.cat])catMap[t.cat]={total:0,icon:t.icon};catMap[t.cat].total+=t.amount;}
  const cats=Object.entries(catMap).map(([name,v])=>({name,...v})).sort((a,b)=>b.total-a.total);
  const maxCat=cats[0]?.total||1;
  const days={};
  txns.forEach(t=>{const d=fmtDate(t.date);if(!days[d])days[d]=0;days[d]+=t.amount;});
  const recentDays=Object.entries(days).slice(0,5);

  if(loading) return <div style={{display:"flex",justifyContent:"center",padding:"60px"}}><Spinner size={32}/></div>;

  return(
    <div style={{padding:"0 16px"}}>
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        {[["Today",fmtNaira(todayTotal),"spent so far"],["This week",fmtNaira(weekTotal),"Mon – Sun"]].map(([label,val,sub])=>(
          <div key={label} style={{flex:1,background:C.white,borderRadius:16,padding:"16px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
            <p style={{fontSize:11,fontWeight:600,color:C.sub,textTransform:"uppercase",letterSpacing:"0.7px"}}>{label}</p>
            <p style={{fontFamily:"'Plus Jakarta Sans'",fontSize:22,fontWeight:800,color:C.blue,marginTop:6,letterSpacing:"-0.5px"}}>{val}</p>
            <p style={{fontSize:11,color:C.sub,marginTop:3}}>{sub}</p>
          </div>
        ))}
      </div>

      {cats[0]&&(
        <div className="slide-up" style={{background:C.blueLight,border:`1.5px solid ${C.blue}22`,borderRadius:16,padding:"16px 18px",marginBottom:14,display:"flex",gap:12,alignItems:"center"}}>
          <span style={{fontSize:28}}>{cats[0].icon}</span>
          <p style={{fontSize:14,color:C.text,lineHeight:1.55,fontWeight:500}}>
            You spent most on <span style={{color:C.blue,fontWeight:700}}>{cats[0].name}</span> this week — <span style={{fontWeight:700}}>{fmtNaira(cats[0].total)}</span>
          </p>
        </div>
      )}

      {cats.length>0&&(
        <>
          <p style={{fontSize:11,fontWeight:700,color:C.sub,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:10}}>This week by category</p>
          {cats.map(c=>(
            <div key={c.name} style={{background:C.white,borderRadius:14,padding:"14px 16px",marginBottom:8,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>{c.icon}</span>
                  <span style={{fontSize:14,fontWeight:600,color:C.text}}>{c.name}</span>
                </div>
                <span style={{fontFamily:"'Plus Jakarta Sans'",fontSize:14,fontWeight:700,color:C.blue}}>{fmtNaira(c.total)}</span>
              </div>
              <div style={{height:6,background:C.bg,borderRadius:6,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:6,background:`linear-gradient(90deg,${C.blue},#42a5f5)`,width:`${(c.total/maxCat)*100}%`,transition:"width 0.9s ease"}}/>
              </div>
            </div>
          ))}
        </>
      )}

      {recentDays.length>0&&(
        <>
          <p style={{fontSize:11,fontWeight:700,color:C.sub,letterSpacing:"0.8px",textTransform:"uppercase",margin:"18px 0 10px"}}>Daily history</p>
          {recentDays.map(([day,amt])=>(
            <div key={day} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.white,borderRadius:12,padding:"12px 16px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
              <p style={{fontSize:14,color:C.sub,fontWeight:500}}>{day}</p>
              <p style={{fontFamily:"'Plus Jakarta Sans'",fontSize:14,fontWeight:700,color:C.text}}>{fmtNaira(amt)}</p>
            </div>
          ))}
        </>
      )}

      {txns.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <p style={{fontSize:44,marginBottom:14}}>📊</p>
          <p style={{fontFamily:"'Plus Jakarta Sans'",fontSize:18,fontWeight:700,color:C.sub}}>No data yet</p>
          <p style={{fontSize:13,color:C.sub,marginTop:6}}>Start logging expenses to see your insights</p>
        </div>
      )}
    </div>
  );
}

/* ── BOTTOM NAV ────────────────────────────────────────────── */
const TABS=[{id:"add",label:"Add",icon:"➕"},{id:"today",label:"Today",icon:"📒"},{id:"insights",label:"Insights",icon:"📊"}];
function BottomNav({active,onChange}){
  return(
    <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"#fff",borderTop:`1px solid ${C.border}`,display:"flex",zIndex:50}}>
      {TABS.map(tab=>{
        const isActive=tab.id===active;
        return(
          <button key={tab.id} onClick={()=>onChange(tab.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"11px 0 10px",background:"none",border:"none",color:isActive?C.blue:C.sub,transition:"color 0.15s",position:"relative"}}>
            <span style={{fontSize:20,lineHeight:1}}>{tab.icon}</span>
            <span style={{fontSize:11,fontWeight:isActive?700:500,fontFamily:"'DM Sans',sans-serif",marginTop:4}}>{tab.label}</span>
            {isActive&&<div style={{position:"absolute",bottom:0,width:36,height:3,background:C.blue,borderRadius:"3px 3px 0 0"}}/>}
          </button>
        );
      })}
    </nav>
  );
}

/* ── APP ROOT ──────────────────────────────────────────────── */
export default function NairaDiary(){
  const [session,setSession] = useState(null);
  const [txns,setTxns]       = useState([]);
  const [tab,setTab]         = useState("add");
  const [loading,setLoading] = useState(true);
  const [toast,setToast]     = useState({msg:"",visible:false,isError:false});

  const showToast=(msg,isError=false)=>{
    setToast({msg,visible:true,isError});
    setTimeout(()=>setToast(t=>({...t,visible:false})),2200);
  };

  /* restore session on mount */
  useEffect(()=>{
    const saved=loadSession();
    if(saved){setSession(saved);}
    else setLoading(false);
  },[]);

  /* load txns when session available */
  useEffect(()=>{
    if(!session) return;
    setLoading(true);
    supa.getTxns(session.token,session.user.id).then(data=>{
      if(Array.isArray(data)) setTxns(data);
      else showToast("Could not load data",true);
      setLoading(false);
    });
  },[session]);

  const handleAuth=(s)=>{ setSession(s); };

  const handleSave=async(entry)=>{
    const saved=await supa.insertTxn(session.token,entry);
    if(saved?.id){ setTxns(prev=>[saved,...prev]); showToast("Saved!"); setTimeout(()=>setTab("today"),500); }
    else showToast("Failed to save",true);
  };

  const handleDelete=async(id)=>{
    await supa.deleteTxn(session.token,id);
    setTxns(prev=>prev.filter(t=>t.id!==id));
    showToast("Deleted");
  };

  const handleLogout=async()=>{
    if(session) await supa.signOut(session.token);
    clearSession(); setSession(null); setTxns([]);
  };

  if(!session) return <><GlobalStyles/><AuthScreen onAuth={handleAuth}/></>;

  const totalAll=txns.reduce((s,t)=>s+t.amount,0);

  return(
    <div style={{fontFamily:"'DM Sans',sans-serif",background:C.bg,minHeight:"100vh",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column",color:C.text,position:"relative"}}>
      <GlobalStyles/>

      <header style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"14px 20px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:40,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div>
          <p style={{fontFamily:"'Plus Jakarta Sans'",fontSize:20,fontWeight:800,color:C.text,letterSpacing:"-0.4px",lineHeight:1}}>
            Naira<span style={{color:C.blue}}>Diary</span>
          </p>
          <p style={{fontSize:11,color:C.sub,marginTop:2,fontWeight:500,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {session.user.email}
          </p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{background:C.blueLight,borderRadius:12,padding:"8px 14px",textAlign:"center"}}>
            <p style={{fontSize:11,color:C.blue,fontWeight:600,letterSpacing:"0.5px",textTransform:"uppercase"}}>Total</p>
            <p style={{fontFamily:"'Plus Jakarta Sans'",fontSize:15,fontWeight:800,color:C.blue,marginTop:2}}>{fmtNaira(totalAll)}</p>
          </div>
          <button onClick={handleLogout} style={{background:"none",border:`1.5px solid ${C.border}`,borderRadius:10,padding:"8px 12px",fontSize:13,color:C.sub,fontWeight:600}}>
            Out
          </button>
        </div>
      </header>

      <div style={{padding:"18px 20px 12px"}}>
        <h1 style={{fontFamily:"'Plus Jakarta Sans'",fontSize:22,fontWeight:800,color:C.text,letterSpacing:"-0.5px"}}>
          {tab==="add"?"Log Expense":tab==="today"?"Today's Log":"Insights"}
        </h1>
      </div>

      <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
        {tab==="add"      &&<AddScreen session={session} onSave={handleSave}/>}
        {tab==="today"    &&<TodayScreen txns={txns} onDelete={handleDelete} loading={loading}/>}
        {tab==="insights" &&<InsightsScreen txns={txns} loading={loading}/>}
      </div>

      <Toast msg={toast.msg} visible={toast.visible} isError={toast.isError}/>
      <BottomNav active={tab} onChange={setTab}/>
    </div>
  );
}
