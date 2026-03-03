'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../../firebase";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";

const PROFESSIONALS = [{ name: "Jesús" }, { name: "Lancas" }, { name: "Eddy" }];
const ADMIN_PASSWORD = "admin123";

function generateSlots() {
  const s = [];
  for (let h = 10; h < 21; h++)
    for (let m = 0; m < 60; m += 15)
      s.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
  return s;
}
const ALL_SLOTS = generateSlots();

function useFirebaseData() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db,"bookings"), orderBy("createdAt","desc")),
      (snap) => { setBookings(snap.docs.map((d) => ({id:d.id,...d.data()}))); setLoading(false); },
      () => setLoading(false));
    const u2 = onSnapshot(collection(db,"blocked-slots"),
      (snap) => setBlocked(snap.docs.map((d) => ({id:d.id,...d.data()}))));
    return () => { u1(); u2(); };
  }, []);

  const removeBooking = useCallback(async (id: string) => { await deleteDoc(doc(db,"bookings",id)); }, []);
  const addBlockedSlot = useCallback(async (date: string, professional: string, time: string) => {
    await addDoc(collection(db,"blocked-slots"), {date, professional, time});
  }, []);
  const removeBlockedSlot = useCallback(async (id: string) => { await deleteDoc(doc(db,"blocked-slots",id)); }, []);

  return { bookings, blocked, loading, removeBooking, addBlockedSlot, removeBlockedSlot };
}

export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState("bookings");
  const [selBooking, setSelBooking] = useState<any>(null);
  const [profFilter, setProfFilter] = useState("");
  const [dateOffset, setDateOffset] = useState(0);
  const [costPerSvc, setCostPerSvc] = useState(5);
  const [earningsFilter, setEarningsFilter] = useState("ALL");
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockDate, setBlockDate] = useState("");
  const [blockProf, setBlockProf] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockAllDay, setBlockAllDay] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const { bookings, blocked, loading, removeBooking, addBlockedSlot, removeBlockedSlot } = useFirebaseData();

  const check = () => {
    if (pw === ADMIN_PASSWORD) setAuth(true);
    else { setErr(true); setPw(""); setTimeout(() => setErr(false), 2000); }
  };

  const upcoming = useMemo(() => {
    const now = new Date();
    const cd = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const ct = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    return [...bookings].filter((b) => b.date > cd || (b.date === cd && b.time >= ct))
      .sort((a,b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
  }, [bookings]);

  const deleteBooking = async (id: string) => {
    const bk = bookings.find((b) => b.id === id);
    if (bk?.contactType === "email" && bk.contactValue) {
      const subj = encodeURIComponent("Cancelación de cita - Tu barbería");
      const body = encodeURIComponent(`Hola ${bk.clientName},\nTu cita del ${bk.date} a las ${bk.time} ha sido cancelada.\n\nEl equipo de Tu barbería`);
      window.open(`mailto:${bk.contactValue}?subject=${subj}&body=${body}`, "_blank");
    }
    await removeBooking(id);
  };

  const toggleBlock = async (date: string, prof: string, time: string) => {
    const existing = blocked.find((b) => b.date===date && b.professional===prof && b.time===time);
    if (existing) await removeBlockedSlot(existing.id);
    else await addBlockedSlot(date, prof, time);
  };

  const applyBlock = async () => {
    if (!blockDate || !blockProf) return;
    const si = blockAllDay ? 0 : ALL_SLOTS.indexOf(blockStart);
    const ei = blockAllDay ? ALL_SLOTS.length-1 : ALL_SLOTS.indexOf(blockEnd);
    if (si<0 || ei<0 || si>ei) { alert("Horarios inválidos"); return; }
    for (let i=si; i<=ei; i++) {
      const t = ALL_SLOTS[i];
      if (!blocked.some((b) => b.date===blockDate && b.professional===blockProf && b.time===t))
        await addBlockedSlot(blockDate, blockProf, t);
    }
    setShowBlockModal(false); setBlockStart(""); setBlockEnd(""); setBlockAllDay(false);
  };

  const getNextDays = () => {
    const days: string[] = [], cur = new Date(); cur.setDate(cur.getDate()+dateOffset);
    while (days.length < 7) {
      if (cur.getDay()!==0) days.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`);
      cur.setDate(cur.getDate()+1);
    }
    return days;
  };

  const earningsBks = useMemo(() => bookings.filter((b) => earningsFilter==="ALL" || b.professional===earningsFilter), [bookings, earningsFilter]);
  const revenue = earningsBks.reduce((s,b) => s+b.service.price, 0);
  const cost = earningsBks.length * costPerSvc;
  const days = getNextDays();

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@400;500;600&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--gold:#c9a227;--gold-dim:#8a6d18;--bg:#0d0d0d;--bg2:#141414;--bg3:#1c1c1c;--bg4:#242424;--border:#2a2a2a;--border2:#333;--text:#f0ece3;--text2:#a09888;--text3:#6b6258;--red:#c0392b;--green:#27ae60;--r:12px}
    html,body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;font-size:15px}
    h1,h2,h3{font-family:'Playfair Display',serif}
    ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--bg2)}::-webkit-scrollbar-thumb{background:var(--gold-dim);border-radius:3px}
    .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(ellipse 80% 60% at 50% 40%,rgba(201,162,39,.05) 0%,transparent 70%)}
    .card{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:48px 40px;max-width:380px;width:100%;text-align:center}
    input[type=password],input[type=number],.sel{width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:10px;padding:14px 16px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:15px;outline:none;margin-bottom:16px;transition:border-color .2s}
    input:focus,.sel:focus{border-color:var(--gold)}
    .err-input{border-color:var(--red)!important}
    .btn{background:linear-gradient(135deg,var(--gold),var(--gold-dim));color:#000;font-weight:700;font-size:15px;padding:14px 32px;border:none;border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;width:100%}
    .admin{padding:32px 24px 60px;min-height:100vh}
    .inner{max-width:1100px;margin:0 auto}
    .hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}
    .tabs{display:flex;gap:4px;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:4px;margin-bottom:24px}
    .tab{flex:1;padding:10px;border-radius:8px;border:none;background:transparent;color:var(--text3);cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;transition:all .2s}
    .tab.on{background:var(--bg3);color:var(--gold);border:1px solid rgba(201,162,39,.2)}
    .panel{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:28px}
    .bk{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px 20px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:border-color .2s}
    .bk:hover{border-color:var(--gold-dim)}
    .price{color:var(--gold);font-family:'Playfair Display',serif;font-size:20px;font-weight:700}
    .empty{text-align:center;padding:60px;color:var(--text3)}
    .logout{display:flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border2);color:var(--text2);padding:8px 16px;border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px}
    .logout:hover{border-color:var(--red);color:#e74c3c}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
    .sc{background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:24px;text-align:center}
    .sc-n{font-family:'Playfair Display',serif;font-size:36px;font-weight:700;margin-bottom:4px}
    .sc-l{font-size:13px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px}
    .sel{margin-bottom:0}
    .ctrl{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap;gap:12px}
    .nav-btns{display:flex;gap:8px}
    .cbtn{width:32px;height:32px;border-radius:50%;border:1px solid var(--border2);background:transparent;color:var(--text);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px}
    .cbtn:hover:not(:disabled){border-color:var(--gold);color:var(--gold)}
    .cbtn:disabled{opacity:.3;cursor:default}
    .gwrap{overflow-x:auto;border:1px solid var(--border);border-radius:var(--r);margin-bottom:20px}
    table{border-collapse:collapse;width:100%;min-width:700px}
    th{background:var(--bg3);padding:10px 8px;font-size:12px;font-weight:700;text-align:center;border-bottom:1px solid var(--border);color:var(--text2);text-transform:uppercase}
    th:first-child{text-align:left;padding-left:14px;position:sticky;left:0;z-index:1}
    td{border:1px solid rgba(255,255,255,.03);padding:0;height:36px;cursor:pointer;text-align:center;font-size:12px;font-weight:600;transition:background .15s}
    td:first-child{padding:0 14px;font-size:12px;color:var(--text3);background:var(--bg3);position:sticky;left:0;z-index:1;width:70px;cursor:default;border-right:1px solid var(--border)}
    td.free{background:rgba(39,174,96,.08);color:rgba(39,174,96,.6)}
    td.free:hover{background:rgba(39,174,96,.2)}
    td.blk{background:rgba(192,57,43,.15);color:rgba(192,57,43,.7)}
    td.blk:hover{background:rgba(192,57,43,.3)}
    td.bkd{background:rgba(41,128,185,.12);color:rgba(41,128,185,.7);vertical-align:middle}
    .bc{font-size:10px;line-height:1.3;padding:4px}
    .leg{display:flex;gap:16px;flex-wrap:wrap}
    .li{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text3)}
    .ld{width:12px;height:12px;border-radius:3px}
    .ov{position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(4px);z-index:500;display:flex;align-items:center;justify-content:center;padding:24px}
    .mb{background:var(--bg2);border:1px solid var(--border2);border-radius:16px;padding:32px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;position:relative}
    .mc{position:absolute;top:16px;right:16px;background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px}
    .dr{padding:10px 0;border-bottom:1px solid var(--border);display:flex;gap:12px;font-size:14px}
    .dr:last-child{border-bottom:none}
    .dk{color:var(--text3);min-width:100px;font-size:13px}
    .dv{color:var(--text);font-weight:500}
    .bdg{width:100%;margin-top:20px;padding:14px;background:rgba(192,57,43,.15);border:1px solid rgba(192,57,43,.4);color:#e74c3c;border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600}
    .cbtns{display:flex;gap:12px;margin-top:20px}
    .bcn{flex:1;padding:12px;background:var(--bg3);border:1px solid var(--border2);color:var(--text2);border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px}
    .bcd{flex:1;padding:12px;background:var(--red);border:none;color:#fff;border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600}
    .bmg{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
    .cl{display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;margin-bottom:20px}
    .cl input{width:18px;height:18px;accent-color:var(--gold);cursor:pointer}
    .lbl{display:block;font-size:13px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
    .live{display:inline-flex;align-items:center;gap:8px;background:rgba(39,174,96,.08);border:1px solid rgba(39,174,96,.2);border-radius:8px;padding:6px 14px;margin-bottom:20px;font-size:13px;color:rgba(39,174,96,.9)}
    .dot{width:8px;height:8px;border-radius:50%;background:rgba(39,174,96,.9);display:inline-block;animation:pulse 2s ease infinite}
    .spin{width:40px;height:40px;border:3px solid var(--border2);border-top:3px solid var(--gold);border-radius:50%;animation:spin .8s linear infinite}
    .spin-wrap{min-height:60vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    .fe{animation:fadeUp .35s ease}
    @media(max-width:768px){.stats{grid-template-columns:1fr}.bmg{grid-template-columns:1fr}.tabs{flex-wrap:wrap}}
  `;

  if (!auth) return (
    <>
      <style>{css}</style>
      <div className="wrap">
        <div className="card fe">
          <div style={{fontSize:48,marginBottom:20}}>🔒</div>
          <h2 style={{fontSize:26,marginBottom:8}}>Área Admin</h2>
          <p style={{color:"#a09888",marginBottom:28,fontSize:14}}>Introduce la contraseña para continuar</p>
          <input type="password" value={pw} onChange={(e)=>setPw(e.target.value)}
            onKeyDown={(e)=>e.key==="Enter"&&check()}
            placeholder="Contraseña" className={err?"err-input":""} style={{textAlign:"center"}} />
          {err&&<p style={{color:"#e74c3c",fontSize:13,marginBottom:12}}>Contraseña incorrecta</p>}
          <button className="btn" onClick={check}>Entrar</button>
        </div>
      </div>
    </>
  );

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="spin-wrap"><div className="spin"/><p style={{color:"#6b6258",fontSize:14}}>Cargando datos…</p></div>
    </>
  );

  const renderGrid = (p: string) => (
    <div className="gwrap" key={p}>
      <div style={{background:"var(--bg3)",padding:"10px 14px",fontWeight:700,fontSize:13,borderBottom:"1px solid var(--border)",color:"var(--gold)"}}>👤 {p}</div>
      <table>
        <thead><tr>
          <th>Hora</th>
          {days.map((d)=>(
            <th key={d}>
              <div>{new Date(d.replace(/-/g,"/")).toLocaleDateString("es-ES",{weekday:"short"})}</div>
              <div style={{fontWeight:400,opacity:.6}}>{new Date(d.replace(/-/g,"/")).toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</div>
            </th>
          ))}
        </tr></thead>
        <tbody>
          {ALL_SLOTS.map((t,idx)=>(
            <tr key={t}>
              <td>{t}</td>
              {days.map((d)=>{
                const isBlk=blocked.some((b)=>b.date===d&&b.professional===p&&b.time===t);
                let occ:any=null;
                for(const bk of upcoming){
                  if(bk.date===d&&bk.professional===p){
                    const bi=ALL_SLOTS.indexOf(bk.time);
                    const bn=Math.ceil(bk.service.duration/15);
                    if(idx>=bi&&idx<bi+bn){occ=bk;break;}
                  }
                }
                if(occ&&occ.time!==t)return null;
                const span=occ?Math.ceil(occ.service.duration/15):1;
                return(
                  <td key={d} rowSpan={span}
                    className={occ?"bkd":isBlk?"blk":"free"}
                    onClick={()=>{if(occ)setSelBooking(occ);else if(isBlk)toggleBlock(d,p,t);else{setBlockDate(d);setBlockProf(p);setShowBlockModal(true);}}}>
                    {occ?<div className="bc"><div>💈</div><div style={{fontWeight:700}}>{occ.clientName}</div></div>:isBlk?"🚫":"✓"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <div className="admin">
        <div className="inner">
          <div className="hdr">
            <h1 style={{fontSize:32}}>Panel Admin</h1>
            <button className="logout" onClick={()=>setAuth(false)}>↩ Salir</button>
          </div>
          <div className="live"><span className="dot"/>Sincronizado · {bookings.length} reservas</div>
          <div className="tabs">
            {[["bookings","📅 Reservas"],["avail","🚫 Disponibilidad"],["earnings","💰 Ganancias"]].map(([id,l])=>(
              <button key={id} className={`tab${tab===id?" on":""}`} onClick={()=>setTab(id)}>{l}</button>
            ))}
          </div>

          {tab==="bookings"&&(
            <div className="panel fe">
              <h2 style={{marginBottom:20,fontSize:22}}>Próximas Reservas <span style={{color:"var(--gold)"}}>({upcoming.length})</span></h2>
              {upcoming.length===0
                ?<div className="empty"><div style={{fontSize:40,marginBottom:16}}>📭</div><p>No hay reservas próximas</p></div>
                :upcoming.map((bk)=>(
                  <div key={bk.id} className="bk" onClick={()=>setSelBooking(bk)}>
                    <div>
                      <h4 style={{fontSize:15,fontWeight:600,marginBottom:4}}>{bk.service.name}</h4>
                      <p style={{color:"var(--text2)",fontSize:13}}>👤 {bk.clientName} · 💈 {bk.professional}</p>
                      <p style={{color:"var(--text2)",fontSize:13}}>📅 {new Date(bk.date.replace(/-/g,"/")).toLocaleDateString("es-ES",{day:"numeric",month:"short"})} · 🕒 {bk.time}</p>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div className="price">€{bk.service.price}</div>
                      <div style={{color:"var(--text3)",fontSize:12,marginTop:4}}>Ver →</div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {tab==="avail"&&(
            <div className="panel fe">
              <h2 style={{marginBottom:20,fontSize:22}}>Gestionar Disponibilidad</h2>
              <div style={{background:"rgba(201,162,39,.06)",border:"1px solid rgba(201,162,39,.2)",borderRadius:10,padding:14,marginBottom:20,fontSize:13,color:"var(--text2)"}}>
                💡 Verde = disponible (clic para bloquear) · 🚫 = bloqueado (clic para desbloquear) · 💈 = reservado
              </div>
              <div className="ctrl">
                <select className="sel" value={profFilter} onChange={(e)=>setProfFilter(e.target.value)} style={{minWidth:200}}>
                  <option value="">— Seleccionar barbero —</option>
                  <option value="ALL">👥 Todos</option>
                  {PROFESSIONALS.map((p)=><option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
                <div className="nav-btns">
                  <button className="cbtn" onClick={()=>setDateOffset((v)=>Math.max(0,v-7))} disabled={dateOffset<=0}>‹</button>
                  <button className="cbtn" onClick={()=>setDateOffset(0)}>⌂</button>
                  <button className="cbtn" onClick={()=>setDateOffset((v)=>v+7)}>›</button>
                </div>
              </div>
              {profFilter&&profFilter!=="ALL"&&renderGrid(profFilter)}
              {profFilter==="ALL"&&PROFESSIONALS.map((p)=>renderGrid(p.name))}
              {!profFilter&&<div className="empty"><p>Selecciona un barbero para ver su calendario</p></div>}
              <div className="leg">
                {[["rgba(39,174,96,.2)","Disponible"],["rgba(192,57,43,.25)","Bloqueado"],["rgba(41,128,185,.2)","Reservado"]].map(([bg,l])=>(
                  <div key={l} className="li"><div className="ld" style={{background:bg}}/>{l}</div>
                ))}
              </div>
            </div>
          )}

          {tab==="earnings"&&(
            <div className="panel fe">
              <h2 style={{marginBottom:24,fontSize:22}}>Análisis de Ganancias</h2>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:28}}>
                <div>
                  <label className="lbl">Filtrar Barbero</label>
                  <select className="sel" value={earningsFilter} onChange={(e)=>setEarningsFilter(e.target.value)} style={{width:"100%"}}>
                    <option value="ALL">Todos</option>
                    {PROFESSIONALS.map((p)=><option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Coste por Servicio (€)</label>
                  <input type="number" value={costPerSvc} onChange={(e)=>setCostPerSvc(Number(e.target.value))} min={0} style={{width:"100%",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:10,padding:"14px 16px",color:"var(--text)",fontFamily:"'DM Sans',sans-serif",fontSize:15,outline:"none"}} />
                </div>
              </div>
              <div className="stats">
                <div className="sc"><div className="sc-n" style={{color:"#5dade2"}}>€{revenue.toFixed(0)}</div><div className="sc-l">Ingresos</div></div>
                <div className="sc"><div className="sc-n" style={{color:"#e74c3c"}}>€{cost.toFixed(0)}</div><div className="sc-l">Costes</div></div>
                <div className="sc"><div className="sc-n" style={{color:"var(--green)"}}>€{(revenue-cost).toFixed(0)}</div><div className="sc-l">Beneficio</div></div>
              </div>
              <p style={{color:"var(--text3)",fontSize:13,textAlign:"center"}}>Basado en {earningsBks.length} reservas · €{costPerSvc} por servicio</p>
            </div>
          )}
        </div>
      </div>

      {selBooking&&(
        <div className="ov" onClick={(e)=>e.target===e.currentTarget&&setSelBooking(null)}>
          <div className="mb fe">
            <button className="mc" onClick={()=>setSelBooking(null)}>✕</button>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:20}}>Detalles de la Cita</h3>
            {[["Cliente",selBooking.clientName],["Servicio",selBooking.service.name],["Barbero",selBooking.professional],
              ["Fecha",new Date(selBooking.date.replace(/-/g,"/")).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})],
              ["Hora",selBooking.time],["Precio",`€${selBooking.service.price}`],["Contacto",selBooking.contactValue]
            ].map(([k,v])=>(
              <div key={k} className="dr"><span className="dk">{k}</span><span className="dv">{v}</span></div>
            ))}
            {!confirmDel
              ?<button className="bdg" onClick={()=>setConfirmDel(true)}>🗑 Cancelar Cita</button>
              :<div>
                <p style={{color:"#a09888",fontSize:14,marginTop:16}}>¿Seguro que quieres cancelar esta cita?</p>
                <div className="cbtns">
                  <button className="bcn" onClick={()=>setConfirmDel(false)}>No, mantener</button>
                  <button className="bcd" onClick={()=>{deleteBooking(selBooking.id);setSelBooking(null);setConfirmDel(false);}}>Sí, cancelar</button>
                </div>
              </div>
            }
          </div>
        </div>
      )}

      {showBlockModal&&(
        <div className="ov" onClick={(e)=>e.target===e.currentTarget&&setShowBlockModal(false)}>
          <div className="mb fe">
            <button className="mc" onClick={()=>setShowBlockModal(false)}>✕</button>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:20}}>Bloquear Horario</h3>
            <p style={{color:"var(--text2)",fontSize:14,marginBottom:6}}><strong>Fecha:</strong> {blockDate&&new Date(blockDate.replace(/-/g,"/")).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</p>
            <p style={{color:"var(--text2)",fontSize:14,marginBottom:20}}><strong>Barbero:</strong> {blockProf}</p>
            <label className="cl">
              <input type="checkbox" checked={blockAllDay} onChange={(e)=>setBlockAllDay(e.target.checked)}/>
              Bloquear todo el día
            </label>
            {!blockAllDay&&(
              <div className="bmg">
                <div>
                  <label className="lbl">Desde</label>
                  <select className="sel" value={blockStart} onChange={(e)=>setBlockStart(e.target.value)} style={{width:"100%"}}>
                    <option value="">Hora inicio</option>
                    {ALL_SLOTS.map((t)=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Hasta</label>
                  <select className="sel" value={blockEnd} onChange={(e)=>setBlockEnd(e.target.value)} style={{width:"100%"}}>
                    <option value="">Hora fin</option>
                    {ALL_SLOTS.map((t)=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:12}}>
              <button className="bcn" onClick={()=>setShowBlockModal(false)}>Cancelar</button>
              <button className="bcd" onClick={applyBlock}>Bloquear</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
