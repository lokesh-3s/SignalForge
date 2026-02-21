'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import StaggeredMenu from '@/components/StaggeredMenu';
import { Loader2, ChevronRight, ChevronLeft, CheckCircle2, Building2, DollarSign, Users, Target, Megaphone, Package, TrendingUp, FileCheck, Save, Upload, FileText, X } from 'lucide-react';

const kycSteps = [
  {
    id: 0,
    title: 'Document Upload',
    icon: Upload,
    description: 'Upload a document to auto-fill your information (optional)',
    questions: [] // Special step for document upload
  },
  {
    id: 1,
    title: 'Business Identity',
    icon: Building2,
    description: 'Tell us about your business structure',
    questions: [
      {
        name: 'businessType',
        label: 'What is your business type?',
        type: 'select',
        options: ['LLC', 'Sole Proprietorship', 'Partnership', 'Corporation', 'Other']
      },
      {
        name: 'industry',
        label: 'What industry are you in?',
        type: 'select',
        options: ['Retail', 'SaaS', 'E-commerce', 'Manufacturing', 'Services', 'Other']
      },
      {
        name: 'employeeCount',
        label: 'How many employees do you have?',
        type: 'select',
        options: ['1-10', '11-50', '51-200', '201-500', '500+']
      }
    ]
  },
  {
    id: 2,
    title: 'Financial Overview',
    icon: DollarSign,
    description: 'Help us understand your revenue model',
    questions: [
      {
        name: 'revenueTier',
        label: 'What is your annual revenue range?',
        type: 'select',
        options: ['<100K', '100K-500K', '500K-1M', '1M-5M', '5M+']
      },
      {
        name: 'businessModel',
        label: 'What is your business model?',
        type: 'select',
        options: ['Subscription', 'One-time Purchase', 'Hybrid', 'Freemium']
      },
      {
        name: 'averageOrderValue',
        label: 'What is your average order value?',
        type: 'select',
        options: ['<$50', '$50-$200', '$200-$500', '$500-$1000', '$1000+']
      }
    ]
  },
  {
    id: 3,
    title: 'Target Audience',
    icon: Users,
    description: 'Who are your customers?',
    questions: [
      {
        name: 'audienceDemographic',
        label: 'What demographics do you target?',
        type: 'multiselect',
        options: ['Gen Z', 'Millennials', 'Gen X', 'Baby Boomers', 'B2B']
      },
      {
        name: 'purchaseFrequency',
        label: 'How often do customers purchase?',
        type: 'select',
        options: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually']
      }
    ]
  },
  {
    id: 4,
    title: 'Marketing Strategy',
    icon: Megaphone,
    description: 'How do you reach customers?',
    questions: [
      {
        name: 'acquisitionChannels',
        label: 'What are your primary acquisition channels?',
        type: 'multiselect',
        options: ['Social Media', 'SEO', 'Paid Ads', 'Email', 'Referrals', 'Events', 'Direct']
      },
      {
        name: 'activePlatforms',
        label: 'Which platforms are you active on?',
        type: 'multiselect',
        options: ['Instagram', 'Facebook', 'LinkedIn', 'Twitter/X', 'TikTok', 'YouTube', 'Pinterest']
      }
    ]
  },
  {
    id: 5,
    title: 'Operations',
    icon: Package,
    description: 'Tell us about your product catalog',
    questions: [
      {
        name: 'skuCount',
        label: 'How many products/SKUs do you have?',
        type: 'select',
        options: ['1-10', '11-50', '51-200', '201-500', '500+']
      },
      {
        name: 'peakSeasonality',
        label: 'When are your peak seasons?',
        type: 'multiselect',
        options: ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)', 'Holiday Season', 'No Peak']
      }
    ]
  },
  {
    id: 6,
    title: 'Business Goals',
    icon: Target,
    description: 'What are you trying to achieve?',
    questions: [
      {
        name: 'primaryObjective',
        label: 'What is your primary objective?',
        type: 'select',
        options: ['Increase Sales', 'Brand Awareness', 'Customer Retention', 'Market Expansion', 'Lead Generation']
      },
      {
        name: 'painPoints',
        label: 'What are your biggest challenges?',
        type: 'multiselect',
        options: ['Low Conversion', 'High CAC', 'Poor Retention', 'Limited Budget', 'Lack of Analytics', 'Time Constraints']
      }
    ]
  },
  {
    id: 7,
    title: 'Verification',
    icon: FileCheck,
    description: 'Complete your business verification',
    questions: [
      {
        name: 'documentType',
        label: 'What document will you provide for verification?',
        type: 'select',
        options: ['Business License', 'Tax ID', 'Registration Certificate', 'Other']
      }
    ]
  }
];

export default function KYCOnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({});
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [menuBtnColor, setMenuBtnColor] = useState('#000000');
  
  // Document upload states
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionComplete, setExtractionComplete] = useState(false);

  // Load saved progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const response = await fetch('/api/kyc');
        if (response.ok) {
          const data = await response.json();
          if (data.businessProfile) {
            setFormData(data.businessProfile);
          }
        }
      } catch (error) {
        console.error('Error loading progress:', error);
      }
    };
    loadProgress();
  }, []);

  // Theme color update
  useEffect(() => {
    const updateColor = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setMenuBtnColor(isDark ? '#ffffff' : '#000000');
    };
    
    updateColor();
    
    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Redirect if KYC is already completed
    if (session?.user?.hasCompletedKYC) {
      router.push('/dashboard');
    }
  }, [session, router]);

  const currentStepData = kycSteps[currentStep];
  const totalSteps = kycSteps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleInputChange = (name, value, type) => {
    if (type === 'multiselect') {
      const currentValues = formData[name] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      setFormData({ ...formData, [name]: newValues });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    setError('');
  };

  const validateCurrentStep = () => {
    const currentQuestions = currentStepData.questions;
    for (const question of currentQuestions) {
      const value = formData[question.name];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        setError(`Please answer: ${question.label}`);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    // For step 0 (document upload), allow skipping without validation
    if (currentStep === 0) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(currentStep + 1);
      return;
    }

    if (!validateCurrentStep()) return;
    
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError('');
    }
  };

  const handleSaveProgress = async () => {
    setIsSaving(true);
    const toastId = toast.loading('Saving progress...');

    try {
      const response = await fetch('/api/kyc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save progress');
      }

      toast.success('Progress saved! You can continue later.', { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF or image file (JPG, PNG)');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadedFile(file);
    setIsExtracting(true);
    setError('');
    const toastId = toast.loading('Extracting information from your document...');

    try {
      const formDataObj = new FormData();
      formDataObj.append('file', file);

      const response = await fetch('/api/kyc/extract-document', {
        method: 'POST',
        body: formDataObj
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // In development, Next.js might return HTML error pages
        // Only log in development, don't show to user if OCR worked
        if (process.env.NODE_ENV === 'development') {
          console.warn('Non-JSON response received:', contentType);
          const text = await response.text();
          console.warn('Response body:', text.substring(0, 200));
        }
        throw new Error('Server error processing document. Please try again.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to extract document data');
      }

      // Merge extracted data with existing form data
      setFormData(prev => ({
        ...prev,
        ...data.extractedData
      }));

      setExtractionComplete(true);
      toast.success(data.message || 'Document processed successfully!', { id: toastId });
      
      // Auto-advance to next step after 2 seconds
      setTimeout(() => {
        handleNext();
      }, 2000);

    } catch (err) {
      toast.error(err.message, { id: toastId });
      setError(err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setExtractionComplete(false);
    setError('');
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError('');
    const toastId = toast.loading('Submitting your business information...');

    try {
      const response = await fetch('/api/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit KYC');
      }

      toast.success('Business verification completed!', { id: toastId });

      // Update session to reflect KYC completion
      await update({ hasCompletedKYC: true });

      // Small delay for better UX
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 800);
    } catch (err) {
      toast.error(err.message, { id: toastId });
      setError(err.message);
      setIsLoading(false);
    }
  };

  const isLastStep = currentStep === totalSteps - 1;
  const StepIcon = currentStepData.icon;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-50 via-emerald-50/30 to-teal-50 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950">
        {/* Animated gradient orbs */}
        <div className="absolute top-20 left-10 w-96 h-96 bg-emerald-500/20 dark:bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-teal-500/20 dark:bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
      </div>

      {/* Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <StaggeredMenu
            position="right"
            isFixed={true}
            logoUrl="/chain-forecast.svg"
            accentColor="#22c55e"
            colors={["#0f172a", "#111827", "#1f2937"]}
            menuButtonColor={menuBtnColor}
            openMenuButtonColor="#22c55e"
            items={[
              { label: "Home", link: "/", ariaLabel: "Go to Home" },
              { label: "Dashboard", link: "/dashboard", ariaLabel: "View Dashboard" },
              { label: "Profile", link: "/profile", ariaLabel: "View Profile" },
            ]}
          />
        </div>
      </div>

      <div className="relative min-h-screen p-4 flex items-center justify-center pt-24">
      <div className="w-full max-w-3xl">
        {/* Save Progress Button */}
        <div className="mb-4 flex justify-end">
          <Button
            onClick={handleSaveProgress}
            variant="outline"
            size="sm"
            disabled={isSaving}
            className="ivy-font"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Progress
              </>
            )}
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-foreground ivy-font">
              Step {currentStep + 1} of {totalSteps}
            </div>
            <div className="text-sm text-muted-foreground ivy-font">
              {Math.round(progress)}% Complete
            </div>
          </div>
          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-between mb-8 overflow-x-auto pb-4">
          {kycSteps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = completedSteps.has(index);
            const isCurrent = index === currentStep;
            
            return (
              <div key={step.id} className="flex flex-col items-center min-w-20">
                <div 
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-emerald-500/20 border-2 border-emerald-500 dark:bg-emerald-500/10' 
                      : isCurrent 
                        ? 'bg-emerald-500/20 border-2 border-emerald-500 dark:bg-emerald-500/10' 
                        : 'bg-muted/30 border-2 border-border'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Icon className={`w-6 h-6 ${
                      isCurrent 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : 'text-muted-foreground'
                    }`} />
                  )}
                </div>
                <div className={`text-xs mt-2 text-center ivy-font ${
                  isCurrent 
                    ? 'text-foreground font-medium' 
                    : 'text-muted-foreground'
                }`}>
                  {step.title}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Card */}
        <Card className="border-border/40 backdrop-blur-sm bg-card/50">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <StepIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400 ivy-font">
                Section {currentStep + 1}
              </Badge>
            </div>
            <CardTitle className="text-2xl text-foreground ivy-font">
              {currentStepData.title}
            </CardTitle>
            <CardDescription className="text-muted-foreground ivy-font">
              {currentStepData.description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg ivy-font">
                {error}
              </div>
            )}

            {/* Document Upload Step (Step 0) */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 rounded-full bg-emerald-500/10">
                      <Upload className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-foreground ivy-font mb-2">
                      Upload Your Business Document (Optional)
                    </h3>
                    <p className="text-muted-foreground ivy-font text-sm">
                      Upload a business license, GST invoice, registration certificate, or any official document. 
                      We'll automatically extract your business information using AI.
                    </p>
                  </div>
                </div>

                {!uploadedFile ? (
                  <div className="space-y-4">
                    <label 
                      htmlFor="document-upload"
                      className="block"
                    >
                      <div className="border-2 border-dashed border-border hover:border-emerald-500/50 rounded-lg p-8 text-center cursor-pointer transition-all duration-200 hover:bg-emerald-500/5">
                        <input
                          id="document-upload"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFileUpload}
                          className="hidden"
                          disabled={isExtracting}
                        />
                        <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-foreground font-medium ivy-font mb-1">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-sm text-muted-foreground ivy-font">
                          PDF, JPG, or PNG (Max 10MB)
                        </p>
                      </div>
                    </label>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground ivy-font">
                          or
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={handleNext}
                      variant="outline"
                      className="w-full ivy-font"
                    >
                      Skip and Enter Manually
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 border border-border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded bg-emerald-500/10">
                            <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground ivy-font">
                              {uploadedFile.name}
                            </p>
                            <p className="text-xs text-muted-foreground ivy-font">
                              {(uploadedFile.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                        {!isExtracting && !extractionComplete && (
                          <button
                            onClick={handleRemoveFile}
                            className="p-1 hover:bg-muted rounded transition-colors"
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isExtracting && (
                      <div className="flex items-center justify-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                        <p className="text-sm text-foreground ivy-font">
                          Extracting information from your document...
                        </p>
                      </div>
                    )}

                    {extractionComplete && (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          <p className="text-sm font-medium text-foreground ivy-font">
                            Document processed successfully!
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground ivy-font">
                          We've auto-filled the information we found. You can review and edit it in the next steps.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Regular Form Steps (Step 1+) */}
            {currentStep > 0 && currentStepData.questions.map((question) => (
              <div key={question.name} className="space-y-3">
                <Label className="text-foreground text-base ivy-font">
                  {question.label}
                </Label>
                
                {question.type === 'select' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {question.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleInputChange(question.name, option, 'select')}
                        className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ivy-font ${
                          formData[question.name] === option
                            ? 'border-emerald-500 bg-emerald-500/10 text-foreground'
                            : 'border-border bg-muted/30 text-muted-foreground hover:border-emerald-500/50 hover:bg-muted/50'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {question.type === 'multiselect' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {question.options.map((option) => {
                      const isSelected = (formData[question.name] || []).includes(option);
                      return (
                        <button
                          key={option}
                          onClick={() => handleInputChange(question.name, option, 'multiselect')}
                          className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ivy-font ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500/10 text-foreground'
                              : 'border-border bg-muted/30 text-muted-foreground hover:border-emerald-500/50 hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{option}</span>
                            {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-6">
              {currentStep > 0 && (
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 ivy-font"
                  disabled={isLoading}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              
              {!isLastStep ? (
                <Button
                  onClick={handleNext}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white ivy-font"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white ivy-font"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
