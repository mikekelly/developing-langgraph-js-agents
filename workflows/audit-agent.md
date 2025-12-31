# Workflow: Audit a LangGraph.js Agent

<required_reading>

**Read these reference files NOW:**
1. references/graph-api.md
2. references/state-management.md
3. references/anti-patterns.md
4. references/common-patterns.md

</required_reading>

<process>

## Step 1: Locate Agent Code

Find all LangGraph-related files:
- Look for imports from `@langchain/langgraph`
- Find `StateGraph`, `Annotation`, `entrypoint`, `task` usage
- Identify state definitions, node functions, and graph construction

## Step 2: Audit State Design

**Check state definition:**

```typescript
// Good: Uses Annotation API with proper reducers
const State = Annotation.Root({
  ...MessagesAnnotation.spec,
  results: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

// Bad: No reducers for accumulating fields
const State = Annotation.Root({
  messages: Annotation<BaseMessage[]>(), // Missing reducer!
  results: Annotation<string[]>(),       // Will overwrite, not accumulate
});
```

**State audit checklist:**
- [ ] Uses `MessagesAnnotation.spec` for message handling
- [ ] Accumulating fields have reducers
- [ ] Fields have sensible defaults
- [ ] No redundant/derived data stored
- [ ] State is minimal (only cross-node data)

## Step 3: Audit Node Functions

**Check each node:**

```typescript
// Good: Pure function, returns partial state
async function myNode(state: StateType) {
  const result = await doSomething(state.input);
  return { output: result };
}

// Bad: Mutates state directly
async function badNode(state: StateType) {
  state.output = await doSomething(state.input); // Don't do this!
  return state;
}

// Bad: Returns full state instead of partial
async function alsoBAd(state: StateType) {
  return { ...state, output: result }; // Wasteful, may cause issues
}
```

**Node audit checklist:**
- [ ] Nodes are async functions
- [ ] Nodes receive state and optional config
- [ ] Nodes return partial state updates (not full state)
- [ ] Nodes don't mutate input state
- [ ] Error handling is appropriate
- [ ] No side effects without proper handling

## Step 4: Audit Edge Logic

**Check routing functions:**

```typescript
// Good: Clear, exhaustive routing
function route(state: StateType): "nodeA" | "nodeB" | typeof END {
  if (state.needsA) return "nodeA";
  if (state.needsB) return "nodeB";
  return END;
}

// Bad: Non-exhaustive, may hang
function badRoute(state: StateType) {
  if (state.condition) return "next";
  // What happens when condition is false? Undefined behavior!
}
```

**Edge audit checklist:**
- [ ] All conditional edges have exhaustive cases
- [ ] Edge functions return valid node names or END
- [ ] No infinite loops possible (or loops have exit conditions)
- [ ] Entry point is correctly defined (START edge)

## Step 5: Audit Graph Construction

**Check graph building:**

```typescript
// Good: Clear flow, compiled
const graph = new StateGraph(State)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent")
  .compile();

// Bad: Missing compile, unclear flow
const graph = new StateGraph(State)
  .addNode("a", nodeA)
  .addNode("b", nodeB)
  .addEdge(START, "a");
// Not compiled! Won't work
```

**Graph audit checklist:**
- [ ] Graph is compiled before use
- [ ] All nodes are connected (no orphans)
- [ ] START edge exists
- [ ] END is reachable from all paths
- [ ] Conditional edges specify all possible targets

## Step 6: Audit Tool Definitions

**Check tools:**

```typescript
// Good: Clear schema, good description
const searchTool = tool(
  async ({ query, limit }) => { /* ... */ },
  {
    name: "search_database",
    description: "Search the database for records. Use when user asks about data.",
    schema: z.object({
      query: z.string().describe("Search query terms"),
      limit: z.number().optional().describe("Max results (default 10)"),
    }),
  }
);

// Bad: Vague description, no parameter descriptions
const badTool = tool(
  async ({ q }) => { /* ... */ },
  {
    name: "search",
    description: "Searches stuff",
    schema: z.object({ q: z.string() }),
  }
);
```

**Tool audit checklist:**
- [ ] Tool names are descriptive and snake_case
- [ ] Descriptions explain when to use the tool
- [ ] Schema parameters have descriptions
- [ ] Tools handle errors gracefully
- [ ] Tools are properly bound to model

## Step 7: Audit Persistence (If Used)

**Check checkpointer usage:**

```typescript
// Good: Proper checkpointer with thread management
import { MemorySaver } from "@langchain/langgraph";

const graph = workflow.compile({
  checkpointer: new MemorySaver(),
});

await graph.invoke(input, {
  configurable: { thread_id: "unique-thread-id" },
});

// Bad: Checkpointer without thread_id
await graph.invoke(input); // No persistence!
```

**Persistence audit checklist:**
- [ ] Checkpointer is passed to compile() if persistence needed
- [ ] thread_id is provided in config
- [ ] Thread IDs are unique per conversation
- [ ] Production uses database-backed checkpointer (not MemorySaver)

## Step 8: Generate Audit Report

Create a report with:

1. **Summary**: Overall health of the agent
2. **Critical Issues**: Must fix (will cause failures)
3. **Warnings**: Should fix (may cause issues)
4. **Suggestions**: Could improve (best practices)
5. **Architecture Diagram**: Graph flow visualization

</process>

<audit_report_template>

## Agent Audit Report

**Agent**: [name/path]
**Date**: [date]
**Auditor**: Claude

### Summary
[1-2 sentence overall assessment]

### Critical Issues
- [ ] [Issue description + fix]

### Warnings
- [ ] [Issue description + fix]

### Suggestions
- [ ] [Improvement + rationale]

### Architecture
```
[START] → [node1] → [conditional] → [node2] → [END]
                  ↘ [node3] ↗
```

### Files Reviewed
- `path/to/file.ts` - [what it contains]

</audit_report_template>

<success_criteria>

A complete audit:
- [ ] All LangGraph files identified and reviewed
- [ ] State design evaluated against best practices
- [ ] All nodes checked for purity and correctness
- [ ] Edge logic verified for completeness
- [ ] Graph construction validated
- [ ] Tools audited for quality
- [ ] Persistence patterns reviewed (if applicable)
- [ ] Report generated with actionable findings

</success_criteria>
