import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ShirtSection from "@/components/ShirtSection";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <Header />
      <Hero />
      <ShirtSection />
      <Footer />
    </main>
  );
}
