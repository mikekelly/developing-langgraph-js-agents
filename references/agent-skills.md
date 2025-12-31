<overview>

Agent skills are specialized capabilities packaged as invokable components. They're prompt-driven specializations that an agent can load on-demand, enabling modular capability design without full sub-agent complexity.

</overview>

<when_to_use>

## When to Use Skills Pattern

- Single agent needing multiple specializations
- Flexible capability loading based on context
- Independent development across teams
- Lighter weight than full sub-agents

**Common use cases:**
- Coding assistants (language-specific skills)
- Knowledge bases (domain-focused skills)
- Creative tools (format-specific skills)

</when_to_use>

<implementation>

## Basic Implementation

Create a `load_skill` tool that retrieves specialized prompts:

```typescript
import { tool } from "@langchain/core/tools";
import * as z from "zod";

// Skill registry
const skills: Record<string, { prompt: string; tools?: any[] }> = {
  typescript: {
    prompt: `You are a TypeScript expert. Follow these practices:
- Use strict mode
- Prefer interfaces over types for objects
- Use const assertions where appropriate`,
    tools: [typescriptLinter, typeChecker],
  },
  python: {
    prompt: `You are a Python expert. Follow these practices:
- Use type hints
- Follow PEP 8
- Prefer list comprehensions`,
    tools: [pythonLinter],
  },
  sql: {
    prompt: `You are a SQL expert. Follow these practices:
- Use parameterized queries
- Optimize for readability
- Add comments for complex joins`,
  },
};

const loadSkill = tool(
  async ({ skillName }) => {
    const skill = skills[skillName];
    if (!skill) {
      return `Unknown skill: ${skillName}. Available: ${Object.keys(skills).join(", ")}`;
    }
    return JSON.stringify({
      instructions: skill.prompt,
      availableTools: skill.tools?.map(t => t.name) ?? [],
    });
  },
  {
    name: "load_skill",
    description: "Load a specialized skill for the current task. Use when you need domain expertise.",
    schema: z.object({
      skillName: z.string().describe("Name of the skill to load"),
    }),
  }
);
```

</implementation>

<integrating_with_agent>

## Integrating with LangGraph Agent

```typescript
const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  activeSkill: Annotation<string | null>({
    default: () => null,
  }),
  skillContext: Annotation<string>({
    default: () => "",
  }),
});

async function agentNode(state: AgentStateType) {
  const systemPrompt = state.skillContext
    ? `${basePrompt}\n\nActive skill instructions:\n${state.skillContext}`
    : basePrompt;

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
  ]);

  return { messages: [response] };
}

async function processSkillLoad(state: AgentStateType) {
  const lastMessage = state.messages.at(-1);
  // Extract skill context from tool response
  // Update state with skill instructions
  return {
    skillContext: extractedInstructions,
    activeSkill: skillName,
  };
}
```

</integrating_with_agent>

<dynamic_tools>

## Dynamic Tool Registration

Skills can register additional tools when loaded:

```typescript
const skills = {
  database: {
    prompt: "You are a database expert...",
    tools: [queryTool, schemaTool, migrationTool],
  },
};

async function loadSkillNode(state: AgentStateType) {
  const skill = skills[state.requestedSkill];

  // Rebind model with skill-specific tools
  const skillModel = baseModel.bindTools([
    ...baseTools,
    ...(skill.tools ?? []),
  ]);

  return {
    skillContext: skill.prompt,
    // Store reference to update model in agent node
  };
}
```

</dynamic_tools>

<hierarchical_skills>

## Hierarchical Skills

Organize skills in tree structures:

```typescript
const skills = {
  coding: {
    prompt: "General coding assistant",
    subskills: {
      frontend: {
        prompt: "Frontend specialist",
        subskills: {
          react: { prompt: "React expert..." },
          vue: { prompt: "Vue expert..." },
        },
      },
      backend: {
        prompt: "Backend specialist",
        subskills: {
          nodejs: { prompt: "Node.js expert..." },
          python: { prompt: "Python backend expert..." },
        },
      },
    },
  },
};

// Navigate: "coding.frontend.react"
function getSkill(path: string) {
  return path.split(".").reduce((s, key) => s?.subskills?.[key] ?? s?.[key], skills);
}
```

</hierarchical_skills>

<vs_subagents>

## Skills vs Sub-Agents

| Aspect | Skills | Sub-Agents |
|--------|--------|------------|
| Complexity | Prompt + optional tools | Full graph with state |
| Overhead | Low | Higher |
| Independence | Share parent state | Own state management |
| Use case | Specializations | Complex autonomous tasks |

**Use skills when:** You need to augment a single agent with domain expertise.

**Use sub-agents when:** You need fully autonomous agents with their own decision loops.

</vs_subagents>
