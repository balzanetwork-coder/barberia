'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SERVICES = [
  { id: 1, name: "Corte de cabello", price: 13, duration: 25 },
  { id: 2, name: "Arreglo de barba", price: 8, duration: 15 },
  { id: 3, name: "Corte + barba", price: 17, duration: 40 },
  { id: 4, name: "Corte jubilado", price: 10, duration: 25 },
  { id: 5, name: "Corte para niños", price: 13, duration: 25 },
];

const PROFESSIONALS = [
  { name: "Jesús", image: "https://i.postimg.cc/fySSnKcg/42368ead-ac49-4030-b692-ba8bdc33f35e.jpg", specialty: "Cortes clásicos" },
  { name: "Lancas", image: "https://i.postimg.cc/3RnFJn0P/f3c66a03-9069-489f-a39f-2baa5cb94e62.jpg", specialty: "Fade & degradado" },
  { name: "Eddy", image: "https://i.postimg.cc/g2mjNd7P/36f5acf1-aee9-473a-9284-e6f8c9f18058.jpg", specialty: "Barba & estilo" },
];

const REVIEWS = [
  { name: "Javier García", text: "El mejor barbero de la zona sin duda. Siempre me deja el corte perfecto y el trato es inmejorable.", rating: 5 },
  { name: "Marcos Alonso", text: "Un ambiente genial y muy profesional. Llevo yendo desde que abrieron y no lo cambio.", rating: 5 },
  { name: "David Sánchez", text: "Gran profesional y muy buen rollo en la barbería. Te aconseja sobre el estilo que mejor te queda.", rating: 5 },
  { name: "Carlos Pérez", text: "El sitio es impecable. Se nota que le pone pasión a su trabajo. Siempre salgo más que satisfecho.", rating: 5 },
];

const ADMIN_PASSWORD = "admin123";

// ─── TIME SLOTS ───────────────────────────────────────────────────────────────
function generateSlots() {
  const s = [];
  for (let h = 10; h < 21; h++)
    for (let m = 0; m < 60; m += 15)
      s.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  return s;
}
const ALL_SLOTS = generateSlots();

// ─── FIREBASE HOOK (tiempo real con onSnapshot) ───────────────────────────────
function useFirebaseData() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escucha reservas en tiempo real
    const unsubBookings = onSnapshot(
      query(collection(db, "bookings"), orderBy("createdAt", "desc")),
      (snap) => {
        setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => { console.error("bookings error:", err); setLoading(false); }
    );

    // Escucha bloqueos en tiempo real
    const unsubBlocked = onSnapshot(
      collection(db, "blocked-slots"),
      (snap) => {
        setBlocked(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("blocked error:", err)
    );

    return () => { unsubBookings(); unsubBlocked(); };
  }, []);

  const addBooking = useCallback(async (bookingData: any) => {
    const docRef = await addDoc(collection(db, "bookings"), {
      ...bookingData,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  }, []);

  const removeBooking = useCallback(async (id) => {
    await deleteDoc(doc(db, "bookings", id));
  }, []);

  const addBlockedSlot = useCallback(async (date, professional, time) => {
    await addDoc(collection(db, "blocked-slots"), { date, professional, time });
  }, []);

  const removeBlockedSlot = useCallback(async (id) => {
    await deleteDoc(doc(db, "blocked-slots", id));
  }, []);

  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "config", "main"), (snap) => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => unsubConfig();
  }, []);

  const saveConfig = useCallback(async (cfg: any) => {
    await setDoc(doc(db, "config", "main"), cfg);
  }, []);

  return {
    bookings, blocked, loading, config,
    addBooking, removeBooking,
    addBlockedSlot, removeBlockedSlot,
    saveConfig,
  };
}

// ─── AVAILABILITY HELPERS ─────────────────────────────────────────────────────
function isSlotAvailable(date, time, prof, duration, bookings, blocked) {
  const si = ALL_SLOTS.indexOf(time);
  if (si < 0) return false;
  const need = Math.ceil(duration / 15);
  for (let i = 0; i < need; i++) {
    const t = ALL_SLOTS[si + i];
    if (!t) return false;
    if (blocked.some((b) => b.date === date && b.professional === prof && b.time === t)) return false;
    if (bookings.some((bk) => {
      if (bk.date !== date || bk.professional !== prof) return false;
      const bi = ALL_SLOTS.indexOf(bk.time);
      const bn = Math.ceil(bk.service.duration / 15);
      const ci = si + i;
      return ci >= bi && ci < bi + bn;
    })) return false;
  }
  return true;
}

function getAvailableSlots(date, prof, service, bookings, blocked) {
  if (!date || !prof || !service) return [];
  const res = [];
  for (let i = 0; i < ALL_SLOTS.length; i++) {
    const t = ALL_SLOTS[i];
    if (isSlotAvailable(date, t, prof, service.duration, bookings, blocked)) {
      res.push(t);
      i += Math.ceil(service.duration / 15) - 1;
    }
  }
  return res;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,700&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --gold: #c9a227;
    --gold-light: #e8c547;
    --gold-dim: #8a6d18;
    --bg: #0d0d0d;
    --bg2: #141414;
    --bg3: #1c1c1c;
    --bg4: #242424;
    --border: #2a2a2a;
    --border2: #333;
    --text: #f0ece3;
    --text2: #a09888;
    --text3: #6b6258;
    --red: #c0392b;
    --green: #27ae60;
    --blue: #2980b9;
    --r: 12px;
  }

  html { scroll-behavior: smooth; }
  body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 15px; line-height: 1.6; overflow-x: hidden; }
  h1,h2,h3,h4 { font-family: 'Playfair Display', serif; line-height: 1.2; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg2); }
  ::-webkit-scrollbar-thumb { background: var(--gold-dim); border-radius: 3px; }

  .header { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(13,13,13,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); height: 64px; display: flex; align-items: center; }
  .header-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; width: 100%; display: flex; align-items: center; justify-content: space-between; }
  .logo { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text); cursor: pointer; }
  .logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, var(--gold), var(--gold-dim)); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .logo-text { font-family: 'Playfair Display', serif; font-weight: 700; font-size: 17px; }
  .nav { display: flex; align-items: center; gap: 28px; }
  .nav a, .nav button { background: none; border: none; color: var(--text2); font-size: 14px; font-family: 'DM Sans', sans-serif; cursor: pointer; text-decoration: none; transition: color .2s; letter-spacing: .3px; }
  .nav a:hover, .nav button:hover { color: var(--gold); }
  .nav .active { color: var(--gold) !important; }
  .btn-book-header { background: var(--gold) !important; color: #000 !important; font-weight: 600 !important; padding: 8px 20px; border-radius: 8px; transition: background .2s, transform .1s !important; }
  .btn-book-header:hover { background: var(--gold-light) !important; transform: translateY(-1px); }
  .hamburger { display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 4px; background: none; border: none; }
  .hamburger span { display: block; width: 22px; height: 2px; background: var(--text); border-radius: 2px; }
  .mobile-menu { display: none; position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,.9); backdrop-filter: blur(20px); flex-direction: column; align-items: center; justify-content: center; gap: 32px; }
  .mobile-menu.open { display: flex; }
  .mobile-menu a, .mobile-menu button { color: var(--text) !important; font-size: 24px !important; font-family: 'Playfair Display', serif; }
  .mobile-close { position: absolute; top: 20px; right: 24px; font-size: 28px; background: none; border: none; color: var(--text2); cursor: pointer; }

  .hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; padding-top: 64px; }
  .hero-bg { position: absolute; inset: 0; background: radial-gradient(ellipse 80% 60% at 50% 40%, rgba(201,162,39,.06) 0%, transparent 70%); }
  .hero-lines { position: absolute; inset: 0; background-image: repeating-linear-gradient(0deg, transparent, transparent 80px, rgba(201,162,39,.03) 80px, rgba(201,162,39,.03) 81px); }
  .hero-content { text-align: center; max-width: 700px; padding: 40px 24px; position: relative; z-index: 1; }
  .hero-eyebrow { display: inline-flex; align-items: center; gap: 8px; background: rgba(201,162,39,.1); border: 1px solid rgba(201,162,39,.2); color: var(--gold); font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; padding: 6px 16px; border-radius: 100px; margin-bottom: 24px; }
  .hero h1 { font-size: clamp(42px, 8vw, 80px); font-weight: 900; margin-bottom: 20px; }
  .hero h1 span { font-style: italic; color: var(--gold); }
  .hero p { color: var(--text2); font-size: 18px; margin-bottom: 40px; max-width: 500px; margin-left: auto; margin-right: auto; }
  .hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .btn-primary { background: linear-gradient(135deg, var(--gold), var(--gold-dim)); color: #000; font-weight: 700; font-size: 15px; padding: 14px 32px; border: none; border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: transform .15s, box-shadow .15s; box-shadow: 0 4px 20px rgba(201,162,39,.3); letter-spacing: .3px; }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(201,162,39,.4); }
  .btn-secondary { background: transparent; color: var(--text); font-weight: 500; font-size: 15px; padding: 14px 32px; border: 1px solid var(--border2); border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: border-color .2s, color .2s; }
  .btn-secondary:hover { border-color: var(--gold); color: var(--gold); }
  .hero-stats { display: flex; gap: 40px; justify-content: center; margin-top: 60px; flex-wrap: wrap; }
  .stat { text-align: center; }
  .stat-num { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; color: var(--gold); }
  .stat-label { color: var(--text3); font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }

  .section { padding: 100px 24px; max-width: 1200px; margin: 0 auto; }
  .section-label { display: inline-block; color: var(--gold); font-size: 12px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: 12px; }
  .section-title { font-size: clamp(28px, 5vw, 44px); margin-bottom: 16px; }
  .section-sub { color: var(--text2); font-size: 16px; max-width: 480px; }

  .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 48px; }
  .service-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--r); padding: 24px; cursor: pointer; transition: border-color .2s, transform .15s, background .2s; }
  .service-card:hover { border-color: var(--gold-dim); transform: translateY(-2px); }
  .service-card.selected { border-color: var(--gold); background: rgba(201,162,39,.06); }
  .service-name { font-weight: 600; font-size: 15px; margin-bottom: 8px; }
  .service-details { display: flex; justify-content: space-between; align-items: center; }
  .service-price { color: var(--gold); font-weight: 700; font-size: 20px; font-family: 'Playfair Display', serif; }
  .service-dur { color: var(--text3); font-size: 13px; }

  .team-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 48px; }
  .team-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; cursor: pointer; transition: border-color .2s, transform .15s; }
  .team-card:hover { border-color: var(--gold-dim); transform: translateY(-3px); }
  .team-card.selected { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(201,162,39,.2); }
  .team-img { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; }
  .team-info { padding: 16px; }
  .team-name { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; }
  .team-specialty { color: var(--text3); font-size: 13px; margin-top: 4px; }
  .team-check { display: inline-flex; align-items: center; gap: 6px; color: var(--gold); font-size: 13px; font-weight: 600; margin-top: 8px; }

  .reviews-track { overflow: hidden; position: relative; margin-top: 48px; }
  .reviews-inner { display: flex; gap: 20px; transition: transform .4s ease; }
  .review-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--r); padding: 28px; min-width: 300px; flex-shrink: 0; }
  .review-stars { color: var(--gold); font-size: 16px; margin-bottom: 16px; letter-spacing: 2px; }
  .review-text { color: var(--text2); font-size: 14px; line-height: 1.7; margin-bottom: 20px; font-style: italic; }
  .review-author { font-weight: 600; color: var(--gold); font-size: 14px; }
  .reviews-nav { display: flex; gap: 12px; margin-top: 28px; }
  .rev-btn { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--border2); background: transparent; color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color .2s, background .2s; font-size: 16px; }
  .rev-btn:hover { border-color: var(--gold); background: rgba(201,162,39,.1); color: var(--gold); }
  .rev-btn:disabled { opacity: .3; cursor: default; }

  .booking-wrap { min-height: 100vh; padding: 80px 24px 40px; display: flex; align-items: flex-start; justify-content: center; }
  .booking-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 20px; padding: 48px; max-width: 800px; width: 100%; box-shadow: 0 24px 80px rgba(0,0,0,.5); }
  .booking-header { text-align: center; margin-bottom: 40px; }
  .booking-header h2 { font-size: 32px; margin-bottom: 8px; }

  .steps { display: flex; align-items: center; margin-bottom: 40px; }
  .step-item { display: flex; flex-direction: column; align-items: center; flex: 1; }
  .step-dot { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; transition: all .3s; border: 2px solid var(--border2); background: var(--bg3); color: var(--text3); }
  .step-dot.active { border-color: var(--gold); background: var(--gold); color: #000; }
  .step-dot.done { border-color: var(--gold); background: rgba(201,162,39,.15); color: var(--gold); }
  .step-label { font-size: 11px; margin-top: 6px; color: var(--text3); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  .step-label.active { color: var(--gold); }
  .step-line { flex: 1; height: 1px; background: var(--border); align-self: center; margin-bottom: 22px; transition: background .3s; }
  .step-line.done { background: var(--gold-dim); }

  .calendar-wrap { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--r); padding: 24px; margin-bottom: 24px; }
  .cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .cal-month { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; text-transform: capitalize; }
  .cal-btn { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border2); background: transparent; color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all .2s; }
  .cal-btn:hover:not(:disabled) { border-color: var(--gold); color: var(--gold); }
  .cal-btn:disabled { opacity: .3; cursor: default; }
  .cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; }
  .cal-day-label { text-align: center; font-size: 11px; font-weight: 700; color: var(--text3); padding: 4px; text-transform: uppercase; letter-spacing: .5px; }
  .cal-day { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all .15s; border: 1px solid transparent; }
  .cal-day.selectable { background: var(--bg4); color: var(--text); }
  .cal-day.selectable:hover { border-color: var(--gold-dim); }
  .cal-day.selected { background: var(--gold); color: #000; font-weight: 700; border-color: var(--gold); }
  .cal-day.disabled { color: var(--text3); opacity: .35; cursor: default; }
  .cal-day.empty { cursor: default; }

  .period-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
  .period-tab { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border2); background: transparent; color: var(--text2); cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; transition: all .2s; }
  .period-tab:hover { border-color: var(--gold-dim); color: var(--text); }
  .period-tab.active { border-color: var(--gold); background: rgba(201,162,39,.1); color: var(--gold); }
  .slots-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; max-height: 220px; overflow-y: auto; padding: 4px; }
  .slot { padding: 10px 6px; border-radius: 8px; border: 1px solid var(--border2); background: var(--bg4); color: var(--text); cursor: pointer; font-size: 13px; font-weight: 600; text-align: center; transition: all .15s; font-family: 'DM Sans', sans-serif; }
  .slot:hover { border-color: var(--gold-dim); }
  .slot.selected { background: var(--gold); color: #000; border-color: var(--gold); }

  .form-group { margin-bottom: 20px; }
  .form-label { display: block; font-size: 13px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: .8px; margin-bottom: 8px; }
  .form-input { width: 100%; background: var(--bg3); border: 1px solid var(--border2); border-radius: 10px; padding: 14px 16px; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 15px; transition: border-color .2s; outline: none; }
  .form-input:focus { border-color: var(--gold); }
  .form-input.error { border-color: var(--red); }
  .form-err { color: #e74c3c; font-size: 12px; margin-top: 6px; }
  .input-row { display: flex; }
  .input-prefix { background: var(--bg4); border: 1px solid var(--border2); border-right: none; border-radius: 10px 0 0 10px; padding: 14px 14px; display: flex; align-items: center; }
  .input-prefix select { background: transparent; border: none; color: var(--text); font-size: 16px; cursor: pointer; outline: none; }
  .input-suffix { border-radius: 0 10px 10px 0 !important; }

  .summary-box { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--r); padding: 20px; margin-bottom: 24px; }
  .summary-title { font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: var(--gold); margin-bottom: 14px; }
  .summary-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); color: var(--text2); font-size: 14px; }
  .summary-row:last-child { border-bottom: none; }
  .summary-total { color: var(--gold); font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; margin-top: 12px; }

  .btn-continue { width: 100%; padding: 16px; border-radius: 12px; border: none; background: linear-gradient(135deg, var(--gold), var(--gold-dim)); color: #000; font-weight: 700; font-size: 16px; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: transform .15s, box-shadow .15s; letter-spacing: .3px; margin-top: 24px; }
  .btn-continue:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(201,162,39,.35); }
  .btn-continue:disabled { background: var(--bg4); color: var(--text3); cursor: default; box-shadow: none; transform: none; }
  .btn-back { display: flex; align-items: center; gap: 6px; background: none; border: none; color: var(--text3); cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; padding: 8px; border-radius: 8px; transition: color .2s; }
  .btn-back:hover { color: var(--text); }

  .success-wrap { display: flex; align-items: center; justify-content: center; min-height: 80vh; }
  .success-card { background: var(--bg2); border: 1px solid rgba(201,162,39,.3); border-radius: 20px; padding: 60px 48px; text-align: center; max-width: 420px; }
  .success-icon { width: 80px; height: 80px; background: linear-gradient(135deg, var(--gold), var(--gold-dim)); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: 0 auto 28px; }

  .admin-wrap { min-height: 100vh; padding: 80px 24px 40px; }
  .admin-inner { max-width: 1100px; margin: 0 auto; }
  .admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
  .admin-tabs { display: flex; gap: 4px; background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 4px; margin-bottom: 28px; }
  .admin-tab { flex: 1; padding: 10px; border-radius: 8px; border: none; background: transparent; color: var(--text3); cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; transition: all .2s; }
  .admin-tab.active { background: var(--bg3); color: var(--gold); border: 1px solid rgba(201,162,39,.2); }
  .admin-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 16px; padding: 28px; }
  .booking-item { background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: border-color .2s; }
  .booking-item:hover { border-color: var(--gold-dim); }
  .booking-item-left h4 { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .booking-item-left p { color: var(--text2); font-size: 13px; }
  .booking-price { color: var(--gold); font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; }
  .empty-state { text-align: center; padding: 60px; color: var(--text3); }

  .avail-controls { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
  .select-input { background: var(--bg3); border: 1px solid var(--border2); border-radius: 8px; padding: 10px 14px; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; cursor: pointer; min-width: 200px; }
  .select-input:focus { border-color: var(--gold); }
  .nav-btns { display: flex; gap: 8px; }
  .grid-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--r); margin-bottom: 24px; }
  .avail-table { border-collapse: collapse; width: 100%; min-width: 700px; }
  .avail-table th { background: var(--bg3); padding: 10px 8px; font-size: 12px; font-weight: 700; text-align: center; border-bottom: 1px solid var(--border); color: var(--text2); text-transform: uppercase; letter-spacing: .5px; white-space: nowrap; }
  .avail-table th:first-child { text-align: left; padding-left: 14px; position: sticky; left: 0; z-index: 1; }
  .avail-table td { border: 1px solid rgba(255,255,255,.03); padding: 0; height: 36px; cursor: pointer; text-align: center; font-size: 12px; font-weight: 600; transition: background .15s; }
  .avail-table td:first-child { padding: 0 14px; font-size: 12px; color: var(--text3); font-weight: 600; white-space: nowrap; background: var(--bg3); position: sticky; left: 0; z-index: 1; width: 70px; cursor: default; border-right: 1px solid var(--border); }
  .avail-table td.free { background: rgba(39,174,96,.08); color: rgba(39,174,96,.6); }
  .avail-table td.free:hover { background: rgba(39,174,96,.2); }
  .avail-table td.blocked { background: rgba(192,57,43,.15); color: rgba(192,57,43,.7); }
  .avail-table td.blocked:hover { background: rgba(192,57,43,.3); }
  .avail-table td.booked { background: rgba(41,128,185,.12); color: rgba(41,128,185,.7); vertical-align: middle; }
  .avail-table td.booked:hover { background: rgba(41,128,185,.2); }
  .booked-cell { font-size: 10px; line-height: 1.3; padding: 4px; }
  .legend { display: flex; gap: 20px; margin-top: 16px; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text3); }
  .legend-dot { width: 12px; height: 12px; border-radius: 3px; }

  .stats-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 32px; }
  .stat-card { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--r); padding: 24px; text-align: center; }
  .stat-card-num { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; margin-bottom: 4px; }
  .stat-card-label { font-size: 13px; color: var(--text3); text-transform: uppercase; letter-spacing: .8px; }
  .stat-card.blue .stat-card-num { color: #5dade2; }
  .stat-card.red .stat-card-num { color: #e74c3c; }
  .stat-card.green .stat-card-num { color: var(--green); }

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.8); backdrop-filter: blur(4px); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .modal-box { background: var(--bg2); border: 1px solid var(--border2); border-radius: 16px; padding: 32px; max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative; }
  .modal-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text3); cursor: pointer; font-size: 20px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: color .2s; }
  .modal-close:hover { color: var(--text); }
  .modal-title { font-family: 'Playfair Display', serif; font-size: 22px; margin-bottom: 20px; }
  .detail-row { padding: 10px 0; border-bottom: 1px solid var(--border); display: flex; gap: 12px; font-size: 14px; }
  .detail-row:last-child { border-bottom: none; }
  .detail-key { color: var(--text3); min-width: 100px; font-size: 13px; }
  .detail-val { color: var(--text); font-weight: 500; }
  .btn-danger { width: 100%; margin-top: 20px; padding: 14px; background: rgba(192,57,43,.15); border: 1px solid rgba(192,57,43,.4); color: #e74c3c; border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; transition: background .2s; }
  .btn-danger:hover { background: rgba(192,57,43,.3); }
  .confirm-btns { display: flex; gap: 12px; margin-top: 20px; }
  .btn-cancel-sm { flex: 1; padding: 12px; background: var(--bg3); border: 1px solid var(--border2); color: var(--text2); border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; }
  .btn-confirm-del { flex: 1; padding: 12px; background: var(--red); border: none; color: #fff; border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; }

  .block-modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .checkbox-label { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; margin-bottom: 20px; }
  .checkbox-label input { width: 18px; height: 18px; accent-color: var(--gold); cursor: pointer; }

  .footer { border-top: 1px solid var(--border); padding: 32px 24px; text-align: center; color: var(--text3); font-size: 14px; }
  .footer-logo { font-family: 'Playfair Display', serif; font-size: 18px; color: var(--gold); margin-bottom: 8px; }

  .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 48px; }
  .contact-info-item { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 28px; }
  .contact-info-title { font-weight: 600; margin-bottom: 4px; }
  .contact-info-text { color: var(--text2); font-size: 14px; }

  .btn-logout { display: flex; align-items: center; gap: 8px; background: var(--bg3); border: 1px solid var(--border2); color: var(--text2); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; transition: all .2s; }
  .btn-logout:hover { border-color: var(--red); color: #e74c3c; }

  @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(201,162,39,.2); } 50% { box-shadow: 0 0 40px rgba(201,162,39,.4); } }
  .page-enter { animation: fadeUp .35s ease; }
  .gold-glow { animation: glow 3s ease infinite; }

  @media (max-width: 768px) {
    .nav { display: none; }
    .hamburger { display: flex; }
    .team-grid { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: 1fr; }
    .contact-grid { grid-template-columns: 1fr; }
    .block-modal-grid { grid-template-columns: 1fr; }

    .booking-wrap { padding: 0; align-items: flex-start; min-height: 100vh; }
    .booking-card { border-radius: 0; border-left: none; border-right: none; border-top: none; padding: 20px 16px 80px; min-height: 100vh; box-shadow: none; max-width: 100%; }
    .booking-header h2 { font-size: 24px; }
    .booking-header { margin-bottom: 20px; }
    .steps { margin-bottom: 24px; }
    .step-dot { width: 30px; height: 30px; font-size: 12px; }
    .step-label { font-size: 10px; letter-spacing: 0; }
    .services-grid { grid-template-columns: 1fr; gap: 10px; }
    .service-card { padding: 16px; display: flex; align-items: center; justify-content: space-between; flex-direction: row; }
    .service-name { margin-bottom: 0; font-size: 15px; }
    .service-details { flex-direction: row; gap: 12px; }
    .service-price { font-size: 18px; }
    .calendar-wrap { padding: 14px; }
    .cal-day { font-size: 13px; border-radius: 6px; }
    .cal-day-label { font-size: 10px; }
    .cal-month { font-size: 16px; }
    .slots-grid { grid-template-columns: repeat(4,1fr); gap: 6px; max-height: none; }
    .slot { padding: 10px 4px; font-size: 12px; border-radius: 6px; }
    .period-tabs { gap: 6px; }
    .period-tab { padding: 8px 4px; font-size: 13px; }
    .form-input { padding: 13px 14px; font-size: 16px; }
    .summary-box { padding: 16px; }
    .btn-continue { padding: 18px; font-size: 17px; border-radius: 14px; position: sticky; bottom: 16px; box-shadow: 0 8px 32px rgba(0,0,0,.6); }
    .team-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
    .team-grid-booking { grid-template-columns: repeat(3, 1fr) !important; gap: 10px; }
    .team-img { aspect-ratio: 2/3; }
    .team-img { height: 180px; }
  }
  @media (max-width: 480px) {
    .hero-stats { gap: 24px; }
    .slots-grid { grid-template-columns: repeat(3,1fr); }
    .hero h1 { font-size: 36px; }
    .team-grid { grid-template-columns: 1fr 1fr; }
  }
`;

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function Stars() {
  return <span className="review-stars">★★★★★</span>;
}

function Spinner({ label = "Cargando…" }) {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: "3px solid var(--border2)", borderTop: "3px solid var(--gold)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "var(--text3)", fontSize: 14 }}>{label}</p>
    </div>
  );
}

function StepBar({ step }) {
  const steps = ["Servicio", "Barbero", "Fecha", "Datos"];
  return (
    <div className="steps">
      {steps.map((s, i) => {
        const n = i + 1, isCur = step === n, isDone = step > n;
        return (
          <div key={s} style={{ display: "contents" }}>
            {i > 0 && <div className={`step-line${isDone ? " done" : ""}`} />}
            <div className="step-item">
              <div className={`step-dot${isCur ? " active" : isDone ? " done" : ""}`}>{isDone ? "✓" : n}</div>
              <span className={`step-label${isCur ? " active" : ""}`}>{s}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BookingModal({ booking, onClose, onCancel }) {
  const [confirm, setConfirm] = useState(false);
  if (!booking) return null;
  const dateStr = new Date(booking.date.replace(/-/g, "/")).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box page-enter">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">Detalles de la Cita</h3>
        {[["Cliente", booking.clientName], ["Servicio", booking.service.name], ["Barbero", booking.professional], ["Fecha", dateStr], ["Hora", booking.time], ["Duración", `${booking.service.duration} min`], ["Precio", `€${booking.service.price}`], ["Contacto", booking.contactValue]].map(([k, v]) => (
          <div key={k} className="detail-row">
            <span className="detail-key">{k}</span>
            <span className="detail-val">{v}</span>
          </div>
        ))}
        {!confirm ? (
          <button className="btn-danger" onClick={() => setConfirm(true)}>🗑 Cancelar Cita</button>
        ) : (
          <div>
            <p style={{ color: "var(--text2)", fontSize: 14, marginTop: 16 }}>¿Seguro que quieres cancelar esta cita?</p>
            <div className="confirm-btns">
              <button className="btn-cancel-sm" onClick={() => setConfirm(false)}>No, mantener</button>
              <button className="btn-confirm-del" onClick={() => { onCancel(booking.id); onClose(); }}>Sí, cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LANDING ──────────────────────────────────────────────────────────────────
function Landing({ onBook, setSubPage, professionals = PROFESSIONALS, services = SERVICES }: any) {
  const [revIdx, setRevIdx] = useState(0);
  return (
    <div>
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-lines" />
        <div className="hero-content page-enter">
          <h1>Tu <span>barbería</span></h1>
          <p>Donde la tradición y la precisión se encuentran. Define tu estilo con los mejores profesionales.</p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={onBook}>Reservar Cita</button>
            <button className="btn-secondary" onClick={() => setSubPage("equipo")}>Conoce al Equipo</button>
          </div>
          <div className="hero-stats">
            {[["500+", "Clientes"], ["3", "Barberos"], ["5★", "Valoración"]].map(([n, l]) => (
              <div key={l} className="stat"><div className="stat-num">{n}</div><div className="stat-label">{l}</div></div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ background: "var(--bg2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="section">
          <span className="section-label">Servicios</span>
          <h2 className="section-title">Nuestros Servicios</h2>
          <p className="section-sub">Cortes y tratamientos realizados con precisión artesanal.</p>
          <div className="services-grid">
            {SERVICES.map((s) => (
              <div key={s.id} className="service-card" onClick={onBook}>
                <div className="service-name">{s.name}</div>
                <div className="service-details">
                  <span className="service-price">€{s.price}</span>
                  <span className="service-dur">⏱ {s.duration}m</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <span className="section-label">Opiniones</span>
        <h2 className="section-title">Lo que dicen nuestros clientes</h2>
        <div className="reviews-track">
          <div className="reviews-inner" style={{ transform: `translateX(-${revIdx * 320}px)` }}>
            {REVIEWS.map((r, i) => (
              <div key={i} className="review-card">
                <Stars />
                <p className="review-text">"{r.text}"</p>
                <span className="review-author">— {r.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="reviews-nav">
          <button className="rev-btn" onClick={() => setRevIdx((v) => Math.max(0, v - 1))} disabled={revIdx === 0}>‹</button>
          <button className="rev-btn" onClick={() => setRevIdx((v) => Math.min(REVIEWS.length - 1, v + 1))} disabled={revIdx === REVIEWS.length - 1}>›</button>
        </div>
      </div>

      <div style={{ background: "linear-gradient(135deg, rgba(201,162,39,.08) 0%, transparent 60%)", borderTop: "1px solid var(--border)", padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(28px,5vw,44px)", marginBottom: 16 }}>¿Listo para tu <span style={{ color: "var(--gold)", fontStyle: "italic" }}>nuevo look</span>?</h2>
        <p style={{ color: "var(--text2)", marginBottom: 32, fontSize: 16 }}>Reserva ahora en segundos. Sin esperas, sin complicaciones.</p>
        <button className="btn-primary" onClick={onBook} style={{ margin: "0 auto", display: "block" }}>Reservar Ahora</button>
      </div>
    </div>
  );
}

function EquipoPage({ onBack, onBook, professionals = PROFESSIONALS }: any) {
  return (
    <div className="section page-enter" style={{ paddingTop: 96 }}>
      <button className="btn-back" onClick={onBack} style={{ marginBottom: 32 }}>← Volver</button>
      <span className="section-label">El Equipo</span>
      <h1 className="section-title">Nuestros Barberos</h1>
      <div className="team-grid">
        {PROFESSIONALS.map((p) => (
          <div key={p.name} className="team-card">
            <img src={p.image} alt={p.name} className="team-img" />
            <div className="team-info">
              <div className="team-name">{p.name}</div>
              <div className="team-specialty">{p.specialty}</div>
              <div style={{ marginTop: 12 }}><Stars /></div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 60 }}>
        <button className="btn-primary" onClick={onBook}>Reservar con nuestro equipo</button>
      </div>
    </div>
  );
}

function ContactoPage({ onBack }) {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", msg: "" });
  return (
    <div className="section page-enter" style={{ paddingTop: 96 }}>
      <button className="btn-back" onClick={onBack} style={{ marginBottom: 32 }}>← Volver</button>
      <span className="section-label">Contacto</span>
      <h1 className="section-title">Hablemos</h1>
      <div className="contact-grid">
        <div>
          {sent ? (
            <div style={{ background: "rgba(39,174,96,.1)", border: "1px solid rgba(39,174,96,.3)", borderRadius: 12, padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <h3 style={{ marginBottom: 8 }}>¡Mensaje enviado!</h3>
              <p style={{ color: "var(--text2)" }}>Te responderemos pronto.</p>
            </div>
          ) : (
            <div>
              {[["Nombre", "name", "text", "Tu nombre"], ["Email", "email", "email", "tu@email.com"]].map(([l, k, t, p]) => (
                <div key={k} className="form-group">
                  <label className="form-label">{l}</label>
                  <input className="form-input" type={t} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={p} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Mensaje</label>
                <textarea className="form-input" rows={5} value={form.msg} onChange={(e) => setForm({ ...form, msg: e.target.value })} placeholder="¿En qué podemos ayudarte?" style={{ resize: "vertical" }} />
              </div>
              <button className="btn-primary" onClick={() => { if (form.name && form.email && form.msg) setSent(true); }}>Enviar Mensaje</button>
            </div>
          )}
        </div>
        <div>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, marginBottom: 24 }}>Información</h3>
          {[["📍", "Dirección", "Calle del Barbero, 45\n28004 Madrid, España"], ["📞", "Teléfono", "+34 910 987 654"], ["✉️", "Email", "hola@tubarberia.es"], ["🕐", "Horario", "Lun–Sáb: 10:00 – 21:00\nDomingo: Cerrado"]].map(([ico, tit, txt]) => (
            <div key={tit} className="contact-info-item">
              <span style={{ fontSize: 20 }}>{ico}</span>
              <div>
                <div className="contact-info-title">{tit}</div>
                <div className="contact-info-text" style={{ whiteSpace: "pre-line" }}>{txt}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── BOOKING FLOW ─────────────────────────────────────────────────────────────
function BookingFlow({ onBack, services = SERVICES, professionals = PROFESSIONALS }: any) {
  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [prof, setProf] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [period, setPeriod] = useState(null);
  const [name, setName] = useState("");
  const [contactType, setContactType] = useState("email");
  const [contact, setContact] = useState("");
  const [contactErr, setContactErr] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  const [saving, setSaving] = useState(false);

  const { bookings, blocked, loading, addBooking } = useFirebaseData();
  const timeSlotsRef = useRef(null);
  const continueRef = useRef(null);

  useEffect(() => {
    if (!contact) { setContactErr(""); return; }
    if (contactType === "email") setContactErr(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? "" : "Email no válido");
    else setContactErr(/^\+?[0-9\s-]{9,}$/.test(contact) ? "" : "Teléfono no válido");
  }, [contact, contactType]);

  useEffect(() => {
    if (step === 3 && date && timeSlotsRef.current)
      setTimeout(() => timeSlotsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }, [date, step]);

  useEffect(() => {
    if (step === 3 && time && continueRef.current)
      setTimeout(() => continueRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }, [time, step]);

  const availSlots = useMemo(() => {
    const slots = getAvailableSlots(date, prof?.name, service, bookings, blocked);
    // Si es hoy, filtrar horas que ya han pasado (+ 30min de margen)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    if (date === todayStr) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes() + 30;
      return slots.filter((t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m > currentMinutes;
      });
    }
    return slots;
  }, [date, prof, service, bookings, blocked]);
  const slotsByPeriod = useMemo(() => ({
    Mañana: availSlots.filter((t) => parseInt(t) < 13),
    Mediodía: availSlots.filter((t) => parseInt(t) >= 13 && parseInt(t) < 16),
    Tarde: availSlots.filter((t) => parseInt(t) >= 16),
  }), [availSlots]);

  const handleBooking = async () => {
    if (contactErr || !name || !contact || saving) return;
    setSaving(true);
    try {
      const bookingData = { service, professional: prof.name, date, time, clientName: name, contactType, contactValue: contact };
      const id = await addBooking(bookingData);
      // Enviar email de confirmación
      if (contactType === "email") {
        const cancelUrl = `${window.location.origin}/cancelar?id=${id}`;
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "confirmation", booking: { ...bookingData, id }, cancelUrl }),
        });
      }
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); onBack(); }, 3000);
    } catch (e) {
      console.error("Error guardando reserva:", e);
      alert("Error al guardar la reserva. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const prevMonthOk = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1) >= new Date(today.getFullYear(), today.getMonth(), 1);

  if (showSuccess) return (
    <div className="success-wrap page-enter">
      <div className="success-card gold-glow">
        <div className="success-icon">✓</div>
        <h2>¡Reserva Confirmada!</h2>
        <p style={{ marginTop: 8 }}>Tu cita ha sido agendada con éxito. ¡Te esperamos! 💈</p>
      </div>
    </div>
  );

  if (loading) return <Spinner label="Cargando disponibilidad…" />;

  const renderCalendar = () => {
    const yr = calMonth.getFullYear(), mo = calMonth.getMonth();
    const first = new Date(yr, mo, 1), last = new Date(yr, mo + 1, 0);
    const startDow = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(<div key={`e${i}`} className="cal-day empty" />);
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      const local = new Date(d); local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
      const ds = local.toISOString().split("T")[0];
      const isSun = d.getDay() === 0;
      const dd = new Date(d); dd.setHours(0, 0, 0, 0);
      const isPast = dd < today;
      const ok = !isSun && !isPast;
      const isSel = date === ds;
      cells.push(
        <div key={ds} className={`cal-day${isSel ? " selected" : ok ? " selectable" : " disabled"}`}
          onClick={() => ok && (setDate(ds), setTime(""), setPeriod(null))}>
          {d.getDate()}
        </div>
      );
    }
    return cells;
  };

  return (
    <div className="booking-wrap">
      <div className="booking-card page-enter">
        <button className="btn-back" onClick={onBack} style={{ marginBottom: 20 }}>← Volver</button>
        <div className="booking-header">
          <h2>Reserva tu <span style={{ color: "var(--gold)", fontStyle: "italic" }}>Cita</span></h2>
          <p style={{ color: "var(--text2)" }}>Agenda tu próximo corte en pocos pasos</p>
        </div>
        <StepBar step={step} />

        {step === 1 && (
          <div className="page-enter">
            <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>Selecciona un Servicio</p>
            <div className="services-grid">
              {SERVICES.map((s) => (
                <div key={s.id} className={`service-card${service?.id === s.id ? " selected" : ""}`} onClick={() => setService(s)}>
                  <div className="service-name">{s.name}</div>
                  <div className="service-details">
                    <span className="service-price">€{s.price}</span>
                    <span className="service-dur">⏱ {s.duration}m</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-continue" disabled={!service} onClick={() => setStep(2)}>Continuar</button>
          </div>
        )}

        {step === 2 && (
          <div className="page-enter">
            <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>Elige tu Barbero</p>
            <div className="team-grid team-grid-booking">
              {PROFESSIONALS.map((p) => (
                <div key={p.name} className={`team-card${prof?.name === p.name ? " selected" : ""}`} onClick={() => setProf(p)}>
                  <img src={p.image} alt={p.name} className="team-img" />
                  <div className="team-info">
                    <div className="team-name">{p.name}</div>
                    <div className="team-specialty">{p.specialty}</div>
                    {prof?.name === p.name && <div className="team-check">✓ Seleccionado</div>}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-continue" disabled={!prof} onClick={() => setStep(3)}>Continuar</button>
          </div>
        )}

        {step === 3 && (
          <div className="page-enter">
            <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>Fecha y Hora</p>
            <div className="calendar-wrap">
              <div className="cal-nav">
                <button className="cal-btn" onClick={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} disabled={!prevMonthOk}>‹</button>
                <span className="cal-month">{calMonth.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</span>
                <button className="cal-btn" onClick={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
              </div>
              <div className="cal-grid">
                {["L", "M", "X", "J", "V", "S", "D"].map((d) => <div key={d} className="cal-day-label">{d}</div>)}
                {renderCalendar()}
              </div>
            </div>

            {date && (
              <div ref={timeSlotsRef}>
                <p style={{ textAlign: "center", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)", marginBottom: 12 }}>Horario del día</p>
                <div className="period-tabs">
                  {["Mañana", "Mediodía", "Tarde"].map((p) => (
                    <button key={p} className={`period-tab${period === p ? " active" : ""}`} onClick={() => { setPeriod(p); setTime(""); }}>
                      {p} <span style={{ fontSize: 12, opacity: .6 }}>({slotsByPeriod[p].length})</span>
                    </button>
                  ))}
                </div>
                {period && (
                  slotsByPeriod[period].length > 0
                    ? <div className="slots-grid">{slotsByPeriod[period].map((t) => <button key={t} className={`slot${time === t ? " selected" : ""}`} onClick={() => setTime(t)}>{t}</button>)}</div>
                    : <p style={{ color: "var(--text3)", textAlign: "center", padding: "32px 0", fontSize: 14 }}>No hay huecos disponibles en esta franja</p>
                )}
              </div>
            )}
            <button ref={continueRef} className="btn-continue" disabled={!time} onClick={() => setStep(4)}>Continuar</button>
          </div>
        )}

        {step === 4 && (
          <div className="page-enter">
            <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>Tus Datos</p>
            <div className="form-group">
              <label className="form-label">Nombre Completo *</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre y apellidos" />
            </div>
            <div className="form-group">
              <label className="form-label">{contactType === "email" ? "Email" : "Teléfono"} *</label>
              <div className="input-row">
                <div className="input-prefix">
                  <select value={contactType} onChange={(e) => { setContactType(e.target.value); setContact(""); }}>
                    <option value="email">📧</option>
                    <option value="phone">📱</option>
                  </select>
                </div>
                <input className={`form-input input-suffix${contactErr ? " error" : ""}`} type={contactType === "email" ? "email" : "tel"} value={contact} onChange={(e) => setContact(e.target.value)} placeholder={contactType === "email" ? "tu@email.com" : "+34 600 000 000"} />
              </div>
              {contactErr && <p className="form-err">{contactErr}</p>}
            </div>

            <div className="summary-box">
              <div className="summary-title">Resumen</div>
              {[["💈", service?.name], ["👤", prof?.name], ["📅", date ? new Date(date.replace(/-/g, "/")).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : ""], ["🕒", time]].map(([ico, val]) => val ? (
                <div key={ico} className="summary-row"><span>{ico}</span><span>{val}</span></div>
              ) : null)}
              <div className="summary-total">€{service?.price}</div>
            </div>

            <button className="btn-continue" disabled={!name || !contact || !!contactErr || saving} onClick={handleBooking}>
              {saving ? "Guardando…" : "✓ Confirmar Reserva"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({ onLogout }) {
  const [tab, setTab] = useState("bookings");
  const [selBooking, setSelBooking] = useState(null);
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

  const { bookings, blocked, loading, config, removeBooking, addBlockedSlot, removeBlockedSlot, saveConfig } = useFirebaseData();

  // Config editable state (initialized from Firebase or defaults)
  const DEFAULT_SERVICES = [
    { id: 1, name: "Corte de cabello", price: 13, duration: 25 },
    { id: 2, name: "Arreglo de barba", price: 8, duration: 15 },
    { id: 3, name: "Corte + barba", price: 17, duration: 40 },
    { id: 4, name: "Corte jubilado", price: 10, duration: 25 },
    { id: 5, name: "Corte para niños", price: 13, duration: 25 },
  ];
  const DEFAULT_PROFESSIONALS = [
    { name: "Jesús", image: "https://i.postimg.cc/fySSnKcg/42368ead-ac49-4030-b692-ba8bdc33f35e.jpg", specialty: "Cortes clásicos" },
    { name: "Lancas", image: "https://i.postimg.cc/3RnFJn0P/f3c66a03-9069-489f-a39f-2baa5cb94e62.jpg", specialty: "Fade & degradado" },
    { name: "Eddy", image: "https://i.postimg.cc/g2mjNd7P/36f5acf1-aee9-473a-9284-e6f8c9f18058.jpg", specialty: "Barba & estilo" },
  ];
  const [editServices, setEditServices] = useState(DEFAULT_SERVICES);
  const [editProfs, setEditProfs] = useState(DEFAULT_PROFESSIONALS);
  const [configSaved, setConfigSaved] = useState(false);

  useEffect(() => {
    if (config) {
      if (config.services) setEditServices(config.services);
      if (config.professionals) setEditProfs(config.professionals);
    }
  }, [config]);

  const handleSaveConfig = async () => {
    await saveConfig({ services: editServices, professionals: editProfs });
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2500);
  };

  const upcoming = useMemo(() => {
    const now = new Date();
    const cd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const ct = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return [...bookings].filter((b) => b.date > cd || (b.date === cd && b.time >= ct))
      .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
  }, [bookings]);

  const deleteBooking = async (id) => {
    const bk = bookings.find((b) => b.id === id);
    if (bk?.contactType === "email" && bk.contactValue) {
      const subj = encodeURIComponent("Cancelación de cita - Tu barbería");
      const body = encodeURIComponent(`Hola ${bk.clientName},\nTu cita del ${bk.date} a las ${bk.time} ha sido cancelada.\n\nEl equipo de Tu barbería`);
      window.open(`mailto:${bk.contactValue}?subject=${subj}&body=${body}`, "_blank");
    }
    await removeBooking(id);
  };

  const toggleBlock = async (date, prof, time) => {
    const existing = blocked.find((b) => b.date === date && b.professional === prof && b.time === time);
    if (existing) await removeBlockedSlot(existing.id);
    else await addBlockedSlot(date, prof, time);
  };

  const applyBlock = async () => {
    if (!blockDate || !blockProf) return;
    const si = blockAllDay ? 0 : ALL_SLOTS.indexOf(blockStart);
    const ei = blockAllDay ? ALL_SLOTS.length - 1 : ALL_SLOTS.indexOf(blockEnd);
    if (si < 0 || ei < 0 || si > ei) { alert("Horarios inválidos"); return; }
    for (let i = si; i <= ei; i++) {
      const t = ALL_SLOTS[i];
      if (!blocked.some((b) => b.date === blockDate && b.professional === blockProf && b.time === t))
        await addBlockedSlot(blockDate, blockProf, t);
    }
    setShowBlockModal(false); setBlockStart(""); setBlockEnd(""); setBlockAllDay(false);
  };

  const getNextDays = (count = 7) => {
    const days = [], cur = new Date(); cur.setDate(cur.getDate() + dateOffset);
    while (days.length < count) {
      if (cur.getDay() !== 0) {
        days.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  };

  const earningsBks = useMemo(() => bookings.filter((b) => earningsFilter === "ALL" || b.professional === earningsFilter), [bookings, earningsFilter]);
  const revenue = earningsBks.reduce((s, b) => s + b.service.price, 0);
  const cost = earningsBks.length * costPerSvc;
  const profit = revenue - cost;
  const days = getNextDays(7);

  const renderGrid = (p) => (
    <div className="grid-wrap" key={p}>
      <div style={{ background: "var(--bg3)", padding: "10px 14px", fontWeight: 700, fontSize: 13, borderBottom: "1px solid var(--border)", color: "var(--gold)" }}>👤 {p}</div>
      <table className="avail-table">
        <thead>
          <tr>
            <th>Hora</th>
            {days.map((d) => (
              <th key={d}>
                <div>{new Date(d.replace(/-/g, "/")).toLocaleDateString("es-ES", { weekday: "short" })}</div>
                <div style={{ fontWeight: 400, opacity: .6 }}>{new Date(d.replace(/-/g, "/")).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_SLOTS.map((t, idx) => (
            <tr key={t}>
              <td>{t}</td>
              {days.map((d) => {
                const isBlk = blocked.some((b) => b.date === d && b.professional === p && b.time === t);
                let occ = null;
                for (const bk of upcoming) {
                  if (bk.date === d && bk.professional === p) {
                    const bi = ALL_SLOTS.indexOf(bk.time);
                    const bn = Math.ceil(bk.service.duration / 15);
                    if (idx >= bi && idx < bi + bn) { occ = bk; break; }
                  }
                }
                if (occ && occ.time !== t) return null;
                const span = occ ? Math.ceil(occ.service.duration / 15) : 1;
                return (
                  <td key={d} rowSpan={span}
                    className={occ ? "booked" : isBlk ? "blocked" : "free"}
                    onClick={() => { if (occ) setSelBooking(occ); else if (isBlk) toggleBlock(d, p, t); else { setBlockDate(d); setBlockProf(p); setShowBlockModal(true); } }}
                    title={occ ? `${occ.clientName} – ${occ.service.name}` : isBlk ? "Bloqueado (clic para desbloquear)" : "Disponible (clic para bloquear)"}>
                    {occ ? <div className="booked-cell"><div>💈</div><div style={{ fontWeight: 700 }}>{occ.clientName}</div><div style={{ opacity: .7 }}>{occ.service.name}</div></div> : isBlk ? "🚫" : "✓"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) return <Spinner label="Cargando datos…" />;

  return (
    <div className="admin-wrap">
      <div className="admin-inner">
        <div className="admin-header">
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 32 }}>Panel Admin</h1>
          <button className="btn-logout" onClick={onLogout}>↩ Salir</button>
        </div>

        {/* LIVE BADGE */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(39,174,96,.08)", border: "1px solid rgba(39,174,96,.2)", borderRadius: 8, padding: "6px 14px", marginBottom: 20, fontSize: 13, color: "rgba(39,174,96,.9)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(39,174,96,.9)", display: "inline-block", animation: "pulse 2s ease infinite" }} />
          Sincronizado con Firebase · {bookings.length} reservas en total
        </div>

        <div className="admin-tabs">
          {[["bookings", "📅 Reservas"], ["avail", "🚫 Disponibilidad"], ["earnings", "💰 Ganancias"], ["config", "⚙️ Configuración"]].map(([id, label]) => (
            <button key={id} className={`admin-tab${tab === id ? " active" : ""}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === "bookings" && (
          <div className="admin-card page-enter">
            <h2 style={{ marginBottom: 20, fontSize: 22 }}>Próximas Reservas <span style={{ color: "var(--gold)" }}>({upcoming.length})</span></h2>
            {upcoming.length === 0 ? (
              <div className="empty-state"><div style={{ fontSize: 40, marginBottom: 16 }}>📭</div><p>No hay reservas próximas</p></div>
            ) : upcoming.map((bk) => (
              <div key={bk.id} className="booking-item" onClick={() => setSelBooking(bk)}>
                <div className="booking-item-left">
                  <h4>{bk.service.name}</h4>
                  <p>👤 {bk.clientName} · 💈 {bk.professional}</p>
                  <p>📅 {new Date(bk.date.replace(/-/g, "/")).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · 🕒 {bk.time}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="booking-price">€{bk.service.price}</div>
                  <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 4 }}>Ver detalles →</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "avail" && (
          <div className="admin-card page-enter">
            <h2 style={{ marginBottom: 20, fontSize: 22 }}>Gestionar Disponibilidad</h2>
            <div style={{ background: "rgba(201,162,39,.06)", border: "1px solid rgba(201,162,39,.2)", borderRadius: 10, padding: 14, marginBottom: 24, fontSize: 13, color: "var(--text2)" }}>
              💡 Clic en celda verde para bloquear · Clic en 🚫 para desbloquear · Clic en 💈 para ver detalles
            </div>
            <div className="avail-controls">
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Barbero</label>
                <select className="select-input" value={profFilter} onChange={(e) => setProfFilter(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  <option value="ALL">👥 Todos</option>
                  {PROFESSIONALS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="nav-btns">
                <button className="cal-btn" onClick={() => setDateOffset((v) => Math.max(0, v - 7))} disabled={dateOffset <= 0}>‹</button>
                <button className="cal-btn" onClick={() => setDateOffset(0)} title="Hoy">⌂</button>
                <button className="cal-btn" onClick={() => setDateOffset((v) => v + 7)}>›</button>
              </div>
            </div>
            {profFilter && profFilter !== "ALL" && renderGrid(profFilter)}
            {profFilter === "ALL" && PROFESSIONALS.map((p) => renderGrid(p.name))}
            {!profFilter && <div className="empty-state"><div style={{ fontSize: 40, marginBottom: 16 }}>👆</div><p>Selecciona un barbero para ver su calendario</p></div>}
            <div className="legend">
              {[["rgba(39,174,96,.2)", "Disponible"], ["rgba(192,57,43,.25)", "Bloqueado"], ["rgba(41,128,185,.2)", "Reservado"]].map(([bg, l]) => (
                <div key={l} className="legend-item"><div className="legend-dot" style={{ background: bg }} />{l}</div>
              ))}
            </div>
          </div>
        )}

        {tab === "earnings" && (
          <div className="admin-card page-enter">
            <h2 style={{ marginBottom: 24, fontSize: 22 }}>Análisis de Ganancias</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Filtrar Barbero</label>
                <select className="select-input" value={earningsFilter} onChange={(e) => setEarningsFilter(e.target.value)} style={{ width: "100%" }}>
                  <option value="ALL">Todos</option>
                  {PROFESSIONALS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Coste por Servicio (€)</label>
                <input type="number" className="form-input" value={costPerSvc} onChange={(e) => setCostPerSvc(Number(e.target.value))} min={0} />
              </div>
            </div>
            <div className="stats-grid">
              <div className="stat-card blue"><div className="stat-card-num">€{revenue.toFixed(0)}</div><div className="stat-card-label">Ingresos</div></div>
              <div className="stat-card red"><div className="stat-card-num">€{cost.toFixed(0)}</div><div className="stat-card-label">Costes</div></div>
              <div className="stat-card green"><div className="stat-card-num">€{profit.toFixed(0)}</div><div className="stat-card-label">Beneficio Neto</div></div>
            </div>
            <p style={{ color: "var(--text3)", fontSize: 13, textAlign: "center" }}>
              Basado en {earningsBks.length} reservas · €{costPerSvc} por servicio{earningsFilter !== "ALL" ? ` · ${earningsFilter}` : ""}
            </p>
          </div>
        )}
      </div>

        {tab === "config" && (
          <div className="admin-card page-enter">
            <h2 style={{ marginBottom: 24, fontSize: 22 }}>⚙️ Configuración</h2>

            {/* SERVICES */}
            <h3 style={{ fontSize: 16, marginBottom: 16, color: "var(--gold)" }}>Servicios</h3>
            {editServices.map((svc, i) => (
              <div key={i} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, alignItems: "center" }}>
                  <input className="form-input" value={svc.name} onChange={(e) => setEditServices(editServices.map((s, j) => j === i ? { ...s, name: e.target.value } : s))} placeholder="Nombre" style={{ marginBottom: 0 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "var(--text3)", fontSize: 13 }}>€</span>
                    <input type="number" className="form-input" value={svc.price} onChange={(e) => setEditServices(editServices.map((s, j) => j === i ? { ...s, price: Number(e.target.value) } : s))} style={{ marginBottom: 0, width: 70 }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "var(--text3)", fontSize: 13 }}>min</span>
                    <input type="number" className="form-input" value={svc.duration} onChange={(e) => setEditServices(editServices.map((s, j) => j === i ? { ...s, duration: Number(e.target.value) } : s))} style={{ marginBottom: 0, width: 70 }} />
                  </div>
                  <button onClick={() => setEditServices(editServices.filter((_, j) => j !== i))} style={{ background: "rgba(192,57,43,.15)", border: "1px solid rgba(192,57,43,.3)", color: "#e74c3c", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 14 }}>✕</button>
                </div>
              </div>
            ))}
            <button onClick={() => setEditServices([...editServices, { id: Date.now(), name: "Nuevo servicio", price: 10, duration: 20 }])}
              style={{ background: "rgba(201,162,39,.08)", border: "1px dashed rgba(201,162,39,.3)", color: "var(--gold)", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 14, width: "100%", marginBottom: 32 }}>
              + Añadir servicio
            </button>

            {/* PROFESSIONALS */}
            <h3 style={{ fontSize: 16, marginBottom: 16, color: "var(--gold)" }}>Barberos</h3>
            {editProfs.map((p, i) => (
              <div key={i} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 12, display: "flex", gap: 16, alignItems: "center" }}>
                <img src={p.image} alt={p.name} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border2)", flexShrink: 0 }} onError={(e: any) => e.target.src = "https://via.placeholder.com/56"} />
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input className="form-input" value={p.name} onChange={(e) => setEditProfs(editProfs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Nombre" style={{ marginBottom: 0 }} />
                  <input className="form-input" value={p.specialty} onChange={(e) => setEditProfs(editProfs.map((x, j) => j === i ? { ...x, specialty: e.target.value } : x))} placeholder="Especialidad" style={{ marginBottom: 0 }} />
                  <input className="form-input" value={p.image} onChange={(e) => setEditProfs(editProfs.map((x, j) => j === i ? { ...x, image: e.target.value } : x))} placeholder="URL de foto" style={{ marginBottom: 0, gridColumn: "1 / -1", fontSize: 12 }} />
                </div>
                <button onClick={() => setEditProfs(editProfs.filter((_, j) => j !== i))} style={{ background: "rgba(192,57,43,.15)", border: "1px solid rgba(192,57,43,.3)", color: "#e74c3c", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>✕</button>
              </div>
            ))}
            <button onClick={() => setEditProfs([...editProfs, { name: "Nuevo barbero", image: "", specialty: "" }])}
              style={{ background: "rgba(201,162,39,.08)", border: "1px dashed rgba(201,162,39,.3)", color: "var(--gold)", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 14, width: "100%", marginBottom: 32 }}>
              + Añadir barbero
            </button>

            {/* SAVE BUTTON */}
            <button onClick={handleSaveConfig}
              style={{ width: "100%", padding: 16, background: configSaved ? "rgba(39,174,96,.2)" : "linear-gradient(135deg,var(--gold),var(--gold-dim))", border: configSaved ? "1px solid rgba(39,174,96,.4)" : "none", color: configSaved ? "rgba(39,174,96,.9)" : "#000", borderRadius: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 700, transition: "all .3s" }}>
              {configSaved ? "✓ Guardado correctamente" : "Guardar cambios"}
            </button>
            <p style={{ color: "var(--text3)", fontSize: 12, textAlign: "center", marginTop: 12 }}>Los cambios se aplican en tiempo real en la web.</p>
          </div>
        )}

      {selBooking && <BookingModal booking={selBooking} onClose={() => setSelBooking(null)} onCancel={deleteBooking} />}

      {showBlockModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowBlockModal(false)}>
          <div className="modal-box page-enter">
            <button className="modal-close" onClick={() => setShowBlockModal(false)}>✕</button>
            <h3 className="modal-title">Bloquear Horario</h3>
            <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 6 }}><strong>Fecha:</strong> {blockDate && new Date(blockDate.replace(/-/g, "/")).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</p>
            <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20 }}><strong>Barbero:</strong> {blockProf}</p>
            <label className="checkbox-label">
              <input type="checkbox" checked={blockAllDay} onChange={(e) => setBlockAllDay(e.target.checked)} />
              Bloquear todo el día
            </label>
            {!blockAllDay && (
              <div className="block-modal-grid">
                <div>
                  <label className="form-label">Desde</label>
                  <select className="form-input" value={blockStart} onChange={(e) => setBlockStart(e.target.value)}>
                    <option value="">Hora inicio</option>
                    {ALL_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Hasta</label>
                  <select className="form-input" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)}>
                    <option value="">Hora fin</option>
                    {ALL_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn-cancel-sm" onClick={() => setShowBlockModal(false)}>Cancelar</button>
              <button className="btn-confirm-del" disabled={!blockAllDay && (!blockStart || !blockEnd)} onClick={applyBlock}>Bloquear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN LOGIN ──────────────────────────────────────────────────────────────
function AdminLogin({ onSuccess }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const check = () => {
    if (pw === ADMIN_PASSWORD) onSuccess();
    else { setErr(true); setPw(""); setTimeout(() => setErr(false), 2000); }
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, padding: "48px 40px", maxWidth: 380, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>🔒</div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, marginBottom: 8 }}>Área Admin</h2>
        <p style={{ color: "var(--text2)", marginBottom: 28, fontSize: 14 }}>Introduce la contraseña para continuar</p>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="Contraseña" className="form-input"
          style={{ marginBottom: 16, textAlign: "center", borderColor: err ? "var(--red)" : undefined }} />
        {err && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>Contraseña incorrecta</p>}
        <button className="btn-primary" onClick={check} style={{ width: "100%" }}>Entrar</button>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("home");
  const [subPage, setSubPage] = useState("home");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [appConfig, setAppConfig] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "main"), (snap) => {
      if (snap.exists()) setAppConfig(snap.data());
    });
    return () => unsub();
  }, []);

  const liveServices = appConfig?.services || SERVICES;
  const liveProfessionals = appConfig?.professionals || PROFESSIONALS;

  const goTo = (p) => { setPage(p); setMobileOpen(false); window.scrollTo(0, 0); };

  return (
    <>
      <style>{css}</style>

      {page !== "booking" && page !== "admin" && (
        <header className="header">
          <div className="header-inner">
            <div className="logo" onClick={() => { goTo("home"); setSubPage("home"); }}>
              <div className="logo-icon">💈</div>
              <span className="logo-text">Tu barbería</span>
            </div>
            <nav className="nav">
              <a className={subPage === "home" ? "active" : ""} onClick={() => { setSubPage("home"); goTo("home"); }} style={{ cursor: "pointer" }}>Inicio</a>
              <a className={subPage === "equipo" ? "active" : ""} onClick={() => { setSubPage("equipo"); goTo("home"); }} style={{ cursor: "pointer" }}>Equipo</a>
              <a className={subPage === "contacto" ? "active" : ""} onClick={() => { setSubPage("contacto"); goTo("home"); }} style={{ cursor: "pointer" }}>Contacto</a>
              <button className="btn-book-header nav" onClick={() => goTo("booking")}>Reservar Cita</button>
            </nav>
            <button className="hamburger" onClick={() => setMobileOpen(true)}><span /><span /><span /></button>
          </div>
        </header>
      )}

      <div className={`mobile-menu${mobileOpen ? " open" : ""}`}>
        <button className="mobile-close" onClick={() => setMobileOpen(false)}>✕</button>
        {[["home", "Inicio"], ["equipo", "Equipo"], ["contacto", "Contacto"]].map(([p, l]) => (
          <a key={p} style={{ cursor: "pointer" }} onClick={() => { setSubPage(p); goTo("home"); setMobileOpen(false); }}>{l}</a>
        ))}
        <button className="btn-primary" onClick={() => { goTo("booking"); setMobileOpen(false); }}>Reservar Cita</button>
      </div>

      {page === "home" && (
        <>
          {subPage === "home" && <Landing onBook={() => goTo("booking")} setSubPage={setSubPage} professionals={liveProfessionals} services={liveServices} />}
          {subPage === "equipo" && <EquipoPage onBack={() => setSubPage("home")} onBook={() => goTo("booking")} professionals={liveProfessionals} />}
          {subPage === "contacto" && <ContactoPage onBack={() => setSubPage("home")} />}
          <footer className="footer">
            <div className="footer-logo">Tu barbería</div>
            <p>© {new Date().getFullYear()} Todos los derechos reservados</p>
          </footer>
        </>
      )}
      {page === "booking" && <div style={{ paddingTop: 64 }}><BookingFlow onBack={() => goTo("home")} services={liveServices} professionals={liveProfessionals} /></div>}
      {page === "admin" && (adminAuth ? <AdminPanel onLogout={() => { setAdminAuth(false); goTo("home"); }} /> : <AdminLogin onSuccess={() => setAdminAuth(true)} />)}
    </>
  );
}
