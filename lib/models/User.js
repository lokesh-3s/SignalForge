import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * Business Profile Schema (KYC Data)
 * This is embedded within the User document for efficient access
 */
const BusinessProfileSchema = new mongoose.Schema({
  // Section 1: Company & Business Context
  companyType: {
    type: String,
    enum: ['B2B (Business-to-Business)', 'B2C (Business-to-Consumer)', 'Mixed B2B / B2C'],
    required: true
  },
  companySize: {
    type: String,
    enum: ['1 to 10 employees', '11 to 50 employees', '51 to 200 employees', '201 to 1000 employees', '1000+ employees'],
    required: true
  },
  primaryOutreachObjective: {
    type: String,
    enum: ['Lead generation', 'Account-based sales (ABM)', 'Partnership development', 'Customer retention or upsell', 'Market research'],
    required: true
  },

  // Section 2: Target Accounts & Intent Signals
  targetOrganizations: {
    type: String,
    enum: ['Small and Medium Businesses (SMBs)', 'Mid-market companies', 'Enterprise organizations', 'All of the above'],
    required: true
  },
  relevantSignals: {
    type: [String],
    enum: ['Funding events', 'Hiring or expansion news', 'Product launches or technology shifts', 'LinkedIn activity', 'Market news or competitor movements'],
    required: true
  },
  personalizationLevel: {
    type: String,
    enum: ['High – Customized messaging for each prospect', 'Medium – Industry or role-based messaging', 'Low – Template-driven messaging'],
    required: true
  },

  // Section 3: Outreach Timing Preferences
  signalResponseTime: {
    type: String,
    enum: ['Immediately (within 24 hours)', 'Within 1 to 3 days', 'Within 4 to 7 days', 'Flexible or strategically timed'],
    required: true
  },

  // Section 4: Content & Authority Building
  usefulContentTypes: {
    type: [String],
    enum: ['Personalized outreach messages', 'LinkedIn profile optimization', 'Authority-building LinkedIn posts', 'Social content calendars', 'Blog or article drafts'],
    required: true
  },
  contentSuggestionFrequency: {
    type: String,
    enum: ['Daily', 'Weekly', 'Bi-weekly', 'Only when a high-intent opportunity is detected'],
    required: true
  },

  // Section 5: AI & Automation Preferences
  aiVoiceOutreachComfort: {
    type: String,
    enum: ['Very comfortable (full automation is acceptable)', 'Somewhat comfortable (prefer human review)', 'Only for simulation or testing'],
    required: true
  },
  aiExplanationDetail: {
    type: String,
    enum: ['Full reasoning (including signal analysis and logic trace)', 'Summary with top influencing factors', 'Minimal, action-focused output'],
    required: true
  },

  // Section 6: Product & Offering Details
  primaryOffering: {
    type: String,
    enum: ['SaaS Software', 'Recruitment Solutions', 'Cybersecurity Tools', 'Marketing Services', 'Consulting', 'Manufacturing', 'Logistics', 'Finance / FinTech', 'EdTech', 'Healthcare'],
    required: true
  },
  idealCustomer: {
    type: [String],
    enum: ['Startups', 'Small and Medium Businesses (SMEs)', 'Enterprise organizations', 'HR Teams', 'CTO or Technical Teams', 'Sales Teams', 'Operations Teams', 'Government Organizations'],
    required: true
  },
  outreachGoal: {
    type: String,
    enum: ['Lead generation', 'Product demo', 'Partnership', 'Hiring solution pitch', 'Vendor onboarding', 'Investment discussion'],
    required: true
  },
  salesCycleLength: {
    type: String,
    enum: ['Immediate (1 to 7 days)', 'Medium (1 to 3 weeks)', 'Long (1 to 3 months)'],
    required: true
  },
  valueProposition: {
    type: String,
    enum: ['Cost reduction', 'Automation', 'Growth enablement', 'Efficiency', 'Security', 'Compliance'],
    required: true
  },

  // Section 7: Platform Usage & Success Metrics
  successMetrics: {
    type: [String],
    enum: ['Response rate or engagement', 'Meetings scheduled', 'Qualified leads', 'Deal conversion', 'Influence or authority growth', 'Speed of outreach response'],
    required: true
  },
  aiExperimentationOpenness: {
    type: String,
    enum: ['Very open (testing multiple AI approaches)', 'Moderately open (minor adjustments allowed)', 'Conservative (prefer default strategies)'],
    required: true
  },
  platformUsers: {
    type: String,
    enum: ['1 to 5 users', '6 to 20 users', '21 to 50 users', 'More than 50 users'],
    required: true
  },

  // Verification status
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected'],
    default: 'Pending'
  },
  
  // Metadata
  completedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

/**
 * User Schema with Embedded KYC
 */
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return this.authProvider === 'credentials';
    }
  },
  authProvider: {
    type: String,
    enum: ['credentials', 'google'],
    default: 'credentials',
    required: true
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String
  },
  
  // KYC Data (Embedded)
  businessProfile: {
    type: BusinessProfileSchema,
    default: null
  },
  
  // Onboarding Status
  hasCompletedKYC: {
    type: Boolean,
    default: false
  },
  
  // Social Media Tokens
  socialTokens: {
    linkedin: {
      access_token: { type: String, select: false },
      expires_in: { type: Number, select: false },
      connected_at: { type: Date, select: false }
    },
    twitter: {
      access_token: { type: String, select: false },
      refresh_token: { type: String, select: false },
      expires_in: { type: Number, select: false },
      connected_at: { type: Date, select: false }
    }
  },
  
  // API Keys (Optional for future integrations)
  apiKeys: {
    gemini: { type: String, select: false },
    midjourney: { type: String, select: false },
    other: { type: Map, of: String, select: false }
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) {
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Force model recompilation - delete cached model if schema changes
if (mongoose.models.User) {
  delete mongoose.models.User;
  delete mongoose.connection.models.User;
}

// Export the model
export default mongoose.model('User', UserSchema);
