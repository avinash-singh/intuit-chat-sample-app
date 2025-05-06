import { useState } from 'react'
import { ChakraProvider, Box, useColorMode, IconButton } from '@chakra-ui/react'
import { Login } from './components/Login'
import { Chat } from './components/Chat'
import { SunIcon, MoonIcon } from '@chakra-ui/icons'

function ThemeToggle() {
  const { colorMode, toggleColorMode } = useColorMode()
  return (
    <IconButton
      aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
      icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
      onClick={toggleColorMode}
      position="fixed"
      top={4}
      right={4}
      zIndex={1000}
    />
  )
}

function App() {
  const [username, setUsername] = useState<string | null>(null)

  return (
    <ChakraProvider>
      <Box minH="100vh" bg={useColorMode().colorMode === 'light' ? 'gray.50' : 'gray.900'}>
        <ThemeToggle />
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
