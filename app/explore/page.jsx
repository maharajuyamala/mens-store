"use client"
import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Menu, X, Instagram, Twitter, Facebook, ArrowRight, Search } from 'lucide-react';
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../app/firebase";
import { motion, AnimatePresence } from "framer-motion";
import Link from 'next/link';

const ProductCard = ({ product }) => (
    <Link href={`/product-details?id=${product?.doc_id}`}>
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="bg-gray-900 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300"
    >
      <div className="aspect-[3/4] w-full overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full scale-[1.02] h-full object-cover transition-transform duration-500 hover:scale-105"
        />
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="text-sm sm:text-base font-semibold text-white truncate">{product.name}</h3>
        <p className="text-orange-400 text-sm sm:text-base">{product.price}</p>
      </div>
    </motion.div>
    </Link>
  );

export default function ExplorePage() {
  const [allProducts, setAllProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTag, setActiveTag] = useState("all");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const tags = ['all', 'sport', 'casual', 'formal', 'shirts', 'pants', 'shorts', 'undergarments'];

  useEffect(() => {
    async function fetchProducts() {
      const snap = await getDocs(collection(db, "products"));
      console.log({dsz:snap.docs})
      const products = snap.docs.map(doc => ({
        doc_id: doc.id,
        // tags: JSON.parse(doc?.tags),
        ...(doc.data())
        
      }));
      console.log(products)
      setAllProducts(products);
      setFilteredProducts(products);
    }
    fetchProducts();
  }, []);



  useEffect(() => {
    let newFiltered = allProducts;
    if (activeTag !== "all")
      newFiltered = newFiltered.filter(p => p.tags.includes(activeTag));
    if (searchTerm)
      newFiltered = newFiltered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    setFilteredProducts(newFiltered);
  }, [searchTerm, activeTag, allProducts]);

return (
    <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="bg-black text-white min-h-screen pt-28 "
    >
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 px-4 sm:px-8">
                <h1 className="text-5xl md:text-6xl font-bold mb-4">Explore the Collection</h1>
                <p className="text-gray-400 text-lg">Find your next signature piece.</p>
                <div className="mt-8 max-w-lg mx-auto relative">
                    <input
                        type="text"
                        placeholder="Search for products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-full py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                </div>
            </div>

            {/* Tags Filter */}
            <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-12 px-4 sm:px-8">
                {tags?.map(tag => (
                    <button
                        key={tag}
                        onClick={() => setActiveTag(tag)}
                        className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                            activeTag === tag
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                    >
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </button>
                ))}
            </div>

            {/* Products Grid */}
            <AnimatePresence>
            <motion.div layout className="grid grid-cols-2 gap-4 sm:gap-6 md:gap-10 px-4 sm:px-8 pb-5">

                    {filteredProducts.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </motion.div>
            </AnimatePresence>

            {filteredProducts.length === 0 && (
                <div className="text-center py-20">
                    <p className="text-2xl font-semibold text-gray-500">No products found.</p>
                    <p className="text-gray-600">Try adjusting your search or filters.</p>
                </div>
            )}
        </div>
    </motion.div>
);
};
