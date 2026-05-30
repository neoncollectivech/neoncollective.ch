import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import type { ContentMap } from "@/lib/content/types";

import { BlockRenderer } from "@/components/block-renderer";
import { getContent } from "@/lib/content";

type ContentPageLayout = "wide" | "prose";

const layoutClasses: Record<
  ContentPageLayout,
  { outer: string; inner: string; wrapper: "section" | "article" }
> = {
  wide: {
    wrapper: "section",
    outer: "flex flex-grow",
    inner: "mx-auto flex flex-col gap-4 py-8 md:py-10 lg:max-w-5xl px-6",
  },
  prose: {
    wrapper: "article",
    outer: "py-16 md:py-28 px-6",
    inner: "max-w-3xl mx-auto",
  },
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
    const { wrapper, outer, inner } = layoutClasses[config.layout];
    const Wrapper = wrapper;

    return (
      <Wrapper className={outer}>
        <div className={inner}>
          <BlockRenderer blocks={content.blocks} locale={locale} />
        </div>
      </Wrapper>
    );
  }

  return { generateMetadata, default: Page };
}
