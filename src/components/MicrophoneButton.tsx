import { useState, useRef, useEffect } from 'react';
import { Button } from '@chakra-ui/react';
import { motion } from 'framer-motion';

interface MicrophoneButtonProps {
  onTranscription: (text: string) => void;
}

export const MicrophoneButton = ({ onTranscription }: MicrophoneButtonProps) => {
  const [isListening, setIsListening] = useState(false);
  const mediaStream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const processor = useRef<ScriptProcessorNode | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const audioBuffer = useRef<Float32Array[]>([]);
  const isProcessing = useRef(false);
  const BUFFER_DURATION = 3000; // 3 seconds of audio
  const lastProcessTime = useRef<number>(0);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const processAudioBuffer = async () => {
    if (isProcessing.current || audioBuffer.current.length === 0) return;

    isProcessing.current = true;
    try {
      // Combine all audio chunks into a single array
      const totalLength = audioBuffer.current.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedAudio = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of audioBuffer.current) {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // Clear the buffer after processing
      audioBuffer.current = [];

      // Split the combined audio into smaller chunks (about 1 second of audio)
      const CHUNK_SIZE = 16000; // 1 second of audio at 16kHz
      for (let i = 0; i < combinedAudio.length; i += CHUNK_SIZE) {
        const audioChunk = combinedAudio.slice(i, i + CHUNK_SIZE);
        
        const response = await fetch('http://localhost:3001/api/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ audioData: Array.from(audioChunk) }),
          signal: abortController.current?.signal
        });
        
        if (!response.ok) {
          throw new Error('Transcription request failed');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response stream available');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const text = new TextDecoder().decode(value);
          if (text.trim()) {
            console.log('Received transcription chunk:', text);
            onTranscription(text);
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        console.error('Transcription error:', error);
      }
    } finally {
      isProcessing.current = false;
      lastProcessTime.current = Date.now();
    }
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        }
      });
      mediaStream.current = stream;

      const context = new AudioContext({
        sampleRate: 16000,
      });
      audioContext.current = context;
      const source = context.createMediaStreamSource(stream);
      const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
      processor.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Only process if we have actual audio data (non-silence)
        const hasAudio = inputData.some(sample => Math.abs(sample) > 0.01);
        if (hasAudio) {
          // Add the audio data to the buffer
          audioBuffer.current.push(new Float32Array(inputData));
          
          // Process if we've accumulated enough audio or enough time has passed
          const currentTime = Date.now();
          if (currentTime - lastProcessTime.current >= BUFFER_DURATION) {
            processAudioBuffer();
          }
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(context.destination);
      
      setIsListening(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    // Process any remaining audio
    if (audioBuffer.current.length > 0) {
      processAudioBuffer();
    }

    // Abort any ongoing request
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }

    // Clear the audio buffer
    audioBuffer.current = [];
    isProcessing.current = false;

    if (processor.current) {
      processor.current.disconnect();
      processor.current = null;
    }
    if (audioContext.current) {
      audioContext.current.close();
      audioContext.current = null;
    }
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(track => track.stop());
      mediaStream.current = null;
    }
    setIsListening(false);
  };

  return (
    <motion.div
      animate={isListening ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 1, repeat: Infinity }}
    >
      <Button
        colorScheme={isListening ? 'red' : 'blue'}
        onClick={isListening ? stopListening : startListening}
        borderRadius="full"
        p={2}
        aria-label={isListening ? 'Stop recording' : 'Start recording'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </Button>
    </motion.div>
  );
}; 