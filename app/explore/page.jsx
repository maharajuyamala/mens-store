"use client"
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Instagram, Twitter, Facebook, ArrowRight, Search } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
// --- DUMMY DATA ---
const allProducts = [
    { id: 1, name: "Onyx Silk-Blend Shirt", price: "₹120.00", image: "https://thefoomer.in/cdn/shop/products/jpeg-optimizer_PATP5125.jpg?v=1680162476", tags: ['formal', 'shirts', 'luxury'] },
    { id: 2, name: "Urban Explorer Tee", price: "₹45.00", image: "https://pinksupply.in/cdn/shop/files/male-model-wearing-blue-striped-button-down-collar-linen-shirt.jpg?v=1735708363&width=480", tags: ['casual', 'shirts'] },
    { id: 3, name: "Crimson Performance Polo", price: "₹75.00", image: "https://m.media-amazon.com/images/I/91UdxhZ+GcL._UY1100_.jpg", tags: ['sport', 'shirts'] },
    { id: 4, name: "Azure Linen Button-Down", price: "₹95.00", image: "https://images-cdn.ubuy.co.in/6621c81885d4910d0a49cd4b-coofandy-men-39-s-casual-shirts.jpg", tags: ['casual', 'shirts', 'smart-casual'] },
    { id: 5, name: "Midnight Corduroy Pants", price: "₹110.00", image: "https://i.pinimg.com/736x/e1/5a/f4/e15af453d4946a74f4edbdb6b9ae7c8f.jpg", tags: ['casual', 'pants', 'vintage'] },
    { id: 6, name: "Forest Green Flannel", price: "₹85.00", image: "https://m.media-amazon.com/images/I/81Kd7bcYg+L._UY350_.jpg", tags: ['casual', 'shirts', 'outdoor'] },
    { id: 7, name: "Tech-Knit Joggers", price: "₹90.00", image: "https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcTd7cgAwLqElMaN3SGFzH_EnFYwHcuaylA9dyrjL4HIIh0uH3xfD-nmBqkLST45m0e5SATcQ3-dx680kHjwgjEb2Mrzht0AQloXpl9Rw1gfo-6QG3ZpZhgIKQ", tags: ['sport', 'pants'] },
    { id: 8, name: "Classic Chino Shorts", price: "₹60.00", image: "https://m.media-amazon.com/images/I/71RU3gVcLrL._UY1100_.jpg", tags: ['casual', 'shorts'] },
    { id: 9, name: "Tailored Wool Trousers", price: "₹150.00", image: "https://cdn-images.farfetch-contents.com/15/96/62/99/15966299_29856966_600.jpg", tags: ['formal', 'pants'] },
    { id: 10, name: "Essential Boxer Briefs", price: "₹35.00", image: "https://images-na.ssl-images-amazon.com/images/I/41Cb2HFGNEL._UL500_.jpg", tags: ['undergarments'] },
  ];

const categories = [
    { name: "The Formal Edit", image: "https://images.unsplash.com/photo-1594938384914-29a4491a7a72?q=80&w=1887" },
    { name: "Casual Collection", image: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?q=80&w=1887" },
    { name: "Active & Sport", image: "https://images.unsplash.com/photo-1552674605-db6ffd5e259b?q=80&w=1887" }
];

const testimonials = [
    { id: 1, quote: "The quality is unparalleled. SecondSkin has become my go-to for statement pieces that are both stylish and comfortable.", name: "Alex Thompson", role: "Fashion Blogger", avatar: "https://placehold.co/100x100/ffffff/000000?text=AT" },
    { id: 2, quote: "I'm constantly impressed by the unique designs and the attention to detail. Every piece feels custom-made.", name: "David Chen", role: "Creative Director", avatar: "https://placehold.co/100x100/ffffff/000000?text=DC" },
    { id: 3, quote: "Finally, a brand that understands modern masculinity. The fit, the fabric, the feel—it's all perfect.", name: "Marcus Reid", role: "Entrepreneur", avatar: "https://placehold.co/100x100/ffffff/000000?text=MR" }
];

// --- UTILITY HOOK ---

const ProductCard = ({ product }) => (
    <Link href={`/product-details?id=₹{product?.id}`}>
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
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        />
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="text-sm sm:text-base font-semibold text-white truncate">{product.name}</h3>
        <p className="text-orange-400 text-sm sm:text-base">{product.price}</p>
      </div>
    </motion.div>
    </Link>
  );
  

export default function ExplorePage () {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTag, setActiveTag] = useState('all');
    const [filteredProducts, setFilteredProducts] = useState(allProducts);

    const tags = ['all', 'sport', 'casual', 'formal', 'shirts', 'pants', 'shorts', 'undergarments'];

    useEffect(() => {
        let newFiltered = allProducts;
        // Filter by active tag
        if (activeTag !== 'all') {
            newFiltered = newFiltered.filter(product => product.tags.includes(activeTag));
        }
        // Filter by search term
        if (searchTerm) {
            newFiltered = newFiltered.filter(product =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        setFilteredProducts(newFiltered);
    }, [searchTerm, activeTag]);

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="bg-black text-white min-h-screen pt-28 "
        >
            <div className="max-w-7xl mx-auto">
            <Header />
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
                    {tags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => setActiveTag(tag)}
                            className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ₹{
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
            <Footer />
        </motion.div>
    );
};
