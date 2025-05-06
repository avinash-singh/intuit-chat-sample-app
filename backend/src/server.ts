import express from 'express';
import cors from 'cors';
import { TranscribeStreamingClient, StartStreamTranscriptionCommand } from '@aws-sdk/client-transcribe-streaming';
import { Readable } from 'node:stream';
import { config } from 'dotenv';
import { fromIni } from '@aws-sdk/credential-providers';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Load environment variables
config();
const app = express();

// Configure CORS to allow requests from the frontend
app.use(cors({
  origin: 'http://localhost:5173', // Vite's default port
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '50mb' })); // Increase payload limit for audio data

// Read AWS credentials from ~/.aws/credentials
const awsCredentialsPath = path.join(os.homedir(), '.aws', 'credentials');
let awsCredentials;

try {
  const credentialsContent = fs.readFileSync(awsCredentialsPath, 'utf-8');
  const defaultProfile = credentialsContent.split('[default]')[1]?.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=').map(s => s.trim());
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string>);

  if (defaultProfile) {
    awsCredentials = {
      accessKeyId: defaultProfile.aws_access_key_id,
      secretAccessKey: defaultProfile.aws_secret_access_key,
      sessionToken: defaultProfile.aws_session_token
    };
    console.log('Successfully loaded AWS credentials from ~/.aws/credentials');
  } else {
    console.error('Could not find [default] profile in AWS credentials file');
  }
} catch (error) {
  console.error('Error reading AWS credentials file:', error);
}

// Initialize AWS Transcribe client with credentials from file
const transcribeClient = new TranscribeStreamingClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: awsCredentials
});

// Helper function to convert audio data to proper format
function convertAudioData(audioData: number[]): Buffer {
  // Convert float32 audio data to 16-bit PCM
  const buffer = Buffer.alloc(audioData.length * 2);
  for (let i = 0; i < audioData.length; i++) {
    // Convert float32 (-1 to 1) to int16 (-32768 to 32767)
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    const int16 = Math.round(sample * 32767);
    buffer.writeInt16LE(int16, i * 2);
  }
  return buffer;
}

app.post('/api/transcribe', async (req, res) => {
  console.log('Received transcription request');
  try {
    const { audioData } = req.body;
    
    if (!audioData || !Array.isArray(audioData)) {
      console.error('Invalid audio data received');
      return res.status(400).json({ error: 'Invalid audio data' });
    }

    // Convert audio data to proper format
    const audioBuffer = convertAudioData(audioData);
    console.log('Converted audio data to buffer, size:', audioBuffer.length);
    
    // Create a readable stream from the buffer
    const audioStream = new Readable({
      read() {
        this.push(audioBuffer);
        this.push(null);
      }
    });

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: 'en-US',
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: 16000,
      AudioStream: {
        [Symbol.asyncIterator]: async function* () {
          // Send the audio data in smaller chunks
          const chunkSize = 1024 * 2; // 2KB chunks
          for (let i = 0; i < audioBuffer.length; i += chunkSize) {
            const chunk = audioBuffer.slice(i, i + chunkSize);
            if (chunk.length > 0) {
              yield { AudioEvent: { AudioChunk: chunk } };
              // Add a small delay between chunks to prevent overwhelming the service
              await new Promise(resolve => setTimeout(resolve, 20));
            }
          }
        }
      }
    });

    console.log('Sending request to AWS Transcribe');
    const response = await transcribeClient.send(command);
    
    if (!response.TranscriptResultStream) {
      console.error('No transcript stream available in response');
      throw new Error('No transcript stream available');
    }

    console.log('Received response from AWS Transcribe, starting to process stream');
    
    // Set headers for streaming response
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Handle the stream
    for await (const event of response.TranscriptResultStream) {
      console.log('Received event from AWS:', JSON.stringify(event, null, 2));
      
      if (event.TranscriptEvent?.Transcript?.Results?.[0]) {
        const result = event.TranscriptEvent.Transcript.Results[0];
        console.log('Processing result:', JSON.stringify(result, null, 2));
        
        if (result.Alternatives?.[0]?.Transcript) {
          const transcribedText = result.Alternatives[0].Transcript;
          console.log('Sending transcription:', transcribedText);
          res.write(transcribedText + '\n');
        }
      }
    }

    console.log('Finished processing AWS Transcribe stream');
    res.end();
  } catch (error) {
    console.error('Server error:', error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chat', async (req, res) => {
  console.log('Received chat message:', req.body.message);
  try {
    const message = req.body.message?.trim();
    
    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    // Simple response logic - you can enhance this with more sophisticated responses
    let response = '';
    const lowerMessage = message.toLowerCase();

    // Check for exact matches first
    if (lowerMessage === 'hi' || lowerMessage === 'hello' || lowerMessage === 'hey') {
      response = 'Hello! How can I help you today?';
    } else if (lowerMessage === 'how are you') {
      response = "I'm doing well, thank you for asking! How can I assist you?";
    } else if (lowerMessage === 'bye' || lowerMessage === 'goodbye') {
      response = 'Goodbye! Have a great day!';
    } else if (lowerMessage.includes('thank you') || lowerMessage === 'thanks') {
      response = "You're welcome! Is there anything else I can help you with?";
    } else if (lowerMessage === 'help') {
      response = "I can help you with various tasks. Just let me know what you need!";
    } else {
      // For other messages, provide a more contextual response
      response = "I understand. What would you like to know more about?";
    }

    res.json({ response });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('CORS enabled for http://localhost:5173');
}); 