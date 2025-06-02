'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface AskAiveryPromptProps {
  className?: string;
}

const SUGGESTED_PROMPTS = [
  "What's my best week so far?",
  "Do I need a rest day?",
  "How's my progress?", 
  "Show me trends"
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
      className={cn("mb-8", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className="apple-card">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="apple-heading-sm text-foreground">Ask Aivery</h3>
                <p className="apple-body-sm text-muted-foreground">
                  Get insights about your training
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
                className="pr-12 bg-background/50 border-border/50 focus:border-foreground/20 rounded-lg"
              />
              <Button
                onClick={() => handleSubmit()}
                disabled={!query.trim() || isLoading}
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0 bg-foreground hover:bg-foreground/90 text-background rounded-md"
              >
                {isLoading ? (
                  <div className="w-3 h-3 border border-background/30 border-t-background rounded-full animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </Button>
            </div>

            {/* Suggested prompts */}
            <div className="space-y-3">
              <p className="apple-caption text-muted-foreground/60">
                Quick questions
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((prompt, index) => (
                  <motion.button
                    key={prompt}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05, duration: 0.2 }}
                    onClick={() => handleSubmit(prompt)}
                    disabled={isLoading}
                    className={cn(
                      "px-3 py-2 apple-body-sm rounded-lg transition-all duration-200",
                      "bg-secondary/50 border border-border/30 hover:border-border",
                      "text-muted-foreground hover:text-foreground",
                      "hover:bg-secondary/80",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {prompt}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
} 