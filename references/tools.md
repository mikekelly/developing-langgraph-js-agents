<overview>

Tools give LangGraph agents the ability to interact with external systems. The LLM decides when to call tools based on the conversation, and the agent executes them. Tools are defined with schemas that tell the LLM what arguments to provide.

</overview>

<defining_tools>

## Creating Tools

Use the `tool` function from `@langchain/core/tools`:

```typescript
import { tool } from "@langchain/core/tools";
import * as z from "zod";

const searchTool = tool(
  async ({ query, limit }) => {
    const results = await searchDatabase(query, limit);
    return JSON.stringify(results);
  },
  {
    name: "search_database",
    description: "Search the product database. Use when user asks about products, inventory, or wants to find items by name or category.",
    schema: z.object({
      query: z.string().describe("Search terms to look for"),
      limit: z.number().optional().default(10).describe("Maximum results to return"),
    }),
  }
);
```

**Tool definition requirements:**
- `name`: snake_case, descriptive
- `description`: Clear explanation of when to use it
- `schema`: Zod schema with parameter descriptions

</defining_tools>

<tool_descriptions>

## Writing Effective Descriptions

The description determines when the LLM uses the tool:

```typescript
// BAD: Vague, LLM won't know when to use
description: "Searches for things"

// GOOD: Clear trigger conditions
description: "Search the product catalog. Use when the user asks about products, wants to find items, or needs inventory information. Returns product names, prices, and availability."

// GOOD: With examples
description: "Calculate mathematical expressions. Use for: arithmetic (2+2), percentages (15% of 200), unit conversions (5km to miles). Input should be a valid math expression."
```

**Description checklist:**
- What the tool does
- When to use it (trigger conditions)
- What input format is expected
- What output format is returned

</tool_descriptions>

<binding_tools>

## Binding Tools to Models

Tools must be bound to the model before use:

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
});

// Define tools
const tools = [searchTool, calculateTool, weatherTool];

// Bind to model
const modelWithTools = model.bindTools(tools);

// Now modelWithTools can generate tool calls
```

</binding_tools>

<tool_node>

## Creating a Tool Execution Node

Standard pattern for executing tool calls:

```typescript
import { AIMessage, ToolMessage } from "@langchain/core/messages";

// Create lookup map
const toolsByName = Object.fromEntries(
  tools.map(t => [t.name, t])
);

async function toolNode(state: AgentStateType) {
  const lastMessage = state.messages.at(-1);

  // Verify we have an AI message with tool calls
  if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
    return { messages: [] };
  }

  const toolCalls = lastMessage.tool_calls ?? [];

  // Execute each tool call
  const toolMessages: ToolMessage[] = [];
  for (const toolCall of toolCalls) {
    const tool = toolsByName[toolCall.name];

    if (!tool) {
      toolMessages.push(new ToolMessage({
        content: `Error: Unknown tool "${toolCall.name}"`,
        tool_call_id: toolCall.id,
      }));
      continue;
    }

    try {
      const result = await tool.invoke(toolCall);
      toolMessages.push(result);
    } catch (error) {
      toolMessages.push(new ToolMessage({
        content: `Error executing ${toolCall.name}: ${error.message}`,
        tool_call_id: toolCall.id,
      }));
    }
  }

  return { messages: toolMessages };
}
```

</tool_node>

<parallel_tools>

## Executing Tools in Parallel

For independent tool calls:

```typescript
async function parallelToolNode(state: AgentStateType) {
  const lastMessage = state.messages.at(-1);

  if (!AIMessage.isInstance(lastMessage)) {
    return { messages: [] };
  }

  const toolCalls = lastMessage.tool_calls ?? [];

  // Execute all tools concurrently
  const results = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const tool = toolsByName[toolCall.name];
      if (!tool) {
        return new ToolMessage({
          content: `Unknown tool: ${toolCall.name}`,
          tool_call_id: toolCall.id,
        });
      }
      return tool.invoke(toolCall);
    })
  );

  return { messages: results };
}
```

</parallel_tools>

<tool_with_context>

## Tools with Runtime Context

Access agent context inside tools:

```typescript
import { RunnableConfig } from "@langchain/core/runnables";

const contextAwareTool = tool(
  async ({ query }, config: RunnableConfig) => {
    // Access thread context
    const userId = config?.configurable?.user_id;

    // Access store for persistent memory
    const store = config?.store;
    const userPrefs = await store?.get([userId, "preferences"]);

    return await searchWithContext(query, userPrefs);
  },
  {
    name: "contextual_search",
    description: "Search with user context",
    schema: z.object({
      query: z.string(),
    }),
  }
);
```

</tool_with_context>

<streaming_from_tools>

## Streaming Progress from Tools

Emit progress updates during long-running tools:

```typescript
const longRunningTool = tool(
  async ({ url }, config: RunnableConfig) => {
    const writer = config?.writer;

    writer?.({ status: "Starting download..." });

    const data = await downloadFile(url, (progress) => {
      writer?.({ status: `Downloaded ${progress}%` });
    });

    writer?.({ status: "Processing..." });
    const result = await processData(data);

    return result;
  },
  {
    name: "download_and_process",
    description: "Download and process a file from URL",
    schema: z.object({
      url: z.string().url(),
    }),
  }
);

// Stream with custom mode to receive updates
for await (const chunk of await graph.stream(input, {
  streamMode: "custom",
})) {
  console.log(chunk.status);
}
```

</streaming_from_tools>

<common_tool_patterns>

## Common Tool Patterns

### Search/Retrieval Tool

```typescript
const searchTool = tool(
  async ({ query, filters }) => {
    const results = await vectorStore.similaritySearch(query, 5);
    return results.map(r => r.pageContent).join("\n\n");
  },
  {
    name: "search_knowledge_base",
    description: "Search internal documentation. Use when user asks questions that might be answered in company docs.",
    schema: z.object({
      query: z.string().describe("Search query"),
      filters: z.object({
        category: z.string().optional(),
      }).optional(),
    }),
  }
);
```

### API Call Tool

```typescript
const apiTool = tool(
  async ({ endpoint, method, body }) => {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await response.text();
  },
  {
    name: "call_api",
    description: "Make API requests. Use for fetching or modifying external data.",
    schema: z.object({
      endpoint: z.string().describe("API endpoint path"),
      method: z.enum(["GET", "POST", "PUT", "DELETE"]),
      body: z.record(z.unknown()).optional(),
    }),
  }
);
```

### Calculator Tool

```typescript
const calculateTool = tool(
  ({ expression }) => {
    // Use a safe math parser, not eval!
    const result = mathjs.evaluate(expression);
    return String(result);
  },
  {
    name: "calculate",
    description: "Evaluate mathematical expressions. Supports: arithmetic, algebra, unit conversions.",
    schema: z.object({
      expression: z.string().describe("Math expression to evaluate"),
    }),
  }
);
```

</common_tool_patterns>

<anti_patterns>

## Tool Anti-Patterns

**DON'T:**
- Use vague descriptions ("does stuff")
- Skip parameter descriptions in schema
- Return unstructured error messages
- Forget to handle tool errors gracefully
- Create tools with side effects that can't be undone

**DO:**
- Write clear, specific descriptions
- Include when-to-use guidance
- Return structured, parseable results
- Handle errors and return helpful messages
- Log tool executions for debugging

</anti_patterns>
