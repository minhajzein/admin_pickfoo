"use client";

import { useEffect, useRef, useState } from "react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { Send, Loader2, MessageSquare } from "lucide-react";
import {
  fetchRestaurantMessages,
  markRestaurantMessagesRead,
  sendRestaurantMessage,
  type RestaurantMessage,
} from "@/lib/api/restaurantMessages";
import { toast } from "sonner";

interface Props {
  ownerId: string;
  restaurantName: string;
}

function dateLabel(d: Date): string {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM yyyy");
}

export function RestaurantMessageThread({ ownerId, restaurantName }: Props) {
  const [messages, setMessages] = useState<RestaurantMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { messages: msgs } = await fetchRestaurantMessages(ownerId);
      setMessages(msgs);
      void markRestaurantMessagesRead(ownerId).catch(() => undefined);
    } catch (e: any) {
      setError(e.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText("");
    setSending(true);
    try {
      const msg = await sendRestaurantMessage(ownerId, trimmed);
      setMessages((prev) => [...prev, msg]);
    } catch (e: any) {
      toast.error(e.message || "Failed to send message");
      setText(trimmed); // restore on failure
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={load}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[480px] flex-col rounded-xl border border-white/10 bg-white/5">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <MessageSquare className="h-4 w-4 text-[#98E32F]" />
        <span className="text-sm font-semibold text-white">
          Messages with {restaurantName}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/40">
            <MessageSquare className="h-10 w-10" />
            <p className="text-sm">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          (() => {
            const nodes: React.ReactNode[] = [];
            messages.forEach((msg, i) => {
              const msgDate = new Date(msg.createdAt);
              const prevDate =
                i > 0 ? new Date(messages[i - 1].createdAt) : null;
              if (!prevDate || !isSameDay(prevDate, msgDate)) {
                nodes.push(
                  <div
                    key={`divider-${msg.id}`}
                    className="flex items-center gap-2 py-2"
                  >
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[10px] text-white/40">
                      {dateLabel(msgDate)}
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                );
              }
              const isAdmin = msg.sender === "admin";
              nodes.push(
                <div
                  key={msg.id}
                  className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      isAdmin
                        ? "bg-[#98E32F]/20 text-white"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    {!isAdmin && (
                      <p className="mb-1 text-[10px] font-semibold text-[#98E32F]">
                        {restaurantName}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </p>
                    <p
                      className={`mt-1 text-[10px] ${
                        isAdmin ? "text-white/50 text-right" : "text-white/40"
                      }`}
                    >
                      {format(new Date(msg.createdAt), "hh:mm a")}
                    </p>
                  </div>
                </div>
              );
            });
            return nodes;
          })()
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-3 flex gap-2">
        <input
          className="flex-1 rounded-xl bg-white/8 px-4 py-2 text-sm text-white placeholder-white/40 outline-none border border-white/10 focus:border-[#98E32F]/60"
          placeholder={`Message ${restaurantName}…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#98E32F] text-black disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
