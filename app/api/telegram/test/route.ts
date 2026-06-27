import { NextResponse } from "next/server";
import { getActiveSubscriberIds } from "@/lib/subscribers-db";

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
const telegramChatIds = [
  ...(process.env.TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
  ...(process.env.TELEGRAM_CHAT_ID ? [process.env.TELEGRAM_CHAT_ID.trim()] : []),
].filter((v, i, arr) => arr.indexOf(v) === i);

const unique = <T,>(arr: T[]) => arr.filter((v, i) => arr.indexOf(v) === i);

async function sendMessage(chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status} ${errText}`);
  }
}

export async function GET() {
  try {
    const recipients = unique([...telegramChatIds, ...getActiveSubscriberIds()]);

    if (!telegramBotToken) {
      return NextResponse.json({ ok: false, error: "missing TELEGRAM_BOT_TOKEN" }, { status: 400 });
    }

    if (recipients.length === 0) {
      return NextResponse.json({ ok: false, error: "no recipients" }, { status: 400 });
    }

    const text = [
      "Test mesajidir",
      `Saat: ${new Date().toLocaleString("az-AZ")}`,
      "Webhook ve Telegram gonderisi aktivdir.",
    ].join("\n");

    const results = await Promise.allSettled(recipients.map((chatId) => sendMessage(chatId, text)));

    const failed = results
      .map((item, index) => ({ item, chatId: recipients[index] }))
      .filter((x) => x.item.status === "rejected")
      .map((x) => ({
        chat_id: x.chatId,
        error: x.item.status === "rejected" ? String(x.item.reason) : "unknown",
      }));

    return NextResponse.json({
      ok: true,
      recipients: recipients.length,
      sent: recipients.length - failed.length,
      failed,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
