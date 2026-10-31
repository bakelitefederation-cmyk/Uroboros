import Link from "next/link";
import { Unbounded, Golos_Text } from "next/font/google";

const display = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["500", "600"] });
const body = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"] });

const WIDTHS = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
} as const;

export default function ModuleShell({
  title,
  subtitle,
  width = "md",
  children,
}: {
  title: string;
  subtitle?: string;
  width?: keyof typeof WIDTHS;
  children: React.ReactNode;
}) {
  return (
    <main className={`${body.className} min-h-screen bg-black/75 text-white px-4 sm:px-6 py-8 sm:py-12`}>
      <div className={`mx-auto w-full ${WIDTHS[width]}`}>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-gray-200 backdrop-blur-md transition-colors hover:border-[#D4B16A]/60 hover:text-[#D4B16A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4B16A]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Все модули
        </Link>

        <div className="mt-6 flex flex-col rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-xl sm:p-8">
          <h1 className={`${display.className} text-2xl font-medium leading-tight tracking-tight`}>{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-gray-400">{subtitle}</p>}
          <div className="my-6 h-px bg-gradient-to-r from-[#D4B16A]/60 via-white/10 to-transparent" />
          {children}
        </div>
      </div>
    </main>
  );
}
