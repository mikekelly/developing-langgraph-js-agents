# Workflow: Build a New LangGraph.js Agent

<required_reading>

**Read these reference files NOW:**
1. references/graph-api.md
2. references/state-management.md
3. references/tools.md
4. references/common-patterns.md

</required_reading>

<process>

## Step 1: Clarify Requirements

Ask the user:
- What should the agent do? (e.g., answer questions, execute tasks, research)
- What tools/capabilities does it need?
- Does it need memory/persistence across conversations?
- Does it need human-in-the-loop approval?
- Which LLM provider? (Anthropic, OpenAI, etc.)

## Step 2: Set Up Project

```bash
# Initialize if new project
npm init -y
npm install @langchain/langgraph @langchain/core zod

# Install LLM provider
npm install @langchain/anthropic  # or @langchain/openai

# TypeScript setup
npm install -D typescript ts-node @types/node
npx tsc --init
```

Create directory structure:
```
src/
├── agent.ts        # Main graph definition
├── state.ts        # State annotations
├── nodes.ts        # Node functions
├── tools.ts        # Tool definitions
└── index.ts        # Entry point
```

## Step 3: Define State

In `src/state.ts`:

```typescript
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  // Add domain-specific fields as needed
});

export type AgentStateType = typeof AgentState.State;
```

**State design rules:**
- Include `MessagesAnnotation.spec` for conversation tracking
- Add fields only if needed across multiple nodes
- Use reducers for accumulating fields (arrays, counters)

## Step 4: Define Tools

In `src/tools.ts`:

```typescript
import { tool } from "@langchain/core/tools";
import * as z from "zod";

export const myTool = tool(
  async ({ param }) => {
    // Tool implementation
    return `Result for ${param}`;
  },
  {
    name: "my_tool",
    description: "Clear description of what this tool does and when to use it",
    schema: z.object({
      param: z.string().describe("What this parameter is for"),
    }),
  }
);

export const tools = [myTool];
export const toolsByName = Object.fromEntries(tools.map(t => [t.name, t]));
```

## Step 5: Define Nodes

In `src/nodes.ts`:

```typescript
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { tools, toolsByName } from "./tools";
import type { AgentStateType } from "./state";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
}).bindTools(tools);

export async function callModel(state: AgentStateType) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

export async function callTools(state: AgentStateType) {
  const lastMessage = state.messages.at(-1);

  if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
    return { messages: [] };
  }

  const toolMessages: ToolMessage[] = [];
  for (const toolCall of lastMessage.tool_calls ?? []) {
    const tool = toolsByName[toolCall.name];
    const result = await tool.invoke(toolCall);
    toolMessages.push(result);
  }

  return { messages: toolMessages };
}
```

## Step 6: Build the Graph

In `src/agent.ts`:

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { AgentState, type AgentStateType } from "./state";
import { callModel, callTools } from "./nodes";

function shouldContinue(state: AgentStateType) {
  const lastMessage = state.messages.at(-1);

  if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
    return END;
  }

  if (lastMessage.tool_calls?.length) {
    return "tools";
  }

  return END;
}

const workflow = new StateGraph(AgentState)
  .addNode("agent", callModel)
  .addNode("tools", callTools)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");

export const agent = workflow.compile();
```

## Step 7: Create Entry Point

In `src/index.ts`:

```typescript
import { HumanMessage } from "@langchain/core/messages";
import { agent } from "./agent";

async function main() {
  const result = await agent.invoke({
    messages: [new HumanMessage("Your test prompt here")],
  });

  for (const message of result.messages) {
    console.log(`[${message.getType()}]: ${message.content}`);
  }
}

main().catch(console.error);
```

## Step 8: Add Persistence (If Needed)

Update `src/agent.ts`:

```typescript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

export const agent = workflow.compile({
  checkpointer,
});

// Usage with thread_id
const result = await agent.invoke(
  { messages: [new HumanMessage("Hello")] },
  { configurable: { thread_id: "user-123" } }
);
```

## Step 9: Verify

```bash
# Check TypeScript
npx tsc --noEmit

# Run the agent
npx ts-node src/index.ts
```

</process>

<anti_patterns>

Avoid:
- **Skipping state design** - Don't jump to nodes; design state first
- **Forgetting to compile** - The graph won't work without `.compile()`
- **Mutating state in nodes** - Return updates, don't mutate
- **Vague tool descriptions** - LLMs need clear descriptions to use tools correctly
- **Missing tool error handling** - Tools should handle their own errors gracefully
- **Hardcoding prompts in state** - Store raw data, format in nodes

</anti_patterns>

<success_criteria>

A well-built agent:
- [ ] Has clearly defined state with appropriate reducers
- [ ] Tools have descriptive names and clear schemas
- [ ] Nodes are pure functions (state in, partial state out)
- [ ] Graph compiles without errors
- [ ] TypeScript types are correct throughout
- [ ] Agent responds to test prompts appropriately
- [ ] Persistence works if required (messages persist across invocations)

</success_criteria>
