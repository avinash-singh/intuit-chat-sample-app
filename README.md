# Intuit Sample Chat App

A real-time chat application built with React, TypeScript, and Vite. This application allows users to create multiple chat rooms and communicate with other users.

## Features

- User authentication with username
- Multiple chat rooms
- Real-time messaging
- Persistent storage using IndexedDB
- Modern UI with Chakra UI

## Prerequisites

- Node.js (version 18.0.0 or higher)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd intuit-sample-chat-app
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Development Mode

To run the application in development mode:

```bash
npm run dev
```

This will start the development server, typically at `http://localhost:5173`

### Production Build

To create a production build:

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint for code linting

## Technologies Used

- React 18
- TypeScript
- Vite
- Chakra UI
- Dexie.js (IndexedDB wrapper)
- ESLint

## Project Structure

```
src/
  ├── components/     # React components
  ├── db/            # Database configuration
  ├── App.tsx        # Main application component
  └── main.tsx       # Application entry point
```
