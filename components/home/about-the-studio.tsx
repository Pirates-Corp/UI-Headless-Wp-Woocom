import Link from "next/link";
import Image from "next/image";
import { FileText } from "lucide-react";

export function AboutTheStudio() {
  return (
    <section className="relative w-full py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-neutral-950 overflow-hidden">
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center">
        {/* Brand Logo */}
        <div className="relative mb-2 sm:mb-4">
          <Image
            src="/assets/brand/logo-dark.svg"
            alt="Clay Brush Studio"
            width={170}
            height={118}
            className="h-16 sm:h-20 w-auto object-contain select-none"
            priority
          />
        </div>

        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-medium text-[#3b2d1d] dark:text-amber-100 tracking-tight mb-5 sm:mb-6">
          About The Studio
        </h2>

        {/* Narrative Description */}
        <p className="text-[#5c5043] dark:text-neutral-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-8 sm:mb-10 font-normal">
          The clay brush studio provides 3d printed Divine collections, Creative sculptures, Cartoon/Comic-Characters, animals, and Custom figures, human figures, logos, etc. in the best quality of 3D sculptures
        </p>

        {/* Read More Action */}
        <Link
          href="/about"
          className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3 rounded-lg bg-[#3d2c16] hover:bg-[#2b1f10] text-[#ecd8bd] hover:text-white font-semibold text-xs sm:text-sm tracking-widest uppercase shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
        >
          <FileText className="w-4 h-4 shrink-0 text-[#ecd8bd]" />
          <span>Read More</span>
        </Link>
      </div>
    </section>
  );
}

export default AboutTheStudio;
