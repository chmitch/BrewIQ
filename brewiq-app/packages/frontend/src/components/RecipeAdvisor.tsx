import { MessageCircle, Send } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';

import type { Library } from '@/hooks/use-library';
import { getRayfinClient } from '@/lib/rayfin-client';

type Turn = { role: 'user' | 'advisor'; text: string };

const STARTERS = [
  "I don't know what to brew next",
  'Something with banana and clove',
  'A fruity, dry beer for summer',
  'A hoppy beer with tropical fruit',
];

/** Minimal inline formatting: **bold** and [source] citations. */
function Inline({ text }: { readonly text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\[[^\]\n]+\])/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : part.startsWith('[') && part.endsWith(']') ? (
          <span key={i} className="text-100 text-muted-foreground">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Reply({ text }: { readonly text: string }) {
  return (
    <div className="space-y-200">
      {text.split(/\n+/).map((line, i) =>
        /^\s*[-*]\s+/.test(line) ? (
          <p key={i} className="pl-300">
            • <Inline text={line.replace(/^\s*[-*]\s+/, '')} />
          </p>
        ) : (
          <p key={i}>
            <Inline text={line} />
          </p>
        ),
      )}
    </div>
  );
}

export function RecipeAdvisor({
  library,
  onPickRecipe,
}: {
  readonly library: Library;
  readonly onPickRecipe: (recipeId: string) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [responseId, setResponseId] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [turns, busy]);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    setInput('');
    setError(null);
    setTurns((t) => [...t, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const res = await (await getRayfinClient()).functions.adviseBrew.invoke({
        message,
        previousResponseId: responseId,
      });
      if (!res.ok) throw new Error(res.message);
      setResponseId(res.responseId);
      setTurns((t) => [...t, { role: 'advisor', text: res.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const mentioned = (text: string) =>
    library.recipes.filter((r) => text.toLowerCase().includes(r.name.toLowerCase()));

  return (
    <section className="space-y-300 rounded-2xl border border-border bg-card p-500 shadow-sm">
      <div className="flex items-center gap-200">
        <MessageCircle className="icon-size-300 text-primary" />
        <h2 className="font-heading text-500 font-semibold">Not sure what to brew?</h2>
      </div>
      <p className="text-300 text-muted-foreground">
        Chat with the recipe advisor. It draws on your recipe and yeast library plus published brewing research.
      </p>

      {turns.length === 0 ? (
        <div className="flex flex-wrap gap-200">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => void send(s)}
              className="rounded-full border border-border px-300 py-100 text-200 hover:bg-hover disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div className="max-h-[28rem] space-y-300 overflow-y-auto pr-100">
          {turns.map((t, i) =>
            t.role === 'user' ? (
              <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-300 py-200 text-300 text-primary-foreground">
                {t.text}
              </p>
            ) : (
              <div key={i} className="space-y-200 rounded-2xl bg-muted px-300 py-200 text-300">
                <Reply text={t.text} />
                {mentioned(t.text).length > 0 ? (
                  <div className="flex flex-wrap gap-200 pt-100">
                    {mentioned(t.text).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onPickRecipe(r.id)}
                        className="rounded-lg border border-primary px-300 py-100 text-200 font-medium text-primary hover:bg-hover"
                      >
                        Use {r.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          )}
          {busy ? <p className="animate-pulse text-300 text-muted-foreground">Thinking…</p> : null}
          <div ref={end} />
        </div>
      )}

      {error ? (
        <p role="alert" className="text-200 text-destructive">
          {error}
        </p>
      ) : null}

      <form
        className="flex gap-200"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          className="w-full rounded-lg border border-input bg-background px-300 py-200 text-300 outline-none focus:ring-2 focus:ring-ring"
          value={input}
          maxLength={2000}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What are you in the mood for?"
          aria-label="Message the recipe advisor"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="rounded-lg bg-primary px-300 py-200 text-primary-foreground disabled:opacity-50"
        >
          <Send className="icon-size-200" />
        </button>
      </form>
      <p className="text-100 text-muted-foreground">AI advice can be wrong; check yeast and temperature details before brewing.</p>
    </section>
  );
}
