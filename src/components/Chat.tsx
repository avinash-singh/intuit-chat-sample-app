import { useState, useEffect, useRef } from 'react';
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
  Flex,
  useToast,
  Progress,
  IconButton,
  Tooltip,
  Divider,
  Badge,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  useColorMode,
  useColorModeValue,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { db, Message, Chat as ChatType } from '../db/database';
import { MicrophoneButton } from './MicrophoneButton';
import { ChatIcon, DeleteIcon } from '@chakra-ui/icons';

interface ChatProps {
  username: string;
}

const MAX_CHARACTERS = 3000;
const EDIT_TIME_LIMIT = 5 * 60 * 1000; // 5 minutes in milliseconds

// Common emoji reactions
const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥'];

export const Chat = ({ username }: ChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentChat, setCurrentChat] = useState<ChatType | null>(null);
  const [chats, setChats] = useState<ChatType[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);
  const lastMessageTimestampRef = useRef<Date | null>(null);
  const { colorMode } = useColorMode();
  const [chatToDelete, setChatToDelete] = useState<ChatType | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Theme-aware colors
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const messageBg = useColorModeValue('white', 'gray.800');
  const userMessageBg = useColorModeValue('blue.100', 'blue.900');
  const otherMessageBg = useColorModeValue('gray.100', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  const replyHighlightBg = useColorModeValue('blue.50', 'blue.900');
  const replyHighlightBorder = useColorModeValue('blue.200', 'blue.700');

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (currentChat) {
      loadMessages(currentChat.id!);
    }
  }, [currentChat]);

  useEffect(() => {
    if (!currentChat) return;

    const refreshMessages = async () => {
      try {
        const chatMessages = await db.messages
          .where('chatId')
          .equals(currentChat.id!)
          .toArray();

        if (chatMessages.length > messages.length) {
          setMessages(chatMessages);
          scrollToBottom();
        }
      } catch (error) {
        console.error('Error refreshing messages:', error);
      }
    };

    const intervalId = setInterval(refreshMessages, 2000);

    return () => clearInterval(intervalId);
  }, [currentChat, messages.length]);

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
      if (chatMessages.length > 0) {
        lastMessageTimestampRef.current = chatMessages[chatMessages.length - 1].timestamp;
      }
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

  const markMessageAsRead = async (messageId: number) => {
    try {
      await db.messages.update(messageId, { isRead: true });
      setMessages((prev: Message[]) =>
        prev.map((msg: Message) =>
          msg.id === messageId ? { ...msg, isRead: true } : msg
        )
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const startReply = (message: Message) => {
    setReplyingTo(message);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const sendMessage = async () => {
    if (!editorRef.current?.innerText.trim() || !currentChat) return;
    if (characterCount > MAX_CHARACTERS) {
      toast({
        title: 'Message too long',
        description: `Please keep messages under ${MAX_CHARACTERS} characters`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const messageContent = editorRef.current?.innerHTML || '';
    const messageText = editorRef.current?.innerText || '';

    setIsProcessing(true);
    try {
      const newMessage = {
        content: messageContent,
        userId: 1,
        username,
        timestamp: new Date(),
        chatId: currentChat.id!,
        isRead: false,
        parentId: replyingTo?.id,
        isThread: !!replyingTo?.id,
      };
      
      const messageId = await db.messages.add(newMessage);
      setMessages((prev: Message[]) => [...prev, { ...newMessage, id: messageId }]);
      await db.chats.update(currentChat.id!, {
        lastMessageAt: new Date(),
      });
      setNewMessage('');
      setCharacterCount(0);
      setReplyingTo(null);
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatText = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText;
      if (text.length <= MAX_CHARACTERS) {
        setNewMessage(editorRef.current.innerHTML);
        setCharacterCount(text.length);
      } else {
        // If text is too long, revert to previous state
        editorRef.current.innerHTML = newMessage;
        toast({
          title: 'Message too long',
          description: `Please keep messages under ${MAX_CHARACTERS} characters`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  const handleTranscription = (text: string) => {
    if (editorRef.current) {
      const newText = editorRef.current.innerText + text;
      if (newText.length > MAX_CHARACTERS) {
        toast({
          title: 'Message too long',
          description: `Please keep messages under ${MAX_CHARACTERS} characters`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      editorRef.current.innerHTML += text;
      setNewMessage(editorRef.current.innerHTML);
      setCharacterCount(newText.length);
    }
  };

  const characterPercentage = (characterCount / MAX_CHARACTERS) * 100;
  const isNearLimit = characterCount > MAX_CHARACTERS * 0.8;

  const addReaction = async (messageId: number, emoji: string) => {
    try {
      const message = await db.messages.get(messageId);
      if (!message) return;

      const reactions = message.reactions || {};
      const userReactions = reactions[username] || [];
      
      // Toggle reaction
      const newUserReactions = userReactions.includes(emoji)
        ? userReactions.filter((e: string) => e !== emoji)
        : [...userReactions, emoji];

      const newReactions = {
        ...reactions,
        [username]: newUserReactions
      };

      await db.messages.update(messageId, { reactions: newReactions });
      setMessages((prev: Message[]) =>
        prev.map((msg: Message) =>
          msg.id === messageId ? { ...msg, reactions: newReactions } : msg
        )
      );
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const getReactionCount = (reactions: Record<string, string[]> | undefined, emoji: string) => {
    if (!reactions) return 0;
    return Object.values(reactions).flat().filter(e => e === emoji).length;
  };

  const hasUserReacted = (reactions: Record<string, string[]> | undefined, emoji: string) => {
    if (!reactions || !reactions[username]) return false;
    return reactions[username].includes(emoji);
  };

  const canEditMessage = (message: Message) => {
    if (message.userId !== 1) return false; // Only user's messages can be edited
    const messageAge = Date.now() - new Date(message.timestamp).getTime();
    return messageAge <= EDIT_TIME_LIMIT;
  };

  const startEditing = (message: Message) => {
    if (!canEditMessage(message)) {
      toast({
        title: 'Cannot edit message',
        description: 'Messages can only be edited within 5 minutes of sending',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    setEditingMessage(message);
    if (editorRef.current) {
      editorRef.current.innerHTML = message.content;
      setCharacterCount(message.content.replace(/<[^>]*>/g, '').length);
    }
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
      setCharacterCount(0);
    }
  };

  const saveEdit = async () => {
    if (!editingMessage || !editorRef.current) return;

    const newContent = editorRef.current.innerHTML;
    if (newContent.length > MAX_CHARACTERS) {
      toast({
        title: 'Message too long',
        description: `Please keep messages under ${MAX_CHARACTERS} characters`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      await db.messages.update(editingMessage.id!, {
        content: newContent,
        isEdited: true,
      });

      setMessages((prev: Message[]) =>
        prev.map((msg: Message) =>
          msg.id === editingMessage.id
            ? { ...msg, content: newContent, isEdited: true }
            : msg
        )
      );

      setEditingMessage(null);
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
        setCharacterCount(0);
      }
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: 'Error',
        description: 'Failed to update message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const renderMessage = (message: Message, isThread = false) => {
    const isUserMessage = message.userId === 1;
    const messageBgColor = isUserMessage ? userMessageBg : otherMessageBg;
    const threadMessages = messages.filter((m: Message) => m.parentId === message.id);
    const isBeingRepliedTo = replyingTo?.id === message.id;

    return (
      <Box
        key={message.id}
        bg={isBeingRepliedTo ? replyHighlightBg : messageBgColor}
        p={3}
        borderRadius="lg"
        alignSelf={isUserMessage ? 'flex-end' : 'flex-start'}
        maxW="70%"
        position="relative"
        ml={isThread ? 8 : 0}
        borderLeft={isThread ? `4px solid ${borderColor}` : 'none'}
        border={isBeingRepliedTo ? `2px solid ${replyHighlightBorder}` : 'none'}
        transition="all 0.2s"
        onMouseEnter={() => {
          if (message.userId === 2 && !message.isRead) {
            markMessageAsRead(message.id!);
          }
        }}
        sx={{
          '&:hover .message-controls': {
            opacity: 1
          }
        }}
      >
        <Flex justify="space-between" align="center">
          {isUserMessage && <Text fontWeight="bold">{message.username}</Text>}
          <HStack spacing={1} className="message-controls" opacity={0} transition="opacity 0.2s">
            {!isThread && (
              <Tooltip label="Reply">
                <IconButton
                  aria-label="Reply to message"
                  icon={<ChatIcon />}
                  size="sm"
                  variant="ghost"
                  onClick={() => startReply(message)}
                  colorScheme={isBeingRepliedTo ? "blue" : undefined}
                />
              </Tooltip>
            )}
            <Popover placement="top">
              <PopoverTrigger>
                <IconButton
                  aria-label="Add reaction"
                  icon={<Text>😀</Text>}
                  size="sm"
                  variant="ghost"
                />
              </PopoverTrigger>
              <PopoverContent width="auto">
                <PopoverArrow />
                <PopoverCloseButton />
                <PopoverBody p={2}>
                  <Flex gap={1} wrap="wrap">
                    {EMOJI_REACTIONS.map(emoji => (
                      <Box
                        key={emoji}
                        cursor="pointer"
                        p={1}
                        borderRadius="md"
                        _hover={{ bg: 'gray.100' }}
                        onClick={() => addReaction(message.id!, emoji)}
                      >
                        {emoji}
                      </Box>
                    ))}
                  </Flex>
                </PopoverBody>
              </PopoverContent>
            </Popover>
          </HStack>
        </Flex>
        <Text dangerouslySetInnerHTML={{ __html: message.content }} />
        <Flex justify="space-between" align="center" mt={1}>
          <HStack spacing={2}>
            <Text fontSize="xs" color="gray.500">
              {new Date(message.timestamp).toLocaleTimeString()}
            </Text>
            {message.isEdited && (
              <Text fontSize="xs" color="gray.500" fontStyle="italic">
                (edited)
              </Text>
            )}
          </HStack>
          {isUserMessage && (
            <Tooltip label={message.isRead ? 'Read' : 'Sent'}>
              <Text
                fontSize="xs"
                color={message.isRead ? 'blue.500' : 'gray.500'}
                ml={2}
                fontFamily="monospace"
              >
                {message.isRead ? '✓✓' : '✓'}
              </Text>
            </Tooltip>
          )}
        </Flex>

        {/* Reactions */}
        <Flex wrap="wrap" gap={1} mt={2}>
          {EMOJI_REACTIONS.map(emoji => {
            const count = getReactionCount(message.reactions, emoji);
            if (count === 0) return null;
            return (
              <Tooltip
                key={emoji}
                label={Object.entries(message.reactions || {})
                  .filter(([_, reactions]) => reactions.includes(emoji))
                  .map(([user]) => user)
                  .join(', ')}
              >
                <Box
                  bg={hasUserReacted(message.reactions, emoji) ? 'blue.100' : 'gray.100'}
                  px={2}
                  py={0.5}
                  borderRadius="full"
                  fontSize="xs"
                  cursor="pointer"
                  onClick={() => addReaction(message.id!, emoji)}
                >
                  {emoji} {count}
                </Box>
              </Tooltip>
            );
          })}
        </Flex>

        {/* Thread Messages */}
        {threadMessages.length > 0 && (
          <VStack spacing={2} mt={2} align="stretch">
            {threadMessages.map((threadMessage: Message) => renderMessage(threadMessage, true))}
          </VStack>
        )}
      </Box>
    );
  };

  const handleDeleteChat = async (chat: ChatType) => {
    setChatToDelete(chat);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;

    try {
      // Delete all messages in the chat
      await db.messages.where('chatId').equals(chatToDelete.id!).delete();
      
      // Delete the chat
      await db.chats.delete(chatToDelete.id!);
      
      // Update state
      setChats(chats.filter(c => c.id !== chatToDelete.id));
      
      // If the deleted chat was the current chat, switch to another chat or create a new one
      if (currentChat?.id === chatToDelete.id) {
        const remainingChats = chats.filter(c => c.id !== chatToDelete.id);
        if (remainingChats.length > 0) {
          setCurrentChat(remainingChats[0]);
        } else {
          await createNewChat();
        }
      }

      toast({
        title: 'Chat deleted',
        description: 'The chat has been successfully deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete chat',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setChatToDelete(null);
    }
  };

  return (
    <Box h="100vh" p={4} bg={bgColor}>
      <Flex h="full" gap={4}>
        {/* Chat List */}
        <Box w="250px" borderWidth={1} borderRadius="lg" p={4} bg={messageBg} borderColor={borderColor}>
          <VStack align="stretch" spacing={4}>
            <Button colorScheme="blue" onClick={createNewChat}>
              New Chat
            </Button>
            {chats.map((chat: ChatType) => (
              <Flex
                key={chat.id}
                align="center"
                justify="space-between"
                _hover={{ bg: hoverBg }}
                p={2}
                borderRadius="md"
                transition="background-color 0.2s"
              >
                <Button
                  variant={currentChat?.id === chat.id ? 'solid' : 'ghost'}
                  onClick={() => setCurrentChat(chat)}
                  justifyContent="flex-start"
                  flex={1}
                >
                  {chat.name}
                </Button>
                <IconButton
                  aria-label="Delete chat"
                  icon={<DeleteIcon />}
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => handleDeleteChat(chat)}
                />
              </Flex>
            ))}
          </VStack>
        </Box>

        {/* Chat Area */}
        <Box flex={1} borderWidth={1} borderRadius="lg" display="flex" flexDirection="column" bg={messageBg} borderColor={borderColor}>
          {/* Messages */}
          <Box flex={1} overflowY="auto" p={4}>
            <VStack spacing={4} align="stretch">
              {messages.filter((m: Message) => !m.parentId).map((message: Message) => renderMessage(message))}
              <div ref={messagesEndRef} />
            </VStack>
          </Box>

          {/* Reply Preview */}
          {replyingTo && (
            <Box p={2} borderTopWidth={1} borderColor={borderColor}>
              <Flex justify="space-between" align="center">
                <Text fontSize="sm" color="gray.500">
                  Replying to {replyingTo.username}
                </Text>
                <IconButton
                  aria-label="Cancel reply"
                  icon={<Text>×</Text>}
                  size="sm"
                  variant="ghost"
                  onClick={cancelReply}
                />
              </Flex>
            </Box>
          )}

          {/* Message Input */}
          <Box p={4} borderTopWidth={1} borderColor={borderColor}>
            <Box position="relative">
              {/* Formatting Toolbar */}
              <Flex gap={1} mb={2} wrap="wrap">
                <Tooltip label="Bold">
                  <IconButton
                    aria-label="Bold"
                    icon={<Text fontWeight="bold">B</Text>}
                    size="sm"
                    onClick={() => formatText('bold')}
                  />
                </Tooltip>
                <Tooltip label="Italic">
                  <IconButton
                    aria-label="Italic"
                    icon={<Text fontStyle="italic">I</Text>}
                    size="sm"
                    onClick={() => formatText('italic')}
                  />
                </Tooltip>
                <Tooltip label="Underline">
                  <IconButton
                    aria-label="Underline"
                    icon={<Text textDecoration="underline">U</Text>}
                    size="sm"
                    onClick={() => formatText('underline')}
                  />
                </Tooltip>
                <Divider orientation="vertical" h="24px" mx={1} />
                <Tooltip label="Bullet List">
                  <IconButton
                    aria-label="Bullet List"
                    icon={<Text>•</Text>}
                    size="sm"
                    onClick={() => formatText('insertUnorderedList')}
                  />
                </Tooltip>
                <Tooltip label="Numbered List">
                  <IconButton
                    aria-label="Numbered List"
                    icon={<Text>1.</Text>}
                    size="sm"
                    onClick={() => formatText('insertOrderedList')}
                  />
                </Tooltip>
              </Flex>

              <Flex gap={2} align="center">
                <Box position="relative" flex={1}>
                  <Box
                    ref={editorRef}
                    contentEditable
                    onInput={handleEditorInput}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (editingMessage) {
                          saveEdit();
                        } else {
                          sendMessage();
                        }
                      } else if (e.key === 'Escape') {
                        if (editingMessage) {
                          cancelEditing();
                        } else if (replyingTo) {
                          cancelReply();
                        }
                      }
                    }}
                    p={3}
                    minH="48px"
                    maxH="200px"
                    overflowY="auto"
                    bg={messageBg}
                    borderRadius="lg"
                    boxShadow="sm"
                    pr="140px"
                    _focus={{
                      boxShadow: '0 0 0 1px #3182ce',
                      borderColor: 'blue.500',
                      outline: 'none'
                    }}
                    _empty={{
                      _before: {
                        content: editingMessage 
                          ? '"Edit your message... (Press Enter to save, Esc to cancel)"' 
                          : replyingTo 
                            ? '"Write a reply... (Press Enter to send, Esc to cancel)"'
                            : '"Type a message... (Press Enter to send)"',
                        color: 'gray.400'
                      }
                    }}
                  />
                  <Box
                    position="absolute"
                    right="4"
                    top="50%"
                    transform="translateY(-50%)"
                    display="flex"
                    alignItems="center"
                    gap={2}
                    pointerEvents="none"
                    bg={messageBg}
                    px={2}
                    borderRadius="md"
                  >
                    <Text
                      fontSize="sm"
                      color={isNearLimit ? 'red.500' : 'gray.500'}
                      fontWeight={isNearLimit ? 'bold' : 'normal'}
                      whiteSpace="nowrap"
                    >
                      {characterCount}/{MAX_CHARACTERS}
                    </Text>
                    <Progress
                      value={characterPercentage}
                      size="xs"
                      width="60px"
                      colorScheme={isNearLimit ? 'red' : 'blue'}
                      borderRadius="full"
                    />
                  </Box>
                </Box>
                {editingMessage ? (
                  <>
                    <Button
                      colorScheme="gray"
                      size="lg"
                      onClick={cancelEditing}
                      borderRadius="full"
                      px={8}
                    >
                      Cancel
                    </Button>
                    <Button
                      colorScheme="blue"
                      size="lg"
                      onClick={saveEdit}
                      borderRadius="full"
                      px={8}
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <MicrophoneButton onTranscription={handleTranscription} />
                    <Button
                      colorScheme="blue"
                      size="lg"
                      onClick={sendMessage}
                      isLoading={isProcessing}
                      borderRadius="full"
                      px={8}
                    >
                      Send
                    </Button>
                  </>
                )}
              </Flex>
            </Box>
          </Box>
        </Box>

        {/* Delete Chat Confirmation Dialog */}
        <AlertDialog
          isOpen={!!chatToDelete}
          leastDestructiveRef={cancelRef}
          onClose={() => setChatToDelete(null)}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Delete Chat
              </AlertDialogHeader>

              <AlertDialogBody>
                Are you sure you want to delete this chat? This action cannot be undone.
              </AlertDialogBody>

              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={() => setChatToDelete(null)}>
                  Cancel
                </Button>
                <Button colorScheme="red" onClick={confirmDeleteChat} ml={3}>
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </Flex>
    </Box>
  );
};