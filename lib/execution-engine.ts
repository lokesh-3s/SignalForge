import { WorkflowNode, WorkflowEdge, NodeExecutionContext } from '@/types/workflow';

/**
 * Builds the execution context for a node by analyzing incoming edges
 * and compiling context from source nodes
 */
export function buildExecutionContext(
  targetNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  campaignBrief: string,
  campaignStrategy: string,
  kyc?: Record<string, any>
): NodeExecutionContext {
  // Find the target node
  const targetNode = nodes.find(n => n.id === targetNodeId);
  if (!targetNode) {
    throw new Error(`Node with ID ${targetNodeId} not found`);
  }

  // Find all incoming edges to this node
  const incomingEdges = edges.filter(edge => edge.target === targetNodeId);

  // Build context from each incoming edge
  const incomingContext = incomingEdges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    
    if (!sourceNode) {
      console.warn(`Source node ${edge.source} not found for edge ${edge.id}`);
      return null;
    }

    // Only include context if the source node has completed
    if (sourceNode.data.status !== 'complete' || !sourceNode.data.output) {
      return null;
    }

    return {
      sourceNodeId: sourceNode.id,
      sourceOutput: sourceNode.data.output,
      transferLogic: edge.data?.transferLogic || 'Use the output from the previous step',
      edgeLabel: edge.data?.label || edge.label || 'Context',
    };
  }).filter(Boolean) as NodeExecutionContext['incomingEdges'];

  return {
    nodeId: targetNode.id,
    nodeType: targetNode.data.type,
    promptContext: targetNode.data.promptContext,
    incomingEdges: incomingContext,
    campaignContext: {
      brief: campaignBrief,
      strategy: campaignStrategy,
      kyc,
    },
  };
}

/**
 * Compiles the final prompt by combining the node's base prompt
 * with context from incoming edges
 */
export function compilePrompt(context: NodeExecutionContext): string {
  const { nodeType, promptContext, incomingEdges, campaignContext } = context;

  // Start with campaign context
  let prompt = `CAMPAIGN CONTEXT:\n`;
  prompt += `Brief: ${campaignContext.brief}\n\n`;
  prompt += `Strategy Overview: ${campaignContext.strategy}\n\n`;

  // Include KYC business profile if available
  if (campaignContext.kyc) {
    try {
      const entries: string[] = [];
      Object.entries(campaignContext.kyc).forEach(([key, value]) => {
        if (value === null || typeof value === 'undefined') return;
        const prettyKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        if (Array.isArray(value)) {
          if (value.length) entries.push(`${prettyKey}: ${value.join(', ')}`);
        } else {
          entries.push(`${prettyKey}: ${String(value)}`);
        }
      });
      if (entries.length) {
        prompt += `BUSINESS PROFILE (KYC):\n`;
        entries.forEach(line => { prompt += `- ${line}\n`; });
        prompt += `\nUse the KYC business attributes above to tailor outputs (tone, channels, personas, timing, and constraints).\n\n`;
      }
    } catch {}
  }

  // Add context from incoming edges
  if (incomingEdges.length > 0) {
    prompt += `CONTEXT FROM PREVIOUS STEPS:\n`;
    
    incomingEdges.forEach((edge, index) => {
      prompt += `\n--- ${edge.edgeLabel} ---\n`;
      prompt += `Transfer Logic: ${edge.transferLogic}\n`;
      prompt += `Source Output:\n${edge.sourceOutput}\n`;
    });
    
    prompt += `\n`;
  }

  // Add the specific task for this node
  prompt += `YOUR TASK:\n`;
  prompt += `${promptContext}\n\n`;

  // Add type-specific instructions
  switch (nodeType) {
    case 'copy':
      prompt += `You are an Ad Copy generator. Create platform-ready ads.
KEEP IT CONCISE. Return:
- 2 headlines (30-40 chars each)
- 2 primary texts (80-120 chars)
- 2 CTAs
Output as a clean list. NO long explanations.\n`;
      break;
    
    case 'image':
      prompt += `Generate 4 high quality marketing visuals aligned to the strategy. For each visual, produce a vivid composition: subject, setting, camera, lighting, color palette, and style. If this model supports direct image output, return images. Otherwise, return detailed prompts.\n`;
      break;
    
    case 'research':
      prompt += `Conduct research and provide CONCISE, actionable insights.
LIMIT: 5-7 bullet points maximum. Be specific but brief. NO long paragraphs.\n`;
      break;
    
    case 'strategy':
      prompt += `Provide strategic analysis and recommendations.
LIMIT: 3-5 key points maximum. Use clear headings and brief bullet points. NO lengthy explanations.\n`;
      break;
    
    case 'timeline':
      prompt += `Create a concise timeline.
LIMIT: 5-7 key milestones maximum. Be specific with dates and actions. Keep descriptions under 15 words each.\n`;
      break;
    
    case 'distribution':
      prompt += `Provide a distribution strategy.
LIMIT: 4-6 channels maximum. For each: channel name, timing (1 line), key tactics (2-3 bullet points). Keep it actionable and brief.\n`;
      break;
    
    case 'linkedin':
      prompt += `You are a LinkedIn content creator. Generate ONE professional LinkedIn post.\n
REQUIREMENTS:
- Maximum 2800 characters (strict limit - LinkedIn allows 3000 but leave buffer)
- Professional, engaging tone
- Include relevant hashtags (3-5)
- Use line breaks for readability
- Focus on value and insights
- NO multiple post variations - just ONE post ready to publish

Output ONLY the post text, nothing else.\n`;
      break;
    
    case 'twitter':
      prompt += `You are a Twitter/X content creator. Generate ONE tweet.\n
REQUIREMENTS:
- Maximum 270 characters (strict limit - Twitter allows 280 but leave buffer)
- Engaging, concise, punchy
- Include 1-2 relevant hashtags
- Can use emojis sparingly
- NO multiple tweet variations - just ONE tweet ready to publish

Output ONLY the tweet text, nothing else.\n`;
      break;
    
    case 'email':
      prompt += `You are an expert email marketing copywriter. Your task is to write a CUSTOMER-FACING promotional email based on the campaign context above.

⚠️ CRITICAL INSTRUCTION ⚠️
The campaign brief and strategy above are YOUR INSTRUCTIONS - they describe what to write about.
DO NOT copy the brief text into the email. DO NOT quote the brief.
INSTEAD: Transform those instructions into persuasive marketing copy that speaks directly to customers.

Think of it this way:
- Campaign Brief = Your assignment (what to create)
- Email Content = What you deliver to customers (the actual marketing message)

EXAMPLE:
❌ WRONG: "Create an integrated marketing campaign for our shoe company..."
✅ RIGHT: "Discover the perfect blend of comfort and style with our premium shoe collection..."

⚠️ PERSONALIZATION PLACEHOLDERS ⚠️
- Use ONLY {{name}} for recipient name personalization
- DO NOT use {{FirstName}}, {{CompanyName}}, {{LastName}}, or any other placeholders
- DO NOT use bracketed placeholders like [Your Company Name], [Product Name], [Link Here]
- All other content must be COMPLETE and STATIC - no placeholders anywhere
- If you mention a company name, use a generic one like "our team" or just omit it
- CTA links can use '#' as href - they will be updated by the system

REQUIRED JSON OUTPUT (use ONLY this exact structure):
{
  "subject": "Compelling subject line here",
  "html": "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'><h1 style='color: #333333; font-size: 24px; margin-bottom: 20px;'>Hello {{name}},</h1><p style='color: #666666; font-size: 16px; line-height: 1.6; margin-bottom: 15px;'>First paragraph - hook the reader...</p><p style='color: #666666; font-size: 16px; line-height: 1.6; margin-bottom: 15px;'>Second paragraph - present solution and benefits...</p><div style='margin: 30px 0; text-align: center;'><a href='#' style='background-color: #0066cc; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;'>Shop Now</a></div><p style='color: #666666; font-size: 14px; margin-top: 30px;'>Best regards,<br>The Team</p></div>",
  "text": "Hello {{name}},\\n\\nFirst paragraph...\\n\\nSecond paragraph...\\n\\nShop Now: [link]\\n\\nBest regards,\\nThe Team"
}

EMAIL WRITING RULES:
1. Subject Line (40-60 chars): Focus on the BENEFIT or OFFER, not the campaign description
   ✅ "Step into Comfort: Premium Shoes Just for You"
   ❌ "Our Shoe Marketing Campaign Information"

2. Opening Hook (1 paragraph): Start with a relatable problem or desire
   - Address the customer's pain point or aspiration
   - Make it personal and relevant to their needs
   - Example: "Tired of choosing between style and comfort? We've solved that dilemma."

3. Solution & Benefits (1-2 paragraphs):
   - Present your product/service as the answer
   - Highlight 2-3 key benefits (comfort, style, durability, etc.)
   - Use concrete details, not abstract descriptions
   - Focus on what THEY get, not what YOU offer
   - All details must be COMPLETE - no bracketed placeholders

4. Call-to-Action:
   - Clear, action-oriented button text
   - Examples: "Shop Now", "Discover More", "Get Your Pair", "Claim Offer", "Explore Collection"
   - NOT generic: "Learn More", "Click Here"
   - Use actual action words related to the product/service

5. Closing Signature:
   - Use "Best regards," or "Warm regards," or "Sincerely,"
   - Follow with "The Team" or "Your Team" or specific team name if mentioned in context
   - DO NOT use placeholders like [Your Company Name] or [Team Name]

6. Tone & Voice:
   - Write as if speaking directly to ONE customer
   - Use "you" and "your" language
   - Match the brand voice from the strategy (professional, energetic, friendly, etc.)
   - Be conversational yet polished

7. HTML Format Requirements:
   - Use single quotes (') for all HTML attributes
   - No escaped characters
   - Include {{name}} placeholder ONLY for recipient name personalization
   - Mobile-responsive (max-width: 600px)

8. Plain Text Version:
   - Mirror HTML content without tags
   - Use \\n for line breaks (double backslash in JSON)
   - Keep it readable and well-structured
   - Replace button with "Action: [link]" format

NOW: Create the customer-facing email with NO PLACEHOLDERS except {{name}}. Every sentence must be complete and ready to send.\n`;
      break;
  }

  return prompt;
}

/**
 * Validates that all dependencies for a node are complete
 */
export function canExecuteNode(
  nodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): { canExecute: boolean; reason?: string } {
  const node = nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return { canExecute: false, reason: 'Node not found' };
  }

  if (node.data.status === 'loading') {
    return { canExecute: false, reason: 'Node is already executing' };
  }

  if (node.data.status === 'complete') {
    return { canExecute: true }; // Allow re-execution
  }

  // Find all incoming edges
  const incomingEdges = edges.filter(edge => edge.target === nodeId);

  // Check if all source nodes are complete
  for (const edge of incomingEdges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    
    if (!sourceNode) {
      continue; // Skip if source node not found
    }

    if (sourceNode.data.status !== 'complete') {
      return { 
        canExecute: false, 
        reason: `Waiting for "${sourceNode.data.label}" to complete` 
      };
    }
  }

  return { canExecute: true };
}

/**
 * Gets the execution order for all nodes (topological sort)
 */
export function getExecutionOrder(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      throw new Error('Circular dependency detected in workflow');
    }

    visiting.add(nodeId);

    // Visit all dependencies first
    const incomingEdges = edges.filter(edge => edge.target === nodeId);
    for (const edge of incomingEdges) {
      visit(edge.source);
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  }

  // Visit all nodes
  for (const node of nodes) {
    visit(node.id);
  }

  return order;
}
