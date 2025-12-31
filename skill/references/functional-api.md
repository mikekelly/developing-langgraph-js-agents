<overview>

The Functional API offers an alternative to StateGraph using `task` and `entrypoint` primitives. It uses standard control flow (if/for/while) instead of explicit graph structure.

</overview>

<core_primitives>

## Tasks and Entrypoints

```typescript
import { task, entrypoint } from "@langchain/langgraph";

// Task: checkpointed unit of work
const callLlm = task("callLlm", async (messages: BaseMessage[]) => {
  return model.invoke(messages);
});

// Entrypoint: workflow entry with state management
const agent = entrypoint("agent", async (input: BaseMessage[]) => {
  let messages = input;

  while (true) {
    const response = await callLlm(messages);
    if (!response.tool_calls?.length) break;

    const toolResults = await Promise.all(
      response.tool_calls.map(tc => callTool(tc))
    );
    messages = [...messages, response, ...toolResults];
  }

  return messages;
});
```

</core_primitives>

<comparison>

## Graph API vs Functional API

| Aspect | Graph | Functional |
|--------|-------|------------|
| Control flow | Explicit nodes/edges | Standard code (if/for) |
| State | Declared schema + reducers | Scoped to function |
| Visualization | Supported | Not supported |
| Checkpointing | After each node | After each task |

</comparison>

<when_to_use>

## When to Use Functional API

- Primarily sequential workflows
- Minimal state management needs
- Rapid iteration on logic
- Simple tool-calling loops

## When to Use Graph API

- Complex branching/parallel execution
- Need visualization for debugging
- Multiple developers need to understand flow
- Explicit checkpoint control

</when_to_use>

<constraints>

## Constraints

- Entrypoint inputs/outputs must be JSON-serializable
- Task outputs require JSON serialization
- Wrap all randomness in tasks for deterministic replay
- Side effects should be in tasks to prevent duplicates on resume

</constraints>
