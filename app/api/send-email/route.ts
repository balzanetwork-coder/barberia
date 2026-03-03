import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "Tu Barbería <onboarding@resend.dev>";

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  return res.json();
}

function emailTemplate(title: string, body: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#0d0d0d;font-family:'Helvetica Neue',Arial,sans-serif">
      <div style="max-width:520px;margin:40px auto;background:#141414;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#c9a227,#8a6d18);padding:32px;text-align:center">
          <div style="font-size:32px;margin-bottom:8px">💈</div>
          <h1 style="color:#000;font-size:22px;margin:0;font-weight:800">Tu barbería</h1>
        </div>
        <div style="padding:32px">
          <h2 style="color:#f0ece3;font-size:20px;margin:0 0 20px">${title}</h2>
          ${body}
        </div>
        <div style="padding:20px 32px;border-top:1px solid #2a2a2a;text-align:center">
          <p style="color:#6b6258;font-size:12px;margin:0">© Tu barbería · Todos los derechos reservados</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function bookingRow(label: string, value: string) {
  return `
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #2a2a2a">
      <span style="color:#a09888;font-size:14px">${label}</span>
      <span style="color:#f0ece3;font-size:14px;font-weight:600">${value}</span>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const { type, booking, cancelUrl } = await req.json();

    if (!booking?.contactValue || booking?.contactType !== "email") {
      return NextResponse.json({ ok: false, reason: "no email" });
    }

    const dateStr = new Date(booking.date.replace(/-/g, "/"))
      .toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    if (type === "confirmation") {
      const html = emailTemplate(
        "¡Tu cita está confirmada! ✓",
        `
        <p style="color:#a09888;font-size:15px;margin:0 0 20px">Hola <strong style="color:#f0ece3">${booking.clientName}</strong>, tu reserva ha sido confirmada.</p>
        ${bookingRow("Servicio", booking.service.name)}
        ${bookingRow("Barbero", booking.professional)}
        ${bookingRow("Fecha", dateStr)}
        ${bookingRow("Hora", booking.time)}
        ${bookingRow("Precio", `€${booking.service.price}`)}
        <div style="margin-top:28px;padding:16px;background:#1c1c1c;border-radius:10px;border:1px solid #333">
          <p style="color:#a09888;font-size:13px;margin:0 0 8px">¿Necesitas cancelar tu cita?</p>
          <a href="${cancelUrl}" style="display:inline-block;background:rgba(192,57,43,.2);color:#e74c3c;border:1px solid rgba(192,57,43,.4);padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
            Cancelar mi cita
          </a>
        </div>
        <p style="color:#6b6258;font-size:12px;margin:20px 0 0">Si tienes alguna pregunta llámanos o escríbenos.</p>
        `
      );
      await sendEmail(booking.contactValue, "✓ Cita confirmada - Tu barbería", html);
    }

    if (type === "reminder") {
      const html = emailTemplate(
        "Recordatorio: tienes cita mañana 📅",
        `
        <p style="color:#a09888;font-size:15px;margin:0 0 20px">Hola <strong style="color:#f0ece3">${booking.clientName}</strong>, te recordamos que mañana tienes cita en Tu barbería.</p>
        ${bookingRow("Servicio", booking.service.name)}
        ${bookingRow("Barbero", booking.professional)}
        ${bookingRow("Fecha", dateStr)}
        ${bookingRow("Hora", booking.time)}
        <div style="margin-top:28px;padding:16px;background:#1c1c1c;border-radius:10px;border-left:3px solid #c9a227">
          <p style="color:#c9a227;font-size:14px;margin:0;font-weight:600">¡Te esperamos! 💈</p>
        </div>
        <div style="margin-top:16px;padding:16px;background:#1c1c1c;border-radius:10px;border:1px solid #333">
          <p style="color:#a09888;font-size:13px;margin:0 0 8px">¿No puedes venir? Cancela tu cita:</p>
          <a href="${cancelUrl}" style="display:inline-block;background:rgba(192,57,43,.2);color:#e74c3c;border:1px solid rgba(192,57,43,.4);padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
            Cancelar mi cita
          </a>
        </div>
        `
      );
      await sendEmail(booking.contactValue, "📅 Recordatorio de cita - Tu barbería", html);
    }

    if (type === "cancellation") {
      const html = emailTemplate(
        "Tu cita ha sido cancelada",
        `
        <p style="color:#a09888;font-size:15px;margin:0 0 20px">Hola <strong style="color:#f0ece3">${booking.clientName}</strong>, tu cita ha sido cancelada correctamente.</p>
        ${bookingRow("Servicio", booking.service.name)}
        ${bookingRow("Barbero", booking.professional)}
        ${bookingRow("Fecha", dateStr)}
        ${bookingRow("Hora", booking.time)}
        <div style="margin-top:28px;padding:16px;background:#1c1c1c;border-radius:10px;border-left:3px solid #c9a227">
          <p style="color:#a09888;font-size:14px;margin:0">¿Quieres reservar otro día? Visita nuestra web y elige una nueva fecha.</p>
        </div>
        `
      );
      await sendEmail(booking.contactValue, "Cita cancelada - Tu barbería", html);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
