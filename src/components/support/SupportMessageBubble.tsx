"use client";

import { FileText, Video } from "lucide-react";
import type { SupportMessage } from "@/lib/api/support";

export function SupportMessageBubble({ message }: { message: SupportMessage }) {
  const fromAdmin = message.senderType === "admin";
  const align = fromAdmin ? "justify-end" : "justify-start";
  const bubbleClass = fromAdmin
    ? "bg-[#98E32F]/25 text-white"
    : "bg-white/10 text-white";

  const renderMedia = () => {
    const url = message.mediaUrl;
    if (!url) return null;

    switch (message.messageType) {
      case "image":
        return (
          <a href={url} target="_blank" rel="noreferrer" className="block mt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={message.mediaFileName || "Image"}
              className="max-w-[240px] rounded-lg border border-white/10"
            />
          </a>
        );
      case "video":
        return (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-sm"
          >
            <Video className="h-5 w-5 text-[#98E32F]" />
            Play video
          </a>
        );
      case "pdf":
        return (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-sm"
          >
            <FileText className="h-5 w-5 text-red-400" />
            {message.mediaFileName || "PDF document"}
          </a>
        );
      case "audio":
        return (
          <audio
            controls
            preload="metadata"
            src={url}
            className="mt-1 block max-w-[260px] h-9"
          />
        );
      default:
        return null;
    }
  };

  const showCaption =
    (message.body?.trim().length ?? 0) > 0 && message.messageType !== "text";

  return (
    <div className={`flex ${align}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${bubbleClass}`}>
        {!fromAdmin && message.senderLabel ? (
          <p className="text-[10px] text-[#98E32F] font-semibold mb-1">
            {message.senderLabel}
          </p>
        ) : null}
        {message.messageType === "text" || !message.mediaUrl ? (
          <p className="whitespace-pre-wrap">{message.body}</p>
        ) : (
          renderMedia()
        )}
        {showCaption ? (
          <p className="whitespace-pre-wrap mt-2 text-white/90">{message.body}</p>
        ) : null}
      </div>
    </div>
  );
}
