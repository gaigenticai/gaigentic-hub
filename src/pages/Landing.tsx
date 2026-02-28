import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  Zap,
  Key,
  BarChart3,
  ArrowRight,
  Shield,
  Brain,
  Calendar,
} from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "Production-Grade Agents",
    desc: "Battle-tested AI agents for underwriting, compliance, collections, credit, and more.",
  },
  {
    icon: Zap,
    title: "Try Before You Buy",
    desc: "Test any agent instantly in our playground with sample data. No credit card needed.",
  },
  {
    icon: Key,
    title: "14-Day API Keys",
    desc: "Generate API keys with one click. Integrate in minutes. No obligations.",
  },
  {
    icon: Brain,
    title: "RAG-Powered Intelligence",
    desc: "Agents backed by a growing knowledge base of fintech regulations and domain expertise.",
  },
  {
    icon: BarChart3,
    title: "Visual Dashboards",
    desc: "Get responses with charts, tables, and KPIs rendered in real-time. Not just text.",
  },
  {
    icon: Shield,
    title: "Bring Your Own Keys",
    desc: "Use Anthropic, OpenAI, or z.ai. Your API keys, your models, your control.",
  },
];

export default function Landing() {
  useEffect(() => {
    if (document.querySelector('script[src*="calendly"]')) return;
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 w-full bg-white border-b border-ink-100 z-50">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg font-bold font-headline tracking-tight">
              g<span className="text-[#E63226]">ai</span>gentic.ai
            </span>
            <span className="text-xs font-semibold font-headline text-ink-400 tracking-wide uppercase">agent hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/signup"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors duration-150 sm:block"
            >
              Browse Agents
            </Link>
            <a
              href="https://gaigentic.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors duration-150 sm:block"
            >
              gaigentic.ai
            </a>
            <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors duration-150 sm:block">
              Log In
            </Link>
            <Link to="/signup" className="btn-primary">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 sm:pt-36 sm:pb-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="tag mb-6 inline-flex">Fintech AI Agents &mdash; Production-Ready</span>
          <h1 className="text-4xl font-semibold tracking-tight text-ink-950 sm:text-5xl font-headline">
            AI agents that understand{" "}
            <span className="text-cta">financial services</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-ink-600 leading-relaxed">
            Browse, test, and integrate production-grade AI agents for
            underwriting, compliance, collections, credit decisioning, and more.
            No obligations. 14-day free trial.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/signup"
              className="btn-primary px-6 py-3 text-base"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/signup"
              className="btn-secondary px-6 py-3 text-base"
            >
              Browse Agents
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-ink-100 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h4 className="text-center mb-10">Platform Capabilities</h4>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <div
                key={i}
                className="card"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-ink-50 text-ink-600">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-ink-900">
                  {feature.title}
                </h3>
                <p className="text-sm text-ink-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-ink-100 py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold text-ink-950 font-headline">
            Ready to integrate?
          </h2>
          <p className="mt-2 text-ink-600">
            Sign up in 30 seconds. No credit card. No obligations. Just AI
            agents that work.
          </p>
          <Link
            to="/signup"
            className="btn-primary mt-6 px-6 py-3 text-base"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Book a Call */}
      <section className="border-t border-ink-100 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h4 className="mb-3">
              <Calendar className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
              Book a Demo
            </h4>
            <h2 className="text-2xl font-semibold text-ink-950 font-headline">
              Let's talk about your use case
            </h2>
            <p className="mt-2 text-ink-600">
              Schedule a 30-minute call to discuss how our AI agents can fit into your workflow.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
            <div
              className="calendly-inline-widget"
              data-url="https://calendly.com/krishnagai"
              style={{ minWidth: "320px", height: "700px" }}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-100 py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-sm text-ink-500 sm:px-6">
          <span>GaiGentic AI Hub</span>
          <a href="https://gaigentic.ai" target="_blank" rel="noopener noreferrer" className="hover:text-ink-900 transition-colors duration-150">
            gaigentic.ai
          </a>
        </div>
      </footer>
    </div>
  );
}
