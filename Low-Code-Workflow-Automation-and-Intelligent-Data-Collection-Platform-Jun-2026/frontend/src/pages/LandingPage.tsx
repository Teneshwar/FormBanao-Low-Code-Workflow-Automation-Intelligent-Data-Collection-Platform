import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Globe2,
  Languages,
  LayoutGrid,
  Mail,
  MapPin,
  Menu,
  Phone,
  PlayCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

type AuthMode = 'login' | 'register'
type RoleType = 'admin' | 'user'

const featureCards = [
  {
    title: 'AI Form Builder',
    description: 'Describe your need and let Form Banao create polished forms instantly.',
    icon: Sparkles,
  },
  {
    title: 'Drag & Drop Canvas',
    description: 'Move fields, resize blocks, and craft beautiful experiences visually.',
    icon: LayoutGrid,
  },
  {
    title: 'Multi-Language Forms',
    description: 'Support global audiences with language switching and multilingual responses.',
    icon: Languages,
  },
  {
    title: 'Analytics Dashboard',
    description: 'Monitor views, completions, drop-offs, trends, and device insights.',
    icon: BarChart3,
  },
  {
    title: 'QR Code Sharing',
    description: 'Share forms offline and online with fast, frictionless access.',
    icon: QrCode,
  },
  {
    title: 'Form Scheduler',
    description: 'Publish now or schedule forms to open and close automatically.',
    icon: CalendarDays,
  },
  {
    title: 'Secure Data Handling',
    description: 'Role-based access, trusted workflows, and secure submissions for every use case.',
    icon: ShieldCheck,
  },
  {
    title: 'Export & Manage',
    description: 'Download CSVs, sort responses, and keep every submission organized.',
    icon: Zap,
  },
]

const useCases = [
  'Schools & Admissions',
  'University Surveys',
  'HR Recruitment',
  'Event Registrations',
  'NGO Volunteer Forms',
  'Healthcare Appointments',
  'Government Feedback',
  'Startup Lead Capture',
]

const steps = [
  'Register for your workspace',
  'Create your form with AI or builder tools',
  'Publish and share a link or QR code',
  'Collect responses automatically',
  'Review analytics and manage submissions',
]

const testimonials = [
  {
    quote: 'Form Banao helped us replace scattered spreadsheets with a polished form experience in just a weekend.',
    name: 'Ananya Sharma',
    role: 'Operations Lead, EduSphere',
  },
  {
    quote: 'The analytics and multilingual support made it easy for our teams to launch and monitor forms globally.',
    name: 'Rahul Verma',
    role: 'Program Manager, FutureCare',
  },
  {
    quote: 'It feels premium, fast, and simple. Our volunteer onboarding flow is now beautifully organized.',
    name: 'Sara Ahmed',
    role: 'Community Head, GreenBridge',
  },
]

const faqs = [
  { question: 'What is Form Banao?', answer: 'Form Banao is a modern form builder that lets you create, share, and manage forms for registrations, feedback, surveys, and more.' },
  { question: 'Who can use it?', answer: 'Admins can publish and manage forms, registered users can fill and track forms, and public visitors can submit forms through shared links.' },
  { question: 'Can I create multilingual forms?', answer: 'Yes. Form Banao supports multilingual forms and interface language switching for a wider audience.' },
  { question: 'Can I schedule forms?', answer: 'Absolutely. You can publish immediately or schedule forms to open and close automatically at future dates.' },
  { question: 'Can I export responses?', answer: 'Yes. Response data can be exported as CSV for reports, analysis, or sharing.' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, loading, login, register } = useAuth()
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  const [role, setRole] = useState<RoleType>('user')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    const saved = localStorage.getItem('app_theme')
    if (saved === 'dark') return 'dark'
    if (saved === 'light') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [openFaq, setOpenFaq] = useState(0)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, navigate, user])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      localStorage.setItem('app_theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('app_theme', 'light')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await login(loginForm.email, loginForm.password, role)
      toast.success('Welcome back! Redirecting to your dashboard.')
      navigate('/dashboard')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in right now.'
      if (message === 'EMAIL_NOT_VERIFIED') {
        toast.error('Please verify your email before signing in.')
      } else if (message === 'Admin account required') {
        toast.error('This email is not registered as an admin account.')
      } else {
        toast.error(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault()
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await register(registerForm.email, registerForm.password, registerForm.fullName, role)
      toast.success('Verification email sent. Please check your inbox or spam folder to continue.')
      setRegisterForm({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' })
      setAuthMode('login')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create your account right now.'
      if (message === 'VERIFICATION_SENT') {
        toast.success('Verification email sent. Please check your inbox to continue.')
        setAuthMode('login')
      } else {
        toast.error(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const stats = useMemo(
    () => [
      { value: '10K+', label: 'Forms created' },
      { value: '500K+', label: 'Responses collected' },
      { value: '99.9%', label: 'Uptime' },
      { value: '50+', label: 'Languages' },
    ],
    [],
  )

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.16),_transparent_26%),linear-gradient(135deg,_rgba(248,250,252,0.99),_rgba(241,245,249,0.95))] text-slate-900 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(129,140,248,0.14),_transparent_24%),linear-gradient(135deg,_#020617,_#0f172a)] dark:text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/40 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 text-white shadow-lg shadow-blue-500/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>Form Banao</span>
          </a>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            <a href="#home" className="transition hover:text-blue-600 dark:hover:text-blue-400">Home</a>
            <a href="#features" className="transition hover:text-blue-600 dark:hover:text-blue-400">Features</a>
            <a href="#about" className="transition hover:text-blue-600 dark:hover:text-blue-400">About</a>
            <a href="#how-it-works" className="transition hover:text-blue-600 dark:hover:text-blue-400">How It Works</a>
            <a href="#faq" className="transition hover:text-blue-600 dark:hover:text-blue-400">FAQ</a>
            <a href="#contact" className="transition hover:text-blue-600 dark:hover:text-blue-400">Contact</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="hidden rounded-full border border-slate-200 bg-white/80 p-2 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white sm:inline-flex dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? <Sparkles className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className="rounded-full bg-gradient-to-r from-blue-600 to-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5"
            >
              Get Started
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="rounded-full border border-slate-200 bg-white/80 p-2 text-slate-700 md:hidden dark:border-slate-700 dark:bg-slate-900/70"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <div className="border-t border-slate-200 bg-white/95 px-4 py-4 text-sm font-medium text-slate-700 shadow-sm md:hidden dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-200">
            <div className="flex flex-col gap-3">
              <a href="#home" onClick={() => setMobileOpen(false)}>Home</a>
              <a href="#features" onClick={() => setMobileOpen(false)}>Features</a>
              <a href="#about" onClick={() => setMobileOpen(false)}>About</a>
              <a href="#how-it-works" onClick={() => setMobileOpen(false)}>How It Works</a>
              <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
              <a href="#contact" onClick={() => setMobileOpen(false)}>Contact</a>
            </div>
          </div>
        ) : null}
      </header>

      <main id="top">
        <section id="home" className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-sm font-medium text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
              <Sparkles className="h-4 w-4" />
              AI-powered, multilingual, and built for modern teams
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Create powerful forms without the complexity.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">
              Form Banao helps schools, businesses, NGOs, and creators build smart forms in minutes, share them instantly, and understand every response in one beautiful workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-violet-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5"
              >
                Start Building Free <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#features" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-6 py-3 font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                <PlayCircle className="h-4 w-4" /> Watch Demo
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> No-code builder</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Live analytics</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> QR & link sharing</div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.08 }} className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-blue-500/20 via-violet-500/20 to-slate-200/40 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/80 p-4 shadow-[0_25px_80px_-20px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70">
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Studio overview</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Smart form workspace</h2>
                  </div>
                  <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">Live</div>
                </div>

                <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Builder</p>
                      <span className="rounded-full bg-blue-600/10 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-300">New</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className="h-2 w-3/4 rounded-full bg-gradient-to-r from-blue-500 to-violet-500" />
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className="h-2 w-1/2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Responses</p>
                          <p className="mt-1 text-lg font-semibold">2.4K</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Completion</p>
                          <p className="mt-1 text-lg font-semibold">84%</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <BarChart3 className="h-4 w-4 text-blue-600" /> Response Trends
                      </div>
                      <div className="mt-3 flex items-end gap-2">
                        {[40, 64, 52, 84, 76].map((height, index) => (
                          <div key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-blue-600 to-violet-500" style={{ height: `${height}px` }} />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <Languages className="h-4 w-4 text-violet-600" /> Multilingual
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {['EN', 'HI', 'BN', 'TA'].map((chip) => (
                          <span key={chip} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium dark:border-slate-800 dark:bg-slate-950">{chip}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200/70 bg-white/70 px-6 py-8 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/70">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Trusted by modern teams</p>
              <div className="flex flex-wrap gap-3">
                {['Schools', 'Businesses', 'NGOs', 'Colleges', 'Government', 'Startups'].map((name) => (
                  <div key={name} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} className="rounded-[2rem] border border-slate-200/70 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/70">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-600">About Form Banao</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">A simple way to create, publish, and understand forms.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                Form Banao allows teams to create custom forms, share them through links or QR codes, collect unlimited responses, and view everything in one clean dashboard with charts and analytics.
              </p>
              <div className="mt-8 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                {['Create custom forms', 'Publish them online', 'Share via link or QR code', 'Collect unlimited responses', 'View responses in one place', 'Use charts and statistics to understand submissions'].map((item) => (
                  <div key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {item}</div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} className="grid gap-4 md:grid-cols-3">
              {[
                { title: 'Admin', description: 'Create unlimited forms, view analytics, schedule publishing, and manage all submissions.' },
                { title: 'Registered User', description: 'Create an account, open shared forms, submit responses, and track your activity.' },
                { title: 'Public Visitor', description: 'Open a link or QR code, fill a form, and submit it instantly without signing up.' },
              ].map((card) => (
                <div key={card.title} className="rounded-[1.6rem] border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 text-white">
                    {card.title === 'Admin' ? <Users className="h-5 w-5" /> : card.title === 'Registered User' ? <Users className="h-5 w-5" /> : <Globe2 className="h-5 w-5" />}
                  </div>
                  <h3 className="text-lg font-semibold">{card.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{card.description}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-600">Features</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Everything you need to build better forms.</h2>
            <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">From AI generation to analytics and secure sharing, Form Banao combines everything modern teams expect in one elegant platform.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.article key={feature.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ delay: index * 0.03 }} className="rounded-[1.6rem] border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{feature.description}</p>
                </motion.article>
              )
            })}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} className="rounded-[2rem] border border-slate-200/70 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/70">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-600">How it works</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Launch your first form in just a few minutes.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">Whether you are collecting signups, feedback, or registrations, the process is fast, intuitive, and built to scale.</p>
              <div className="mt-8 space-y-4">
                {steps.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-500 text-sm font-semibold text-white">{index + 1}</div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{step}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} className="rounded-[2rem] border border-slate-200/70 bg-gradient-to-br from-blue-600/10 via-slate-50 to-violet-500/10 p-8 shadow-sm dark:border-slate-800 dark:from-blue-950/40 dark:to-violet-950/30">
              <div className="rounded-[1.7rem] border border-slate-200/70 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Dashboard preview</p>
                    <h3 className="mt-1 text-2xl font-semibold">Insights that keep moving</h3>
                  </div>
                  <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">+24.8%</div>
                </div>
                <div className="mt-8 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300">
                      <span>Total forms</span>
                      <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">184</span>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                      <p className="text-sm text-slate-500 dark:text-slate-400">Responses</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">14,289</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                      <p className="text-sm text-slate-500 dark:text-slate-400">Completion rate</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">87%</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300">
                      <span>Response trends</span>
                      <span>Weekly</span>
                    </div>
                    <div className="mt-4 flex items-end gap-2">
                      {[48, 68, 54, 82, 90].map((height, index) => (
                        <div key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-blue-600 to-violet-500" style={{ height: `${height}px` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-6 rounded-[2rem] border border-slate-200/70 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/70 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-600">Why choose Form Banao</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">Fast, intuitive, and premium from the first click.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: 'Responsive by default', description: 'Create and fill forms comfortably on desktop, tablet, and mobile.' },
                { title: 'AI-assisted workflows', description: 'Generate form structure with prompts and customize with ease.' },
                { title: 'Secure and scalable', description: 'Handle public, registered, and admin access with confidence.' },
                { title: 'Beautiful analytics', description: 'See views, completions, device types, and trends in a polished dashboard.' },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-600">Use cases</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Built for every kind of modern workflow.</h2>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {useCases.map((item) => (
              <div key={item} className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-6 rounded-[2rem] border border-slate-200/70 bg-gradient-to-br from-blue-600 to-violet-500 p-8 text-white shadow-[0_20px_60px_-20px_rgba(59,130,246,0.65)] md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-[1.3rem] border border-white/15 bg-white/10 p-5 text-center backdrop-blur-sm">
                <p className="text-3xl font-semibold">{stat.value}</p>
                <p className="mt-2 text-sm text-blue-50">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-600">Testimonials</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Loved by teams who value clarity and speed.</h2>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <motion.blockquote key={testimonial.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} className="rounded-[1.6rem] border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-base leading-8 text-slate-600 dark:text-slate-300">“{testimonial.quote}”</p>
                <div className="mt-6">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{testimonial.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{testimonial.role}</p>
                </div>
              </motion.blockquote>
            ))}
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-600">FAQ</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked questions.</h2>
          </div>
          <div className="mt-12 space-y-4">
            {faqs.map((faq, index) => (
              <div key={faq.question} className="rounded-[1.3rem] border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
                <button type="button" className="flex w-full items-center justify-between px-6 py-5 text-left" onClick={() => setOpenFaq(index === openFaq ? -1 : index)}>
                  <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{faq.question}</span>
                  <ChevronDown className={`h-5 w-5 transition ${index === openFaq ? 'rotate-180' : ''}`} />
                </button>
                {index === openFaq ? <p className="px-6 pb-6 text-sm leading-7 text-slate-600 dark:text-slate-300">{faq.answer}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-8 rounded-[2rem] border border-slate-200/70 bg-white/80 p-8 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-600">Contact</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Let’s build better forms together.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">Whether you are planning a launch, onboarding flow, or survey initiative, our team can help you get started quickly.</p>
              <div className="mt-8 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-blue-600" /> hello@formbanao.com</div>
                <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-blue-600" /> +91 98765 43210</div>
                <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-blue-600" /> 12, Digital Park, Bengaluru, India</div>
              </div>
            </div>
            <form className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70" onSubmit={(event) => { event.preventDefault(); toast.success('Thanks for reaching out. We will respond shortly.'); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  <span className="mb-2 block">Name</span>
                  <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" placeholder="Aarav Singh" />
                </label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  <span className="mb-2 block">Email</span>
                  <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" placeholder="you@example.com" />
                </label>
              </div>
              <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">
                <span className="mb-2 block">Subject</span>
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" placeholder="Tell us about your project" />
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">
                <span className="mb-2 block">Message</span>
                <textarea className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" placeholder="We want to run a multilingual form launch for our school community." />
              </label>
              <button type="submit" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-violet-500 px-5 py-3 font-semibold text-white transition hover:-translate-y-0.5">Send Message <ArrowRight className="h-4 w-4" /></button>
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 bg-white/70 py-12 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 text-sm text-slate-600 sm:px-6 lg:grid-cols-[1fr_0.7fr_0.7fr_0.7fr] lg:px-8 dark:text-slate-300">
          <div>
            <div className="flex items-center gap-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 text-white shadow-lg shadow-blue-500/20">
                <Sparkles className="h-5 w-5" />
              </span>
              Form Banao
            </div>
            <p className="mt-4 max-w-sm leading-8">Create professional forms, collect responses, and understand your audience from a beautiful all-in-one platform.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Quick links</h3>
            <ul className="mt-4 space-y-2">
              {['Home', 'Features', 'About', 'Contact', 'FAQ'].map((link) => (
                <li key={link}><a href={`#${link.toLowerCase()}`} className="transition hover:text-blue-600">{link}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Legal</h3>
            <ul className="mt-4 space-y-2">
              <li><a href="#" className="transition hover:text-blue-600">Privacy Policy</a></li>
              <li><a href="#" className="transition hover:text-blue-600">Terms & Conditions</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Social</h3>
            <div className="mt-4 flex gap-3">
              {['in', 'x', 'ig'].map((label) => (
                <a key={label} href="#" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{label}</a>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-2 border-t border-slate-200/70 px-4 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© 2026 Form Banao. All rights reserved.</p>
          <p>Built for modern form experiences.</p>
        </div>
      </footer>

      <AnimatePresence>
        {authMode ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} className="relative w-full max-w-lg sm:max-w-md md:max-w-lg rounded-[1.25rem] border border-slate-200/70 bg-white p-4 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 modal-panel auth-modal">
              <button type="button" onClick={() => setAuthMode(null)} className="absolute right-3 top-3 icon-btn border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Close authentication dialog">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-600">Access your workspace</p>
                  <h3 className="mt-2 text-2xl font-semibold">{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h3>
                </div>
                <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">{role === 'admin' ? 'Admin' : 'User'}</div>
              </div>
              <div className="mt-6 flex flex-col sm:flex-row rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                <button type="button" onClick={() => setAuthMode('login')} className={`flex-1 rounded-full px-4 py-3 sm:py-2 text-sm font-semibold ${authMode === 'login' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>Login</button>
                <button type="button" onClick={() => setAuthMode('register')} className={`flex-1 rounded-full mt-2 sm:mt-0 sm:ml-2 sm:py-2 px-4 py-3 text-sm font-semibold ${authMode === 'register' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>Register</button>
              </div>
              <div className="mt-6 flex flex-col sm:flex-row rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                <button type="button" onClick={() => setRole('admin')} className={`flex-1 rounded-full px-4 py-3 sm:py-2 text-sm font-semibold ${role === 'admin' ? 'bg-gradient-to-r from-blue-600 to-violet-500 text-white' : 'text-slate-600 dark:text-slate-300'}`}>Admin</button>
                <button type="button" onClick={() => setRole('user')} className={`flex-1 rounded-full mt-2 sm:mt-0 sm:ml-2 sm:py-2 px-4 py-3 text-sm font-semibold ${role === 'user' ? 'bg-gradient-to-r from-blue-600 to-violet-500 text-white' : 'text-slate-600 dark:text-slate-300'}`}>User</button>
              </div>

              {authMode === 'login' ? (
                <form className="mt-6 space-y-4" onSubmit={handleLogin}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    <span className="mb-2 block">Email</span>
                    <input type="email" required value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} className="auth-input" placeholder="you@example.com" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    <span className="mb-2 block">Password</span>
                    <input type="password" required value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} className="auth-input" placeholder="Enter password" />
                  </label>
                  <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <label className="flex items-center gap-2"><input type="checkbox" className="rounded border-slate-300" /> Remember me</label>
                    <a href="#" className="text-blue-600">Forgot password?</a>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="auth-button">
                    {isSubmitting ? 'Signing in...' : 'Login'}
                  </button>
                </form>
              ) : (
                <form className="mt-6 space-y-4" onSubmit={handleRegister}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    <span className="mb-2 block">Full name</span>
                    <input required value={registerForm.fullName} onChange={(event) => setRegisterForm({ ...registerForm, fullName: event.target.value })} className="auth-input" placeholder="Aarav Singh" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    <span className="mb-2 block">Email</span>
                    <input type="email" required value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })} className="auth-input" placeholder="you@example.com" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    <span className="mb-2 block">Mobile Number</span>
                    <input type="tel" value={registerForm.phone} onChange={(event) => setRegisterForm({ ...registerForm, phone: event.target.value })} className="auth-input" placeholder="+91 98765 43210" />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      <span className="mb-2 block">Password</span>
                      <input type="password" required value={registerForm.password} onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })} className="auth-input" placeholder="Create password" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      <span className="mb-2 block">Confirm Password</span>
                      <input type="password" required value={registerForm.confirmPassword} onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })} className="auth-input" placeholder="Confirm password" />
                    </label>
                  </div>
                  <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" required className="mt-1 rounded border-slate-300" />
                    <span>I agree to the terms and privacy policy.</span>
                  </label>
                  <button type="submit" disabled={isSubmitting} className="auth-button">
                    {isSubmitting ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
