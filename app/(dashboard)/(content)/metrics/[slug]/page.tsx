import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMetric, METRICS, CATEGORY_LABELS } from '@/lib/metrics-library'

interface PageProps { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return METRICS.map(m => ({ slug: m.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const metric = getMetric(slug)
  if (!metric) return {}
  return { title: `${metric.title} — Metrics Library — KeepGoing` }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-6 border-b border-[#D9D9D9] dark:border-zinc-800">
      <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-3">{title}</p>
      <div className="text-base text-[#0D0D0D] dark:text-zinc-200 leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

export default async function MetricPage({ params }: PageProps) {
  const { slug } = await params
  const metric = getMetric(slug)
  if (!metric) notFound()

  const related = metric.related_metrics
    .map(s => getMetric(s))
    .filter((m): m is NonNullable<typeof m> => m != null)

  const paragraphs = (text: string) =>
    text.split('\n\n').map((p, i) => <p key={i}>{p}</p>)

  return (
    <div className="max-w-2xl">

      {/* Back */}
      <Link href="/metrics"
        className="inline-flex items-center gap-1 text-sm text-[#888888] hover:text-[#0D0D0D] dark:hover:text-zinc-100 transition-colors mb-8">
        ← Metrics Library
      </Link>

      {/* Header */}
      <div className="border-b border-[#D9D9D9] dark:border-zinc-800 pb-8 mb-0">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-3">
          {CATEGORY_LABELS[metric.category]}
        </p>
        <h1 className="font-display font-bold text-[#0D0D0D] dark:text-zinc-50 leading-tight mb-3"
            style={{ fontSize: '2.5rem' }}>
          {metric.title}
        </h1>
        {metric.units && (
          <p className="text-sm text-[#888888] mb-3">Measured in <span className="font-medium text-[#0D0D0D] dark:text-zinc-200">{metric.units}</span></p>
        )}
        <p className="text-base text-[#888888] leading-relaxed">{metric.short_description}</p>
      </div>

      {/* Sections */}
      <Section title="What is it?">
        {paragraphs(metric.full_explanation)}
      </Section>
      <Section title="How is it measured?">
        <p>{metric.how_measured}</p>
      </Section>
      {metric.units && (
        <Section title="Units">
          <p>{metric.units}</p>
        </Section>
      )}
      <Section title="Why track it?">
        <p>{metric.why_track_it}</p>
      </Section>
      <Section title="Typical examples">
        <p>{metric.typical_examples}</p>
      </Section>
      <Section title="Limitations">
        <p>{metric.limitations}</p>
      </Section>

      {/* Related metrics */}
      {related.length > 0 && (
        <div className="py-6 border-b border-[#D9D9D9] dark:border-zinc-800">
          <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-4">Related metrics</p>
          <div className="flex flex-wrap gap-3">
            {related.map(r => (
              <Link key={r.slug} href={`/metrics/${r.slug}`}
                className="text-sm font-medium text-[#0D0D0D] dark:text-zinc-200 hover:text-[#E5173F] transition-colors">
                {r.title} →
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="pt-6">
        <Link href="/metrics"
          className="text-sm text-[#888888] hover:text-[#0D0D0D] dark:hover:text-zinc-100 transition-colors">
          ← Back to Metrics Library
        </Link>
      </div>
    </div>
  )
}
