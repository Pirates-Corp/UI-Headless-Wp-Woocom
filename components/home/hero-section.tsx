import { HeroCarousel } from "@/components/home/hero-carousel";

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden border-b border-brand-brown/15 bg-[#f6eedf]">
      <h1 className="sr-only">Clay Brush Studio - 3D Prints & Custom Art</h1>
      <HeroCarousel />
    </section>
  );
}
