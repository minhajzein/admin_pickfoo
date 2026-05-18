"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Headset, Mic, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { SupportMessageBubble } from "@/components/support/SupportMessageBubble";
import {
  fetchSupportThread,
  fetchSupportThreads,
  markSupportThreadRead,
  dispatchAdminSupportMessage,
  sendSupportMessage,
  uploadSupportMedia,
  type SupportMessage,
  type SupportMessagePayload,
  type SupportThread,
} from "@/lib/api/support";

export default function SupportPage() {
  const searchParams = useSearchParams();
  const initialPartnerId = searchParams.get("partnerId") ?? "";

  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialPartnerId);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const recordStartedRef = useRef<number | null>(null);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const list = await fetchSupportThreads();
      setThreads(list);
    } catch {
      toast.error("Failed to load support threads");
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const loadChat = useCallback(async (partnerId: string) => {
    if (!partnerId) return;
    setLoadingChat(true);
    try {
      const data = await fetchSupportThread(partnerId);
      setMessages(data.messages);
      await markSupportThreadRead(partnerId);
      setThreads((prev) =>
        prev.map((t) =>
          t.partnerId === partnerId ? { ...t, unreadByAdmin: 0 } : t,
        ),
      );
    } catch {
      toast.error("Failed to load conversation");
    } finally {
      setLoadingChat(false);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (selectedPartnerId) {
      void loadChat(selectedPartnerId);
    } else {
      setMessages([]);
    }
  }, [selectedPartnerId, loadChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const onMessage = (event: Event) => {
      const detail = (event as CustomEvent<SupportMessagePayload>).detail;
      if (!detail?.message) return;
      setThreads((prev) => {
        const idx = prev.findIndex((t) => t.partnerId === detail.thread.partnerId);
        const updated = { ...detail.thread };
        if (idx < 0) return [updated, ...prev];
        const copy = [...prev];
        copy[idx] = updated;
        copy.sort((a, b) => {
          const at = a.lastMessageAt ?? "";
          const bt = b.lastMessageAt ?? "";
          return bt.localeCompare(at);
        });
        return copy;
      });
      if (detail.thread.partnerId === selectedPartnerId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === detail.message.id)) return prev;
          return [...prev, detail.message];
        });
        if (detail.message.senderType === "partner") {
          void markSupportThreadRead(detail.thread.partnerId);
        }
      } else if (detail.message.senderType === "partner") {
        toast.message("New partner support message", {
          description: detail.thread.partnerName ?? detail.thread.partnerId,
        });
      }
    };

    const onThread = (event: Event) => {
      const detail = (event as CustomEvent<{ thread: SupportThread }>).detail;
      if (!detail?.thread) return;
      setThreads((prev) => {
        const idx = prev.findIndex((t) => t.partnerId === detail.thread.partnerId);
        if (idx < 0) return [detail.thread, ...prev];
        const copy = [...prev];
        copy[idx] = detail.thread;
        return copy;
      });
    };

    window.addEventListener("admin:support-message", onMessage);
    window.addEventListener("admin:support-thread-updated", onThread);
    return () => {
      window.removeEventListener("admin:support-message", onMessage);
      window.removeEventListener("admin:support-thread-updated", onThread);
    };
  }, [selectedPartnerId]);

  const applyPayload = useCallback(
    (payload: SupportMessagePayload) => {
      dispatchAdminSupportMessage(payload);
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
      setThreads((prev) =>
        prev.map((t) =>
          t.partnerId === selectedPartnerId ? payload.thread : t,
        ),
      );
    },
    [selectedPartnerId],
  );

  const handleSendText = async () => {
    const text = draft.trim();
    if (!text || !selectedPartnerId || sending) return;
    setSending(true);
    setDraft("");
    try {
      const payload = await sendSupportMessage(selectedPartnerId, {
        body: text,
        messageType: "text",
      });
      applyPayload(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      toast.error(msg);
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const handleSendFile = async (file: File, caption?: string) => {
    if (!selectedPartnerId || sending) return;
    setSending(true);
    try {
      const upload = await uploadSupportMedia(file);
      const payload = await sendSupportMessage(selectedPartnerId, {
        body: caption,
        messageType: upload.messageType,
        mediaStaticUrl: upload.staticUrl,
        mediaFileName: upload.fileName || file.name,
        mediaMimeType: upload.fileType || file.type,
        mediaSize: upload.fileSize ?? file.size,
      });
      applyPayload(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send attachment";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const caption = draft.trim() || undefined;
    if (caption) setDraft("");
    void handleSendFile(file, caption);
  };

  const toggleVoice = async () => {
    if (!selectedPartnerId || sending) return;
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceChunksRef.current = [];
      recordStartedRef.current = Date.now();
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) voiceChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(voiceChunksRef.current, { type: "audio/webm" });
        const durationMs = recordStartedRef.current
          ? Date.now() - recordStartedRef.current
          : undefined;
        recordStartedRef.current = null;
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        void (async () => {
          setSending(true);
          try {
            const upload = await uploadSupportMedia(file);
            const payload = await sendSupportMessage(selectedPartnerId, {
              messageType: "audio",
              mediaStaticUrl: upload.staticUrl,
              mediaFileName: file.name,
              mediaMimeType: file.type,
              mediaSize: file.size,
              mediaDurationMs: durationMs,
            });
            applyPayload(payload);
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "Failed to send voice message",
            );
          } finally {
            setSending(false);
          }
        })();
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access is required for voice messages.");
    }
  };

  const selectedThread = threads.find((t) => t.partnerId === selectedPartnerId);

  return (
    <div className="flex flex-col h-full min-h-0 p-4 lg:p-6 gap-4">
      <div className="flex items-center gap-3">
        <Headset className="h-8 w-8 text-[#98E32F]" />
        <div>
          <h1 className="text-2xl font-bold text-white">Partner support</h1>
          <p className="text-sm text-white/60">
            Live chat with delivery partners
          </p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-4 rounded-xl border border-white/10 overflow-hidden bg-[#002833]">
        <aside className="w-full max-w-sm border-r border-white/10 flex flex-col min-h-0">
          <div className="p-3 border-b border-white/10 text-sm font-semibold text-white/80">
            Conversations
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingThreads ? (
              <p className="p-4 text-white/50 text-sm">Loading…</p>
            ) : threads.length === 0 ? (
              <p className="p-4 text-white/50 text-sm">No conversations yet.</p>
            ) : (
              threads.map((t) => {
                const active = t.partnerId === selectedPartnerId;
                return (
                  <button
                    key={t.partnerId}
                    type="button"
                    onClick={() => setSelectedPartnerId(t.partnerId)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${
                      active ? "bg-white/10" : ""
                    }`}
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">
                          {t.partnerName || "Partner"}
                        </p>
                        <p className="text-xs text-white/50 truncate">
                          {t.partnerPhone || t.partnerId}
                        </p>
                        {t.lastMessagePreview ? (
                          <p className="text-xs text-white/40 mt-1 truncate">
                            {t.lastMessagePreview}
                          </p>
                        ) : null}
                      </div>
                      {t.unreadByAdmin > 0 ? (
                        <span className="shrink-0 bg-[#98E32F] text-[#013644] text-xs font-bold px-2 py-0.5 rounded-full">
                          {t.unreadByAdmin}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex-1 flex flex-col min-h-0 min-w-0">
          {!selectedPartnerId ? (
            <div className="flex-1 flex items-center justify-center text-white/50 text-sm">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-white/10">
                <p className="font-semibold text-white">
                  {selectedThread?.partnerName || "Partner"}
                </p>
                <p className="text-xs text-white/50">
                  {selectedThread?.partnerPhone || selectedPartnerId}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingChat ? (
                  <p className="text-white/50 text-sm">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="text-white/50 text-sm">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <SupportMessageBubble key={m.id} message={m} />
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t border-white/10 flex flex-col gap-2">
                {recording ? (
                  <p className="text-xs text-red-400 text-center font-medium">
                    Recording… tap mic to send
                  </p>
                ) : null}
                <div className="flex gap-2 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    className="hidden"
                    onChange={onFilePicked}
                  />
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/5"
                    title="Attach image, video, or PDF"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => void toggleVoice()}
                    className={`rounded-xl border p-2 ${
                      recording
                        ? "border-red-400 text-red-400 bg-red-400/10"
                        : "border-white/10 text-white/70 hover:bg-white/5"
                    }`}
                    title="Voice message"
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendText();
                      }
                    }}
                    placeholder="Reply to partner…"
                    className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-white text-sm outline-none focus:border-[#98E32F]/50"
                  />
                  <button
                    type="button"
                    disabled={sending || !draft.trim()}
                    onClick={() => void handleSendText()}
                    className="rounded-xl bg-[#98E32F] text-[#013644] px-4 py-2 font-semibold disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
