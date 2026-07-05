import type { PublicBusiness } from "@/server/public-booking/queries";
import { APP_URL } from "@/lib/config";
import { InstagramIcon, FacebookIcon, WhatsAppIcon } from "./icons";
import {
  normalizeInstagramUrl,
  normalizeSocialUrl,
  getBusinessWhatsAppHref,
} from "./helpers";

export function PublicSiteFooter({ business }: { business: PublicBusiness }) {
  const waHref = business.showPhone
    ? getBusinessWhatsAppHref(business.phone, business.name)
    : null;
  const instagramHref = normalizeInstagramUrl(business.instagramUrl);
  const facebookHref = normalizeSocialUrl(business.facebookUrl);
  const hasSocial = !!waHref || !!instagramHref || !!facebookHref;

  return (
    <footer className="mt-14 border-t border-[var(--border)] bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-5 py-8 sm:px-8">
        {hasSocial && (
          <div className="flex items-center gap-3">
            {instagramHref && (
              <a
                href={instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-pink-300 hover:text-pink-600"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
            )}
            {facebookHref && (
              <a
                href={facebookHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-blue-300 hover:text-blue-600"
              >
                <FacebookIcon className="h-4 w-4" />
              </a>
            )}
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-green-300 hover:text-green-600"
              >
                <WhatsAppIcon className="h-4 w-4" />
              </a>
            )}
          </div>
        )}

        <p className="text-xs text-[var(--muted)]">
          © כל הזכויות שמורות ל{business.name}
        </p>
        <p className="text-xs text-[var(--muted-light)]">
          מופעל על ידי{" "}
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--foreground-soft)] hover:underline"
          >
            Allura
          </a>
        </p>
      </div>
    </footer>
  );
}
