'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  Loader2,
  Coffee,
  Smartphone,
  Shirt,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCampaignStore } from '@/lib/store';
import { toast } from 'react-hot-toast';

const quickExamples = [
  {
    icon: Coffee,
    title: 'SaaS Expansion Outreach',
    brief: 'Target Series A SaaS companies that recently raised funding for our AI automation platform. Focus on CTOs and VP Engineering via LinkedIn and email. Emphasize ROI, efficiency gains, and technical integration capabilities.',
  },
  {
    icon: Smartphone,
    title: 'Enterprise Sales Campaign',
    brief: 'Create a multi-touch outreach sequence for Fortune 500 companies adopting digital transformation. Target IT Directors and CDOs across LinkedIn, email, and phone. Focus on our enterprise solutions and case studies.',
  },
  {
    icon: Shirt,
    title: 'Startup Founder Outreach',
    brief: 'Reach early-stage startup founders in fintech and healthtech who are scaling their teams. Multi-channel approach via LinkedIn, email, and WhatsApp. Highlight our growth-stage solutions and founder success stories.',
  },
];

// Component that uses useSearchParams - must be wrapped in Suspense
function CampaignPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [brief, setBrief] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [autoEnhanced, setAutoEnhanced] = useState(false);
  const { 
    setBrief: setStoreBrief, 
    setStrategy, 
    setWorkflow, 
    setGeneratingStrategy,
    setGeneratingWorkflow,
    setError 
  } = useCampaignStore();

  // Auto-fill and enhance brief from URL params (from segmentation)
  useEffect(() => {
    const rawParam = searchParams.get('brief');
    if (rawParam && !autoEnhanced) {
      // URLSearchParams.get already returns a decoded string; avoid double decoding
      const segmentBrief = rawParam;
      setBrief(segmentBrief);
      setCharCount(segmentBrief.length);
      setAutoEnhanced(true);
      // Auto-trigger enhancement after small delay
      setTimeout(() => {
        handleEnhanceBrief(segmentBrief);
      }, 400);
    }
  }, [searchParams, autoEnhanced]);

  const handleBriefChange = (e) => {
    const text = e.target.value;
    setBrief(text);
    setCharCount(text.length);
  };

  const handleQuickExample = (exampleBrief) => {
    setBrief(exampleBrief);
    setCharCount(exampleBrief.length);
  };

  const handleEnhanceBrief = async (textToEnhance = null) => {
    const text = String(textToEnhance || brief || '');
    if (text.trim().length < 10) {
      toast.error('Please provide at least a basic description (minimum 10 characters)');
      return;
    }

    setIsEnhancing(true);

    try {
      const response = await fetch('/api/campaign/enhance-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text }),
      });

      if (!response.ok) {
        throw new Error('Failed to enhance brief');
      }

      const data = await response.json();
      setBrief(data.enhancedBrief);
      setCharCount(data.enhancedBrief.length);
      if (data.fallback) {
        toast('⚠️ Used fallback enhancement (AI parse issue).', { icon: '⚠️' });
      } else {
        toast.success('✨ Brief enhanced! You can edit it before generating the campaign.');
      }
    } catch (error) {
      console.error('Error enhancing brief:', error);
      toast.error('Failed to enhance brief. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerateWorkflow = async () => {
    if (brief.trim().length < 50) {
      toast.error('Please provide a more detailed campaign brief (at least 50 characters)');
      return;
    }

    setStoreBrief(brief);
    setGeneratingStrategy(true);

    try {
      // Step 1: Generate Strategy
      const strategyResponse = await fetch('/api/campaign/generate-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      });

      if (!strategyResponse.ok) {
        throw new Error('Failed to generate strategy');
      }

      const strategyData = await strategyResponse.json();
      setStrategy(strategyData);
      setGeneratingStrategy(false);

      // Step 2: Generate Workflow
      setGeneratingWorkflow(true);

      const workflowResponse = await fetch('/api/campaign/generate-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rationale: strategyData.rationale,
          brief 
        }),
      });

      if (!workflowResponse.ok) {
        throw new Error('Failed to generate workflow');
      }

      const workflowData = await workflowResponse.json();
      setWorkflow(workflowData.nodes, workflowData.edges);
      setGeneratingWorkflow(false);

      // Navigate to canvas
      router.push('/campaign/canvas');

    } catch (error) {
      console.error('Error generating campaign:', error);
      setError(error.message);
      setGeneratingStrategy(false);
      setGeneratingWorkflow(false);
      toast.error('Failed to generate campaign. Please try again.');
    }
  };

  const { isGeneratingStrategy, isGeneratingWorkflow } = useCampaignStore();
  const isLoading = isGeneratingStrategy || isGeneratingWorkflow;

  // Import workflow JSON (drag/drop or file input)
  const handleImportFile = (file) => {
    if (!file) return;
    if (!file.type.includes('json')) { toast.error('Please select a JSON file'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result));
        const briefValue = parsed.brief || '';
        const strategyObj = parsed.strategy || {};
        const workflowData = parsed.workflow || parsed; // allow direct {nodes,edges}
        const rawNodes = workflowData.nodes || [];
        const rawEdges = workflowData.edges || [];
        if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) { toast.error('Invalid workflow structure'); return; }
        if (briefValue) setStoreBrief(briefValue);
        if (strategyObj.rationale || parsed.strategyRationale) {
          setStrategy({ rationale: strategyObj.rationale || parsed.strategyRationale });
        }
        setWorkflow(rawNodes, rawEdges);
        toast.success('Workflow imported');
        router.push('/campaign/canvas');
      } catch (err) {
        toast.error('Failed to parse workflow JSON');
      }
    };
    reader.readAsText(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    handleImportFile(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-transparent"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border bg-transparent"
      >
        <div className="max-w-7xl mx-auto px-14 py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI-Powered Outreach Campaign Generator</h1>
              <p className="text-sm text-muted-foreground">Describe your outreach goals, watch AI build intelligent multi-channel campaigns</p>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Input Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">Describe Your Outreach Campaign</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Share your B2B outreach objectives, and watch AI autonomously create a comprehensive strategy 
                with signal intelligence, prospect research, personalized content, and multi-channel execution.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Campaign Brief
                </label>
                <span className="text-xs text-muted-foreground">
                  {charCount} characters
                </span>
              </div>
              
              <Textarea
                value={brief}
                onChange={handleBriefChange}
                placeholder="E.g., Launch a LinkedIn outreach campaign targeting SaaS CTOs in Series A companies who recently raised funding. Focus on our AI automation platform, emphasize ROI and efficiency gains. Include personalized connection requests, follow-up sequences, and content sharing strategy..."
                className="min-h-[280px] text-sm bg-card border-border text-foreground resize-none"
                disabled={isLoading || isEnhancing}
              />
              
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground flex-1">
                  Include: target audience, industry, company stage, outreach channels, key messaging, and objectives
                </p>
                <Button
                  onClick={handleEnhanceBrief}
                  disabled={isLoading || isEnhancing || brief.trim().length < 10}
                  variant="outline"
                  size="sm"
                  className="border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50 text-amber-600 dark:text-amber-400"
                >
                  {isEnhancing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Enhancing...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
                      Get Idea
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Button
              onClick={handleGenerateWorkflow}
              disabled={isLoading || brief.trim().length < 50 || isEnhancing}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg hover:shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 h-12 text-base font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {isGeneratingStrategy && 'Formulating Strategy...'}
                  {isGeneratingWorkflow && 'Building Workflow...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Workflow
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11"
                onClick={() => document.getElementById('workflowImportInput')?.click()}
                disabled={isLoading}
              >
                Import Workflow
              </Button>
              <input
                id="workflowImportInput"
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => handleImportFile(e.target.files?.[0])}
              />
            </div>
          </motion.div>

          {/* Right: Quick Examples */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Quick Examples</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Click to use these example campaigns
              </p>
            </div>

            <div className="space-y-4">
              {quickExamples.map((example, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  onClick={() => handleQuickExample(example.brief)}
                  disabled={isLoading}
                  className="w-full p-5 rounded-xl border border-border bg-card hover:bg-accent hover:border-emerald-500/30 transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                      <example.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h4 className="font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {example.title}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {example.brief}
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Feature Highlights */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 p-6 rounded-xl border border-border bg-card"
            >
              <h4 className="font-semibold text-foreground mb-4">What You'll Get:</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>
                  <span>AI-powered signal intelligence and prospect scoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>
                  <span>Decision engine for optimal channel and timing selection</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>
                  <span>Personalized outreach messages and LinkedIn content</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>
                  <span>Multi-channel automation across LinkedIn, Email, WhatsApp</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>
                  <span>Interactive relationship mapping and execution timeline</span>
                </li>
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// Wrap the component with Suspense boundary
export default function CampaignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    }>
      <CampaignPageContent />
    </Suspense>
  );
}
