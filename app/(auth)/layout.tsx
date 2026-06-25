import { LegalFooter } from "@/components/legal/LegalFooter";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md flex-1 flex flex-col justify-center">{children}</div>
      <LegalFooter className="mt-8 pb-4" />
    </main>
  );
}
