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
  Sparkles,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 w-full bg-white border-b border-gray-200 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold font-headline tracking-tight">
              g<span className="text-[#E63226]">ai</span>gentic.ai
            </span>
            <span className="text-sm font-bold font-headline text-gray-400 tracking-wide">agent hub</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/agents"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 sm:block"
            >
              Browse Agents
            </Link>
            <a
              href="https://gaigentic.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 sm:block"
            >
              gaigentic.ai
            </a>
            <Link to="/signup" className="btn-primary">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
        {/* Decorative orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-200/40 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-200/40 rounded-full blur-3xl animate-float" style={{ animationDelay: "3s" }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:14px_24px]" />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-sm font-medium text-purple-700">
            <Sparkles className="h-4 w-4" />
            The App Store for Fintech AI
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-7xl font-headline">
            AI Agents that understand{" "}
            <span className="text-gradient">
              financial services
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 leading-relaxed">
            Browse, test, and integrate production-grade AI agents for
            underwriting, compliance, collections, credit decisioning, and more.
            No obligations. 14-day free trial.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              to="/signup"
              className="btn-primary px-8 py-4 text-base"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/agents"
              className="btn-secondary px-8 py-4 text-base"
            >
              Browse Agents
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-200 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-4xl font-bold text-gray-900 font-headline">
            Everything you need to build with AI
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
            From playground to production in minutes. Every agent is built with
            enterprise-grade prompt engineering, guardrails, and domain
            knowledge.
          </p>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <div
                key={i}
                className="card group"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 text-purple-600 group-hover:from-purple-600 group-hover:to-blue-600 group-hover:text-white transition-all duration-300">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 font-headline">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-3xl bg-gradient-to-r from-purple-600 to-blue-600 p-12 text-center shadow-2xl">
            <h2 className="text-3xl font-bold text-white font-headline">
              Ready to build smarter?
            </h2>
            <p className="mt-4 text-purple-100">
              Sign up in 30 seconds. No credit card. No obligations. Just AI
              agents that work.
            </p>
            <Link
              to="/signup"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-purple-700 shadow-lg transition-all hover:shadow-xl hover:scale-105"
            >
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Book a Call */}
      <section className="border-t border-gray-200 py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-sm font-medium text-purple-700">
              <Calendar className="h-4 w-4" />
              Book a Demo
            </div>
            <h2 className="text-3xl font-bold text-gray-900 font-headline">
              Let's talk about your use case
            </h2>
            <p className="mt-4 text-gray-600">
              Schedule a 30-minute call to discuss how our AI agents can fit into your workflow.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
            <div
              className="calendly-inline-widget"
              data-url="https://calendly.com/krishnagai"
              style={{ minWidth: "320px", height: "700px" }}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-sm text-gray-500 sm:px-6">
          <span>GaiGentic AI Hub</span>
          <a href="https://gaigentic.ai" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">
            gaigentic.ai
          </a>
        </div>
      </footer>
    </div>
  );
}
