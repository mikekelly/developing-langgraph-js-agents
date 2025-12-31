<overview>

The Graph API is LangGraph's primary way to define agent workflows. It models agents as directed graphs where **nodes** are functions that do work and **edges** determine execution flow. State flows through the graph, updated by each node.

</overview>

<core_components>

## StateGraph

The main class for building graphs:

```typescript
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

const State = Annotation.Root({
  messages: Annotation<BaseMessage[]>(),
});

const graph = new StateGraph(State)
  .addNode("name", nodeFunction)
  .addEdge(START, "name")
  .addEdge("name", END)
  .compile();
```

## Nodes

Functions that receive state and return partial state updates:

```typescript
// Async function node
async function myNode(state: typeof State.State) {
  const result = await doWork(state.input);
  return { output: result };  // Partial state update
}

// With config access
async function nodeWithConfig(
  state: typeof State.State,
  config?: RunnableConfig
) {
  const threadId = config?.configurable?.thread_id;
  return { result: await process(state, threadId) };
}
```

**Node rules:**
- Must return partial state (object with updated fields)
- Never mutate input state directly
- Can be sync or async
- Receive optional config as second parameter

## Edges

Connect nodes and determine execution flow:

```typescript
// Normal edge: always goes to target
.addEdge("nodeA", "nodeB")

// Conditional edge: routing function decides
.addConditionalEdges(
  "nodeA",
  routingFunction,
  ["nodeB", "nodeC", END]  // Possible targets
)

// Entry point
.addEdge(START, "firstNode")
```

## Special Nodes

- `START` - Entry point, must have outgoing edge
- `END` - Terminal node, graph completes when reached

</core_components>

<conditional_edges>

## Routing Functions

Determine which node executes next based on state:

```typescript
function route(state: typeof State.State): string {
  if (state.needsTools) return "tools";
  if (state.needsReview) return "review";
  return END;
}

// Register with graph
.addConditionalEdges("agent", route, ["tools", "review", END])
```

**Routing function rules:**
- Must return a valid node name or END
- Should handle all possible cases (exhaustive)
- Return type should match declared targets

## Common Routing Patterns

```typescript
// Tool calling decision
function shouldCallTools(state: StateType) {
  const lastMessage = state.messages.at(-1);
  if (AIMessage.isInstance(lastMessage) && lastMessage.tool_calls?.length) {
    return "tools";
  }
  return END;
}

// Multi-way routing
function routeByType(state: StateType): "research" | "action" | "respond" {
  switch (state.taskType) {
    case "research": return "research";
    case "action": return "action";
    default: return "respond";
  }
}
```

</conditional_edges>

<compilation>

## Compiling the Graph

**Required before use:**

```typescript
// Basic compilation
const graph = workflow.compile();

// With checkpointer for persistence
import { MemorySaver } from "@langchain/langgraph";
const graph = workflow.compile({
  checkpointer: new MemorySaver(),
});

// With interrupt points
const graph = workflow.compile({
  checkpointer: new MemorySaver(),
  interruptBefore: ["humanApproval"],
  interruptAfter: ["planning"],
});
```

Compilation:
- Validates graph structure
- Ensures all nodes are connected
- Enables runtime features (checkpointing, streaming)

</compilation>

<invocation>

## Running the Graph

```typescript
// Basic invocation
const result = await graph.invoke({
  messages: [new HumanMessage("Hello")],
});

// With thread for persistence
const result = await graph.invoke(
  { messages: [new HumanMessage("Hello")] },
  { configurable: { thread_id: "user-123" } }
);

// Streaming
for await (const chunk of await graph.stream(input, {
  streamMode: "updates",
})) {
  console.log(chunk);
}
```

</invocation>

<parallel_execution>

## Running Nodes in Parallel

Nodes with multiple outgoing edges run in parallel:

```typescript
const workflow = new StateGraph(State)
  .addNode("start", startNode)
  .addNode("branchA", branchANode)
  .addNode("branchB", branchBNode)
  .addNode("join", joinNode)
  // start → branchA and start → branchB run in parallel
  .addEdge(START, "start")
  .addEdge("start", "branchA")
  .addEdge("start", "branchB")
  .addEdge("branchA", "join")
  .addEdge("branchB", "join")
  .addEdge("join", END);
```

**State reducers** control how parallel updates merge:

```typescript
const State = Annotation.Root({
  results: Annotation<string[]>({
    reducer: (existing, new_) => existing.concat(new_),
    default: () => [],
  }),
});
```

</parallel_execution>

<visualization>

## Visualizing the Graph

```typescript
// Get mermaid diagram
const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid();
console.log(mermaid);

// Generate PNG image
const png = await drawable.drawMermaidPng();
```

</visualization>

<decision_tree>

## When to Use Graph API vs Functional API

**Use Graph API when:**
- You need visual debugging/understanding of flow
- Workflow has clear discrete steps
- Multiple developers need to understand the agent
- Complex branching and parallel execution
- You want explicit checkpoints at each node

**Use Functional API when:**
- Workflow is primarily sequential
- State management is minimal
- Faster iteration on logic
- Simple tool-calling loops

</decision_tree>
