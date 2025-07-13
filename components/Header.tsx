"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ShoppingCart } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-black text-white px-6 py-4 flex items-center justify-between shadow-md">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 text-white text-2xl font-bold">
        <Image src="/logo.png" alt="Logo" height={40} width={40} className="h-10 w-10" />
        SecondSkin
      </Link>

      {/* Desktop Nav */}
      <nav className="hidden md:flex gap-6 text-gray-300 text-sm">
        <Link href="#" className="hover:text-orange-500">Home</Link>
        <Link href="#" className="hover:text-orange-500">Shop</Link>
        <Link href="#" className="hover:text-orange-500">Contact</Link>
      </nav>

      {/* Right: Cart Button */}
      <div className="flex items-center gap-4">
        <Button variant="outline" className="text-white border-white hover:bg-orange-500 bg-black hover:text-white transition">
          <ShoppingCart className="h-4 w-4 " />
          
        </Button>

        {/* Mobile Hamburger */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" className="text-white hover:text-orange-500">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-black text-white w-64 pl-5">
              <nav className="flex flex-col gap-4 mt-8 text-lg">
                <Link href="#" className="hover:text-orange-500">Home</Link>
                <Link href="#" className="hover:text-orange-500">Shop</Link>
                <Link href="#" className="hover:text-orange-500">Contact</Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
