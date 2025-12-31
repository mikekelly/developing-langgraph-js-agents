<overview>

Deployment covers running LangGraph agents locally for development, deploying to LangSmith Cloud for production, and operational concerns like observability and debugging.

</overview>

<local_server>

## Running Locally

### Install CLI

```bash
npx @langchain/langgraph-cli
```

### Create New App

```bash
npm create langgraph
cd my-app
npm install
```

### Configure Environment

Create `.env`:
```bash
LANGSMITH_API_KEY=lsv2_...
```

Get free API key from https://smith.langchain.com/settings

### Start Development Server

```bash
npx @langchain/langgraph-cli dev
```

Runs at `http://127.0.0.1:2024` with:
- In-memory persistence (dev/test only)
- Hot-reloading on code changes
- LangGraph Studio UI for debugging

### Test Locally

**Via SDK:**
```typescript
import { Client } from "@langchain/langgraph-sdk";

const client = new Client({ apiUrl: "http://localhost:2024" });
const thread = await client.threads.create();

for await (const event of client.runs.stream(
  thread.thread_id,
  "agent",
  { input: { messages: [{ role: "user", content: "Hello" }] } }
)) {
  console.log(event);
}
```

**Via REST:**
```bash
curl --request POST \
  --url "http://localhost:2024/runs/stream" \
  --header 'Content-Type: application/json' \
  --data '{"assistant_id": "agent", "input": {"messages": [...]}}'
```

</local_server>

<cloud_deployment>

## Deploying to LangSmith Cloud

### Prerequisites

- GitHub account
- LangSmith account (free tier available)
- Agent code in GitHub repository

### Deployment Steps

1. **Push to GitHub** - Public or private repo
2. **Connect in LangSmith** - Deployments → "+ New Deployment"
3. **Select Repository** - Connect GitHub if first time
4. **Wait ~15 minutes** - Initial deployment
5. **Get API URL** - From Deployment details

### Access Deployed Agent

```typescript
import { Client } from "@langchain/langgraph-sdk";

const client = new Client({
  apiUrl: "https://your-deployment-url.langsmith.dev",
  apiKey: process.env.LANGSMITH_API_KEY,
});
```

### Alternative Deployment Options

- **Self-hosted**: Control plane for hybrid deployments
- **Standalone server**: Your own infrastructure

</cloud_deployment>

<studio>

## LangGraph Studio

Visual interface for developing and testing agents locally.

### Features

- **Step visualization**: See prompts, tool calls, results, outputs
- **Interactive testing**: Test inputs without code changes
- **Exception capture**: Debugging with surrounding state
- **Hot-reload**: Code changes reflect immediately
- **Thread replay**: Re-run from any step

### Access

When running `npx @langchain/langgraph-cli dev`, Studio URL appears in output.

### Debugging Workflow

1. Run agent with test input
2. Observe execution steps
3. Identify issues in trace
4. Modify code (hot-reloads)
5. Re-run from any step

</studio>

<observability>

## Observability with LangSmith

### Enable Tracing

```bash
# .env
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=my-agent  # Optional: custom project
```

### Selective Tracing

```typescript
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";

const tracer = new LangChainTracer({ projectName: "my-project" });

await graph.invoke(input, {
  callbacks: [tracer],
});
```

### Metadata Enrichment

```typescript
await graph.invoke(input, {
  metadata: {
    userId: "user-123",
    sessionId: "session-456",
    environment: "production",
  },
  tags: ["production", "v2"],
});
```

### What You Get

- Execution traces with timing
- Token usage metrics
- Error capture with context
- Performance monitoring
- Custom filtering by metadata

### Sensitive Data Protection

LangSmith can anonymize patterns (SSNs, etc.) before data reaches servers.

</observability>

<time_travel>

## Time-Travel Debugging

Replay and fork executions from any checkpoint.

### Use Cases

- **Understanding reasoning**: Why did it succeed?
- **Debugging mistakes**: Where did it go wrong?
- **Exploring alternatives**: What if we changed X?

### Implementation

```typescript
// Step 1: Run the graph
const result = await graph.invoke(input, {
  configurable: { thread_id: "debug-session" },
});

// Step 2: Get state history
const history = await graph.getStateHistory({
  configurable: { thread_id: "debug-session" },
});

for await (const snapshot of history) {
  console.log(snapshot.config);  // Contains checkpoint_id
  console.log(snapshot.values);  // State at that point
}

// Step 3: Modify state at checkpoint (optional)
await graph.updateState(
  { configurable: { thread_id: "debug-session", checkpoint_id: "..." } },
  { topic: "different value" }
);

// Step 4: Resume from checkpoint
const forked = await graph.invoke(null, {
  configurable: {
    thread_id: "debug-session",
    checkpoint_id: targetCheckpointId,
  },
});
```

### Forking Behavior

- Creates new execution branch
- Original history unchanged
- Useful for A/B testing prompts

</time_travel>

<durable_execution>

## Durable Execution

Workflows save progress at checkpoints, allowing pause/resume even after failures.

### Why It Matters

- Human-in-the-loop can take hours/days
- System failures shouldn't lose progress
- Long-running tasks need fault tolerance

### Durability Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `"exit"` | Save only at end | Best performance, no mid-run recovery |
| `"async"` | Save async during next step | Balanced, minimal risk |
| `"sync"` | Save before continuing | Maximum durability |

### Requirements

1. **Checkpointer**: Persists state
2. **Thread ID**: Identifies execution
3. **Idempotent operations**: Safe to retry

### Resumption Behavior

- Resumes from start of interrupted node (not exact line)
- Replays from that point forward
- Completed tasks not re-executed (stored in persistence)

### Best Practices

```typescript
// Wrap non-deterministic operations in nodes
async function apiCallNode(state: StateType) {
  // If this fails mid-execution, whole node retries
  const result = await externalApi.call(state.input);
  return { result };
}

// Make operations idempotent
async function updateDatabaseNode(state: StateType) {
  // Use upsert, not insert - safe to retry
  await db.upsert({ id: state.id, data: state.data });
  return { updated: true };
}
```

</durable_execution>
