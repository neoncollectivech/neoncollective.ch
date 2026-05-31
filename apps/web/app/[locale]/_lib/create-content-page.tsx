import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import type { ContentMap } from "@/lib/content/types";
import type { PageShellWidth } from "@/config/page-shell";

import { BlockRenderer } from "@/components/block-renderer";
import { PageShell } from "@/components/page-shell";
import { getContent } from "@/lib/content";

type ContentPageLayout = "wide" | "prose";

const layoutWidth: Record<ContentPageLayout, PageShellWidth> = {
  wide: "wide",
  prose: "prose",
};

export function createContentPage<K extends keyof ContentMap>(config: {
  slug: K;
  layout: ContentPageLayout;
}) {
  type Props = { params: Promise<{ locale: string }> };

  async function generateMetadata({ params }: Props): Promise<Metadata> {
    const locale = (await params).locale as Locale;
    const content = await getContent(config.slug, locale);

    return {
      title: content.meta.title,
      ...(content.meta.description
        ? { description: content.meta.description }
        : {}),
    };
  }

  async function Page({ params }: Props) {
    const locale = (await params).locale as Locale;
    const content = await getContent(config.slug, locale);
    const width = layoutWidth[config.layout];
    const Wrapper = config.layout === "wide" ? "section" : "article";

    return (
      <PageShell
        as={Wrapper}
        innerClassName="flex flex-col gap-4"
        width={width}
      >
        <BlockRenderer blocks={content.blocks} locale={locale} />
      </PageShell>
    );
  }

  return { generateMetadata, default: Page };
}
