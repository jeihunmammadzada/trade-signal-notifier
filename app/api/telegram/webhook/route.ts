import { NextResponse } from "next/server";
import { deactivateSubscriber, upsertSubscriber } from "@/lib/subscribers-db";

type TelegramUpdate = {
  message?: { chat?: { id: number; type?: string; username?: string; first_name?: string } };
  channel_post?: { chat?: { id: number; type?: string; username?: string; first_name?: string } };
  my_chat_member?: {
    chat?: { id: number; type?: string; username?: string; first_name?: string };
    new_chat_member?: { status?: string };
  };
  chat_member?: {
    chat?: { id: number; type?: string; username?: string; first_name?: string };
    new_chat_member?: { status?: string };
  };
};

const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

function extractChat(update: TelegramUpdate) {
  if (update.message?.chat) return update.message.chat;
  if (update.channel_post?.chat) return update.channel_post.chat;
  if (update.my_chat_member?.chat) return update.my_chat_member.chat;
  if (update.chat_member?.chat) return update.chat_member.chat;
  return null;
}

function extractMemberStatus(update: TelegramUpdate): string | null {
  return update.my_chat_member?.new_chat_member?.status ?? update.chat_member?.new_chat_member?.status ?? null;
}

export async function POST(req: Request) {
  try {
    if (webhookSecret) {
      const incoming = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
      if (incoming !== webhookSecret) {
        return NextResponse.json({ ok: false, error: "invalid_secret" }, { status: 401 });
      }
    }

    const update = (await req.json()) as TelegramUpdate;
    const chat = extractChat(update);

    if (!chat) {
      return NextResponse.json({ ok: true, skipped: "no_chat" });
    }

    const status = extractMemberStatus(update);
    if (status && ["kicked", "left"].includes(status)) {
      deactivateSubscriber(chat.id);
      return NextResponse.json({ ok: true, action: "deactivated", chat_id: String(chat.id) });
    }

    upsertSubscriber(chat);
    return NextResponse.json({ ok: true, action: "subscribed", chat_id: String(chat.id) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
