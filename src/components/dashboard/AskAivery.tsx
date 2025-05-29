'use client';

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const AskAivery = () => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return

    setIsLoading(true)
    setResponse('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question,
          context: 'dashboard'
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to get response')
      }

      const data = await res.json()
      setResponse(data.response || 'I apologize, but I could not process your question at the moment.')
    } catch (error) {
      console.error('Failed to get AI response:', error)
      setResponse('I apologize, but there was an error processing your question. Please try again later.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewQuestion = () => {
    setQuestion('')
    setResponse('')
  }

  const suggestedQuestions = [
    "How can I improve my running pace?",
    "What's the best recovery strategy after strength training?",
    "How often should I do cardio?",
    "Tips for staying motivated?"
  ]

  return (
    <motion.section 
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="mb-6">
        <motion.h2 
          className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          Ask Aivery
        </motion.h2>
        <motion.p 
          className="text-sm text-zinc-500 dark:text-zinc-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          Your AI fitness companion
        </motion.p>
      </div>

      <motion.div 
        className="p-8 bg-white dark:bg-neutral-900/50 rounded-xl backdrop-blur-sm shadow-sm border border-neutral-200/50 dark:border-neutral-800/50 cursor-pointer hover:shadow-md transition-all duration-300"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
        onClick={() => !isExpanded && setIsExpanded(true)}
        whileHover={!isExpanded ? { 
          y: -1,
          transition: { duration: 0.3, ease: "easeOut" }
        } : {}}
      >
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            <motion.div
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-between"
            >
              <p className="text-[1rem] font-serif italic text-neutral-600 dark:text-neutral-400">
                Ask me anything about your fitness journey...
              </p>
              <motion.div 
                className="w-2 h-2 bg-blue-500 rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-6"
            >
              {/* Question Input */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="What would you like to know about your fitness?"
                    className="w-full min-h-[100px] p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 resize-none text-[1rem] font-serif"
                    autoFocus
                  />
                </div>
                
                <div className="flex gap-3">
                  <motion.button
                    type="submit"
                    disabled={!question.trim() || isLoading}
                    className="px-6 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    whileHover={!isLoading && question.trim() ? { scale: 1.02 } : {}}
                    whileTap={!isLoading && question.trim() ? { scale: 0.98 } : {}}
                  >
                    {isLoading ? 'Thinking...' : 'Ask'}
                  </motion.button>
                  
                  {(response || isLoading) && (
                    <motion.button
                      type="button"
                      onClick={handleNewQuestion}
                      className="px-4 py-2 text-zinc-600 dark:text-zinc-400 rounded-lg font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      New Question
                    </motion.button>
                  )}
                </div>
              </form>

              {/* Suggested Questions */}
              {!response && !isLoading && !question && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="space-y-3"
                >
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Try asking:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {suggestedQuestions.map((suggestion, index) => (
                      <motion.button
                        key={index}
                        onClick={() => setQuestion(suggestion)}
                        className="text-left p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-sm"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        {suggestion}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Loading State */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20"
                >
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Aivery is thinking...
                  </p>
                </motion.div>
              )}

              {/* Response */}
              {response && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/50"
                >
                  <p className="text-[1rem] font-serif text-green-900 dark:text-green-100 leading-relaxed">
                    {response}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  )
}

export default AskAivery 