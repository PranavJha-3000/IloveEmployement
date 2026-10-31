import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PresetRunner } from "@/components/engine/PresetRunner";
import { ToolCard, ToolIcon } from "@/components/tools/ToolCard";
import { PRESET_CATEGORY_LABELS, PUBLIC_PRESETS, getPresetBySlug } from "@/lib/presets";
import { TOOLS, toolById } from "@/lib/tools";

export function generateStaticParams() {
  return PUBLIC_PRESETS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const preset = getPresetBySlug(slug);
  if (!preset) return {};
  return {
    title: `${preset.name}: free AI tool | iloveemployment`,
    description: preset.description,
    alternates: { canonical: `/tools/${preset.slug}` },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const preset = getPresetBySlug(slug);
  if (!preset || preset.hidden) notFound();

  const tool = toolById(preset.id);
  const related = TOOLS.filter((t) => t.category === preset.category && t.id !== preset.id).slice(0, 4);
  const stage = PRESET_CATEGORY_LABELS[preset.category];

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="tool-hero">
          <div className="tool-hero-inner">
            <nav aria-label="Breadcrumb" className="crumbs">
              <Link href="/#tools">All tools</Link>
              <span aria-hidden>/</span>
              <span>{stage}</span>
              <span aria-hidden>/</span>
              <span aria-current="page">{preset.name}</span>
            </nav>
            <div className="tool-title">
              {tool && <ToolIcon tool={tool} />}
              <h1>{preset.name}</h1>
            </div>
            <p className="tool-lede">{preset.description}</p>
          </div>
        </div>

        <div className="tool-body">
          <PresetRunner presetId={preset.id} />

          {related.length > 0 && (
            <section className="related">
              <h2>More {stage.toLowerCase()} tools</h2>
              <div className="tool-grid">
                {related.map((t) => (
                  <ToolCard key={t.id} tool={t} />
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
