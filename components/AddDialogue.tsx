"use client"
import React,   {useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, PlusCircle, UploadCloud, Loader2, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
import imageCompression from 'browser-image-compression';

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
    const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
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

    const handleQuantityChange = (size: string, newQuantity: number) => {
        const quantity = Math.max(0, newQuantity);
        setSizeQuantities(prev => ({
            ...prev,
            [size]: quantity
        }));
    };

    const resetForm = () => {
        setProductName("");
        setPrice("");
        setSelectedColor("");
        setSizeQuantities({});
        setSelectedTags([]);
        setImageFile(null);
        setImagePreview(null);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
    
        // Prepare data
        const finalPrice = parseFloat(price);
        const sizesToSubmit = Object.entries(sizeQuantities)
            .filter(([_, quantity]) => quantity > 0)
            .reduce((acc, [size, quantity]) => {
                acc[size] = quantity;
                return acc;
            }, {} as Record<string, number>);
    
        // Validate data STRICTLY before sending
        if (
            !productName ||
            !price ||
            isNaN(finalPrice) ||
            !imageFile ||
            !selectedColor ||
            Object.keys(sizesToSubmit).length === 0 ||
            selectedTags.length === 0
        ) {
            setError("Please fill all fields. Price must be a number and at least one size must have stock.");
            return;
        }
    
        setIsLoading(true);
        setError(null);
    
        try {
            // Step 1: Upload image
            const imageRef = ref(storage, `products/${Date.now()}-${imageFile.name}`);
            const options = {
                maxSizeMB: 1,          // (Max file size in MB)
                maxWidthOrHeight: 1024,  // (Max width or height in pixels)
                useWebWorker: true
              }
          
              const compressedFile = await imageCompression(imageFile, options);
              
              // Now, upload the 'compressedFile' instead of the original 'imageFile'
            await uploadBytes(imageRef, compressedFile);
            // await uploadBytes(imageRef, imageFile);
            const imageUrl = await getDownloadURL(imageRef);
    
            // Step 2: Create the final, clean data object
            const productData = {
                id: `${Date.now()}`,
                name: productName,
                price: finalPrice,
                image: imageUrl,
                tags: selectedTags,
                color: selectedColor,
                description: "This is a description",
                size: [sizesToSubmit]
            };
    
            // 🧐 This console log will show you the exact data being sent
            console.log("Submitting to Firestore:", productData);
            
            // Step 3: Write to Firestore
            await addDoc(collection(db, "products"), productData);
            
            alert("Product added successfully!");
            resetForm();
            setOpen(false);
    
        } catch (err) {
            console.error("Error adding product: ", err);
            setError("Failed to add product. Check the console for the data object and verify your Firestore rules.");
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
                    
                    <div className="space-y-3">
                        <Label>Available Sizes & Stock Quantity</Label>
                        {/* ---- MODIFIED ---- Changed grid classes for responsiveness */}
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {availableSizes.map(size => (
                                <div key={size} className="flex flex-col items-center justify-between p-2 bg-gray-800 rounded-md">
                                    <span className="font-medium text-sm text-gray-300">{size}</span>
                                    <div className="flex items-center gap-2">
                                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-gray-700" onClick={() => handleQuantityChange(size, (sizeQuantities[size] || 0) - 1)}>
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Input
                                            type="number"
                                            className="w-14 h-8 text-center bg-gray-900/50 border-gray-700 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            value={sizeQuantities[size] || 0}
                                            onChange={(e) => handleQuantityChange(size, parseInt(e.target.value, 10) || 0)}
                                            min="0"
                                        />
                                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-gray-700" onClick={() => handleQuantityChange(size, (sizeQuantities[size] || 0) + 1)}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
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