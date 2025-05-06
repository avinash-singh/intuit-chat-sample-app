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
  useColorModeValue,
} from '@chakra-ui/react';
import { db } from '../db/database';

interface LoginProps {
  onLogin: (username: string) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('');
  const toast = useToast();

  // Theme-aware colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

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
    <Box 
      maxW="md" 
      mx="auto" 
      mt={8} 
      p={6} 
      borderWidth={1} 
      borderRadius="lg"
      bg={bgColor}
      borderColor={borderColor}
      boxShadow="lg"
    >
      <VStack spacing={6} as="form" onSubmit={handleSubmit}>
        <Heading size="lg" textAlign="center">Welcome to Intuit Sample Chat App</Heading>
        <FormControl isRequired>
          <FormLabel>Username</FormLabel>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            size="lg"
            _focus={{
              borderColor: 'blue.500',
              boxShadow: '0 0 0 1px #3182ce',
            }}
          />
        </FormControl>
        <Button 
          type="submit" 
          colorScheme="blue" 
          width="full"
          size="lg"
          borderRadius="full"
        >
          Enter Chat
        </Button>
      </VStack>
    </Box>
  );
}; 