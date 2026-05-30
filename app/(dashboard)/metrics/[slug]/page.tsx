import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMetric, METRICS, CATEGORY_LABELS } from '@/lib/metrics-library'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PageProps {
  params: Promise<{ slug: string }>
}

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
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
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
    <div className="max-w-2xl space-y-8">
      {/* Back */}
      <div>
        <Link
          href="/metrics"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Metrics Library
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">
          {CATEGORY_LABELS[metric.category]}
        </p>
        <h1 className="text-3xl font-bold text-gray-900">{metric.title}</h1>
        {metric.units && (
          <p className="text-sm text-gray-400">
            Measured in <span className="font-medium text-gray-600">{metric.units}</span>
          </p>
        )}
        <p className="text-base text-gray-600 leading-relaxed">{metric.short_description}</p>
      </div>

      {/* Divider */}
      <hr className="border-gray-100" />

      {/* Sections */}
      <div className="space-y-7">
        <Section title="What is it?">
          <div className="space-y-3">{paragraphs(metric.full_explanation)}</div>
        </Section>

        <Section title="How is it measured?">
          <p>{metric.how_measured}</p>
        </Section>

        {metric.units && (
          <Section title="Units">
            <p>{metric.units}</p>
          </Section>
        )}

        <Section title="Why do people track it?">
          <p>{metric.why_track_it}</p>
        </Section>

        <Section title="Typical examples">
          <p>{metric.typical_examples}</p>
        </Section>

        <Section title="Limitations">
          <p>{metric.limitations}</p>
        </Section>
      </div>

      {/* Related metrics */}
      {related.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Related metrics</h2>
          <div className="flex flex-wrap gap-2">
            {related.map(r => (
              <Link
                key={r.slug}
                href={`/metrics/${r.slug}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                {r.title}
                <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Back to library */}
      <div className="pt-4 border-t border-gray-100">
        <Link
          href="/metrics"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors font-medium"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Metrics Library
        </Link>
      </div>
    </div>
  )
}
