import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDB();
    const snap = await getDocs(collection(db, "bookings"));
    const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

    const now = new Date();
    // Ventana: entre 2h55 y 3h05 desde ahora
    const windowStart = new Date(now.getTime() + (2 * 60 + 55) * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + (3 * 60 +  5) * 60 * 1000);

    const toRemind = bookings.filter((b) => {
      if (b.contactType !== "email") return false;
      const apptDate = new Date(`${b.date}T${b.time}:00`);
      return apptDate >= windowStart && apptDate <= windowEnd;
    });

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

    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}