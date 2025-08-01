import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { ShoppingCart, Menu, X, Instagram, Twitter, Facebook, ArrowRight, ArrowLeft } from 'lucide-react';
import featuredShirts from "../app/data/cloths.json";

export const useScrollAnimation = () => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
      const observer = new IntersectionObserver(
          ([entry]) => {
              if (entry.isIntersecting) {
                  setInView(true);
              }
          },
          {
              threshold: 0.1,
          }
      );

      if (ref.current) {
          observer.observe(ref.current);
      }

      return () => {
          if (ref.current) {
              observer.unobserve(ref.current);
          }
      };
  }, []);

  return [ref, inView];
};
// 3. FEATURED SHIRTS SECTION (REVAMPED)
const ShirtCard = ({ shirt }) => {
  // Variants for the hover overlay elements, creating a staggered animation effect.
  const overlayVariants = {
      rest: { opacity: 0 },
      hover: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } }
  };

  const itemVariants = {
      rest: { opacity: 0, y: 20 },
      hover: { opacity: 1, y: 0 }
  };

  return (
      <motion.div
          className="group relative w-72 md:w-80 h-[28rem] md:h-[32rem] bg-gray-900 rounded-2xl overflow-hidden flex-shrink-0"
          whileHover={{ scale: 1.03, zIndex: 10, transition: { duration: 0.3 } }}
          style={{ perspective: '800px' }} // Enables 3D transformations on child elements.
      >
          {/* This div applies the 3D tilt effect on hover */}
          <motion.div 
              className="absolute inset-0"
              whileHover={{ rotateY: -15, rotateX: 10, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
          >
              {/* Image zooms in on hover */}
              <img
                  src={shirt.image}
                  alt={shirt.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-125"
              />
              {/* Gradient overlay for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
          </motion.div>

          {/* Static Content at the bottom with entry animation */}
          <div className="absolute bottom-0 left-0 p-6 w-full z-10 pointer-events-none">
              <motion.h3 
                  className="text-2xl font-semibold text-white"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
              >
                  {shirt.name}
              </motion.h3>
              <motion.p 
                  className="text-orange-400 font-medium text-lg"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6, type: 'spring' }}
              >
                  {shirt.price}
              </motion.p>
          </div>
          
          {/* Hover Content that appears with a blur and staggered fade-in */}
          <motion.div 
              variants={overlayVariants}
              initial="rest"
              animate="rest"
              whileHover="hover"
              className="absolute inset-0 bg-black/60 backdrop-blur-md z-20 flex flex-col justify-center items-center p-6 text-center"
          >
              <motion.p variants={itemVariants} className="text-gray-200 text-sm mb-2">
                  {shirt.category} Collection
              </motion.p>
              <motion.div variants={itemVariants} className="w-16 h-px bg-orange-500 my-2"></motion.div>
              <motion.button variants={itemVariants} className="mt-4 bg-orange-500 text-white font-bold py-3 px-8 rounded-full text-base transition-all duration-300 hover:bg-orange-600 hover:scale-105">
                  View Details
              </motion.button>
          </motion.div>
      </motion.div>
  );
};

export const ShirtSection = () => {
  const [sectionRef, inView] = useScrollAnimation();
  const scrollContainerRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const scrollDirectionRef = useRef(1); // 1 for right, -1 for left

  // Auto-scroll effect that patrols back and forth
  useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container || !inView) return;

      let intervalId;

      if (!isHovering) {
          intervalId = setInterval(() => {
              // When the scroll reaches the far right, change direction to left.
              if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 1) {
                  scrollDirectionRef.current = -1;
              } else if (container.scrollLeft <= 0) {
                  // When the scroll reaches the far left, change direction to right.
                  scrollDirectionRef.current = 1;
              }
              
              // Scroll by 1px for a smooth effect.
              container.scrollBy({ left: scrollDirectionRef.current * 1, behavior: 'smooth' });
          }, 25); // Interval duration controls speed (lower is faster).
      }

      return () => clearInterval(intervalId);
  }, [inView, isHovering]);

  const titleVariants = {
      hidden: { opacity: 0, y: -30 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };
  
  const textVariants = {
      hidden: { opacity: 0, y: -20 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.8, delay: 0.2, ease: "easeOut" } }
  };

  return (
      <section ref={sectionRef} className="bg-black text-white py-24 px-0 overflow-hidden">
          <motion.div
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              variants={titleVariants}
              className="text-center mb-4 px-4"
          >
              <h2 className="text-4xl md:text-5xl font-bold text-orange-500 mb-2">Our Signature Collection</h2>
          </motion.div>
          <motion.p 
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              variants={textVariants}
              className="text-gray-400 max-w-xl mx-auto text-center mb-12 px-4"
          >
              Hover over the collection to pause. Drag to explore.
          </motion.p>
          
          <div 
              className="relative"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
          >
              {/* Gradient fades for a seamless look */}
              <div className="absolute top-0 left-0 h-full w-24 bg-gradient-to-r from-black to-transparent z-20 pointer-events-none"></div>
              <div className="absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-black to-transparent z-20 pointer-events-none"></div>

              {/* Auto-scrolling container */}
              <motion.div
                  ref={scrollContainerRef}
                  className="flex gap-8 px-8 cursor-grab active:cursor-grabbing overflow-x-scroll"
                  style={{ scrollbarWidth: 'none', '-ms-overflow-style': 'none' }} // Hide scrollbar
              >
                  {featuredShirts.map((shirt) => (
                      <ShirtCard key={shirt.id} shirt={shirt} />
                  ))}
              </motion.div>
          </div>
      </section>
  );
};
