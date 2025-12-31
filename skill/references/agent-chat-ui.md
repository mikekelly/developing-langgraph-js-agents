<overview>

Agent Chat UI is a Next.js application providing a conversational interface for LangGraph agents. It offers real-time chat, tool visualization, time-travel debugging, and state forking.

</overview>

<setup>

## Quick Start Options

**Hosted (no install):**
Visit https://agentchat.vercel.app

**Local with npx:**
```bash
npx create-agent-chat-app --project-name my-chat-ui
cd my-chat-ui
pnpm install
pnpm dev
```

**Clone repository:**
```bash
git clone https://github.com/langchain-ai/agent-chat-ui.git
cd agent-chat-ui
pnpm install
pnpm dev
```

</setup>

<running_local_server>

## Running Your Agent as a Server

Agent Chat UI connects to a LangGraph server. Run your agent locally:

```bash
# Install LangGraph CLI
npm install -g @langchain/langgraph-cli

# Start server (reads langgraph.json)
langgraph dev
```

Create `langgraph.json` in your project root:

```json
{
  "graphs": {
    "agent": "./src/agent.ts:agent"
  },
  "dependencies": ["."]
}
```

The format is `"graph_name": "./path/to/file.ts:exportedVariable"`.

Server runs at `http://localhost:2024` by default.

</running_local_server>

<connecting>

## Connecting Chat UI to Your Agent

In the Chat UI, provide:

| Field | Value |
|-------|-------|
| Graph ID | Your graph name from `langgraph.json` (e.g., `"agent"`) |
| Deployment URL | `http://localhost:2024` (local) or deployed URL |
| LangSmith API Key | Only for deployed agents, not needed locally |

</connecting>

<features>

## Key Features

- **Tool visualization**: Automatically renders tool calls and results
- **Interrupts**: Built-in support for human-in-the-loop flows
- **Time-travel**: Debug by viewing/forking from any state
- **Streaming**: Real-time token streaming display
- **Customizable**: Open source, modify as needed

</features>

<project_structure>

## Required Project Structure

```
my-agent/
├── src/
│   └── agent.ts          # Exports compiled graph
├── langgraph.json        # Server configuration
├── package.json
└── .env                  # API keys
```

**agent.ts must export the compiled graph:**

```typescript
import { StateGraph, ... } from "@langchain/langgraph";

const workflow = new StateGraph(State)
  .addNode(...)
  .addEdge(...)
  // ...

// Export the compiled graph (name matches langgraph.json)
export const agent = workflow.compile({
  checkpointer: new MemorySaver(),
});
```

</project_structure>

<streaming_integration>

## Enabling Streaming in Chat UI

Chat UI automatically streams if your agent supports it. Ensure your graph compiles correctly - streaming is built-in to LangGraph.

For custom streaming events (progress indicators):

```typescript
async function myNode(state: StateType, config: RunnableConfig) {
  config.writer?.({ type: "progress", message: "Processing..." });
  // ... work
  return { result };
}
```

</streaming_integration>
