const PULSE = "animate-pulse rounded-md bg-neutral-100 motion-reduce:animate-none";

function Block({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`${PULSE} ${className}`} />;
}

export function PageHeaderSkeleton({ controls = false }: { controls?: boolean }) {
  return (
    <div className="border-b border-line">
      <div className="flex h-14 items-center gap-3 px-4">
        <Block className="h-8 w-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Block className="h-4 w-28" />
          {controls && <Block className="h-2.5 w-20" />}
        </div>
        <Block className="h-8 w-8 shrink-0 rounded-full" />
      </div>
      {controls && (
        <div className="flex h-12 items-center gap-2 overflow-hidden px-4">
          <Block className="h-7 w-16 shrink-0 rounded-full" />
          <Block className="h-7 w-20 shrink-0 rounded-full" />
          <Block className="h-7 w-14 shrink-0 rounded-full" />
          <Block className="h-7 w-24 shrink-0 rounded-full" />
          <Block className="h-7 w-16 shrink-0 rounded-full" />
        </div>
      )}
    </div>
  );
}

export function PostCardSkeleton({
  media = false,
  connector = false,
}: {
  media?: boolean;
  connector?: boolean;
}) {
  return (
    <article className="flex gap-3 px-4 py-3.5" aria-hidden="true">
      <div className="flex flex-col items-center">
        <Block className="h-9 w-9 shrink-0 rounded-full" />
        {connector && <span className="mt-1 w-px flex-1 bg-line" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Block className="h-3 w-24" />
          <Block className="h-3 w-14" />
        </div>
        <Block className="mt-2.5 h-4 w-[82%]" />
        <Block className="mt-2 h-3 w-full" />
        <Block className="mt-1.5 h-3 w-[68%]" />
        {media && <Block className="mt-3 aspect-[16/10] w-full rounded-xl" />}
        <div className="mt-3 flex items-center gap-3">
          <Block className="h-3 w-12" />
          <Block className="h-3 w-9" />
          <Block className="h-3 w-12" />
        </div>
      </div>
    </article>
  );
}

export function FeedSkeleton({
  count = 6,
  header = true,
  controls = true,
}: {
  count?: number;
  header?: boolean;
  controls?: boolean;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading content…</span>
      {header && <PageHeaderSkeleton controls={controls} />}
      <div className="divide-y divide-line">
        {Array.from({ length: count }, (_, index) => (
          <PostCardSkeleton key={index} media={index === 0} />
        ))}
      </div>
    </div>
  );
}

export function PostDetailSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading post…</span>
      <div className="border-b border-line">
        <div className="flex h-14 items-center gap-3 px-4">
          <Block className="h-8 w-8 rounded-full" />
          <div className="space-y-1.5">
            <Block className="h-4 w-16" />
            <Block className="h-2.5 w-24" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 px-4 pt-4" aria-hidden="true">
        <Block className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 pb-3">
          <div className="flex items-center gap-2">
            <Block className="h-3.5 w-28" />
            <Block className="h-5 w-16 rounded-full" />
          </div>
          <Block className="mt-2 h-2.5 w-32" />
          <Block className="mt-3 h-5 w-[88%]" />
          <Block className="mt-2 h-3 w-full" />
          <Block className="mt-1.5 h-3 w-[92%]" />
          <Block className="mt-1.5 h-3 w-[70%]" />
          <Block className="mt-4 aspect-[16/10] w-full rounded-xl" />
          <div className="mt-3 flex items-center gap-3">
            <Block className="h-3 w-12" />
            <Block className="h-3 w-9" />
            <Block className="h-3 w-12" />
          </div>
        </div>
      </div>

      <div className="border-t border-line" aria-hidden="true">
        <div className="px-4 py-3">
          <Block className="h-3 w-20" />
        </div>
        <div className="divide-y divide-line">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex gap-3 px-4 py-3.5">
              <Block className="h-8 w-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Block className="h-3 w-28" />
                <Block className="h-3 w-full" />
                <Block className="h-3 w-[64%]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading profile…</span>
      <PageHeaderSkeleton />
      <div className="border-b border-line px-4 pb-4 pt-5" aria-hidden="true">
        <div className="flex items-start gap-3">
          <Block className="h-16 w-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <Block className="h-5 w-40" />
            <Block className="h-3 w-24" />
            <Block className="h-3 w-52 max-w-full" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Block className="h-8 w-20 rounded-full" />
          <Block className="h-8 w-24 rounded-full" />
        </div>
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: 4 }, (_, index) => (
          <PostCardSkeleton key={index} media={index === 0} />
        ))}
      </div>
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading activity…</span>
      <PageHeaderSkeleton />
      <div className="border-b border-line bg-canvas px-4 py-2.5" aria-hidden="true">
        <Block className="h-3 w-64 max-w-full" />
      </div>
      <div className="divide-y divide-line" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex gap-3 px-4 py-3.5">
            <Block className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Block className="h-2.5 w-14" />
                <Block className="h-2.5 w-12" />
              </div>
              <Block className="h-3.5 w-[72%]" />
              <Block className="h-3 w-[52%]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QueueSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading moderation queue…</span>
      <div className="border-b border-line px-4 py-4" aria-hidden="true">
        <Block className="h-5 w-40" />
        <Block className="mt-2 h-3 w-24" />
      </div>
      <div className="divide-y divide-line" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="flex items-start gap-4 px-4 py-3.5">
            <div className="min-w-0 flex-1 space-y-2">
              <Block className="h-4 w-[72%]" />
              <Block className="h-3 w-[92%]" />
              <Block className="h-2.5 w-36" />
            </div>
            <Block className="h-7 w-16 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading console…</span>
      <div className="border-b border-line px-4 py-4" aria-hidden="true">
        <Block className="h-5 w-36" />
        <Block className="mt-2 h-3 w-64 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="bg-white px-4 py-3.5">
            <Block className="h-2.5 w-20" />
            <Block className="mt-2 h-6 w-10" />
          </div>
        ))}
      </div>
      <div className="divide-y divide-line" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Block className="h-3.5 w-[66%]" />
              <Block className="h-3 w-[88%]" />
            </div>
            <Block className="h-3 w-14 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading form…</span>
      <PageHeaderSkeleton />
      <div className="space-y-5 px-4 py-5" aria-hidden="true">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="space-y-2">
            <Block className="h-3 w-24" />
            <Block className={`w-full rounded-xl ${index === fields - 1 ? "h-28" : "h-10"}`} />
          </div>
        ))}
        <Block className="ml-auto h-9 w-28 rounded-full" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 8, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading list…</span>
      {title && <PageHeaderSkeleton />}
      <div className="divide-y divide-line" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3.5">
            <Block className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Block className="h-3.5 w-[60%]" />
              <Block className="h-3 w-[85%]" />
            </div>
            <Block className="h-6 w-14 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shown under a list while "Load more" is fetching the next page. */
export function LoadMoreSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="divide-y divide-line" role="status" aria-busy="true">
      <span className="sr-only">Loading more posts…</span>
      {Array.from({ length: count }, (_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </div>
  );
}
