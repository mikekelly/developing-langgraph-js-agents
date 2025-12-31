<overview>

Persistence in LangGraph enables saving and restoring agent state across invocations. This powers conversation memory, human-in-the-loop workflows, fault tolerance, and debugging via time-travel.

</overview>

<checkpointers>

## Checkpointers

Checkpointers save graph state at each step:

```typescript
import { MemorySaver } from "@langchain/langgraph";

// In-memory (development only)
const checkpointer = new MemorySaver();

const graph = workflow.compile({
  checkpointer,
});
```

**Production checkpointers:**

```typescript
// PostgreSQL (recommended for production)
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(
  process.env.DATABASE_URL
);
await checkpointer.setup();  // Run migrations

// SQLite
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

const checkpointer = new SqliteSaver("./checkpoints.db");
await checkpointer.setup();
```

</checkpointers>

<threads>

## Thread Management

Threads identify unique conversation/execution contexts:

```typescript
// Each thread has independent state
await graph.invoke(
  { messages: [new HumanMessage("Hello")] },
  { configurable: { thread_id: "user-123-conversation-1" } }
);

// Different thread = different conversation
await graph.invoke(
  { messages: [new HumanMessage("Hello")] },
  { configurable: { thread_id: "user-456-conversation-1" } }
);

// Same thread = continues conversation
await graph.invoke(
  { messages: [new HumanMessage("What did I just say?")] },
  { configurable: { thread_id: "user-123-conversation-1" } }
);
```

**Thread ID strategies:**
- User ID + session ID: `"user-123-session-abc"`
- Conversation UUID: `crypto.randomUUID()`
- External reference: `"ticket-12345"`

</threads>

<state_snapshots>

## Accessing State

**Get current state:**

```typescript
const state = await graph.getState({
  configurable: { thread_id: "user-123" },
});

console.log(state.values);  // Current state values
console.log(state.next);    // Next nodes to execute
console.log(state.config);  // Thread configuration
```

**Get state history:**

```typescript
const history = await graph.getStateHistory({
  configurable: { thread_id: "user-123" },
});

for await (const snapshot of history) {
  console.log(snapshot.values);
  console.log(snapshot.metadata);  // Step info
}
```

</state_snapshots>

<updating_state>

## Modifying State

Update state externally (for human-in-the-loop):

```typescript
await graph.updateState(
  { configurable: { thread_id: "user-123" } },
  {
    messages: [new HumanMessage("Correction: use metric units")],
  }
);

// Resume execution with updated state
const result = await graph.invoke(null, {
  configurable: { thread_id: "user-123" },
});
```

**As a specific node:**

```typescript
// Update as if "editor" node made the change
await graph.updateState(
  { configurable: { thread_id: "user-123" } },
  { editedContent: "Fixed content" },
  "editor"  // Pretend this came from "editor" node
);
```

</updating_state>

<time_travel>

## Time Travel & Replay

Resume from any checkpoint:

```typescript
// Get a specific checkpoint
const history = await graph.getStateHistory({
  configurable: { thread_id: "user-123" },
});

let targetCheckpoint;
for await (const snapshot of history) {
  if (snapshot.metadata?.step === 3) {
    targetCheckpoint = snapshot.config;
    break;
  }
}

// Resume from that point (creates new fork)
const result = await graph.invoke(null, targetCheckpoint);
```

**Replay behavior:**
- Steps before checkpoint: replayed without re-execution
- Steps after checkpoint: execute fresh
- Creates new execution branch

</time_travel>

<memory_store>

## Long-Term Memory (MemoryStore)

For data persisting across threads:

```typescript
import { InMemoryStore } from "@langchain/langgraph";

const store = new InMemoryStore();

const graph = workflow.compile({
  checkpointer: new MemorySaver(),
  store,
});

// In a node, access via config
async function myNode(state: StateType, config: RunnableConfig) {
  const store = config.store;
  const userId = config.configurable?.user_id;

  // Read user memories
  const memories = await store.search([userId, "memories"]);

  // Write new memory
  await store.put([userId, "memories"], "memory-1", {
    content: "User prefers dark mode",
    timestamp: Date.now(),
  });

  return { /* state update */ };
}

// Invoke with user context
await graph.invoke(input, {
  configurable: {
    thread_id: "conv-123",
    user_id: "user-456",
  },
});
```

**Memory namespacing:**
- `[userId, "preferences"]` - User preferences
- `[userId, "memories"]` - Long-term memories
- `[userId, "facts"]` - Known facts about user

</memory_store>

<semantic_search>

## Semantic Memory Search

Enable similarity-based retrieval:

```typescript
import { InMemoryStore } from "@langchain/langgraph";

// Create store with embeddings
const store = new InMemoryStore({
  index: {
    embeddings: new OpenAIEmbeddings(),
    dims: 1536,
  },
});

// Store with embedding
await store.put([userId, "memories"], "mem-1", {
  content: "User mentioned they have a cat named Whiskers",
});

// Search by semantic similarity
const relevant = await store.search(
  [userId, "memories"],
  { query: "What pets does the user have?" }
);
```

</semantic_search>

<production_setup>

## Production Persistence Setup

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { PostgresStore } from "@langchain/langgraph-store-postgres";

// Checkpointer for thread state
const checkpointer = PostgresSaver.fromConnString(
  process.env.DATABASE_URL
);

// Store for cross-thread memory
const store = new PostgresStore({
  connectionString: process.env.DATABASE_URL,
});

// Run migrations on startup
await Promise.all([
  checkpointer.setup(),
  store.setup(),
]);

const graph = workflow.compile({
  checkpointer,
  store,
});
```

</production_setup>

<decision_tree>

## When to Use Persistence

**Use checkpointer when:**
- Multi-turn conversations
- Human-in-the-loop approval
- Long-running tasks that might fail
- Debugging/replaying executions

**Use memory store when:**
- User preferences across sessions
- Facts learned about users
- Shared context between agents
- Cross-conversation memory

**Skip persistence when:**
- Single-shot queries
- Stateless API endpoints
- Testing (use MemorySaver)

</decision_tree>
