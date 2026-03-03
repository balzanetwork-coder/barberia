'use client';

import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{--gold:#c9a227;--gold-dim:#8a6d18;--bg:#0d0d0d;--bg2:#141414;--bg3:#1c1c1c;--border:#2a2a2a;--border2:#333;--text:#f0ece3;--text2:#a09888;--text3:#6b6258;--red:#c0392b}
  html,body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh}
  h1,h2,h3{font-family:'Playfair Display',serif}
  .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(ellipse 80% 60% at 50% 40%,rgba(201,162,39,.05) 0%,transparent 70%)}
  .card{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:40px;max-width:440px;width:100%;text-align:center}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:14px;text-align:left}
  .row:last-child{border-bottom:none}
  .rk{color:var(--text3)}
  .rv{color:var(--text);font-weight:600}
  .btn-cancel{width:100%;margin-top:24px;padding:16px;background:rgba(192,57,43,.15);border:1px solid rgba(192,57,43,.4);color:#e74c3c;border-radius:12px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:16px;font-weight:600;transition:background .2s}
  .btn-cancel:hover{background:rgba(192,57,43,.3)}
  .btn-cancel:disabled{opacity:.5;cursor:default}
  .btn-home{display:inline-block;margin-top:20px;padding:14px 32px;background:linear-gradient(135deg,var(--gold),var(--gold-dim));color:#000;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;font-family:'DM Sans',sans-serif}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  .fe{animation:fadeUp .35s ease}
`;

export default function CancelarPage() {
  const [booking, setBooking] = useState<any>(null);
  const [status, setStatus] = useState<"loading"|"found"|"notfound"|"cancelled"|"error">("loading");
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) { setStatus("notfound"); return; }

    getDoc(doc(db, "bookings", id)).then((snap) => {
      if (snap.exists()) {
        setBooking({ id: snap.id, ...snap.data() });
        setStatus("found");
      } else {
        setStatus("notfound");
      }
    }).catch(() => setStatus("error"));
  }, []);

  const handleCancel = async () => {
    if (!booking) return;
    setCancelling(true);
    try {
      // Send cancellation email
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "cancellation", booking }),
      });
      // Delete from Firebase
      await deleteDoc(doc(db, "bookings", booking.id));
      setStatus("cancelled");
    } catch {
      setStatus("error");
    } finally {
      setCancelling(false);
    }
  };

  const dateStr = booking
    ? new Date(booking.date.replace(/-/g, "/")).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <>
      <style>{css}</style>
      <div className="wrap">
        <div className="card fe">

          {status === "loading" && (
            <>
              <div style={{ width: 40, height: 40, border: "3px solid #333", borderTop: "3px solid #c9a227", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 16px" }} />
              <p style={{ color: "var(--text3)" }}>Buscando tu cita…</p>
            </>
          )}

          {status === "notfound" && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <h2 style={{ marginBottom: 8 }}>Cita no encontrada</h2>
              <p style={{ color: "var(--text2)", marginBottom: 24 }}>Es posible que ya haya sido cancelada o el enlace no sea válido.</p>
              <a href="/" className="btn-home">Volver al inicio</a>
            </>
          )}

          {status === "error" && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <h2 style={{ marginBottom: 8 }}>Ha ocurrido un error</h2>
              <p style={{ color: "var(--text2)", marginBottom: 24 }}>Inténtalo de nuevo más tarde.</p>
              <a href="/" className="btn-home">Volver al inicio</a>
            </>
          )}

          {status === "found" && booking && !confirming && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
              <h2 style={{ marginBottom: 8 }}>Cancelar tu cita</h2>
              <p style={{ color: "var(--text2)", marginBottom: 24, fontSize: 14 }}>¿Seguro que quieres cancelar la siguiente cita?</p>
              <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", marginBottom: 8, textAlign: "left" }}>
                {[["Servicio", booking.service.name], ["Barbero", booking.professional], ["Fecha", dateStr], ["Hora", booking.time], ["Precio", `€${booking.service.price}`]].map(([k, v]) => (
                  <div key={k} className="row"><span className="rk">{k}</span><span className="rv">{v}</span></div>
                ))}
              </div>
              <button className="btn-cancel" onClick={() => setConfirming(true)}>Cancelar esta cita</button>
              <div style={{ marginTop: 12 }}>
                <a href="/" style={{ color: "var(--text3)", fontSize: 13, textDecoration: "none" }}>← Volver sin cancelar</a>
              </div>
            </>
          )}

          {status === "found" && confirming && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <h2 style={{ marginBottom: 8 }}>¿Confirmas la cancelación?</h2>
              <p style={{ color: "var(--text2)", marginBottom: 28, fontSize: 14 }}>Esta acción no se puede deshacer.</p>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setConfirming(false)} style={{ flex: 1, padding: 14, background: "var(--bg3)", border: "1px solid var(--border2)", color: "var(--text2)", borderRadius: 10, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 14 }}>
                  No, mantener
                </button>
                <button className="btn-cancel" onClick={handleCancel} disabled={cancelling} style={{ flex: 1, marginTop: 0 }}>
                  {cancelling ? "Cancelando…" : "Sí, cancelar"}
                </button>
              </div>
            </>
          )}

          {status === "cancelled" && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 style={{ marginBottom: 8 }}>Cita cancelada</h2>
              <p style={{ color: "var(--text2)", marginBottom: 28 }}>Tu cita ha sido cancelada correctamente. ¡Esperamos verte pronto!</p>
              <a href="/" className="btn-home">Reservar otra cita</a>
            </>
          )}

        </div>
      </div>
    </>
  );
}
