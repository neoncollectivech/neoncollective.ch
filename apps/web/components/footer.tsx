import type { Dictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";

import { Link } from "@heroui/link";

import { NeonLink } from "@/components/neon-link";
import { siteConfig } from "@/config/site";
import { InstagramIcon } from "@/components/icons";

interface FooterProps {
  locale: Locale;
  dictionary: Dictionary;
}

export const Footer: React.FC<FooterProps> = ({ locale, dictionary }) => {
  return (
    <footer className="w-full mx-auto">
      <div className="neon-line mx-6" />
      <div className="mx-auto flex items-center justify-between flex-col-reverse sm:flex-row py-8 px-6 gap-4">
        <span className="text-[0.625rem] font-mono text-foreground/20 uppercase tracking-widest">
          NEON &copy; {new Date().getFullYear()}
        </span>
        <div className="flex items-center gap-6">
          <NeonLink href={`/${locale}/impressum`} neonStyle="footer">
            {dictionary.footer.impressum}
          </NeonLink>
          <NeonLink href={`/${locale}/privacy-policy`} neonStyle="footer">
            {dictionary.footer.privacy}
          </NeonLink>
          <Link
            isExternal
            aria-label="Instagram"
            className="text-foreground/20 hover:text-neon transition-colors"
            href={siteConfig.links.instagram}
          >
            <InstagramIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </footer>
  );
};
