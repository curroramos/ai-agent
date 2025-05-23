# AI Agent

A sophisticated AI chat application built with Next.js, featuring real-time conversations, advanced prompt caching, and intelligent tool orchestration powered by LangChain and gpt 4o mini.

## Features

- 🤖 Advanced AI chat interface with Claude 3.5 Sonnet
- 🎨 Modern and responsive UI with Tailwind CSS
- 🔐 Authentication with Clerk
- 💾 Real-time data storage with Convex
- ⚡ Built with Next.js 15 and React 19
- 🌊 Advanced streaming responses with custom implementation
- 📱 Mobile-friendly design
- 🧠 Prompt caching for optimized token usage
- 🔧 Intelligent tool orchestration with LangGraph
- 🔄 Real-time updates and tool execution feedback

## Advanced Features

### AI and Prompt Management

- **Prompt Caching**: Optimized token usage with Anthropic's caching feature
- **Context Window**: Efficient 4096 token context management
- **Tool-Augmented Responses**: Enhanced AI capabilities with custom tools
- **Context-Aware Conversations**: Intelligent conversation management

### LangChain & LangGraph Features

- **State Management**: Sophisticated state handling with StateGraph
- **Tool Orchestration**: Advanced tool management with ToolNode
- **Memory Management**: Efficient context tracking with MemorySaver
- **Message Optimization**: Intelligent message trimming and context management

### Streaming Implementation

- **Custom Streaming Solution**:
  - Real-time token streaming
  - Tool execution feedback
  - Error handling for failed tool calls
  - Workarounds for LangChainAdapter limitations

### Real-time Features

- **Live Updates**: Instant message delivery and updates
- **Tool Visualization**: Real-time tool interaction display
- **History Management**: Efficient message history tracking

## Tech Stack

- **Frontend Framework**: Next.js 15.1.3
- **UI Library**: React 19.0.0
- **Styling**: Tailwind CSS
- **Authentication**: Clerk
- **Database**: Convex
- **AI Integration**: LangChain
- **Icons**: Lucide React & Radix UI Icons
- **Type Safety**: TypeScript

## Prerequisites

- Node.js (Latest LTS version recommended)
- PNPM package manager or NPM/Yarn
- Clerk account for authentication
- Convex account for database
- OpenAI/Anthropic API key for AI capabilities

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Performance Optimizations

- Implemented prompt caching
- Optimized token usage
- Efficient streaming implementation
- Smart context window management
