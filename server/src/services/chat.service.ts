import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db/connection';

interface ChatUser {
  userId: number;
  email: string;
  role: 'customer' | 'admin';
  name?: string;
}

interface ChatMessage {
  ticketId: number;
  message: string;
}

let io: Server | null = null;

export function initChatService(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin === '*' ? true : (_origin: any, callback: any) => {
        callback(null, true); // Allow same-origin (SPA served from same server)
      },
      credentials: true,
    },
    path: '/socket.io',
  });

  const chatNs = io.of('/chat');

  // Authentication middleware
  chatNs.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret) as any;
      (socket as any).user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      } as ChatUser;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  chatNs.on('connection', (socket: Socket) => {
    const user: ChatUser = (socket as any).user;
    console.log(`[Chat] User connected: ${user.email} (${user.role})`);

    // Look up user name from DB
    query('SELECT name FROM customers WHERE id = $1', [user.userId])
      .then(res => {
        if (res.rows.length > 0) {
          user.name = res.rows[0].name;
        }
      })
      .catch(() => {});

    // Join a ticket room
    socket.on('join-ticket', async (ticketId: number) => {
      const room = `ticket-${ticketId}`;
      socket.join(room);
      console.log(`[Chat] ${user.email} joined room ${room}`);

      // Send chat history for this ticket
      try {
        const result = await query(
          `SELECT id, ticket_id, author_id, author_name, author_role, message, is_internal, is_chat, created_at
           FROM ticket_responses
           WHERE ticket_id = $1 AND is_chat = TRUE
           ORDER BY created_at ASC`,
          [ticketId]
        );
        socket.emit('chat-history', result.rows);
      } catch (err) {
        console.error('[Chat] Error loading history:', err);
        socket.emit('chat-history', []);
      }
    });

    // Send a chat message
    socket.on('chat-message', async (data: ChatMessage) => {
      const { ticketId, message } = data;
      if (!message?.trim()) return;

      const authorName = user.name || user.email;
      const authorRole = user.role === 'admin' ? 'admin' : 'customer';

      try {
        const result = await query(
          `INSERT INTO ticket_responses (ticket_id, author_id, author_name, author_role, message, is_internal, is_chat)
           VALUES ($1, $2, $3, $4, $5, FALSE, TRUE)
           RETURNING id, ticket_id, author_id, author_name, author_role, message, is_internal, is_chat, created_at`,
          [ticketId, user.userId, authorName, authorRole, message.trim()]
        );

        const savedMessage = result.rows[0];
        const room = `ticket-${ticketId}`;

        // Broadcast to all users in the room (including sender)
        chatNs.to(room).emit('chat-message', savedMessage);

        console.log(`[Chat] Message in ticket ${ticketId} from ${authorName}: ${message.trim().substring(0, 50)}`);
      } catch (err) {
        console.error('[Chat] Error saving message:', err);
        socket.emit('chat-error', { error: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing', (data: { ticketId: number; isTyping: boolean }) => {
      const room = `ticket-${data.ticketId}`;
      socket.to(room).emit('typing', {
        userId: user.userId,
        name: user.name || user.email,
        isTyping: data.isTyping,
      });
    });

    // Leave a ticket room
    socket.on('leave-ticket', (ticketId: number) => {
      const room = `ticket-${ticketId}`;
      socket.leave(room);
      console.log(`[Chat] ${user.email} left room ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Chat] User disconnected: ${user.email}`);
    });
  });

  console.log('[Chat] WebSocket chat service initialized');
  return io;
}

export function getChatIO(): Server | null {
  return io;
}
