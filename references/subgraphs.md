<overview>

Subgraphs enable composing complex agents from smaller, reusable graphs. Use for multi-agent systems, modular design, and team-based development.

</overview>

<approaches>

## Two Composition Approaches

**1. Invoke from node** (different state schemas):
```typescript
async function callSubagent(state: ParentState) {
  // Transform parent state to subgraph input
  const subInput = { query: state.userQuery };
  const result = await subgraph.invoke(subInput);
  // Transform result back
  return { subagentResult: result.answer };
}
```

**2. Add as node** (shared state channels):
```typescript
const parent = new StateGraph(State)
  .addNode("main", mainNode)
  .addNode("sub", compiledSubgraph)  // Direct addition
  .addEdge("main", "sub");
```

</approaches>

<state_mapping>

## State Transformation

When schemas differ, transform at boundaries:

```typescript
async function subagentWrapper(state: ParentState) {
  // Parent → Subgraph
  const subInput = {
    messages: state.messages.filter(m => m.type === "human"),
    context: state.relevantContext,
  };

  const result = await subgraph.invoke(subInput);

  // Subgraph → Parent
  return {
    messages: result.messages,
    subagentOutput: result.finalAnswer,
  };
}
```

</state_mapping>

<checkpointer_propagation>

## Persistence

Compile only the parent with checkpointer; children inherit:

```typescript
const parent = parentWorkflow.compile({
  checkpointer: new MemorySaver(),
});
// Subgraphs automatically get checkpointing
```

For isolated subgraph memory:
```typescript
const subgraph = subWorkflow.compile({
  checkpointer: true,  // Own isolated checkpointer
});
```

</checkpointer_propagation>

<when_to_use>

## When to Use Subgraphs

- Multi-agent systems with specialized agents
- Reusable components across graphs
- Team development with clear interfaces
- Complex workflows that benefit from decomposition

</when_to_use>
