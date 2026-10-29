import type { BatchRecord } from '@rayfin-app/shared';
import { useState } from 'react';

import { EmptyState } from '@/components/states';

function fmt(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function BatchRow({
  batch,
  now,
  onOpen,
  image,
}: {
  readonly batch: BatchRecord;
  readonly now: number;
  readonly onOpen: (b: BatchRecord) => void;
  readonly image?: string;
}) {
  const days = Math.max(
    0,
    Math.floor(
      ((batch.endDate ? batch.endDate.getTime() : now) -
        batch.startDate.getTime()) /
        86_400_000
    )
  );
  const totalDays = batch.endDate
    ? Math.max(
        1,
        Math.round(
          (batch.endDate.getTime() - batch.startDate.getTime()) / 86_400_000
        )
      )
    : 0;
  const hasMetrics =
    batch.endDate != null && batch.ogPoints != null && batch.fgPoints != null;
  const metrics: { label: string; value: string }[] = hasMetrics
    ? [
        { label: 'OG', value: ((batch.ogPoints ?? 0) / 1000).toFixed(3) },
        { label: 'FG', value: ((batch.fgPoints ?? 0) / 1000).toFixed(3) },
        ...(batch.abvTenths != null
          ? [{ label: 'ABV', value: `${(batch.abvTenths / 10).toFixed(1)}%` }]
          : []),
        ...(batch.attenuationPct != null
          ? [{ label: 'Atten.', value: `${batch.attenuationPct}%` }]
          : []),
        ...(batch.avgTempTenthsF != null
          ? [{ label: 'Avg temp', value: `${(batch.avgTempTenthsF / 10).toFixed(1)}°F` }]
          : []),
      ]
    : [];
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(batch)}
        className={`w-full space-y-200 rounded-xl border border-border border-l-4 bg-card px-400 py-300 text-left shadow-sm transition hover:-translate-y-px hover:bg-hover hover:shadow-md ${
          batch.endDate ? 'border-l-border' : 'border-l-primary'
        }`}
      >
        <div className="flex w-full items-center gap-400">
          {image ? (
            <img
              src={image}
              alt=""
              referrerPolicy="no-referrer"
              className="h-14 w-14 shrink-0 rounded-lg border border-border bg-white object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-200 truncate font-heading text-400 font-semibold">
              {batch.name}
              <span
                className={`shrink-0 rounded-full px-200 py-100-nudge font-base text-100 font-medium uppercase tracking-wide ${
                  batch.endDate ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-brand-foreground'
                }`}
              >
                {batch.endDate ? 'Done' : 'Fermenting'}
              </span>
            </p>
            <p className="truncate text-200 text-muted-foreground">
              {batch.yeast} · started {fmt(batch.startDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-numeric text-400 font-semibold">
              {batch.endDate
                ? `${totalDays} ${totalDays === 1 ? 'day' : 'days'}`
                : `Day ${days + 1}`}
            </p>
            <p className="text-200 text-muted-foreground">
              target OG {(batch.targetOGPoints / 1000).toFixed(3)}
            </p>
          </div>
        </div>
        {metrics.length ? (
          <dl className="flex flex-wrap gap-x-500 gap-y-100 border-t border-border pt-200">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-baseline gap-100">
                <dt className="text-200 text-muted-foreground">{m.label}</dt>
                <dd className="font-numeric text-300 font-semibold">{m.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </button>
    </li>
  );
}

function Group({
  title,
  batches,
  now,
  onOpen,
  empty,
  imageFor,
}: {
  readonly title: string;
  readonly batches: readonly BatchRecord[];
  readonly now: number;
  readonly onOpen: (b: BatchRecord) => void;
  readonly empty: { title: string; hint: string };
  readonly imageFor?: (b: BatchRecord) => string | undefined;
}) {
  return (
    <section className="space-y-300">
      <h2 className="font-heading text-500 font-semibold">{title}</h2>
      {batches.length === 0 ? (
        <EmptyState title={empty.title} hint={empty.hint} />
      ) : (
        <ul className="space-y-200">
          {batches.map((b) => (
            <BatchRow key={b.id} batch={b} now={now} onOpen={onOpen} image={imageFor?.(b)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function BatchList({
  batches,
  onOpen,
  imageFor,
}: {
  readonly batches: readonly BatchRecord[];
  readonly onOpen: (b: BatchRecord) => void;
  readonly imageFor?: (b: BatchRecord) => string | undefined;
}) {
  const [now] = useState(() => Date.now());
  const active = batches.filter((b) => !b.endDate);
  const done = batches.filter((b) => b.endDate);
  return (
    <div className="space-y-800">
      <Group
        title="Active batches"
        batches={active}
        now={now}
        onOpen={onOpen}
        imageFor={imageFor}
        empty={{
          title: 'Nothing fermenting',
          hint: 'Create a batch to start tracking gravity and temperature.',
        }}
      />
      <Group
        title="Completed batches"
        batches={done}
        now={now}
        onOpen={onOpen}
        imageFor={imageFor}
        empty={{
          title: 'No completed batches yet',
          hint: 'Finished batches show up here once you mark them complete.',
        }}
      />
    </div>
  );
}
