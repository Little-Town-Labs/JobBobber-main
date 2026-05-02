import { Hero } from "@/components/marketing/hero"
import { HowItWorks } from "@/components/marketing/how-it-works"
import { Pricing } from "@/components/marketing/pricing"
import { DeveloperSection } from "@/components/marketing/developer-section"
import { Footer } from "@/components/marketing/footer"
import { SEEKER_PLANS, EMPLOYER_PLANS } from "@/components/marketing/pricing-data"

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <Pricing seekerPlans={SEEKER_PLANS} employerPlans={EMPLOYER_PLANS} />
      <DeveloperSection />
      <Footer />
    </main>
  )
}
