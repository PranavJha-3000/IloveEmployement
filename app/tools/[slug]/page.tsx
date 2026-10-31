import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PresetRunner } from "@/components/engine/PresetRunner";
import { PRESETS, PRESET_CATEGORY_LABELS, getPresetBySlug } from "@/lib/presets";

export function generateStaticParams() {
  return PRESETS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const preset = getPresetBySlug(slug);
  if (!preset) return {};
  return {
    title: `${preset.name} — free AI tool | iloveemployment`,
    description: preset.description,
    alternates: { canonical: `/tools/${preset.slug}` },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const preset = getPresetBySlug(slug);
  if (!preset) notFound();

  const related = PRESETS.filter((p) => p.category === preset.category && p.id !== preset.id).slice(0, 4);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1180px] px-6 pb-20 pt-8">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Link href="/" className="transition-colors hover:text-zinc-600">
              Employment Tools
            </Link>
            <span aria-hidden>/</span>
            <span>{PRESET_CATEGORY_LABELS[preset.category]}</span>
            <span aria-hidden>/</span>
            <span className="font-medium text-zinc-600">{preset.name}</span>
          </nav>

          <header className="mb-8 mt-5 max-w-2xl">
            <h1 className="text-[28px] font-bold tracking-tight text-zinc-900">{preset.name}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">{preset.description}</p>
          </header>

          <PresetRunner presetId={preset.id} />

          {related.length > 0 && (
            <section className="mt-16 border-t border-zinc-100 pt-8">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-400">
                More {PRESET_CATEGORY_LABELS[preset.category].toLowerCase()} tools
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((p) => (
                  <Link
                    key={p.id}
                    href={`/tools/${p.slug}`}
                    className="rounded-xl border border-zinc-200 p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    <p className="text-[14px] font-semibold text-zinc-900">{p.name}</p>
                    <p className="mt-1 text-[12.5px] text-zinc-500">{p.tagline}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
