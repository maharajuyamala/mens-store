"use client";

import { Hero } from "@/components/Hero";
import { CategorySection } from "@/components/ShopByCategory";
import { CategoryGallery } from "@/components/CategoryGallery";
import { ShirtSection } from "@/components/ShirtSection";
import { Testimonials } from "@/components/Testimonial";
import { WhyChooseUs } from "@/components/WhyUs";
import { RecentlyViewedSection } from "@/components/RecentlyViewedSection";
import type { ExploreProduct } from "@/lib/explore/types";

export default function HomePageClient({ signatureProducts }: { signatureProducts: ExploreProduct[] }) {
  return (
    <main className="bg-background text-foreground antialiased">
      <Hero />
      <CategorySection />
      <CategoryGallery />
      <ShirtSection products={signatureProducts} />
      <RecentlyViewedSection />
      <WhyChooseUs />
      <Testimonials />
    </main>
  );
}
