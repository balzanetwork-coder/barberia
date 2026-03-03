import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// Inicializar Firebase en el servidor
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

function getDB() {
  if (!getApps().length) initializeApp(firebaseConfig);
  return getFirestore();
}

export async function GET(req: NextRequest) {
  // Verificar que viene de Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDB();
    const snap = await getDocs(collection(db, "bookings"));
    const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

    // Fecha de mañana
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,"0")}-${String(tomorrow.getDate()).padStart(2,"0")}`;

    const toRemind = bookings.filter((b) => b.date === tomorrowStr && b.contactType === "email");

    let sent = 0;
    for (const booking of toRemind) {
      const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/cancelar?id=${booking.id}`;
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "reminder", booking, cancelUrl }),
      });
      sent++;
    }

    return NextResponse.json({ ok: true, sent, date: tomorrowStr });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
