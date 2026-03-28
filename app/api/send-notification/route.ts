import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function getDB() {
  if (!getApps().length) initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
  return getFirestore();
}

export async function POST(req: NextRequest) {
  try {
    const { title, body } = await req.json();

    // Leer suscripción guardada en Firebase
    const db = getDB();
    const snap = await getDoc(doc(db, "config", "push"));
    if (!snap.exists()) return NextResponse.json({ ok: false, reason: "no subscription" });

    const subscription = JSON.parse(snap.data().subscription);
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, url: "/admin2" }));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e) });
  }
}