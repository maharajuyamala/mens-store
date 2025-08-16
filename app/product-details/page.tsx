"use client"
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Instagram, Twitter, Facebook, ArrowRight, Search, ChevronLeft, Plus, Minus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const ProductDetailPage = () => {
    const params = useSearchParams()
    const allProducts = [
        {
          id: 1,
          name: "Onyx Silk-Blend Shirt",
          price: "₹1200.00",
          image: "https://thefoomer.in/cdn/shop/products/jpeg-optimizer_PATP5125.jpg?v=1680162476",
          tags: ['formal', 'shirts', 'luxury'],
          description: "Crafted from a smooth silk blend, this shirt adds a sleek finish to any formal ensemble."
        },
        {
          id: 2,
          name: "Urban Explorer Tee",
          price: "₹450.00",
          image: "https://pinksupply.in/cdn/shop/files/male-model-wearing-blue-striped-button-down-collar-linen-shirt.jpg?v=1735708363&width=480",
          tags: ['casual', 'shirts'],
          description: "A lightweight, breathable tee for laid-back city adventures and weekend vibes."
        },
        {
          id: 3,
          name: "Crimson Performance Polo",
          price: "₹750.00",
          image: "https://m.media-amazon.com/images/I/91UdxhZ+GcL._UY1100_.jpg",
          tags: ['sport', 'shirts'],
          description: "Stay sharp and dry with this moisture-wicking polo made for movement and comfort."
        },
        {
          id: 4,
          name: "Azure Linen Button-Down",
          price: "₹950.00",
          image: "https://images-cdn.ubuy.co.in/6621c81885d4910d0a49cd4b-coofandy-men-39-s-casual-shirts.jpg",
          tags: ['casual', 'shirts', 'smart-casual'],
          description: "A breezy linen shirt perfect for warm days—smart enough for brunch, easy enough for the beach."
        },
        {
          id: 5,
          name: "Midnight Corduroy Pants",
          price: "₹1100.00",
          image: "https://i.pinimg.com/736x/e1/5a/f4/e15af453d4946a74f4edbdb6b9ae7c8f.jpg",
          tags: ['casual', 'pants', 'vintage'],
          description: "Vintage-inspired corduroys that pair comfort with a touch of retro cool."
        },
        {
          id: 6,
          name: "Forest Green Flannel",
          price: "₹850.00",
          image: "https://m.media-amazon.com/images/I/81Kd7bcYg+L._UY350_.jpg",
          tags: ['casual', 'shirts', 'outdoor'],
          description: "Cozy and rugged—this flannel is your go-to layer for chilly mornings and weekend hikes."
        },
        {
          id: 7,
          name: "Tech-Knit Joggers",
          price: "₹900.00",
          image: "https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcTd7cgAwLqElMaN3SGFzH_EnFYwHcuaylA9dyrjL4HIIh0uH3xfD-nmBqkLST45m0e5SATcQ3-dx680kHjwgjEb2Mrzht0AQloXpl9Rw1gfo-6QG3ZpZhgIKQ",
          tags: ['sport', 'pants'],
          description: "Stretchy, breathable joggers built for training, travel, or chill days at home."
        },
        {
          id: 8,
          name: "Classic Chino Shorts",
          price: "₹600.00",
          image: "https://m.media-amazon.com/images/I/71RU3gVcLrL._UY1100_.jpg",
          tags: ['casual', 'shorts'],
          description: "Clean lines and a relaxed fit—these chinos are your summer essential."
        },
        {
          id: 9,
          name: "Tailored Wool Trousers",
          price: "₹1500.00",
          image: "https://cdn-images.farfetch-contents.com/15/96/62/99/15966299_29856966_600.jpg",
          tags: ['formal', 'pants'],
          description: "Expert tailoring meets premium wool—elevate your wardrobe with timeless class."
        },
        {
          id: 10,
          name: "Essential Boxer Briefs",
          price: "₹350.00",
          image: "https://images-na.ssl-images-amazon.com/images/I/41Cb2HFGNEL._UL500_.jpg",
          tags: ['undergarments'],
          description: "Soft, supportive, and breathable—built for all-day comfort under anything you wear."
        }
      ];
      
    const [quantity, setQuantity] = useState(1);
    const [selectedSize, setSelectedSize] = useState('M');
    const product = allProducts.find(p => p.id === Number(params?.get("id")));
    const sizes = ['S', 'M', 'L', 'XL'];
    
    if (!product) {
        return (
            <div className="bg-black text-white min-h-screen pt-28 px-4 sm:px-8 text-center">
                <h1 className="text-4xl text-red-500">Product not found</h1>
                <Link href="/explore" className="text-orange-500 mt-4 inline-block">Back to Shop</Link>
            </div>
        );
    }

    return (<>
   
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-black text-white min-h-screen pt-28 px-4 sm:px-8">
            <div className="max-w-6xl mx-auto pb-5">
                <Link href="/explore" className="flex items-center gap-2 text-gray-400 hover:text-white mb-8">
                    <ChevronLeft className="h-5 w-5" />
                    Back to Shop
                </Link>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <motion.div layoutId={`product-image-${product.id}`} className="rounded-2xl overflow-hidden">
                        <img src={product.image} alt={product.name} className="scale-[1.02] w-full h-full object-cover" />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">{product.name}</h1>
                        <p className="text-3xl text-orange-500 mb-6">{product.price}</p>
                        <p className="text-gray-300 leading-relaxed mb-8">{product.description}</p>
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold mb-3">Select Size</h3>
                            <div className="flex gap-3">
                                {sizes.map((size, index) => (
                                    <button key={`${size}${index} `} onClick={() => setSelectedSize(size)} className={`w-12 h-12 flex items-center justify-center rounded-full border-2 transition-colors ${selectedSize === size ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-600 text-gray-300 hover:border-orange-500'}`}>
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold mb-3">Quantity</h3>
                            <div className="flex items-center gap-4 p-2 border border-gray-600 rounded-full w-fit">
                                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-1 rounded-full hover:bg-gray-700"><Minus className="h-5 w-5"/></button>
                                <span className="text-xl font-semibold w-8 text-center">{quantity}</span>
                                <button onClick={() => setQuantity(q => q + 1)} className="p-1 rounded-full hover:bg-gray-700"><Plus className="h-5 w-5"/></button>
                            </div>
                        </div>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full pb-5 bg-orange-500 text-white font-bold py-4 px-8 rounded-full text-lg flex items-center justify-center gap-3 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30">
                            <ShoppingCart className="h-6 w-6" />
                            Add to Cart
                        </motion.button>
                    </motion.div>
                </div>
            </div>
        </motion.div>
            </>

    );
};


export default ProductDetailPage;
