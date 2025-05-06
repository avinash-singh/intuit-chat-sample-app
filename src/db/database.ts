import Dexie from 'dexie';
import type { Table } from 'dexie';

export interface User {
  id?: number;
  username: string;
  createdAt: Date;
}

export interface Message {
  id?: number;
  content: string;
  userId: number;
  username: string;
  timestamp: Date;
  chatId: number;
  isRead: boolean;
  isEdited?: boolean;
  reactions?: Record<string, string[]>;
  parentId?: number;  // ID of the parent message for threaded replies
  isThread?: boolean; // Whether this message is part of a thread
}

export interface Chat {
  id?: number;
  name: string;
  createdAt: Date;
  lastMessageAt: Date;
}

class ChatDatabase extends Dexie {
  users!: Table<User>;
  messages!: Table<Message>;
  chats!: Table<Chat>;

  constructor() {
    super('ChatDatabase');
    this.version(1).stores({
      users: '++id, username',
      messages: '++id, userId, chatId, timestamp',
      chats: '++id, name, createdAt, lastMessageAt'
    });
  }
}

export const db = new ChatDatabase(); 