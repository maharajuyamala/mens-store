import { Instagram, Twitter, Facebook, ArrowRight } from "lucide-react";

// 6. FOOTER COMPONENT
export const Footer = () => {
  return (
      <footer className="border-t border-border bg-background px-8 pb-8 pt-16 text-muted-foreground">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Brand Info */}
              <div className="md:col-span-1">
                  <a href="/" className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
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
                  <h4 className="mb-4 font-semibold text-foreground">Explore</h4>
                  <ul className="space-y-2 text-sm">
                      <li><a href="#" className="hover:text-orange-500 transition-colors">Shop All</a></li>
                      <li><a href="#" className="hover:text-orange-500 transition-colors">New Arrivals</a></li>
                      <li><a href="#" className="hover:text-orange-500 transition-colors">Best Sellers</a></li>
                      <li><a href="#" className="hover:text-orange-500 transition-colors">About Us</a></li>
                  </ul>
              </div>

              {/* Support */}
              <div className="md:col-span-1">
                  <h4 className="mb-4 font-semibold text-foreground">Support</h4>
                  <ul className="space-y-2 text-sm">
                      <li><a href="#" className="hover:text-orange-500 transition-colors">FAQ</a></li>
                      <li><a href="#" className="hover:text-orange-500 transition-colors">Contact</a></li>
                      <li><a href="#" className="hover:text-orange-500 transition-colors">Shipping & Returns</a></li>
                      <li><a href="#" className="hover:text-orange-500 transition-colors">Size Guide</a></li>
                  </ul>
              </div>

              {/* Newsletter */}
              <div className="md:col-span-1">
                  <h4 className="mb-4 font-semibold text-foreground">Join our newsletter</h4>
                  <p className="text-sm mb-4">Get exclusive access to new drops and special offers.</p>
                  <form className="flex">
                      <input type="email" placeholder="Your email" className="w-full rounded-l-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"/>
                      <button className="bg-orange-500 text-white p-2 rounded-r-md hover:bg-orange-600 transition-colors">
                          <ArrowRight className="h-5 w-5"/>
                      </button>
                  </form>
              </div>
          </div>

          {/* Bottom Bar */}
          <div className="mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm sm:flex-row sm:gap-0">
              <p>&copy; {new Date().getFullYear()} SecondSkin. All Rights Reserved.</p>
              <div className="flex gap-4 mt-4 sm:mt-0">
                  <a href="#" className="transition-colors hover:text-foreground"><Instagram className="h-5 w-5" /></a>
                  <a href="#" className="transition-colors hover:text-foreground"><Twitter className="h-5 w-5" /></a>
                  <a href="#" className="transition-colors hover:text-foreground"><Facebook className="h-5 w-5" /></a>
              </div>
          </div>
      </footer>
  );
};
