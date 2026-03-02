import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import {
  Bot,
  Zap,
  Key,
  BarChart3,
  ArrowRight,
  Shield,
  Brain,
  Calendar,
  Search,
  FileText,
  ShieldCheck,
  Loader2,
  CheckCircle,
  Database,
  Activity,
  Code
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

function InteractiveDemo() {
  const [step, setStep] = useState<number>(-1);
  const [running, setRunning] = useState(false);

  const THOUGHTS = [
    { text: "Connecting to internal transaction core...", icon: Database, color: "text-blue-500" },
    { text: "Extracted TX-9824 details. Amount: $12,500.", icon: Search, color: "text-ink-600" },
    { text: "Entity: 'Global Tech Supplies Ltd.' Checking sanction lists...", icon: ShieldCheck, color: "text-amber-500" },
    { text: "No OFAC matches found.", icon: CheckCircle, color: "text-signal-green" },
    { text: "Analyzing historical velocity and geolocation...", icon: Brain, color: "text-purple-500" },
    { text: "Velocity matches baseline. IP matches shipping address.", icon: CheckCircle, color: "text-signal-green" },
    { text: "Generating final risk report...", icon: FileText, color: "text-ink-600" }
  ];

  const runDemo = () => {
    if (running) return;
    setRunning(true);
    setStep(0);

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setStep(currentStep); // Update step here so we reach step 7

      if (currentStep >= THOUGHTS.length) {
        clearInterval(interval);
        setTimeout(() => {
          setRunning(false);
          setStep(-1);
        }, 8000);
      }
    }, 1200);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="mt-16 mx-auto max-w-4xl text-left"
    >
      <div className="rounded-xl border border-ink-200 bg-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden relative">
        {/* Mock Search Bar */}
        <div className="border-b border-ink-100 bg-ink-50 p-3 flex gap-3 items-center">
          <Bot className="h-5 w-5 text-cta" />
          <div className="flex-1 font-mono text-xs sm:text-sm text-ink-600 bg-white border border-ink-200 rounded-md px-3 py-1.5 flex items-center gap-2 cursor-text shadow-sm" onClick={runDemo}>
            <span className="text-cta font-semibold hidden sm:inline">User:</span>
            <span className="truncate">Analyze recent transaction #TX-9824 for fraud risk. Output JSON.</span>
            {!running && step === -1 && <motion.span animate={{ opacity: [0, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="h-4 w-1.5 bg-ink-400 inline-block align-middle ml-0.5" />}
          </div>
          <button onClick={runDemo} disabled={running} className="btn-primary !py-1.5 !px-3 sm:!px-4 text-xs sm:text-sm shrink-0 shadow-sm transition-all hover:shadow-premium-sm">
            {!running && step === -1 ? "Run Agent" : <Loader2 className="h-4 w-4 animate-spin" />}
          </button>
        </div>

        {/* Split View */}
        <div className="flex flex-col md:flex-row min-h-[340px]">
          {/* Left: Thoughts / Actions */}
          <div className="flex-1 border-b md:border-b-0 md:border-r border-ink-100 bg-ink-25/50 p-4 sm:p-5 flex flex-col gap-3 relative overflow-hidden">
            <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Activity className="h-3 w-3" /> Agent Execution Log
            </div>
            {step === -1 ? (
              <div className="absolute inset-0 flex items-center justify-center text-ink-400 text-sm flex-col gap-3">
                <Brain className="h-10 w-10 text-ink-300 opacity-50" />
                <span>Waiting for instruction...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pb-8">
                {THOUGHTS.map((t, i) => {
                  const isDone = step >= THOUGHTS.length;
                  const isActive = step === i;
                  const isPast = isDone ? false : step > i; // Light up all at the end
                  const isVisible = step >= i;
                  if (!isVisible) return null;

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex gap-3 text-sm transition-opacity duration-300 ${isPast ? 'opacity-50' : 'opacity-100'}`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isActive ? (
                          <Loader2 className="h-4 w-4 animate-spin text-cta" />
                        ) : (
                          <t.icon className={`h-4 w-4 ${t.color}`} />
                        )}
                      </div>
                      <span className={isActive ? "text-ink-900 font-medium leading-snug" : "text-ink-600 leading-snug"}>{t.text}</span>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right: Output / Structured Data */}
          <div className="flex-1 bg-[#0A0A0A] p-4 sm:p-5 text-white font-mono text-[11px] sm:text-xs overflow-hidden relative selection:bg-cta/30">
            <div className="text-[10px] font-semibold text-ink-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Code className="h-3 w-3" /> Structured Output
            </div>
            {step >= 1 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col justify-between">
                <pre className="text-gray-300 leading-relaxed whitespace-pre-wrap font-mono flex-1 mb-4 overflow-y-auto pr-2 custom-scrollbar">
                  {`{
  "`}<span className="text-blue-400">transaction_id</span>{`": "TX-9824",
  "`}<span className="text-blue-400">amount_usd</span>{`": 12500.00,
  "`}<span className="text-blue-400">entity</span>{`": {
    "`}<span className="text-blue-400">name</span>{`": "Global Tech Supplies Ltd."`}
                  {step >= 3 && (
                    <>
                      {`,\n    "`}<span className="text-blue-400">ofac_match</span>{`": `}<span className="text-orange-400">false</span>
                    </>
                  )}
                  {step >= 5 && (
                    <>
                      {`,\n    "`}<span className="text-blue-400">velocity_score</span>{`": 0.12`}
                      {`,\n    "`}<span className="text-blue-400">geo_match</span>{`": `}<span className="text-orange-400">true</span>
                    </>
                  )}
                  {step >= 6 ? (
                    <>
                      {`\n  },
  "`}<span className="text-blue-400">risk_assessment</span>{`": {
    "`}<span className="text-blue-400">level</span>{`": "`}<span className="text-emerald-400 font-bold">LOW</span>{`",
    "`}<span className="text-blue-400">score</span>{`": 12,
    "`}<span className="text-blue-400">recommendation</span>{`": "APPROVE"
  }`}
                    </>
                  ) : (
                    `\n  }`
                  )}
                  {`\n}`}
                </pre>
              </motion.div>
            ) : (
              <div className="text-ink-600 h-full flex items-center justify-center font-sans text-sm pb-10">
                Awaiting payload...
              </div>
            )}

            {/* Simulated Risk Report Overlay */}
            {step >= 7 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute inset-0 z-20 bg-ink-950/80 backdrop-blur-sm p-4 flex items-center justify-center"
              >
                <div className="bg-white text-ink-900 rounded-xl w-full max-w-[320px] shadow-premium-2xl overflow-hidden border border-ink-200 cursor-default" onClick={e => e.stopPropagation()}>
                  <div className="bg-signal-green-light px-4 py-3 border-b border-signal-green-light/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-signal-green" />
                      <span className="font-semibold text-signal-green-dark">Risk Approved</span>
                    </div>
                    <span className="bg-signal-green text-white text-[10px] font-bold px-2 py-0.5 rounded-full">SCORE: 12</span>
                  </div>
                  <div className="p-4 bg-white text-xs text-ink-700 font-sans space-y-3">
                    <div className="flex justify-between border-b border-ink-100 pb-2">
                      <span className="text-ink-500">Transaction</span>
                      <span className="font-mono text-ink-900">TX-9824</span>
                    </div>
                    <div className="flex justify-between border-b border-ink-100 pb-2">
                      <span className="text-ink-500">Amount</span>
                      <span className="font-semibold text-ink-900">$12,500.00</span>
                    </div>
                    <div className="pt-1">
                      <p className="font-medium text-ink-900 mb-1">Agent Summary:</p>
                      <p className="text-ink-600 leading-relaxed bg-ink-50 p-2 rounded-md border border-ink-100">
                        No OFAC hits found for Global Tech Supplies Ltd. Historical transaction velocity is within standard deviation. Proceed with clearing.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Landing() {
  useEffect(() => {
    if (document.querySelector('script[src*="calendly"]')) return;
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <PageTransition className="min-h-screen bg-[#FAFAFB]">
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
        <motion.div
          className="mx-auto max-w-3xl px-4 text-center sm:px-6 relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, staggerChildren: 0.1 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="mb-6 flex justify-center"
          >
            <span className="tag px-3 py-1.5 text-sm bg-white/80 border-white/50 shadow-premium-sm backdrop-blur-md">✨ Fintech AI Agents &mdash; Production-Ready</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-4xl font-semibold tracking-tight text-ink-950 sm:text-6xl font-headline leading-[1.1]"
          >
            AI agents that understand{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cta to-brand-red">financial services</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mx-auto mt-6 max-w-xl text-lg text-ink-600 leading-relaxed"
          >
            Browse, test, and integrate production-grade AI agents for
            underwriting, compliance, collections, credit decisioning, and more.
            No obligations. 14-day free trial.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link
              to="/signup"
              className="btn-primary px-8 py-3.5 text-base w-full sm:w-auto"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/signup"
              className="btn-secondary px-8 py-3.5 text-base w-full sm:w-auto"
            >
              Browse Agents
            </Link>
          </motion.div>

          <InteractiveDemo />
        </motion.div>
      </section>

      {/* Features */}
      <section className="border-t border-ink-100 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h4 className="text-center mb-10">Platform Capabilities</h4>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="card-interactive"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-ink-50/50 text-ink-600 backdrop-blur-sm shadow-premium-inset">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-ink-900">
                  {feature.title}
                </h3>
                <p className="text-sm text-ink-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
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
    </PageTransition>
  );
}
