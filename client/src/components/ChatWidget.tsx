import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageSquare, Send, X, Wifi, WifiOff, MinusCircle } from 'lucide-react';

interface ChatMessage {
  id: number;
  ticket_id: number;
  author_id: number;
  author_name: string;
  author_role: string;
  message: string;
  is_chat: boolean;
  created_at: string;
}

interface TypingUser {
  userId: number;
  name: string;
}

interface ChatWidgetProps {
  ticketId: number;
  currentUser: {
    userId: number;
    name: string;
    role: string;
  };
}

export default function ChatWidget({ ticketId, currentUser }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io('/chat', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-ticket', ticketId);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Chat] Connection error:', err.message);
      setConnected(false);
    });

    socket.on('chat-history', (history: ChatMessage[]) => {
      setMessages(history);
      setTimeout(scrollToBottom, 100);
    });

    socket.on('chat-message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(scrollToBottom, 100);
      if (isMinimized && msg.author_id !== currentUser.userId) {
        setUnreadCount(prev => prev + 1);
      }
    });

    socket.on('typing', (data: { userId: number; name: string; isTyping: boolean }) => {
      if (data.userId === currentUser.userId) return;
      setTypingUsers(prev => {
        if (data.isTyping) {
          if (prev.find(u => u.userId === data.userId)) return prev;
          return [...prev, { userId: data.userId, name: data.name }];
        } else {
          return prev.filter(u => u.userId !== data.userId);
        }
      });
    });

    socket.on('chat-error', (err: { error: string }) => {
      console.error('[Chat] Error:', err.error);
    });

    return () => {
      socket.emit('leave-ticket', ticketId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isOpen, ticketId, currentUser.userId, scrollToBottom]);

  // Reset unread when expanded
  useEffect(() => {
    if (!isMinimized) {
      setUnreadCount(0);
    }
  }, [isMinimized]);

  const handleSend = () => {
    if (!inputMessage.trim() || !socketRef.current) return;

    socketRef.current.emit('chat-message', {
      ticketId,
      message: inputMessage.trim(),
    });

    // Stop typing indicator
    if (isTypingRef.current) {
      socketRef.current.emit('typing', { ticketId, isTyping: false });
      isTypingRef.current = false;
    }

    setInputMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);

    if (!socketRef.current) return;

    // Send typing indicator
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current.emit('typing', { ticketId, isTyping: true });
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && isTypingRef.current) {
        socketRef.current.emit('typing', { ticketId, isTyping: false });
        isTypingRef.current = false;
      }
    }, 2000);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Floating button when chat is closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-accent-blue text-white rounded-full shadow-lg hover:bg-accent-blue/90 transition-all hover:scale-105 flex items-center justify-center"
        title="Open Live Chat"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 bg-white dark:bg-tb-dark border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl flex flex-col transition-all ${
        isMinimized ? 'w-80 h-12' : 'w-96 h-[500px]'
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-accent-blue text-white rounded-t-xl cursor-pointer select-none"
        onClick={() => { setIsMinimized(!isMinimized); if (isMinimized) setUnreadCount(0); }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          <span className="font-medium text-sm">Live Chat</span>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <span title="Connected"><Wifi className="w-3.5 h-3.5 text-green-300" /></span>
          ) : (
            <span title="Disconnected"><WifiOff className="w-3.5 h-3.5 text-red-300" /></span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); if (isMinimized) setUnreadCount(0); }}
            className="hover:bg-white/20 rounded p-0.5 transition-colors"
          >
            <MinusCircle className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            className="hover:bg-white/20 rounded p-0.5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No chat messages yet.</p>
                <p className="text-xs mt-1">Start the conversation!</p>
              </div>
            )}

            {messages.map((msg) => {
              const isOwn = msg.author_id === currentUser.userId;
              return (
                <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      isOwn
                        ? 'bg-accent-blue text-white'
                        : msg.author_role === 'admin'
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-gray-800 dark:text-gray-200 border border-blue-200 dark:border-blue-800'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {!isOwn && (
                      <p className={`text-xs font-medium mb-0.5 ${
                        msg.author_role === 'admin'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {msg.author_name}
                        <span className="ml-1 opacity-60">
                          ({msg.author_role === 'admin' ? 'Engineer' : 'Customer'})
                        </span>
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                  <span className={`text-[10px] mt-0.5 px-1 ${isOwn ? 'text-gray-400' : 'text-gray-400'}`}>
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              );
            })}

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 px-1">
                <div className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>
                  {typingUsers.map(u => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            {!connected && (
              <p className="text-xs text-red-400 mb-2 flex items-center gap-1">
                <WifiOff className="w-3 h-3" /> Reconnecting...
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 tb-input text-sm py-2"
                disabled={!connected}
              />
              <button
                onClick={handleSend}
                disabled={!inputMessage.trim() || !connected}
                className="p-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
