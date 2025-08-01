import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Instagram, Twitter, Facebook, ArrowRight } from 'lucide-react';

// 2. HERO SECTION COMPONENT
export const Hero = () => {
  const videoRef = useRef(null);

  useEffect(() => {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      // This function attempts to play the video.
      const attemptPlay = () => {
          videoElement
              .play()
              .catch(error => {
                  console.error("Video autoplay was prevented:", error);
              });
      };

      // We listen for the 'canplay' event which fires when the browser has enough data to begin playback.
      videoElement.addEventListener('canplay', attemptPlay);
      
      // In case the event has already fired before the listener was attached, we check the readyState.
      if (videoElement.readyState >= 3) { // 3 is HAVE_FUTURE_DATA, 4 is HAVE_ENOUGH_DATA
           attemptPlay();
      }

      // Cleanup: remove the event listener when the component unmounts.
      return () => {
          videoElement.removeEventListener('canplay', attemptPlay);
      };
  }, []);

  return (
      <section className="relative min-h-[80svh] bg-black text-white flex items-center justify-center text-center overflow-hidden">
           {/* Background Video */}
          <video
              ref={videoRef}
              loop
              muted
              playsInline
              className="absolute z-0 top-0 w-auto min-w-full min-h-full max-w-none opacity-30 object-cover object-top"
          >
            
              <source src="http://localhost:3000/shirts.mov" type="video/mp4" />
              Your browser does not support the video tag.
          </video>
           {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black"></div>
          
          <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative z-10 px-4"
          >
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter mb-4 text-shadow-lg">
                  Style Redefined.
              </h1>
              <p className="text-lg md:text-xl max-w-2xl mx-auto text-gray-300 mb-8">
                  Discover curated collections where premium craftsmanship meets contemporary design.
              </p>
              <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0px 0px 20px rgba(249, 115, 22, 0.5)" }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-orange-500 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 flex items-center gap-2 mx-auto"
              >
                  Explore Collection <ArrowRight className="h-5 w-5" />
              </motion.button>
          </motion.div>
      </section>
  );
};