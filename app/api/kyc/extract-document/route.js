import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getReasoningModel } from '@/lib/gemini';

// Force Node.js runtime for file processing libraries
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) console.log('=== OCR API Route Hit ===');
  
  try {
    // Dynamic imports to avoid module resolution issues
    const { createWorker } = await import('tesseract.js');
    const pdfParse = (await import('pdf-parse')).default;
    
    if (isDev) console.log('Modules loaded successfully');
    
    const session = await getServerSession(authOptions);
    
    if (!session) {
      if (isDev) console.log('No session found');
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to continue.' },
        { status: 401 }
      );
    }

    if (isDev) console.log('Session valid for user:', session.user?.email);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      if (isDev) console.log('No file in formData');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (isDev) console.log('File received:', file.name, 'Type:', file.type, 'Size:', file.size);

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Get file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let extractedText = '';

    // Handle PDF files
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        if (isDev) console.log('Processing PDF file:', file.name, 'size:', buffer.length);
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text;
        if (isDev) console.log('PDF extracted text length:', extractedText.length);
      } catch (error) {
        console.error('PDF parsing error:', error.message);
        return NextResponse.json(
          { error: `PDF parsing failed: ${error.message}. Please ensure the PDF is not password-protected or corrupted.` },
          { status: 400 }
        );
      }
    }
    // Handle image files (JPG, PNG, etc.)
    else if (file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name)) {
      try {
        if (isDev) console.log('Processing image file:', file.name, 'type:', file.type);
        const worker = await createWorker('eng', 1, {
          logger: isDev ? m => console.log('Tesseract:', m) : undefined
        });
        
        await worker.setParameters({
          tessedit_pageseg_mode: '1', // Automatic page segmentation
        });
        
        const { data: { text, confidence } } = await worker.recognize(buffer);
        await worker.terminate();
        
        extractedText = text;
        if (isDev) console.log('OCR extracted text length:', extractedText.length, 'confidence:', confidence);
      } catch (error) {
        console.error('OCR error:', error.message);
        return NextResponse.json(
          { error: `Image OCR failed: ${error.message}. Please ensure the image is clear and contains readable text.` },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Please upload a PDF or image file (JPG, PNG).` },
        { status: 400 }
      );
    }

    // More lenient text length check
    if (!extractedText || extractedText.trim().length < 20) {
      console.warn('Insufficient text extracted. Length:', extractedText?.trim().length || 0);
      return NextResponse.json(
        { error: `Could not extract sufficient text (only ${extractedText?.trim().length || 0} characters found). Please try a clearer document or manual entry.` },
        { status: 400 }
      );
    }

    // Use Gemini LLM to extract structured KYC fields from the text
    const model = getReasoningModel();
    
    const prompt = `You are a KYC data extraction assistant. Extract business information from the following document text and return it in JSON format.

Document Text:
${extractedText}

Extract and return ONLY a valid JSON object with these fields (use null for fields not found):
{
  "companyType": "one of: B2B (Business-to-Business), B2C (Business-to-Consumer), Mixed B2B / B2C",
  "companySize": "one of: 1 to 10 employees, 11 to 50 employees, 51 to 200 employees, 201 to 1000 employees, 1000+ employees",
  "primaryOutreachObjective": "one of: Lead generation, Account-based sales (ABM), Partnership development, Customer retention or upsell, Market research",
  "targetOrganizations": "one of: Small and Medium Businesses (SMBs), Mid-market companies, Enterprise organizations, All of the above",
  "relevantSignals": ["array of: Funding events, Hiring or expansion news, Product launches or technology shifts, LinkedIn activity, Market news or competitor movements"],
  "personalizationLevel": "one of: High – Customized messaging for each prospect, Medium – Industry or role-based messaging, Low – Template-driven messaging",
  "signalResponseTime": "one of: Immediately (within 24 hours), Within 1 to 3 days, Within 4 to 7 days, Flexible or strategically timed",
  "usefulContentTypes": ["array of: Personalized outreach messages, LinkedIn profile optimization, Authority-building LinkedIn posts, Social content calendars, Blog or article drafts"],
  "contentSuggestionFrequency": "one of: Daily, Weekly, Bi-weekly, Only when a high-intent opportunity is detected",
  "aiVoiceOutreachComfort": "one of: Very comfortable (full automation is acceptable), Somewhat comfortable (prefer human review), Only for simulation or testing",
  "aiExplanationDetail": "one of: Full reasoning (including signal analysis and logic trace), Summary with top influencing factors, Minimal, action-focused output",
  "primaryOffering": "one of: SaaS Software, Recruitment Solutions, Cybersecurity Tools, Marketing Services, Consulting, Manufacturing, Logistics, Finance / FinTech, EdTech, Healthcare",
  "idealCustomer": ["array of: Startups, Small and Medium Businesses (SMEs), Enterprise organizations, HR Teams, CTO or Technical Teams, Sales Teams, Operations Teams, Government Organizations"],
  "outreachGoal": "one of: Lead generation, Product demo, Partnership, Hiring solution pitch, Vendor onboarding, Investment discussion",
  "salesCycleLength": "one of: Immediate (1 to 7 days), Medium (1 to 3 weeks), Long (1 to 3 months)",
  "valueProposition": "one of: Cost reduction, Automation, Growth enablement, Efficiency, Security, Compliance",
  "successMetrics": ["array of: Response rate or engagement, Meetings scheduled, Qualified leads, Deal conversion, Influence or authority growth, Speed of outreach response"],
  "aiExperimentationOpenness": "one of: Very open (testing multiple AI approaches), Moderately open (minor adjustments allowed), Conservative (prefer default strategies)",
  "platformUsers": "one of: 1 to 5 users, 6 to 20 users, 21 to 50 users, More than 50 users",
  "companyName": "string or null",
  "registrationNumber": "string or null",
  "taxId": "string or null",
  "address": "string or null"
}

Return ONLY the JSON object, no explanations or additional text.`;

    if (isDev) console.log('Sending to Gemini, text length:', extractedText.length);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    if (isDev) console.log('Gemini response received');
    
    // Extract JSON from response
    let extractedData;
    try {
      // Try to find JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
        if (isDev) console.log('Extracted fields:', Object.keys(extractedData).length);
      } else {
        console.error('No JSON found in Gemini response');
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError.message);
      return NextResponse.json(
        { error: 'AI extraction failed. Please try manual entry or a different document.' },
        { status: 500 }
      );
    }

    // Clean up the extracted data - remove null values
    const cleanedData = {};
    for (const [key, value] of Object.entries(extractedData)) {
      if (value !== null && value !== undefined && value !== '' && 
          !(Array.isArray(value) && value.length === 0)) {
        cleanedData[key] = value;
      }
    }

    return NextResponse.json({
      success: true,
      extractedText: extractedText.substring(0, 500) + '...', // First 500 chars for reference
      extractedData: cleanedData,
      fieldsFound: Object.keys(cleanedData).length,
      message: `Successfully extracted ${Object.keys(cleanedData).length} fields from your document.`
    });

  } catch (error) {
    console.error('Document extraction error:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to process document. Please try again or use manual entry.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
