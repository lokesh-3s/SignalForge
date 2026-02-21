import { NextResponse } from 'next/server';
import { getReasoningModel, generateWithRetry, parseJSONFromResponse } from '@/lib/gemini';

export async function POST(request: Request) {
  let descriptionValue = '';
  try {
    const { description } = await request.json();
    descriptionValue = typeof description === 'string' ? description : '';

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    const model = getReasoningModel();

    const systemPrompt = `You are an expert campaign strategist and copywriter. Your task is to transform a user's rough campaign description into a well-structured, detailed campaign brief.

The user has provided this description:
"${descriptionValue}"

Transform this into a comprehensive campaign brief that includes:
- Clear product/service description
- Specific target audience (demographics, psychographics)
- Campaign occasion or timing (if mentioned or implied)
- Key focus areas and unique selling points
- Recommended marketing channels
- Desired outcomes or goals

Make it compelling, specific, and actionable. Keep the original intent but enhance with marketing best practices.

IMPORTANT CONSTRAINTS:
- Maximum length: 500-600 characters
- Be concise but comprehensive
- Focus on the most critical campaign elements

IMPORTANT: Respond with ONLY a valid JSON object containing a single field "enhancedBrief" with the improved campaign brief text. Do not include markdown, code blocks, or any other text.

Example format:
{"enhancedBrief": "Launch a multi-channel social media campaign..."}`;

    const responseText = await generateWithRetry(model, systemPrompt);
    let parsedResponse: any = null;
    let usedFallback = false;
    try {
      parsedResponse = parseJSONFromResponse(responseText);
    } catch (e) {
      // Fallback: build a concise enhanced brief manually
      usedFallback = true;
      const base = description.trim();
      // Simple enrichment heuristics
      const enhanced = `Campaign: ${base.slice(0, 140)}. Target audience: clarify demographics. Focus: highlight unique value. Channels: social + email + paid retargeting. Goal: boost engagement & conversions.`;
      parsedResponse = { enhancedBrief: enhanced };
    }

    // Validate / normalize enhancedBrief
    let enhancedBrief: string = String(parsedResponse.enhancedBrief || '').trim();
    if (!enhancedBrief) {
      throw new Error('AI did not return enhancedBrief');
    }
    // Enforce max length ~600 chars
    if (enhancedBrief.length > 600) {
      enhancedBrief = enhancedBrief.slice(0, 597).replace(/\s+$/,'') + '…';
    }
    return NextResponse.json({
      enhancedBrief,
      fallback: usedFallback
    });

  } catch (error) {
    console.error('Error enhancing brief:', error);
    // Final safety fallback (route still returns 200 with deterministic brief)
    const fbSource = descriptionValue || '';
    const fallbackBrief = `Campaign: ${fbSource.slice(0,120)}. Channels: social + email. Goal: conversion uplift.`;
    return NextResponse.json({ enhancedBrief: fallbackBrief, fallback: true, error: error instanceof Error ? error.message : 'Enhancement error' });
  }
}
