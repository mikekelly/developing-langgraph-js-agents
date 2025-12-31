<overview>

Interrupts pause graph execution to wait for external input, enabling human-in-the-loop workflows like approval gates, content review, and input validation.

</overview>

<requirements>

## Setup Requirements

1. Checkpointer (to persist paused state)
2. Thread ID (to identify which execution to resume)
3. `interrupt()` call in node

```typescript
import { MemorySaver, interrupt } from "@langchain/langgraph";

const graph = workflow.compile({
  checkpointer: new MemorySaver(),
});
```

</requirements>

<basic_interrupt>

## Basic Interrupt

```typescript
import { interrupt } from "@langchain/langgraph";

async function approvalNode(state: StateType) {
  const action = determineAction(state);

  // Pause and return value to caller
  const approved = interrupt({
    action,
    message: "Approve this action?",
  });

  if (!approved) {
    return { messages: [new AIMessage("Cancelled.")] };
  }

  return { result: await executeAction(action) };
}
```

</basic_interrupt>

<resuming>

## Resuming Execution

```typescript
import { Command } from "@langchain/langgraph";

// Resume with approval
await graph.invoke(
  new Command({ resume: true }),
  { configurable: { thread_id: "thread-123" } }
);

// Resume with rejection
await graph.invoke(
  new Command({ resume: false }),
  { configurable: { thread_id: "thread-123" } }
);

// Resume with custom data
await graph.invoke(
  new Command({ resume: { edited: "New content" } }),
  { configurable: { thread_id: "thread-123" } }
);
```

</resuming>

<rules>

## Critical Rules

- Don't wrap `interrupt()` in try/catch (uses exceptions internally)
- Keep interrupt call order consistent across executions
- Only pass JSON-serializable values
- Make side effects before `interrupt()` idempotent (node re-executes on resume)

</rules>

<patterns>

## Common Patterns

**Approval gate:**
```typescript
const approved = interrupt({ action, requiresApproval: true });
if (!approved) return { cancelled: true };
```

**Content review:**
```typescript
const edited = interrupt({ draft: generatedContent });
return { content: edited ?? generatedContent };
```

**Input validation loop:**
```typescript
while (true) {
  const input = interrupt({ prompt: "Enter valid email:" });
  if (isValidEmail(input)) return { email: input };
}
```

</patterns>
