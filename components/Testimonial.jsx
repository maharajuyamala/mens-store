
import { useEffect, useState } from "react";
import React from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Instagram, Twitter, Facebook, ArrowRight } from 'lucide-react';
import { useScrollAnimation } from "./ShirtSection";


const testimonials = [
    {
        id: 1,
        quote: "The quality is unparalleled. SecondSkin has become my go-to for statement pieces.",
        name: "Alex Thompson",
        role: "Fashion Blogger",
        avatar: "https://placehold.co/100x100/ffffff/000000?text=AT"
    },
    {
        id: 2,
        quote: "I'm constantly impressed by the unique designs and the attention to detail. Every piece feels custom-made.",
        name: "David Chen",
        role: "Creative Director",
        avatar: "https://placehold.co/100x100/ffffff/000000?text=DC"
    },
    {
        id: 3,
        quote: "Finally, a brand that understands modern masculinity. The fit, the fabric, the feel—it's all perfect.",
        name: "Marcus Reid",
        role: "Entrepreneur",
        avatar: "https://placehold.co/100x100/ffffff/000000?text=MR"
    }
];

// 5. TESTIMONIALS SECTION
export const Testimonials = () => {
    const [ref, inView] = useScrollAnimation();
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (inView) {
            const timer = setInterval(() => {
                setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
            }, 3000);
            return () => clearInterval(timer);
        }
    }, [inView]);

    return (
        <section ref={ref} className="bg-black text-white py-20 px-4 sm:px-8">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-orange-500 mb-2">From Our Community</h2>
                <p className="text-gray-400">What our valued customers have to say about their SecondSkin experience.</p>
            </div>
            <div className="relative max-w-3xl mx-auto h-64">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 flex flex-col items-center justify-center text-center bg-gray-900 p-8 rounded-lg"
                    >
                        <img src={testimonials[currentIndex].avatar} alt={testimonials[currentIndex].name} className="w-16 h-16 rounded-full mb-4 border-2 border-orange-500"/>
                        <p className="text-lg italic text-gray-300 mb-4">"{testimonials[currentIndex].quote}"</p>
                        <h4 className="font-bold text-white">{testimonials[currentIndex].name}</h4>
                        <p className="text-sm text-orange-400">{testimonials[currentIndex].role}</p>
                    </motion.div>
                </AnimatePresence>
            </div>
             <div className="flex justify-center mt-8 gap-2">
                {testimonials.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        className={`w-3 h-3 rounded-full transition-colors ${currentIndex === index ? 'bg-orange-500' : 'bg-gray-600 hover:bg-gray-500'}`}
                    />
                ))}
            </div>
        </section>
    );
};
