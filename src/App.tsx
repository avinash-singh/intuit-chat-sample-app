import { useState } from 'react'
import { ChakraProvider, Box } from '@chakra-ui/react'
import { Login } from './components/Login'
import { Chat } from './components/Chat'

function App() {
  const [username, setUsername] = useState<string | null>(null)

  return (
    <ChakraProvider>
      <Box minH="100vh" bg="gray.50">
        {!username ? (
          <Login onLogin={setUsername} />
        ) : (
          <Chat username={username} />
        )}
      </Box>
    </ChakraProvider>
  )
}

export default App
