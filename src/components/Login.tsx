import { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  useToast,
} from '@chakra-ui/react';
import { db } from '../db/database';

interface LoginProps {
  onLogin: (username: string) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('');
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a username',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      // Check if user exists
      let user = await db.users.where('username').equals(username).first();
      
      if (!user) {
        // Create new user
        const id = await db.users.add({
          username,
          createdAt: new Date(),
        });
        user = await db.users.get(id);
      }

      onLogin(username);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to login. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Box maxW="md" mx="auto" mt={8} p={6} borderWidth={1} borderRadius="lg">
      <VStack spacing={4} as="form" onSubmit={handleSubmit}>
        <Heading size="lg">Welcome to Intuit Sample Chat App</Heading>
        <FormControl isRequired>
          <FormLabel>Username</FormLabel>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
          />
        </FormControl>
        <Button type="submit" colorScheme="blue" width="full">
          Enter Chat
        </Button>
      </VStack>
    </Box>
  );
}; 