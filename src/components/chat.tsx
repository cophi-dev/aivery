import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/user-avatar"
import Image from "next/image"

interface Message {
  id: string
  text: string
  isUserMessage: boolean
  name?: string
}

interface ChatMessageProps {
  message: Message
  isNextMessageSamePerson: boolean
}

const ChatMessage = ({ message, isNextMessageSamePerson }: ChatMessageProps) => {
  return (
    <div
      className={cn('flex items-end', {
        'justify-end': message.isUserMessage,
      })}>
      <div
        className={cn('relative flex h-8 w-8 aspect-square items-center justify-center', {
          'order-2 bg-primary/10 rounded-full': message.isUserMessage,
          'order-1': !message.isUserMessage,
          invisible: isNextMessageSamePerson,
        })}>
        {message.isUserMessage ? (
          <UserAvatar
            name={message.name || 'U'}
            imageUrl={null}
            size="sm"
          />
        ) : (
          <div className="relative w-8 h-8">
            <Image
              src="/aivery-logo.svg"
              alt="Aivery AI"
              width={32}
              height={32}
              priority
              className="rounded-full"
            />
          </div>
        )}
      </div>

      <div
        className={cn('flex flex-col space-y-2 text-base max-w-md mx-2', {
          'order-1 items-end': message.isUserMessage,
          'order-2 items-start': !message.isUserMessage,
        })}>
        <div
          className={cn('px-4 py-2 rounded-lg inline-block', {
            'bg-primary text-primary-foreground': message.isUserMessage,
            'bg-primary/10 text-foreground': !message.isUserMessage,
          })}>
          {message.text}
        </div>
      </div>
    </div>
  )
} 