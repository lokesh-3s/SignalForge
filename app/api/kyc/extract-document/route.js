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
  "businessType": "one of: LLC, Sole Proprietorship, Partnership, Corporation, Other",
  "industry": "one of: Retail, SaaS, E-commerce, Manufacturing, Services, Other",
  "employeeCount": "one of: 1-10, 11-50, 51-200, 201-500, 500+",
  "revenueTier": "one of: <100K, 100K-500K, 500K-1M, 1M-5M, 5M+",
  "businessModel": "one of: Subscription, One-time Purchase, Hybrid, Freemium",
  "averageOrderValue": "one of: <$50, $50-$200, $200-$500, $500-$1000, $1000+",
  "audienceDemographic": ["array of: Gen Z, Millennials, Gen X, Baby Boomers, B2B"],
  "purchaseFrequency": "one of: Daily, Weekly, Monthly, Quarterly, Annually",
  "acquisitionChannels": ["array of: Social Media, SEO, Paid Ads, Email, Referrals, Events, Direct"],
  "activePlatforms": ["array of: Instagram, Facebook, LinkedIn, Twitter/X, TikTok, YouTube, Pinterest"],
  "skuCount": "one of: 1-10, 11-50, 51-200, 201-500, 500+",
  "peakSeasonality": ["array of: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec), Holiday Season, No Peak"],
  "primaryObjective": "one of: Increase Sales, Brand Awareness, Customer Retention, Market Expansion, Lead Generation",
  "painPoints": ["array of: Low Conversion, High CAC, Poor Retention, Limited Budget, Lack of Analytics, Time Constraints"],
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
