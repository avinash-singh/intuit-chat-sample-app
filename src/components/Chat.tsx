import { useState, useEffect, useRef } from 'react';
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  Flex,
  useToast,
} from '@chakra-ui/react';
import { db, Message, Chat as ChatType } from '../db/database';

interface ChatProps {
  username: string;
}

export const Chat = ({ username }: ChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentChat, setCurrentChat] = useState<ChatType | null>(null);
  const [chats, setChats] = useState<ChatType[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (currentChat) {
      loadMessages(currentChat.id!);
    }
  }, [currentChat]);

  const loadChats = async () => {
    try {
      const allChats = await db.chats.toArray();
      setChats(allChats);
      if (allChats.length > 0 && !currentChat) {
        setCurrentChat(allChats[0]);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load chats',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const loadMessages = async (chatId: number) => {
    try {
      const chatMessages = await db.messages
        .where('chatId')
        .equals(chatId)
        .toArray();
      setMessages(chatMessages);
      scrollToBottom();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const createNewChat = async () => {
    try {
      const chatName = `Chat ${chats.length + 1}`;
      const chatId = await db.chats.add({
        name: chatName,
        createdAt: new Date(),
        lastMessageAt: new Date(),
      });
      const newChat = await db.chats.get(chatId);
      setChats([...chats, newChat!]);
      setCurrentChat(newChat!);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create new chat',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentChat) return;

    try {
      const user = await db.users.where('username').equals(username).first();
      if (!user) throw new Error('User not found');

      const message: Message = {
        content: newMessage,
        userId: user.id!,
        username,
        timestamp: new Date(),
        chatId: currentChat.id!,
      };

      await db.messages.add(message);
      await db.chats.update(currentChat.id!, {
        lastMessageAt: new Date(),
      });

      setMessages([...messages, message]);
      setNewMessage('');
      scrollToBottom();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Box h="100vh" p={4}>
      <Flex h="full" gap={4}>
        {/* Chat List */}
        <Box w="250px" borderWidth={1} borderRadius="lg" p={4}>
          <VStack align="stretch" spacing={4}>
            <Button colorScheme="blue" onClick={createNewChat}>
              New Chat
            </Button>
            {chats.map((chat) => (
              <Button
                key={chat.id}
                variant={currentChat?.id === chat.id ? 'solid' : 'ghost'}
                onClick={() => setCurrentChat(chat)}
                justifyContent="flex-start"
              >
                {chat.name}
              </Button>
            ))}
          </VStack>
        </Box>

        {/* Chat Area */}
        <Box flex={1} borderWidth={1} borderRadius="lg" display="flex" flexDirection="column">
          {/* Messages */}
          <Box flex={1} overflowY="auto" p={4}>
            <VStack spacing={4} align="stretch">
              {messages.map((message) => (
                <Box
                  key={message.id}
                  bg={message.username === username ? 'blue.100' : 'gray.100'}
                  p={3}
                  borderRadius="lg"
                  alignSelf={message.username === username ? 'flex-end' : 'flex-start'}
                  maxW="70%"
                >
                  <Text fontWeight="bold">{message.username}</Text>
                  <Text>{message.content}</Text>
                  <Text fontSize="xs" color="gray.500">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </Text>
                </Box>
              ))}
              <div ref={messagesEndRef} />
            </VStack>
          </Box>

          {/* Message Input */}
          <Box p={4} borderTopWidth={1}>
            <HStack>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message... (Press Enter to send)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button colorScheme="blue" onClick={sendMessage}>
                Send
              </Button>
            </HStack>
          </Box>
        </Box>
      </Flex>
    </Box>
  );
};