import Link from "next/link";
import { LEGAL_ENTITY } from "@/lib/legal-versions";

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`text-center text-xs text-muted-foreground space-x-3 ${className}`}>
      <Link href="/privacy" className="hover:text-foreground underline-offset-2 hover:underline">
        Privacy
      </Link>
      <Link href="/terms" className="hover:text-foreground underline-offset-2 hover:underline">
        Terms
      </Link>
      <Link href="/cookies" className="hover:text-foreground underline-offset-2 hover:underline">
        Cookies
      </Link>
      <span className="block mt-2">{LEGAL_ENTITY.name}</span>
    </footer>
  );
}
