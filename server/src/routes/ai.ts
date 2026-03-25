import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Validation schemas
const askAISchema = z.object({
  question: z.string().min(1),
  taskContext: z.object({
    title: z.string(),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    dueDate: z.string().optional(),
  }),
});

const writeDescriptionSchema = z.object({
  taskTitle: z.string().min(1),
  additionalContext: z.string().optional(),
});

const suggestPrioritySchema = z.object({
  taskTitle: z.string().min(1),
  taskDescription: z.string().optional(),
  dueDate: z.string().optional(),
});

// Helper function to call OpenAI API
async function callOpenAI(messages: { role: string; content: string }[], maxTokens: number = 500) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// Ask AI endpoint - Answer questions about the task
router.post('/ask', async (req, res) => {
  try {
    const { question, taskContext } = askAISchema.parse(req.body);

    const systemPrompt = `You are a helpful AI assistant for a task management application similar to ClickUp.
You help users understand their tasks, suggest improvements, and answer questions about task management.
Be concise, practical, and actionable in your responses.`;

    const userPrompt = `Task Information:
- Title: ${taskContext.title}
- Description: ${taskContext.description || 'No description'}
- Status: ${taskContext.status || 'Not set'}
- Priority: ${taskContext.priority || 'Not set'}
- Due Date: ${taskContext.dueDate || 'Not set'}

User Question: ${question}

Please provide a helpful and concise answer.`;

    const answer = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    res.json({ answer });
  } catch (error) {
    console.error('Ask AI error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
    } else if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to process AI request' });
    }
  }
});

// Write with AI endpoint - Generate task description
router.post('/write-description', async (req, res) => {
  try {
    const { taskTitle, additionalContext } = writeDescriptionSchema.parse(req.body);

    const systemPrompt = `You are a helpful AI assistant for a task management application.
Your job is to write clear, detailed, and actionable task descriptions.
Format the description with clear sections if needed. Use markdown formatting.
Keep descriptions practical and focused on what needs to be done.`;

    const userPrompt = `Generate a detailed task description for the following task:

Task Title: ${taskTitle}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Write a comprehensive but concise description that includes:
1. What needs to be done
2. Key objectives or goals
3. Any important considerations
4. Suggested steps or approach (if applicable)

Format using markdown.`;

    const description = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 800);

    res.json({ description });
  } catch (error) {
    console.error('Write description error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
    } else if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to generate description' });
    }
  }
});

// Suggest Priority endpoint - AI suggests task priority
router.post('/suggest-priority', async (req, res) => {
  try {
    const { taskTitle, taskDescription, dueDate } = suggestPrioritySchema.parse(req.body);

    const systemPrompt = `You are a task prioritization AI assistant.
Analyze tasks and suggest appropriate priority levels.
Available priorities: URGENT, HIGH, NORMAL, LOW
Respond with ONLY the priority level (one word), nothing else.`;

    const today = new Date().toISOString().split('T')[0];
    const userPrompt = `Analyze this task and suggest a priority level:

Task Title: ${taskTitle}
Description: ${taskDescription || 'No description provided'}
Due Date: ${dueDate || 'No due date'}
Today's Date: ${today}

Consider:
- Urgency based on due date proximity
- Importance based on task content
- Keywords suggesting urgency (urgent, ASAP, critical, important, deadline, etc.)

Respond with ONLY one of: URGENT, HIGH, NORMAL, LOW`;

    const suggestedPriority = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 10);

    // Validate the response is a valid priority
    const validPriorities = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];
    const priority = suggestedPriority.trim().toUpperCase();

    if (!validPriorities.includes(priority)) {
      res.json({ priority: 'NORMAL', reasoning: 'Could not determine priority' });
    } else {
      res.json({ priority });
    }
  } catch (error) {
    console.error('Suggest priority error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
    } else if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to suggest priority' });
    }
  }
});

export default router;
