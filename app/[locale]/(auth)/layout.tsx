import { LegalFooter } from "@/components/legal/LegalFooter";
import { LanguageSelector } from "@/components/i18n/LanguageSelector";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md flex justify-end mb-3">
        <LanguageSelector compact className="max-w-[220px]" />
      </div>
      <div className="w-full max-w-md flex-1 flex flex-col justify-center">{children}</div>
      <LegalFooter className="mt-8 pb-4" />
    </main>
  );
}
