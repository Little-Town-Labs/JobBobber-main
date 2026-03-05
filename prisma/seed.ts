/**
 * Prisma seed script — creates development/preview fixture data.
 *
 * Record counts from data-model.md:
 *   JobSeeker × 5, SeekerSettings × 5
 *   Employer × 3, EmployerMember × 6 (2 per employer)
 *   JobPosting × 6 (2 per employer: 1 DRAFT + 1 ACTIVE), JobSettings × 6
 *   AgentConversation × 4, Match × 3, FeedbackInsights × 4
 *
 * Clerk IDs use placeholder values that correspond to test accounts in the
 * Clerk development instance. Never run in production (guarded below).
 *
 * Run: pnpm db:seed
 */

import {
  PrismaClient,
  ExperienceLevel,
  EmploymentType,
  LocationType,
  JobPostingStatus,
  JobUrgency,
  ConversationStatus,
  MatchConfidence,
  MatchPartyStatus,
  FeedbackUserType,
  TrendDirection,
  EmployerMemberRole,
} from "@prisma/client"

const db = new PrismaClient()

async function main() {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("Seed script must not run in production")
  }

  console.log("🌱 Seeding database…")

  // ------------------------------------------------------------------
  // Employers (3)
  // ------------------------------------------------------------------
  const [startupCo, midTechCo, enterpriseCo] = await Promise.all([
    db.employer.upsert({
      where: { clerkOrgId: "org_seed_01" },
      create: {
        clerkOrgId: "org_seed_01",
        name: "NovaSpark Labs",
        industry: "Technology",
        size: "1-50",
        description: "Fast-moving startup building AI tooling for developers.",
        culture: "Flat hierarchy, async-first, radical transparency.",
        headquarters: "San Francisco, CA",
        locations: ["San Francisco, CA", "Remote"],
        websiteUrl: "https://novaspark.example.com",
        benefits: ["Equity", "Unlimited PTO", "Remote-friendly"],
      },
      update: {},
    }),
    db.employer.upsert({
      where: { clerkOrgId: "org_seed_02" },
      create: {
        clerkOrgId: "org_seed_02",
        name: "Meridian Systems",
        industry: "SaaS / Enterprise Software",
        size: "51-500",
        description: "Mid-size B2B SaaS company focused on logistics automation.",
        culture: "Engineering-led, strong mentorship culture.",
        headquarters: "Austin, TX",
        locations: ["Austin, TX", "Chicago, IL", "Hybrid"],
        websiteUrl: "https://meridian.example.com",
        benefits: ["401k Match", "Health/Dental/Vision", "Annual Bonus"],
      },
      update: {},
    }),
    db.employer.upsert({
      where: { clerkOrgId: "org_seed_03" },
      create: {
        clerkOrgId: "org_seed_03",
        name: "Atlas Financial Group",
        industry: "FinTech",
        size: "501+",
        description: "Enterprise financial services platform serving Fortune 500 clients.",
        culture: "Process-oriented, compliance-conscious, career stability.",
        headquarters: "New York, NY",
        locations: ["New York, NY", "London, UK"],
        websiteUrl: "https://atlas.example.com",
        benefits: ["RSUs", "Comprehensive Benefits", "Education Reimbursement"],
      },
      update: {},
    }),
  ])

  // ------------------------------------------------------------------
  // Employer Members (6: 2 per employer)
  // ------------------------------------------------------------------
  await Promise.all([
    // NovaSpark Labs
    db.employerMember.upsert({
      where: { employerId_clerkUserId: { employerId: startupCo.id, clerkUserId: "user_seed_01" } },
      create: {
        employerId: startupCo.id,
        clerkUserId: "user_seed_01",
        role: EmployerMemberRole.ADMIN,
      },
      update: {},
    }),
    db.employerMember.upsert({
      where: { employerId_clerkUserId: { employerId: startupCo.id, clerkUserId: "user_seed_02" } },
      create: {
        employerId: startupCo.id,
        clerkUserId: "user_seed_02",
        role: EmployerMemberRole.JOB_POSTER,
      },
      update: {},
    }),
    // Meridian Systems
    db.employerMember.upsert({
      where: { employerId_clerkUserId: { employerId: midTechCo.id, clerkUserId: "user_seed_03" } },
      create: {
        employerId: midTechCo.id,
        clerkUserId: "user_seed_03",
        role: EmployerMemberRole.ADMIN,
      },
      update: {},
    }),
    db.employerMember.upsert({
      where: { employerId_clerkUserId: { employerId: midTechCo.id, clerkUserId: "user_seed_04" } },
      create: {
        employerId: midTechCo.id,
        clerkUserId: "user_seed_04",
        role: EmployerMemberRole.JOB_POSTER,
      },
      update: {},
    }),
    // Atlas Financial
    db.employerMember.upsert({
      where: {
        employerId_clerkUserId: { employerId: enterpriseCo.id, clerkUserId: "user_seed_05" },
      },
      create: {
        employerId: enterpriseCo.id,
        clerkUserId: "user_seed_05",
        role: EmployerMemberRole.ADMIN,
      },
      update: {},
    }),
    db.employerMember.upsert({
      where: {
        employerId_clerkUserId: { employerId: enterpriseCo.id, clerkUserId: "user_seed_06" },
      },
      create: {
        employerId: enterpriseCo.id,
        clerkUserId: "user_seed_06",
        role: EmployerMemberRole.JOB_POSTER,
      },
      update: {},
    }),
  ])

  // ------------------------------------------------------------------
  // Job Postings (6: 2 per employer — 1 DRAFT, 1 ACTIVE) + JobSettings
  // ------------------------------------------------------------------
  const [novaDraft, novaActive, meridianDraft, meridianActive, atlasDraft, atlasActive] =
    await Promise.all([
      db.jobPosting.upsert({
        where: { id: "seed_jp_01" },
        create: {
          id: "seed_jp_01",
          employerId: startupCo.id,
          title: "Senior Full-Stack Engineer",
          description: "Build the core AI development platform from scratch.",
          requiredSkills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
          preferredSkills: ["Rust", "AI/ML experience"],
          experienceLevel: ExperienceLevel.SENIOR,
          employmentType: EmploymentType.FULL_TIME,
          locationType: LocationType.REMOTE,
          salaryMin: 160000,
          salaryMax: 220000,
          status: JobPostingStatus.DRAFT,
        },
        update: {},
      }),
      db.jobPosting.upsert({
        where: { id: "seed_jp_02" },
        create: {
          id: "seed_jp_02",
          employerId: startupCo.id,
          title: "ML Infrastructure Engineer",
          description: "Design and operate the inference pipeline for LLM-based features.",
          requiredSkills: ["Python", "Kubernetes", "CUDA"],
          preferredSkills: ["PyTorch", "Triton"],
          experienceLevel: ExperienceLevel.MID,
          employmentType: EmploymentType.FULL_TIME,
          locationType: LocationType.REMOTE,
          salaryMin: 140000,
          salaryMax: 185000,
          status: JobPostingStatus.ACTIVE,
        },
        update: {},
      }),
      db.jobPosting.upsert({
        where: { id: "seed_jp_03" },
        create: {
          id: "seed_jp_03",
          employerId: midTechCo.id,
          title: "Backend Engineer — Logistics",
          description: "Expand the core logistics API serving 200+ enterprise clients.",
          requiredSkills: ["Java", "Spring Boot", "PostgreSQL", "Kafka"],
          preferredSkills: ["gRPC", "Terraform"],
          experienceLevel: ExperienceLevel.MID,
          employmentType: EmploymentType.FULL_TIME,
          locationType: LocationType.HYBRID,
          locationReq: "Austin, TX (hybrid 2 days/week)",
          salaryMin: 120000,
          salaryMax: 160000,
          status: JobPostingStatus.DRAFT,
        },
        update: {},
      }),
      db.jobPosting.upsert({
        where: { id: "seed_jp_04" },
        create: {
          id: "seed_jp_04",
          employerId: midTechCo.id,
          title: "Staff Engineer — Platform",
          description: "Lead technical architecture for the Meridian platform.",
          requiredSkills: ["System Design", "TypeScript", "Go", "AWS"],
          preferredSkills: ["eBPF", "OpenTelemetry"],
          experienceLevel: ExperienceLevel.SENIOR,
          employmentType: EmploymentType.FULL_TIME,
          locationType: LocationType.HYBRID,
          locationReq: "Austin, TX (hybrid 3 days/week)",
          salaryMin: 200000,
          salaryMax: 260000,
          status: JobPostingStatus.ACTIVE,
        },
        update: {},
      }),
      db.jobPosting.upsert({
        where: { id: "seed_jp_05" },
        create: {
          id: "seed_jp_05",
          employerId: enterpriseCo.id,
          title: "Junior Software Engineer",
          description: "Entry-level position on the payments platform team.",
          requiredSkills: ["Java", "SQL"],
          preferredSkills: ["Spring", "JUnit"],
          experienceLevel: ExperienceLevel.ENTRY,
          employmentType: EmploymentType.FULL_TIME,
          locationType: LocationType.ONSITE,
          locationReq: "New York, NY",
          salaryMin: 90000,
          salaryMax: 110000,
          status: JobPostingStatus.DRAFT,
        },
        update: {},
      }),
      db.jobPosting.upsert({
        where: { id: "seed_jp_06" },
        create: {
          id: "seed_jp_06",
          employerId: enterpriseCo.id,
          title: "VP of Engineering",
          description: "Executive leader for Atlas's 150-person global engineering org.",
          requiredSkills: ["Engineering Leadership", "Budget Management", "FinTech"],
          preferredSkills: ["Regulatory Compliance", "ISO 27001"],
          experienceLevel: ExperienceLevel.EXECUTIVE,
          employmentType: EmploymentType.FULL_TIME,
          locationType: LocationType.ONSITE,
          locationReq: "New York, NY",
          salaryMin: 350000,
          salaryMax: 500000,
          status: JobPostingStatus.ACTIVE,
        },
        update: {},
      }),
    ])

  // Job Settings (private, 1 per posting)
  await Promise.all([
    db.jobSettings.upsert({
      where: { jobPostingId: novaDraft.id },
      create: {
        jobPostingId: novaDraft.id,
        trueMaxSalary: 240000,
        urgency: JobUrgency.HIGH,
        priorityAttrs: ["AI experience", "OSS contributions"],
      },
      update: {},
    }),
    db.jobSettings.upsert({
      where: { jobPostingId: novaActive.id },
      create: {
        jobPostingId: novaActive.id,
        trueMaxSalary: 200000,
        urgency: JobUrgency.CRITICAL,
        priorityAttrs: ["CUDA expertise"],
      },
      update: {},
    }),
    db.jobSettings.upsert({
      where: { jobPostingId: meridianDraft.id },
      create: {
        jobPostingId: meridianDraft.id,
        trueMaxSalary: 170000,
        urgency: JobUrgency.MEDIUM,
        priorityAttrs: ["Kafka experience"],
      },
      update: {},
    }),
    db.jobSettings.upsert({
      where: { jobPostingId: meridianActive.id },
      create: {
        jobPostingId: meridianActive.id,
        trueMaxSalary: 280000,
        urgency: JobUrgency.HIGH,
        priorityAttrs: ["eBPF or kernel experience"],
      },
      update: {},
    }),
    db.jobSettings.upsert({
      where: { jobPostingId: atlasDraft.id },
      create: {
        jobPostingId: atlasDraft.id,
        trueMaxSalary: 115000,
        urgency: JobUrgency.LOW,
        priorityAttrs: ["Strong Java fundamentals"],
      },
      update: {},
    }),
    db.jobSettings.upsert({
      where: { jobPostingId: atlasActive.id },
      create: {
        jobPostingId: atlasActive.id,
        trueMaxSalary: 550000,
        urgency: JobUrgency.HIGH,
        priorityAttrs: ["FinTech regulatory experience", "Global org management"],
      },
      update: {},
    }),
  ])

  // ------------------------------------------------------------------
  // Job Seekers (5) + SeekerSettings
  // ------------------------------------------------------------------
  const [alice, bob, carol, dan, eve] = await Promise.all([
    db.jobSeeker.upsert({
      where: { clerkUserId: "user_seed_10" },
      create: {
        clerkUserId: "user_seed_10",
        name: "Alice Chen",
        headline: "Senior Full-Stack Engineer | React · TypeScript · Node.js",
        bio: "5 years building high-scale SaaS products. Love clean architecture and great DX.",
        skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS"],
        urls: ["https://github.com/alicechen"],
        location: "Seattle, WA",
        relocationPreference: "Open to remote",
        profileCompleteness: 0.9,
      },
      update: {},
    }),
    db.jobSeeker.upsert({
      where: { clerkUserId: "user_seed_11" },
      create: {
        clerkUserId: "user_seed_11",
        name: "Bob Okafor",
        headline: "ML Infrastructure Engineer | Python · Kubernetes · PyTorch",
        bio: "Ex-Google. Specialise in LLM inference at scale.",
        skills: ["Python", "Kubernetes", "CUDA", "PyTorch", "Triton", "C++"],
        urls: [],
        location: "Remote",
        profileCompleteness: 0.75,
      },
      update: {},
    }),
    db.jobSeeker.upsert({
      where: { clerkUserId: "user_seed_12" },
      create: {
        clerkUserId: "user_seed_12",
        name: "Carol Martinez",
        headline: "Backend Engineer | Java · Spring Boot · Kafka",
        bio: "Logistics and supply-chain domain expert. Austin-based.",
        skills: ["Java", "Spring Boot", "Kafka", "PostgreSQL", "Terraform"],
        urls: ["https://linkedin.com/in/carolmartinez"],
        location: "Austin, TX",
        profileCompleteness: 0.85,
      },
      update: {},
    }),
    db.jobSeeker.upsert({
      where: { clerkUserId: "user_seed_13" },
      create: {
        clerkUserId: "user_seed_13",
        name: "Dan Park",
        headline: "Entry-Level Software Engineer | Java · SQL · Spring",
        bio: "Recent CS graduate from NYU. Eager to grow in enterprise software.",
        skills: ["Java", "SQL", "Spring", "JUnit"],
        urls: [],
        location: "New York, NY",
        profileCompleteness: 0.6,
      },
      update: {},
    }),
    db.jobSeeker.upsert({
      where: { clerkUserId: "user_seed_14" },
      create: {
        clerkUserId: "user_seed_14",
        name: "Eve Nakamura",
        headline: "Engineering Leader | VP · Director | FinTech · Platform",
        bio: "20 years in FinTech. Led teams of 200+. Board-level communicator.",
        skills: [
          "Engineering Leadership",
          "Budget Management",
          "FinTech",
          "ISO 27001",
          "Go",
          "Java",
        ],
        urls: ["https://eve-nakamura.example.com"],
        location: "New York, NY",
        profileCompleteness: 0.95,
      },
      update: {},
    }),
  ])

  // Seeker Settings (private)
  await Promise.all([
    db.seekerSettings.upsert({
      where: { seekerId: alice.id },
      create: {
        seekerId: alice.id,
        minSalary: 150000,
        dealBreakers: ["No equity", "100% onsite"],
        priorities: ["Equity", "Remote-friendly", "AI/ML exposure"],
      },
      update: {},
    }),
    db.seekerSettings.upsert({
      where: { seekerId: bob.id },
      create: {
        seekerId: bob.id,
        minSalary: 140000,
        dealBreakers: ["No GPU access"],
        priorities: ["GPU cluster", "Research autonomy"],
      },
      update: {},
    }),
    db.seekerSettings.upsert({
      where: { seekerId: carol.id },
      create: {
        seekerId: carol.id,
        minSalary: 115000,
        dealBreakers: ["Fully remote only (wants hybrid)"],
        priorities: ["Hybrid schedule", "Austin-based team"],
      },
      update: {},
    }),
    db.seekerSettings.upsert({
      where: { seekerId: dan.id },
      create: {
        seekerId: dan.id,
        minSalary: 85000,
        dealBreakers: [],
        priorities: ["Mentorship", "Training budget", "Career growth"],
      },
      update: {},
    }),
    db.seekerSettings.upsert({
      where: { seekerId: eve.id },
      create: {
        seekerId: eve.id,
        minSalary: 350000,
        dealBreakers: ["Startup < Series B"],
        priorities: ["Equity upside", "Board exposure", "Compliance scope"],
      },
      update: {},
    }),
  ])

  // ------------------------------------------------------------------
  // Agent Conversations (4): 3 COMPLETED_MATCH, 1 IN_PROGRESS
  // ------------------------------------------------------------------
  const [conv1, conv2, conv3, _conv4] = await Promise.all([
    db.agentConversation.upsert({
      where: { id: "seed_conv_01" },
      create: {
        id: "seed_conv_01",
        jobPostingId: novaActive.id,
        seekerId: bob.id,
        status: ConversationStatus.COMPLETED_MATCH,
        completedAt: new Date("2026-01-15T10:00:00Z"),
        outcome: "Strong technical alignment on CUDA and PyTorch stack.",
        inngestRunId: "inngest_seed_01",
      },
      update: {},
    }),
    db.agentConversation.upsert({
      where: { id: "seed_conv_02" },
      create: {
        id: "seed_conv_02",
        jobPostingId: meridianActive.id,
        seekerId: carol.id,
        status: ConversationStatus.COMPLETED_MATCH,
        completedAt: new Date("2026-01-20T14:00:00Z"),
        outcome: "Kafka and logistics domain knowledge confirmed. Location compatible.",
        inngestRunId: "inngest_seed_02",
      },
      update: {},
    }),
    db.agentConversation.upsert({
      where: { id: "seed_conv_03" },
      create: {
        id: "seed_conv_03",
        jobPostingId: atlasActive.id,
        seekerId: eve.id,
        status: ConversationStatus.COMPLETED_MATCH,
        completedAt: new Date("2026-01-25T09:00:00Z"),
        outcome: "Executive alignment on scope, compensation band, and regulatory remit.",
        inngestRunId: "inngest_seed_03",
      },
      update: {},
    }),
    db.agentConversation.upsert({
      where: { id: "seed_conv_04" },
      create: {
        id: "seed_conv_04",
        jobPostingId: novaDraft.id,
        seekerId: alice.id,
        status: ConversationStatus.IN_PROGRESS,
        inngestRunId: "inngest_seed_04",
      },
      update: {},
    }),
  ])

  // ------------------------------------------------------------------
  // Matches (3): 1 mutual ACCEPTED, 1 PENDING both, 1 employer ACCEPTED
  // ------------------------------------------------------------------
  await Promise.all([
    db.match.upsert({
      where: { conversationId: conv1.id },
      create: {
        conversationId: conv1.id,
        jobPostingId: novaActive.id,
        seekerId: bob.id,
        employerId: startupCo.id,
        confidenceScore: MatchConfidence.STRONG,
        matchSummary:
          "Bob's CUDA and PyTorch expertise aligns perfectly with the inference pipeline role. Compensation band compatible.",
        seekerStatus: MatchPartyStatus.ACCEPTED,
        employerStatus: MatchPartyStatus.ACCEPTED,
        seekerContactInfo: { email: "bob@seed.example.com", phone: "+1-555-0101" },
        seekerAvailability: { earliestStart: "2026-03-01", timezone: "UTC" },
      },
      update: {},
    }),
    db.match.upsert({
      where: { conversationId: conv2.id },
      create: {
        conversationId: conv2.id,
        jobPostingId: meridianActive.id,
        seekerId: carol.id,
        employerId: midTechCo.id,
        confidenceScore: MatchConfidence.GOOD,
        matchSummary:
          "Carol's Kafka and logistics background is strong. Hybrid location confirmed.",
        seekerStatus: MatchPartyStatus.PENDING,
        employerStatus: MatchPartyStatus.ACCEPTED,
      },
      update: {},
    }),
    db.match.upsert({
      where: { conversationId: conv3.id },
      create: {
        conversationId: conv3.id,
        jobPostingId: atlasActive.id,
        seekerId: eve.id,
        employerId: enterpriseCo.id,
        confidenceScore: MatchConfidence.STRONG,
        matchSummary:
          "Eve's 20-year FinTech leadership record and ISO 27001 experience are exceptional matches.",
        seekerStatus: MatchPartyStatus.PENDING,
        employerStatus: MatchPartyStatus.PENDING,
      },
      update: {},
    }),
  ])

  // ------------------------------------------------------------------
  // FeedbackInsights (4: 3 seekers + 1 employer)
  // ------------------------------------------------------------------
  await Promise.all([
    db.feedbackInsights.upsert({
      where: { userId_userType: { userId: bob.id, userType: FeedbackUserType.JOB_SEEKER } },
      create: {
        userId: bob.id,
        userType: FeedbackUserType.JOB_SEEKER,
        strengths: ["Deep GPU expertise", "Strong Python fundamentals"],
        weaknesses: ["Limited frontend experience"],
        recommendations: ["Highlight inference latency wins", "Add system design examples"],
        totalConversations: 1,
        matchRate: 1.0,
        trendDirection: TrendDirection.IMPROVING,
      },
      update: {},
    }),
    db.feedbackInsights.upsert({
      where: { userId_userType: { userId: carol.id, userType: FeedbackUserType.JOB_SEEKER } },
      create: {
        userId: carol.id,
        userType: FeedbackUserType.JOB_SEEKER,
        strengths: ["Domain expertise in logistics", "Strong Kafka skills"],
        weaknesses: ["Limited cloud-native experience"],
        recommendations: ["Obtain AWS or GCP certification"],
        totalConversations: 1,
        matchRate: 1.0,
        trendDirection: TrendDirection.STABLE,
      },
      update: {},
    }),
    db.feedbackInsights.upsert({
      where: { userId_userType: { userId: eve.id, userType: FeedbackUserType.JOB_SEEKER } },
      create: {
        userId: eve.id,
        userType: FeedbackUserType.JOB_SEEKER,
        strengths: ["Executive presence", "Board-level communication", "Regulatory expertise"],
        weaknesses: [],
        recommendations: ["Be explicit about direct report count in negotiations"],
        totalConversations: 1,
        matchRate: 1.0,
        trendDirection: TrendDirection.IMPROVING,
      },
      update: {},
    }),
    db.feedbackInsights.upsert({
      where: { userId_userType: { userId: startupCo.id, userType: FeedbackUserType.EMPLOYER } },
      create: {
        userId: startupCo.id,
        userType: FeedbackUserType.EMPLOYER,
        strengths: ["Competitive equity packages", "Clear technical culture"],
        weaknesses: ["Compensation range too narrow for senior candidates"],
        recommendations: ["Expand salary bands for senior roles"],
        totalConversations: 2,
        inProgressCount: 1,
        matchRate: 0.5,
        trendDirection: TrendDirection.STABLE,
      },
      update: {},
    }),
  ])

  console.log("✅ Seed complete")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    void db.$disconnect()
  })
