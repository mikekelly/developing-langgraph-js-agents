<overview>

Multi-agent systems break complex applications into specialized agents coordinated by a supervisor or network. Use when a single agent has too many tools, context grows too complex, or you need multiple specialization areas.

</overview>

<when_to_use>

## When to Use Multi-Agent

**Single agent problems:**
- Too many tools → poor tool selection
- Context too complex to track
- Need for specialization (researcher, coder, analyst)

**Multi-agent benefits:**
- Focused agents with fewer tools each
- Isolated state management
- Independent development per agent
- Clearer debugging (which agent failed?)

</when_to_use>

<architectures>

## Architecture Patterns

### 1. Supervisor (Most Common)

One supervisor routes tasks to worker agents:

```
[Supervisor] ─→ [Researcher] ─→ [Supervisor]
            ─→ [Coder]      ─→ [Supervisor]
            ─→ [Writer]     ─→ [Supervisor]
            ─→ [END]
```

Supervisor decides which agent acts next based on conversation state.

### 2. Hierarchical

Supervisors managing supervisors:

```
[Top Supervisor]
    ├── [Research Supervisor]
    │       ├── [Web Searcher]
    │       └── [Doc Reader]
    └── [Coding Supervisor]
            ├── [Frontend Dev]
            └── [Backend Dev]
```

### 3. Network (Peer-to-Peer)

Agents hand off directly to each other:

```
[Planner] ─→ [Researcher] ─→ [Writer] ─→ [Reviewer] ─→ [END]
```

Use explicit edges for deterministic flow, conditional edges for dynamic routing.

</architectures>

<supervisor_implementation>

## Supervisor Pattern Implementation

### State Definition

```typescript
import { Annotation, MessagesAnnotation, END } from "@langchain/langgraph";

const SupervisorState = Annotation.Root({
  ...MessagesAnnotation.spec,
  // Track which agent should act next
  next: Annotation<string>({
    reducer: (x, y) => y ?? x ?? END,
    default: () => END,
  }),
});
```

### Create Specialized Agents

Using `createReactAgent` from prebuilt:

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({ model: "claude-sonnet-4-5-20250929" });

// Researcher agent with search tool
const researcherAgent = createReactAgent({
  llm: model,
  tools: [tavilySearch],
  stateModifier: "You are a web researcher. Search for information as needed.",
});

// Coder agent with code execution
const coderAgent = createReactAgent({
  llm: model,
  tools: [codeExecutor],
  stateModifier: "You are a coding expert. Write and execute code.",
});
```

### Supervisor Node

```typescript
import { tool } from "@langchain/core/tools";
import * as z from "zod";

const members = ["researcher", "coder"] as const;

// Routing tool for supervisor
const routeTool = tool(
  ({ next }) => next,
  {
    name: "route",
    description: "Select the next agent to act, or FINISH if done.",
    schema: z.object({
      next: z.enum([...members, "FINISH"]),
    }),
  }
);

const supervisorModel = model.bindTools([routeTool], {
  tool_choice: "route",  // Force tool call
});

async function supervisorNode(state: typeof SupervisorState.State) {
  const systemPrompt = `You are a supervisor managing these agents: ${members.join(", ")}.
Given the conversation, decide which agent should act next.
Select FINISH when the task is complete.`;

  const response = await supervisorModel.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
  ]);

  const toolCall = response.tool_calls?.[0];
  const next = toolCall?.args?.next === "FINISH" ? END : toolCall?.args?.next;

  return { next };
}
```

### Agent Wrapper Nodes

Wrap agents to format output for the shared state:

```typescript
async function researcherNode(state: typeof SupervisorState.State) {
  const result = await researcherAgent.invoke(state);
  const lastMessage = result.messages.at(-1);

  return {
    messages: [
      new HumanMessage({
        content: lastMessage?.content ?? "",
        name: "researcher",
      }),
    ],
  };
}

async function coderNode(state: typeof SupervisorState.State) {
  const result = await coderAgent.invoke(state);
  const lastMessage = result.messages.at(-1);

  return {
    messages: [
      new HumanMessage({
        content: lastMessage?.content ?? "",
        name: "coder",
      }),
    ],
  };
}
```

### Build the Graph

```typescript
const workflow = new StateGraph(SupervisorState)
  .addNode("supervisor", supervisorNode)
  .addNode("researcher", researcherNode)
  .addNode("coder", coderNode)
  // Start with supervisor
  .addEdge(START, "supervisor")
  // Workers return to supervisor
  .addEdge("researcher", "supervisor")
  .addEdge("coder", "supervisor")
  // Supervisor routes to workers or END
  .addConditionalEdges("supervisor", (state) => state.next, [
    "researcher",
    "coder",
    END,
  ]);

export const multiAgent = workflow.compile();
```

</supervisor_implementation>

<prebuilt_supervisor>

## Using @langchain/langgraph-supervisor

Simplified supervisor creation:

```bash
npm install @langchain/langgraph-supervisor
```

```typescript
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const researchAgent = createReactAgent({
  llm: model,
  tools: [searchTool],
  name: "researcher",
  prompt: "You are a research expert.",
});

const mathAgent = createReactAgent({
  llm: model,
  tools: [calculatorTool],
  name: "mathematician",
  prompt: "You are a math expert.",
});

const supervisor = createSupervisor({
  agents: [researchAgent, mathAgent],
  llm: model,
  prompt: `You manage a research expert and math expert.
For current events, use researcher.
For calculations, use mathematician.`,
});

const result = await supervisor.invoke({
  messages: [new HumanMessage("What is 15% of the US population?")],
});
```

</prebuilt_supervisor>

<communication_patterns>

## Agent Communication

### Via Shared State

Agents communicate through the message history:

```typescript
// Agent adds message with its name
return {
  messages: [
    new HumanMessage({
      content: result,
      name: "researcher",  // Identifies source
    }),
  ],
};
```

Supervisor and other agents see all messages and can reference previous agent outputs.

### Via Explicit Handoff

For network patterns, pass context directly:

```typescript
async function plannerNode(state: StateType) {
  const plan = await createPlan(state);
  return {
    plan,
    next: "researcher",  // Explicit handoff
  };
}

async function researcherNode(state: StateType) {
  // Access plan from previous agent
  const research = await doResearch(state.plan);
  return {
    research,
    next: "writer",
  };
}
```

</communication_patterns>

<state_strategies>

## State Management Strategies

### Shared State (Simple)

All agents share one state:

```typescript
const SharedState = Annotation.Root({
  ...MessagesAnnotation.spec,
  next: Annotation<string>(),
  // All agents can read/write
  research: Annotation<string>(),
  code: Annotation<string>(),
  draft: Annotation<string>(),
});
```

### Isolated State (Complex)

Agents have internal state, transform at boundaries:

```typescript
// Researcher has its own state
const ResearcherState = Annotation.Root({
  ...MessagesAnnotation.spec,
  sources: Annotation<string[]>(),
  confidence: Annotation<number>(),
});

// Transform when invoking
async function researcherNode(state: SupervisorState) {
  const result = await researcherAgent.invoke({
    messages: state.messages.filter(m => /* relevant messages */),
  });

  // Extract what supervisor needs
  return {
    messages: [new HumanMessage({ content: result.summary, name: "researcher" })],
    researchComplete: true,
  };
}
```

</state_strategies>

<best_practices>

## Best Practices

1. **Clear agent responsibilities** - Each agent should have a focused purpose
2. **Limit tools per agent** - 3-5 tools max for reliable selection
3. **Name messages** - Always include `name` field for agent attribution
4. **Add iteration limits** - Prevent infinite supervisor loops
5. **Use explicit routing when possible** - More predictable than LLM routing
6. **Test agents individually** - Verify each agent works before composing

</best_practices>

<decision_tree>

## Choosing an Architecture

**Use Supervisor when:**
- Dynamic task routing needed
- Tasks can be done in any order
- Need central coordination

**Use Hierarchical when:**
- Large number of agents
- Natural groupings exist
- Teams have different concerns

**Use Network when:**
- Fixed, predictable flow
- Pipeline-style processing
- Deterministic execution needed

</decision_tree>
