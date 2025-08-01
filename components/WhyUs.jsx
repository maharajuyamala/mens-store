
import { useEffect, useState } from "react";
import React from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Instagram, Twitter, Facebook, ArrowRight } from 'lucide-react';
import { useScrollAnimation } from "./ShirtSection";

// 4. WHY CHOOSE US SECTION
export const WhyChooseUs = () => {
    const [ref, inView] = useScrollAnimation();

    const features = [
        { title: "Premium Fabrics", description: "Sourced from the finest mills worldwide for ultimate comfort.", icon: "💎" },
        { title: "Modern Tailoring", description: "Expertly crafted for a perfect fit that moves with you.", icon: "✂️" },
        { title: "Sustainable Practices", description: "Committed to ethical production and eco-friendly materials.", icon: "🌿" },
    ];

    const containerVariants = {
        hidden: {},
        visible: { transition: { staggerChildren: 0.2 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.9 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
    };

    return (
        <section ref={ref} className="bg-gray-900 text-white py-20 px-4 sm:px-8">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-white mb-2">The SecondSkin Difference</h2>
                <p className="text-gray-400 max-w-xl mx-auto">More than just clothing, it's a statement of quality and intent.</p>
            </div>
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate={inView ? "visible" : "hidden"}
                className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto"
            >
                {features.map((feature, index) => (
                    <motion.div key={index} variants={itemVariants} className="text-center p-8 bg-gray-800 rounded-xl shadow-lg hover:bg-gray-700 transition-colors duration-300">
                        <div className="text-5xl mb-4">{feature.icon}</div>
                        <h3 className="text-2xl font-semibold text-orange-400 mb-2">{feature.title}</h3>
                        <p className="text-gray-300">{feature.description}</p>
                    </motion.div>
                ))}
            </motion.div>
        </section>
    );
};
