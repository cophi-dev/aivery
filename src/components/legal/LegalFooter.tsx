import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import LegalModal from './LegalModal';
import { Icons } from '@/components/ui/icons';
import { SvgPatternBackground } from '@/components/ui/svg-pattern-background';

interface LegalFooterProps {
  className?: string;
}

const LegalFooter: React.FC<LegalFooterProps> = ({ className = '' }) => {
  return (
    <footer className={`relative py-12 md:py-16 border-t border-gray-100 dark:border-gray-800 overflow-hidden ${className}`}>
      {/* SVG Pattern Background */}
      <SvgPatternBackground 
        opacity={0.03} 
        iconSize={64} 
        className="hidden md:block"
        color="var(--brand-accent, #0066FF)" 
      />
      
      <div className="container px-4 md:px-6 max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center justify-center">
            <Image
              src="/icons/aivery.svg"
              alt="Aivery Logo"
              width={60}
              height={60}
              className="hover:scale-110 transition-transform duration-300"
            />
          </Link>
          
          {/* Main Links */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/register" className="hover:text-brand-accent transition-colors">
              Get Started
            </Link>
            <Link href="#features" className="hover:text-brand-accent transition-colors">
              Features
            </Link>
            <LegalModal 
              documentType="terms" 
              buttonVariant="link" 
              className="h-auto text-sm text-gray-500 dark:text-gray-400 hover:text-brand-accent transition-colors"
            />
            <LegalModal 
              documentType="privacy" 
              buttonVariant="link" 
              className="h-auto text-sm text-gray-500 dark:text-gray-400 hover:text-brand-accent transition-colors"
            />
            <LegalModal 
              documentType="impressum" 
              buttonVariant="link" 
              className="h-auto text-sm text-gray-500 dark:text-gray-400 hover:text-brand-accent transition-colors"
            />
          </div>
          
          {/* Social Media */}
          <div className="flex gap-4">
            <a 
              href="https://x.com/_cophi_" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-brand-accent hover:text-white transition-colors"
              aria-label="Follow us on X (Twitter)"
            >
              <Icons.x className="w-4 h-4" />
            </a>
          </div>
          
          {/* Copyright */}
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
            <p>© {new Date().getFullYear()} Aivery. All rights reserved.</p>
            <p className="mt-1 text-xs opacity-60">Training smarter with AI</p>
          </div>
        </div>
      </div>
      
      {/* Fun visual element - Animated Smiley */}
      <div className="absolute -bottom-6 right-6 md:right-12 opacity-25 dark:opacity-10 hidden md:block">
        <svg width="64" height="64" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-bounce">
          <circle cx="256" cy="256" r="200" fill="var(--brand-accent, #0066FF)" opacity="0.7" />
          <circle cx="200" cy="200" r="20" fill="#FFFFFF" />
          <circle cx="312" cy="200" r="20" fill="#FFFFFF" />
          <path d="M200 300 Q 256 320 312 300" stroke="#FFA07A" strokeWidth="10" fill="none" />
        </svg>
      </div>
    </footer>
  );
};

export default LegalFooter; 