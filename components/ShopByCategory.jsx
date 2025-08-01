import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Instagram, Twitter, Facebook, ArrowRight } from 'lucide-react';
import { useScrollAnimation } from './ShirtSection';

const categories = [
    {
        name: "The Formal Edit",
        image: "https://thefoomer.in/cdn/shop/products/jpeg-optimizer_PATP5270.jpg?v=1680164001",
        href: "#"
    },
    {
        name: "Casual Collection",
        image: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?q=80&w=1887&auto=format&fit=crop",
        href: "#"
    },
    {
        name: "Active & Sport",
        image: "https://static.fibre2fashion.com/MemberResources/LeadResources/1/2019/6/Seller/19164890/Images/19164890_0_men-s-sports-wear.jpg",
        href: "#"
    }
];

export const CategorySection = () => {
    const [ref, inView] = useScrollAnimation();
    const containerVariants = {
        hidden: {},
        visible: { transition: { staggerChildren: 0.2, delayChildren: 0.2 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
    };

    return (
        <section ref={ref} className="bg-gray-900 py-24 px-4 sm:px-8">
            <h2 className="text-center text-4xl md:text-5xl font-bold text-white mb-12">Shop by Category</h2>
            <motion.div 
                className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8"
                variants={containerVariants}
                initial="hidden"
                animate={inView ? "visible" : "hidden"}
            >
                {categories.map(category => (
                    <motion.a 
                        key={category.name} 
                        href={category.href}
                        variants={itemVariants}
                        className="group relative h-96 rounded-2xl overflow-hidden shadow-lg"
                    >
                        <img src={category.image} alt={category.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-in-out group-hover:scale-110"/>
                        <div className="absolute inset-0 bg-black/50 group-hover:bg-black/60 transition-all duration-300"></div>
                        <div className="relative h-full flex flex-col justify-end p-8 text-white">
                            <h3 className="text-3xl font-bold mb-2">{category.name}</h3>
                            <div className="flex items-center gap-2 text-orange-400 font-semibold opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                                <span>Shop Now</span>
                                <ArrowRight className="h-5 w-5"/>
                            </div>
                        </div>
                    </motion.a>
                ))}
            </motion.div>
        </section>
    );
};