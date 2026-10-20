"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BlogFaq } from "@/lib/api/blog";

export const MAX_FAQS = 20;

export function BlogFaqEditor({
  value,
  onChange,
}: {
  value: BlogFaq[];
  onChange: (next: BlogFaq[]) => void;
}) {
  const update = (index: number, patch: Partial<BlogFaq>) =>
    onChange(value.map((faq, i) => (i === index ? { ...faq, ...patch } : faq)));

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {value.length === 0 ? (
        <p className="text-sm text-white/40">
          No questions yet. FAQs appear at the end of the post as expandable
          items.
        </p>
      ) : null}

      {value.map((faq, index) => (
        <div
          key={index}
          className="space-y-3 rounded-lg border border-white/10 bg-white/2 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-white/50">
              Question {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label="Move up"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
                aria-label="Move down"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-300 hover:text-red-200"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label="Remove question"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Input
            value={faq.question}
            maxLength={300}
            placeholder="Do you deliver to Payyampally?"
            onChange={(e) => update(index, { question: e.target.value })}
          />
          <Textarea
            value={faq.answer}
            maxLength={3000}
            rows={3}
            placeholder="Answer"
            onChange={(e) => update(index, { answer: e.target.value })}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        disabled={value.length >= MAX_FAQS}
        onClick={() => onChange([...value, { question: "", answer: "" }])}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add question
      </Button>
    </div>
  );
}
