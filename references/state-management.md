<overview>

State is the shared memory accessible to all nodes in a LangGraph agent. It persists across the graph execution and can be saved/restored via checkpointers. Proper state design is critical for agent reliability.

</overview>

<annotation_api>

## Defining State with Annotations

```typescript
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

const AgentState = Annotation.Root({
  // Include messages handling (recommended for chat agents)
  ...MessagesAnnotation.spec,

  // Simple field (overwrites on update)
  currentStep: Annotation<string>({
    default: () => "start",
  }),

  // Accumulating field (uses reducer)
  searchResults: Annotation<string[]>({
    reducer: (existing, new_) => existing.concat(new_),
    default: () => [],
  }),

  // Counter with custom reducer
  iterations: Annotation<number>({
    reducer: (x, y) => x + y,
    default: () => 0,
  }),
});

// Type for use in nodes
type AgentStateType = typeof AgentState.State;
```

</annotation_api>

<reducers>

## Understanding Reducers

Reducers define how state updates combine with existing values:

```typescript
// NO REDUCER: New value overwrites existing
currentStep: Annotation<string>()
// state.currentStep = "old" → return { currentStep: "new" } → state.currentStep = "new"

// WITH REDUCER: Values combine
messages: Annotation<BaseMessage[]>({
  reducer: (existing, new_) => existing.concat(new_),
})
// state.messages = [msg1] → return { messages: [msg2] } → state.messages = [msg1, msg2]
```

**Common reducer patterns:**

```typescript
// Append to array
reducer: (x, y) => x.concat(y)

// Add numbers
reducer: (x, y) => x + y

// Merge objects
reducer: (x, y) => ({ ...x, ...y })

// Keep latest N items
reducer: (x, y) => [...x, ...y].slice(-10)

// Deduplicate
reducer: (x, y) => [...new Set([...x, ...y])]
```

</reducers>

<messages_annotation>

## MessagesAnnotation

Pre-built annotation for handling LangChain messages:

```typescript
import { MessagesAnnotation } from "@langchain/langgraph";

const State = Annotation.Root({
  ...MessagesAnnotation.spec,
  // Your additional fields...
});
```

**Features:**
- Proper message ID tracking
- Correct deserialization of message types
- Handles AIMessage, HumanMessage, ToolMessage, etc.
- Built-in reducer for message accumulation

**Always use this for chat agents** instead of manual message array handling.

</messages_annotation>

<zod_schemas>

## Using Zod for State

Alternative approach using Zod schemas:

```typescript
import * as z from "zod";
import { BaseMessage } from "@langchain/core/messages";
import { MessagesZodMeta } from "@langchain/langgraph";

const State = z.object({
  messages: z.array(z.custom<BaseMessage>())
    .register(registry, MessagesZodMeta),
  query: z.string(),
  results: z.array(z.string()),
});
```

**Zod reducers:**

```typescript
const State = z.object({
  items: z.array(z.string())
    .langgraph.reducer((x, y) => x.concat(y)),
});
```

</zod_schemas>

<state_design_principles>

## State Design Best Practices

### 1. Store Raw Data, Not Formatted Text

```typescript
// BAD: Formatted prompt in state
const State = Annotation.Root({
  prompt: Annotation<string>(),  // "You are a helpful assistant. Context: ..."
});

// GOOD: Raw data, format in node
const State = Annotation.Root({
  context: Annotation<string[]>(),
  userQuery: Annotation<string>(),
});

// In node:
const prompt = `You are a helpful assistant.
Context: ${state.context.join("\n")}
Query: ${state.userQuery}`;
```

### 2. Minimize State Size

Only store what's needed across nodes:

```typescript
// BAD: Storing derived data
const State = Annotation.Root({
  documents: Annotation<Document[]>(),
  documentCount: Annotation<number>(),  // Can be computed
  formattedDocs: Annotation<string>(),  // Can be computed
});

// GOOD: Store source data only
const State = Annotation.Root({
  documents: Annotation<Document[]>(),
});
// Compute documentCount and formattedDocs in nodes as needed
```

### 3. Use Reducers for Accumulating Data

```typescript
// BAD: Will overwrite previous results
results: Annotation<string[]>()

// GOOD: Accumulates results from multiple nodes
results: Annotation<string[]>({
  reducer: (x, y) => x.concat(y),
  default: () => [],
})
```

### 4. Include Defaults

```typescript
// BAD: No default, may be undefined
count: Annotation<number>()

// GOOD: Explicit default
count: Annotation<number>({
  default: () => 0,
})
```

</state_design_principles>

<accessing_state>

## Accessing State in Nodes

```typescript
async function myNode(state: AgentStateType) {
  // Read state
  const messages = state.messages;
  const lastMessage = messages.at(-1);

  // Do work
  const result = await process(lastMessage);

  // Return partial update (only changed fields)
  return {
    messages: [new AIMessage(result)],
    processedCount: 1,  // Will use reducer if defined
  };
}
```

**Rules:**
- Access state by property name
- Return object with only updated fields
- Never mutate state directly
- Return values will be processed through reducers

</accessing_state>

<input_output_schemas>

## Input/Output Schemas

Constrain what enters and exits the graph:

```typescript
const InputSchema = Annotation.Root({
  messages: Annotation<BaseMessage[]>(),
});

const OutputSchema = Annotation.Root({
  messages: Annotation<BaseMessage[]>(),
  finalAnswer: Annotation<string>(),
});

const InternalState = Annotation.Root({
  ...InputSchema.spec,
  ...OutputSchema.spec,
  // Private fields not exposed to caller
  intermediateResults: Annotation<string[]>(),
});

// Graph uses internal state but constrains I/O
const graph = new StateGraph({
  stateSchema: InternalState,
  input: InputSchema,
  output: OutputSchema,
});
```

</input_output_schemas>

<common_patterns>

## Common State Patterns

### Chat Agent State

```typescript
const ChatState = Annotation.Root({
  ...MessagesAnnotation.spec,
  systemPrompt: Annotation<string>({
    default: () => "You are a helpful assistant.",
  }),
});
```

### RAG Agent State

```typescript
const RAGState = Annotation.Root({
  ...MessagesAnnotation.spec,
  documents: Annotation<Document[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  query: Annotation<string>(),
});
```

### Multi-Step Task State

```typescript
const TaskState = Annotation.Root({
  ...MessagesAnnotation.spec,
  currentStep: Annotation<string>({
    default: () => "planning",
  }),
  plan: Annotation<string[]>({
    default: () => [],
  }),
  completedSteps: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});
```

</common_patterns>
