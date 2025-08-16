"use client"
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { AddItemDialog } from './AddDialogue';

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : 'auto';
    return () => (document.body.style.overflow = 'auto');
  }, [isMenuOpen]);

  const navLinks = [{label:"Home",link:"/"}, {label:"Shop",link:"/explore"}, {label:"Collections",link:"/"}, {label:"Contact", link:"/"}];

  const menuVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } }
  };

  const linkVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <>
      <motion.header
        initial={false}
        animate={{
          backgroundColor: isScrolled ? 'rgba(10, 10, 10, 0.8)' : 'rgba(10, 10, 10, 0)',
          backdropFilter: isScrolled ? 'blur(10px)' : 'blur(0px)',
          boxShadow: isScrolled ? '0 4px 30px rgba(0, 0, 0, 0.1)' : 'none',
        }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 left-0 w-[100svw] text-white px-4 sm:px-8 py-4 flex items-center justify-between z-50 overflow-x-hidden"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-white text-2xl font-bold tracking-wider">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            xmlns="http://www.w3.org/2000/svg" className="text-orange-500">
            <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
              stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M2 7L12 12L22 7"
              stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M12 12V22"
              stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          SecondSkin
        </Link>

        {/* Desktop Nav */}
        <motion.nav
          variants={menuVariants}
          initial="hidden"
          animate="visible"
          className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300"
        >
          {navLinks.map(link => (
            <motion.a
              key={link?.label}
              href={link?.link}
              variants={linkVariants}
              className="relative group"
            >
              {link?.label}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300"></span>
            </motion.a>
          ))}
        </motion.nav>

        {/* Right: Cart & Mobile Trigger */}
        <div className="flex items-center gap-4">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            className="relative bg-transparent border border-gray-600 hover:border-orange-500 rounded-full p-2.5 transition-colors duration-300">
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500 text-white text-xs items-center justify-center">3</span>
            </span>
          </motion.button>

          <AddItemDialog/>

          <div className="md:hidden">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setIsMenuOpen(true)} className="text-white">
              <Menu className="h-7 w-7" />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm z-50 md:hidden"
            onClick={() => setIsMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute top-0 right-0 h-full w-[80vw] max-w-sm bg-gray-900 p-8 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setIsMenuOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white">
                <X className="h-7 w-7" />
              </button>
              <nav className="flex flex-col gap-8 mt-16 text-lg">
                {navLinks.map(link => (
                  <a
                    key={link?.label}
                    href={link?.link}
                    className="text-gray-200 hover:text-orange-500 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link?.label}
                  </a>
                ))}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
