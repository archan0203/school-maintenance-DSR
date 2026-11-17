import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const events = body?.events || [];
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    for (const event of events) {
      if (
        event.type === "message" &&
        event.message?.type === "text" &&
        event.message.text.trim().toLowerCase() === "id" &&
        lineToken
      ) {
        const sourceId =
          event.source?.groupId ||
          event.source?.roomId ||
          event.source?.userId ||
          "ไม่พบรหัส ID";

        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lineToken}`,
          },
          body: JSON.stringify({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: `รหัสสำหรับตั้งค่า LINE_TARGET_ID คือ:\n${sourceId}`,
              },
            ],
          }),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
