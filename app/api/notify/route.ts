import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      request_no,
      title,
      location_text,
      description,
      reporter_name,
      status,
      image_url,
    } = body;

    const nowThai = new Date().toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const detailLink = siteUrl && id ? `${siteUrl}/requests/${id}` : "";

    const tasks: Promise<any>[] = [];

    // 1. ส่งแจ้งเตือนเข้า LINE Messaging API
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const lineTargetId = process.env.LINE_TARGET_ID;

    if (lineToken && lineTargetId) {
      const lines = [
        "🔧 มีรายการแจ้งซ่อมใหม่",
        `เลขที่: ${request_no || "-"}`,
        `หัวข้อ: ${title || "-"}`,
        `สถานที่: ${location_text || "-"}`,
        `อาการ: ${description || "-"}`,
        `ผู้แจ้ง: ${reporter_name || "-"}`,
        `เวลา: ${nowThai} น.`,
      ];
      if (detailLink) {
        lines.push(`เปิดดูรายการ: ${detailLink}`);
      }

      tasks.push(
        fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lineToken}`,
          },
          body: JSON.stringify({
            to: lineTargetId,
            messages: [{ type: "text", text: lines.join("\n") }],
          }),
        })
      );
    }

    // 2. ส่งข้อมูลบันทึกลง Google Sheets
    const sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
    if (sheetUrl) {
      tasks.push(
        fetch(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request_no,
            created_at_th: nowThai,
            title,
            location_text,
            description,
            reporter_name,
            status: status || "รอตรวจสอบ",
            image_url: image_url || "-",
          }),
        })
      );
    }

    await Promise.allSettled(tasks);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Notify failed" },
      { status: 500 }
    );
  }
}
