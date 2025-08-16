"use client"
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, PlusCircle, UploadCloud, Loader2 } from 'lucide-react';
import Link from 'next/link';

// --- Firebase Imports ---
import { db, storage } from "../app/firebase";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// --- Shadcn UI Imports ---
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

/**
 * @component AddItemDialog
 * A dialog component with a form to upload and add a new product to Firebase.
 */
export const AddItemDialog = () => {
    // --- Form State ---
    const [open, setOpen] = useState(false);
    const [productName, setProductName] = useState("");
    const [price, setPrice] = useState("");
    const [selectedColor, setSelectedColor] = useState("");
    // ---- MODIFIED ---- Changed from single string to array for multi-select
    const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    
    // --- UI State ---
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const availableTags = ['sport', 'casual', 'formal', 'shirts', 'pants', 'shorts', 'undergarments', 'luxury'];
    const availableColors = ["Onyx Black", "Silk White", "Stone Gray", "Ocean Blue", "Forest Green"];
    const availableSizes = ["XS", "S", "M", "L", "XL", "XXL"];

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleTagToggle = (tag: string) => {
        setSelectedTags(prev => 
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    // ---- NEW ---- Handler for multi-select sizes
    const handleSizeToggle = (size: string) => {
        setSelectedSizes(prev => 
            prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
        );
    };

    const resetForm = () => {
        setProductName("");
        setPrice("");
        setSelectedColor("");
        setSelectedSizes([]);
        setSelectedTags([]);
        setImageFile(null);
        setImagePreview(null);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // --- MODIFIED ---- Updated form validation for multi-select size
        if (!productName || !price || !imageFile || !selectedColor || selectedSizes.length === 0 || selectedTags.length === 0) {
            setError("Please fill out all fields, select an image, and choose at least one size and category.");
            return;
        }
        
        setIsLoading(true);
        setError(null);

        try {
            const imageRef = ref(storage, `products/${Date.now()}-${imageFile.name}`);
            await uploadBytes(imageRef, imageFile);
            const imageUrl = await getDownloadURL(imageRef);

            const productData = {
                name: productName,
                price: parseFloat(price),
                image: imageUrl,
                tags: selectedTags,
                color: selectedColor,
                size: selectedSizes // ---- MODIFIED ---- Use the array of selected sizes
            };

            await addDoc(collection(db, "products"), productData);
            alert("Product added successfully!");
            resetForm();
            setOpen(false);

        } catch (err) {
            console.error("Error adding product: ", err);
            setError("Failed to add product. Please check console and CORS settings.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="relative bg-transparent border border-gray-600 hover:border-orange-500 rounded-full p-2.5 transition-colors duration-300">
                    <PlusCircle className="h-5 w-5" />
                </motion.button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl h-[80svh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
                <DialogHeader>
                    <DialogTitle className="text-2xl text-white">Add New Product</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Fill in the details to add a new item to the Firestore database.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
                     <div>
                        <Label htmlFor="product-image" className="text-sm font-medium text-gray-300">Product Image</Label>
                        <div className="mt-2 flex justify-center items-center w-full h-48 rounded-lg border-2 border-dashed border-gray-600 p-2 relative bg-gray-800/50 hover:border-orange-500 transition-colors">
                            {imagePreview ? <img src={imagePreview} alt="Preview" className="h-full w-full object-contain rounded-md" />
                            : <div className="text-center"><UploadCloud className="mx-auto h-10 w-10 text-gray-500" /><p className="mt-2 text-sm text-gray-400"><span className="font-semibold text-orange-400">Click to upload</span></p></div>}
                            <Input id="product-image" type="file" onChange={handleImageChange} accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2"><Label htmlFor="product-name">Product Name</Label><Input id="product-name" placeholder="e.g., Onyx Silk-Blend Shirt" value={productName} onChange={(e) => setProductName(e.target.value)} className="bg-gray-800 border-gray-700 focus:ring-orange-500" /></div>
                        <div className="space-y-2"><Label htmlFor="price">Price</Label><Input id="price" type="number" placeholder="e.g., 1200" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-gray-800 border-gray-700 focus:ring-orange-500" /></div>
                    </div>
                    <div className="space-y-2"><Label>Color</Label><Select value={selectedColor} onValueChange={setSelectedColor}><SelectTrigger className="w-full bg-gray-800 border-gray-700"><SelectValue placeholder="Select a color" /></SelectTrigger><SelectContent className="bg-gray-800 border-gray-700 text-white">{availableColors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                    
                    {/* ---- NEW ---- Multi-select chips for Sizes */}
                    <div className="space-y-2">
                        <Label>Available Sizes (select multiple)</Label>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {availableSizes.map(size => (
                                <button type="button" key={size} onClick={() => handleSizeToggle(size)} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-orange-500 ${selectedSizes.includes(size) ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{size}</button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Categories (select multiple)</Label>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {availableTags.map(tag => (
                                <button type="button" key={tag} onClick={() => handleTagToggle(tag)} className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-orange-500 ${selectedTags.includes(tag) ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{tag.charAt(0).toUpperCase() + tag.slice(1)}</button>
                            ))}
                        </div>
                    </div>
                     {error && <p className="text-sm text-red-500">{error}</p>}
                </form>
                <DialogFooter>
                    <Button type="submit" onClick={handleSubmit} disabled={isLoading} className="bg-orange-500 hover:bg-orange-600 text-white w-32">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Product'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
