'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageCircle, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface AskAiveryPromptProps {
  className?: string;
}

const SUGGESTED_PROMPTS = [
  "How's my volume trend?",
  "Do I need a rest day?", 
  "Where do I improve most?",
  "What's my best week so far?",
  "Am I overtraining?",
  "Show me my progress"
];

export default function AskAiveryPrompt({ className }: AskAiveryPromptProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (promptText?: string) => {
    const finalQuery = promptText || query.trim();
    if (!finalQuery) return;

    setIsLoading(true);
    
    // Encode the query and redirect to chat
    const encodedQuery = encodeURIComponent(finalQuery);
    router.push(`/chat?initialQuery=${encodedQuery}&requestType=general`);
    
    // Reset form
    setQuery('');
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.section 
      className={`mb-12 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <Card className="border-0 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/30 dark:to-teal-950/20 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent pointer-events-none" />
        
        <CardContent className="p-6 relative">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <MessageCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Ask Aivery</h3>
                <p className="text-sm text-muted-foreground">
                  Get insights about your training and progress
                </p>
              </div>
            </div>

            {/* Input field */}
            <div className="relative">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="What's my best week so far?"
                disabled={isLoading}
                className="pr-12 bg-background/80 backdrop-blur-sm border-border/50 focus:border-emerald-400 dark:focus:border-emerald-500"
              />
              <Button
                onClick={() => handleSubmit()}
                disabled={!query.trim() || isLoading}
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {isLoading ? (
                  <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </Button>
            </div>

            {/* Suggested prompts */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">
                Quick questions:
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((prompt, index) => (
                  <motion.button
                    key={prompt}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSubmit(prompt)}
                    disabled={isLoading}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200",
                      "bg-background/80 backdrop-blur-sm border border-border/40 hover:border-emerald-400/60",
                      "text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-300",
                      "hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {prompt}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Call to action */}
            <div className="pt-2 border-t border-border/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs text-muted-foreground/80">
                    AI-powered insights from your workout data
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => router.push('/chat')}
                  className="text-xs h-auto py-1.5 px-3 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Open Chat
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
} 