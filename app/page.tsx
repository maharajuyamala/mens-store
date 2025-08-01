"use client"
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Instagram, Twitter, Facebook, ArrowRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { ShirtSection } from '@/components/ShirtSection';
import { Footer } from '@/components/Footer';
import { Testimonials } from '@/components/Testimonial';
import { WhyChooseUs } from '@/components/WhyUs';
import { CategorySection } from '@/components/ShopByCategory';

// --- MAIN APP COMPONENT ---
export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      // Simulate page loading
      const timer = setTimeout(() => setLoading(false), 2000);
      return () => clearTimeout(timer);
  }, []);

  return (
      <>
          <AnimatePresence>
              {loading && (
                  <motion.div
                      key="loader"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center gap-4"
                  >
                      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-orange-500">
                          <motion.path
                              d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
                              stroke="currentColor" strokeWidth="1" strokeLinejoin="round"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              transition={{ duration: 1, ease: "easeInOut" }}
                          />
                          <motion.path
                              d="M2 7L12 12L22 7"
                              stroke="currentColor" strokeWidth="1" strokeLinejoin="round"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              transition={{ duration: 1, delay: 0.5, ease: "easeInOut" }}
                          />
                           <motion.path
                              d="M12 12V22"
                              stroke="currentColor" strokeWidth="1" strokeLinejoin="round"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              transition={{ duration: 1, delay: 0.8, ease: "easeInOut" }}
                          />
                      </svg>
                      <motion.p 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1.2, duration: 0.5 }}
                          className="text-white text-lg font-medium tracking-widest"
                      >
                          SECONDSKIN
                      </motion.p>
                  </motion.div>
              )}
          </AnimatePresence>

          {!loading && (
              <main className="bg-black">
                  <Header />
                  <Hero />
                  <ShirtSection />
                  <CategorySection/>
                  <WhyChooseUs />
                  <Testimonials />
                  <Footer />
              </main>
          )}
      </>
  );
}
