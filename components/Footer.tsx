import { ShoppingCart, Menu, X, Instagram, Twitter, Facebook, ArrowRight } from 'lucide-react';

// 6. FOOTER COMPONENT
export const Footer = () => {
  return (
      <footer className="bg-gray-900 text-gray-400 pt-16 pb-8 px-8">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Brand Info */}
              <div className="md:col-span-1">
                  <a href="#" className="flex items-center gap-2 text-white text-xl font-bold mb-4">
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-orange-500">
                          <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                          <path d="M2 7L12 12L22 7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                          <path d="M12 12V22" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                      </svg>
                      SecondSkin
                  </a>
                  <p className="text-sm">Crafting the future of men's fashion with passion and precision.</p>
              </div>

              {/* Links */}
              <div className="md:col-span-1">
                  <h4 className="font-semibold text-white mb-4">Explore</h4>
                  <ul className="space-y-2 text-sm">
                      <li><a href="#" className="hover:text-orange-500 transition-colors">Shop All</a></li>
                      <li><a href="#" className="hover:text-orange-500 transition-colors">New Arrivals</a></li>
                      <li><a href="#" className="hover:text-orange-500 transition-colors">Best Sellers</a></li>
                      <li><a href="#" className="hover:text-orange-500 transition-colors">About Us</a></li>
                  </ul>
              </div>

              {/* Support */}
              <div className="md:col-span-1">
                  <h4 className="font-semibold text-white mb-4">Support</h4>
                  <ul className="space-y-2 text-sm">
                      <li><a href="#" className="hover:text-orange-500 transition-colors">FAQ</a></li>
                      <li><a href="#" className="hover:text-orange-500 transition-colors">Contact</a></li>
                      <li><a href="#" className="hover:text-orange-500 transition-colors">Shipping & Returns</a></li>
                      <li><a href="#" className="hover:text-orange-500 transition-colors">Size Guide</a></li>
                  </ul>
              </div>

              {/* Newsletter */}
              <div className="md:col-span-1">
                  <h4 className="font-semibold text-white mb-4">Join Our Newsletter</h4>
                  <p className="text-sm mb-4">Get exclusive access to new drops and special offers.</p>
                  <form className="flex">
                      <input type="email" placeholder="Your Email" className="w-full bg-gray-800 text-white px-3 py-2 rounded-l-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"/>
                      <button className="bg-orange-500 text-white p-2 rounded-r-md hover:bg-orange-600 transition-colors">
                          <ArrowRight className="h-5 w-5"/>
                      </button>
                  </form>
              </div>
          </div>

          {/* Bottom Bar */}
          <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center text-sm">
              <p>&copy; {new Date().getFullYear()} SecondSkin. All Rights Reserved.</p>
              <div className="flex gap-4 mt-4 sm:mt-0">
                  <a href="#" className="hover:text-white"><Instagram className="h-5 w-5" /></a>
                  <a href="#" className="hover:text-white"><Twitter className="h-5 w-5" /></a>
                  <a href="#" className="hover:text-white"><Facebook className="h-5 w-5" /></a>
              </div>
          </div>
      </footer>
  );
};
