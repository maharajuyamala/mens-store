import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Instagram, Twitter, Facebook, ArrowRight } from 'lucide-react';
import { useScrollAnimation } from './ShirtSection';


export const BrandStory = () => {
    const [ref, inView] = useScrollAnimation();
    const imageVariants = {
        hidden: { opacity: 0, x: -50 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.6, 0.05, -0.01, 0.9] } }
    };
    const textVariants = {
        hidden: { opacity: 0, x: 50 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.8, delay: 0.2, ease: [0.6, 0.05, -0.01, 0.9] } }
    };

    return (
        <section ref={ref} className="bg-black py-24 px-4 sm:px-8 overflow-hidden">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <motion.div 
                    className="relative h-96 md:h-[32rem] rounded-2xl overflow-hidden"
                    variants={imageVariants}
                    initial="hidden"
                    animate={inView ? "visible" : "hidden"}
                >
                    <img src="https://images.unsplash.com/photo-1550928433-ceb94b010143?q=80&w=1887&auto=format&fit=crop" alt="Tailor at work" className="w-full h-full object-cover"/>
                </motion.div>
                <motion.div 
                    className="text-white"
                    variants={textVariants}
                    initial="hidden"
                    animate={inView ? "visible" : "hidden"}
                >
                    <h2 className="text-4xl md:text-5xl font-bold text-orange-500 mb-6">The Art of Dressing Well</h2>
                    <p className="text-gray-300 text-lg mb-4">
                        At SecondSkin, we believe clothing is more than just fabric; it's a form of self-expression. Our journey began with a simple idea: to create pieces that blend timeless style with modern sensibilities, using only the finest materials.
                    </p>
                    <p className="text-gray-300 text-lg mb-8">
                        Each garment is a testament to our commitment to quality, detail, and the man who wears it. We don't just sell clothes—we offer confidence, stitched into every seam.
                    </p>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-transparent border border-orange-500 text-orange-500 font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 hover:bg-orange-500 hover:text-white"
                    >
                        Our Philosophy
                    </motion.button>
                </motion.div>
            </div>
        </section>
    );
};