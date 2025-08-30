"use client"
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Menu, X, ChevronLeft, Plus, Minus, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app/firebase'; // Adjust this import path to your firebase.js file

// Define a type for your product data for better type safety
interface Product {
    id: string;
    name: string;
    price: number;
    description: string;
    image: string;
    sizes: Record<string, number>; // e.g., { S: 10, M: 20, L: 15 }
    tags: string[];
    color: string;
}

const ProductDetailPage = () => {
    const params = useSearchParams();
    const productId = params?.get("id");

    const [product, setProduct] = useState<Product | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [quantity, setQuantity] = useState(1);
    const [selectedSize, setSelectedSize] = useState<string | null>(null);

    useEffect(() => {
        if (!productId) {
            setError("Product ID is missing.");
            setIsLoading(false);
            return;
        }

        const fetchProduct = async () => {
            try {
                // Create a reference to the specific document in the 'products' collection
                const productRef = doc(db, "products", productId);
                const docSnap = await getDoc(productRef);

                if (docSnap.exists()) {
                    const productData = { id: docSnap.id, ...docSnap.data() } as Product;
                    setProduct(productData);
                    // Automatically select the first available size
                    if (productData.sizes && Object.keys(productData.sizes).length > 0) {
                        setSelectedSize(Object.keys(productData.sizes)[0]);
                    }
                } else {
                    setError("Product not found.");
                }
            } catch (err) {
                console.error("Error fetching product:", err);
                setError("Failed to fetch product data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchProduct();
    }, [productId]); // This effect runs whenever the productId changes

    if (isLoading) {
        return (
            <div className="bg-black text-white min-h-screen flex flex-col items-center justify-center pt-28 px-4 sm:px-8">
                <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
                <p className="mt-4 text-lg">Loading Product...</p>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="bg-black text-white min-h-screen flex flex-col items-center justify-center pt-28 px-4 sm:px-8 text-center">
                <h1 className="text-4xl text-red-500">{error || "Product not found"}</h1>
                <Link href="/explore" className="text-orange-500 mt-4 inline-block hover:underline">
                    Back to Shop
                </Link>
            </div>
        );
    }
    
    // Get available sizes from the product data, handling cases where it might not exist
    const availableSizes = product.sizes ? Object.keys(product.sizes) : [];

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-black text-white min-h-screen pt-28 px-4 sm:px-8">
            <div className="max-w-6xl mx-auto pb-5">
                <Link href="/explore" className="flex items-center gap-2 text-gray-400 hover:text-white mb-8">
                    <ChevronLeft className="h-5 w-5" />
                    Back to Shop
                </Link>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <motion.div layoutId={`product-image-${product.id}`} className="rounded-2xl overflow-hidden aspect-square">
                        <img src={product.image} alt={product.name} className="scale-[1.02] w-full h-full object-cover" />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">{product.name}</h1>
                        <p className="text-3xl text-orange-500 mb-6">${product.price.toFixed(2)}</p>
                        <p className="text-gray-300 leading-relaxed mb-8">{product.description || "No description available."}</p>
                        
                        {availableSizes.length > 0 && (
                             <div className="mb-8">
                                <h3 className="text-lg font-semibold mb-3">Select Size</h3>
                                <div className="flex gap-3">
                                    {availableSizes.map((size) => (
                                        <button key={size} onClick={() => setSelectedSize(size)} className={`w-12 h-12 flex items-center justify-center rounded-full border-2 transition-colors ${selectedSize === size ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-600 text-gray-300 hover:border-orange-500'}`}>
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                       
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold mb-3">Quantity</h3>
                            <div className="flex items-center gap-4 p-2 border border-gray-600 rounded-full w-fit">
                                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-1 rounded-full hover:bg-gray-700"><Minus className="h-5 w-5"/></button>
                                <span className="text-xl font-semibold w-8 text-center">{quantity}</span>
                                <button onClick={() => setQuantity(q => q + 1)} className="p-1 rounded-full hover:bg-gray-700"><Plus className="h-5 w-5"/></button>
                            </div>
                        </div>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full bg-orange-500 text-white font-bold py-4 px-8 rounded-full text-lg flex items-center justify-center gap-3 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30">
                            <ShoppingCart className="h-6 w-6" />
                            Add to Cart
                        </motion.button>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};

export default ProductDetailPage;