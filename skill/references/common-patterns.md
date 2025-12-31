<overview>

Common architectural patterns for LangGraph.js agents. Use these as starting points and adapt to specific needs.

</overview>

<react_pattern>

## ReAct (Reasoning + Acting)

The standard tool-calling loop:

```typescript
const workflow = new StateGraph(State)
  .addNode("agent", callModel)      // Reason: decide action
  .addNode("tools", executeTool)    // Act: execute tool
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");       // Loop back
```

**Flow:** Agent reasons → calls tool (if needed) → observes result → reasons again → repeat until done.

</react_pattern>

<rag_pattern>

## RAG (Retrieval-Augmented Generation)

```typescript
const workflow = new StateGraph(RAGState)
  .addNode("retrieve", retrieveDocs)
  .addNode("grade", gradeDocuments)
  .addNode("generate", generateAnswer)
  .addNode("rewrite", rewriteQuery)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "grade")
  .addConditionalEdges("grade", checkRelevance, ["generate", "rewrite"])
  .addEdge("rewrite", "retrieve")   // Retry with better query
  .addEdge("generate", END);
```

**Flow:** Retrieve → Grade relevance → Generate (if relevant) or Rewrite query and retry.

</rag_pattern>

<router_pattern>

## Router Pattern

Route to specialized handlers:

```typescript
function routeByIntent(state: StateType) {
  const intent = classifyIntent(state.messages.at(-1));
  switch (intent) {
    case "search": return "searchAgent";
    case "calculate": return "calculator";
    case "chitchat": return "responder";
    default: return "fallback";
  }
}

const workflow = new StateGraph(State)
  .addNode("classifier", classifyNode)
  .addNode("searchAgent", searchNode)
  .addNode("calculator", calcNode)
  .addNode("responder", respondNode)
  .addEdge(START, "classifier")
  .addConditionalEdges("classifier", routeByIntent);
```

</router_pattern>

<multi_agent>

## Multi-Agent (Supervisor)

Central supervisor coordinates specialists:

```typescript
const workflow = new StateGraph(State)
  .addNode("supervisor", supervisorNode)
  .addNode("researcher", researchSubgraph)
  .addNode("coder", coderSubgraph)
  .addNode("writer", writerSubgraph)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", assignTask, [
    "researcher", "coder", "writer", END
  ])
  .addEdge("researcher", "supervisor")
  .addEdge("coder", "supervisor")
  .addEdge("writer", "supervisor");
```

**Flow:** Supervisor assigns tasks → Specialist executes → Returns to supervisor → Repeat or finish.

</multi_agent>

<plan_execute>

## Plan and Execute

Plan steps first, then execute:

```typescript
const workflow = new StateGraph(State)
  .addNode("planner", createPlan)
  .addNode("executor", executeStep)
  .addNode("replanner", revisePlan)
  .addEdge(START, "planner")
  .addEdge("planner", "executor")
  .addConditionalEdges("executor", checkProgress, [
    "executor",   // More steps
    "replanner",  // Need new plan
    END           // Done
  ])
  .addEdge("replanner", "executor");
```

</plan_execute>

<human_in_loop>

## Human-in-the-Loop

```typescript
const workflow = new StateGraph(State)
  .addNode("draft", createDraft)
  .addNode("review", humanReview)    // Uses interrupt()
  .addNode("finalize", finalize)
  .addEdge(START, "draft")
  .addEdge("draft", "review")
  .addConditionalEdges("review", checkApproval, [
    "draft",      // Rejected, redo
    "finalize"    // Approved
  ])
  .addEdge("finalize", END);
```

</human_in_loop>

<parallel_fan_out>

## Parallel Processing (Fan-out/Fan-in)

```typescript
const workflow = new StateGraph(State)
  .addNode("split", splitWork)
  .addNode("worker1", processA)
  .addNode("worker2", processB)
  .addNode("worker3", processC)
  .addNode("merge", combineResults)
  .addEdge(START, "split")
  .addEdge("split", "worker1")
  .addEdge("split", "worker2")  // Parallel
  .addEdge("split", "worker3")  // Parallel
  .addEdge("worker1", "merge")
  .addEdge("worker2", "merge")
  .addEdge("worker3", "merge")
  .addEdge("merge", END);
```

Use reducers to combine parallel results:
```typescript
results: Annotation<string[]>({
  reducer: (x, y) => x.concat(y),
})
```

</parallel_fan_out>
