<overview>

Streaming provides real-time updates during graph execution, improving perceived performance by showing partial results before completion.

</overview>

<stream_modes>

## Available Modes

| Mode | Output | Use When |
|------|--------|----------|
| `"values"` | Full state after each step | Debugging, full state visibility |
| `"updates"` | State delta after each step | Tracking incremental changes |
| `"messages"` | LLM tokens as `[chunk, metadata]` | Chat UIs, real-time typing |
| `"custom"` | User-defined data from nodes | Progress indicators |
| `"debug"` | Maximum execution detail | Debugging |

</stream_modes>

<basic_streaming>

## Basic Usage

```typescript
// Stream state updates
for await (const chunk of await graph.stream(input, {
  streamMode: "updates",
})) {
  console.log("Update:", chunk);
}

// Stream LLM tokens
for await (const [message, metadata] of await graph.stream(input, {
  streamMode: "messages",
})) {
  if (metadata.langgraph_node === "agent") {
    process.stdout.write(message.content);
  }
}
```

</basic_streaming>

<custom_streaming>

## Custom Progress Signals

Emit from nodes using `config.writer`:

```typescript
async function myNode(state: StateType, config: RunnableConfig) {
  config.writer?.({ progress: "Starting..." });

  const result = await longOperation((pct) => {
    config.writer?.({ progress: `${pct}% complete` });
  });

  config.writer?.({ progress: "Done" });
  return { result };
}

// Receive custom events
for await (const chunk of await graph.stream(input, {
  streamMode: "custom",
})) {
  console.log(chunk.progress);
}
```

</custom_streaming>

<multi_mode>

## Multiple Modes

```typescript
for await (const [mode, data] of await graph.stream(input, {
  streamMode: ["updates", "messages"],
})) {
  if (mode === "messages") {
    process.stdout.write(data[0].content);
  } else {
    console.log("State update:", data);
  }
}
```

</multi_mode>
