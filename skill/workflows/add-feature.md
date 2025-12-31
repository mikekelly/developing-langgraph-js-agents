# Workflow: Add a Feature to a LangGraph.js Agent

<required_reading>

**Read these reference files NOW:**
1. references/graph-api.md
2. references/state-management.md
3. references/common-patterns.md

**Read feature-specific references:**
- Adding tools → references/tools.md
- Adding persistence → references/persistence.md
- Adding streaming → references/streaming.md
- Adding human-in-the-loop → references/interrupts.md
- Adding subagents → references/subgraphs.md

</required_reading>

<process>

## Step 1: Understand the Existing Agent

1. Read all agent files (state, nodes, tools, graph)
2. Map the current graph flow
3. Identify where the feature should integrate

## Step 2: Identify Feature Type

| Feature | What to modify |
|---------|----------------|
| New tool | tools.ts, bind to model |
| New node | nodes.ts, graph construction |
| State field | state.ts (with reducer if needed) |
| Persistence | compile() options |
| Streaming | invoke() options |
| Human approval | Add interrupt(), checkpointer |
| Subagent | New graph, add as node |
| New routing | Add conditional edges |

## Step 3: Implement by Feature Type

### Adding a New Tool

```typescript
// 1. Define tool in tools.ts
export const newTool = tool(
  async ({ param }) => {
    return `Result: ${param}`;
  },
  {
    name: "new_tool",
    description: "What this tool does and when to use it",
    schema: z.object({
      param: z.string().describe("Parameter description"),
    }),
  }
);

// 2. Add to tools array
export const tools = [existingTool, newTool];

// 3. Update toolsByName
export const toolsByName = Object.fromEntries(tools.map(t => [t.name, t]));

// 4. Re-bind tools to model (if in separate file)
const model = baseModel.bindTools(tools);
```

### Adding a New Node

```typescript
// 1. Create node function in nodes.ts
export async function newNode(state: AgentStateType) {
  // Node logic
  return { fieldToUpdate: newValue };
}

// 2. Add to graph in agent.ts
const workflow = new StateGraph(AgentState)
  .addNode("existing", existingNode)
  .addNode("newNode", newNode)  // Add node
  .addEdge(START, "existing")
  .addEdge("existing", "newNode")  // Connect it
  .addEdge("newNode", END);
```

### Adding a State Field

```typescript
// In state.ts
export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  // New field with reducer for accumulation
  history: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  // Or simple field (overwrites on update)
  currentStep: Annotation<string>({
    default: () => "start",
  }),
});
```

### Adding Persistence

```typescript
// In agent.ts
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

export const agent = workflow.compile({
  checkpointer,
});

// Usage requires thread_id
await agent.invoke(input, {
  configurable: { thread_id: "conversation-123" },
});
```

### Adding Streaming

```typescript
// Stream mode options: "values", "updates", "messages", "custom", "debug"
for await (const chunk of await agent.stream(input, {
  streamMode: "messages",
})) {
  const [message, metadata] = chunk;
  if (metadata.langgraph_node === "agent") {
    process.stdout.write(message.content);
  }
}
```

### Adding Human-in-the-Loop

```typescript
import { interrupt } from "@langchain/langgraph";

// In a node that needs approval
async function nodeWithApproval(state: AgentStateType) {
  const action = determineAction(state);

  // Pause and ask for approval
  const approved = interrupt({
    action,
    message: "Approve this action?",
  });

  if (!approved) {
    return { messages: [new AIMessage("Action cancelled.")] };
  }

  // Proceed with action
  return { result: await executeAction(action) };
}

// Resume with Command
import { Command } from "@langchain/langgraph";

await agent.invoke(
  new Command({ resume: true }),  // or { resume: false }
  { configurable: { thread_id: "thread-123" } }
);
```

### Adding a Subagent

```typescript
// 1. Create subagent graph
const subagentWorkflow = new StateGraph(SubagentState)
  .addNode("process", processNode)
  .addEdge(START, "process")
  .addEdge("process", END);

const subagent = subagentWorkflow.compile();

// 2. Create wrapper node
async function callSubagent(state: AgentStateType) {
  // Transform state for subagent
  const subInput = { data: state.dataForSubagent };

  const result = await subagent.invoke(subInput);

  // Transform result back
  return { subagentResult: result.output };
}

// 3. Add to main graph
const mainWorkflow = new StateGraph(AgentState)
  .addNode("main", mainNode)
  .addNode("subagent", callSubagent)
  .addEdge(START, "main")
  .addConditionalEdges("main", routeToSubagent)
  .addEdge("subagent", "main");
```

### Adding Conditional Routing

```typescript
function routeBasedOnState(state: AgentStateType) {
  if (state.needsResearch) return "research";
  if (state.needsAction) return "action";
  if (state.messages.at(-1)?.tool_calls?.length) return "tools";
  return END;
}

const workflow = new StateGraph(AgentState)
  .addNode("agent", agentNode)
  .addNode("research", researchNode)
  .addNode("action", actionNode)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", routeBasedOnState, [
    "research", "action", "tools", END
  ])
  .addEdge("research", "agent")
  .addEdge("action", "agent")
  .addEdge("tools", "agent");
```

## Step 4: Verify Integration

```bash
# TypeScript check
npx tsc --noEmit

# Run tests
npm test

# Test the feature manually
npx ts-node src/index.ts
```

</process>

<anti_patterns>

Avoid:
- **Adding state fields without reducers** when they should accumulate
- **Breaking existing edges** without updating routing
- **Forgetting to rebind tools** after adding new ones
- **Adding nodes without connecting** them to the graph
- **Adding persistence without thread_id** in invocations

</anti_patterns>

<success_criteria>

Feature successfully added when:
- [ ] TypeScript compiles without errors
- [ ] Existing functionality still works
- [ ] New feature integrates cleanly with graph flow
- [ ] State updates correctly (check reducers)
- [ ] Tests pass (existing + new)
- [ ] Feature works as expected in manual testing

</success_criteria>
