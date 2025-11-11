import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Sun,
  Moon,
  Sparkles,
  Camera,
  Palette,
  Wand2,
  ChevronRight,
  Play,
  Shield,
  Zap,
  Users,
  Award,
  TrendingUp,
  Clock,
  Globe2,
  Rocket,
  Quote,
  Upload,
  Building2,
  Sofa,
  Image as ImageIcon,
  Star,
  BadgeCheck,
  Maximize2,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import packageJson from '../../package.json';

type BeforeAfterSliderProps = {
  beforeSrc: string;
  afterSrc: string;
  altBefore: string;
  altAfter: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
};

type ServiceShowcase = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  beforeSrc: string;
  afterSrc: string;
  altBefore: string;
  altAfter: string;
  bullets: string[];
  metric: { value: string; label: string };
  icon: LucideIcon;
  gradient: string;
  accent: string;
  beforeLabel?: string;
  afterLabel?: string;
};

type TrustSignal = {
  icon: LucideIcon;
  label: string;
  description: string;
};

type Highlight = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type WorkflowStep = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type Testimonial = {
  name: string;
  title: string;
  company: string;
  quote: string;
  result: string;
  rating: number;
};

type FAQItem = {
  question: string;
  answer: string;
};

type WhyChooseItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type RoleOutcome = {
  icon: LucideIcon;
  role: string;
  stat: string;
  description: string;
};

type SubscriptionOutcome = {
  icon: LucideIcon;
  value: string;
  label: string;
  description: string;
};

const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeSrc,
  afterSrc,
  altBefore,
  altAfter,
  beforeLabel = 'Before',
  afterLabel = 'After',
  className
}) => {
  const [position, setPosition] = useState(52);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState(52);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const activePointerIdRef = useRef<number | null>(null);
  const [isModalDragging, setIsModalDragging] = useState(false);

  const clamp = (value: number) => Math.max(0, Math.min(100, value));

  const updatePosition = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percentage = clamp((relativeX / rect.width) * 100);
    setPosition(percentage);
  };

  const updateModalPosition = (clientX: number) => {
    if (!modalContainerRef.current) return;
    const rect = modalContainerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percentage = clamp((relativeX / rect.width) * 100);
    setModalPosition(percentage);
  };

  const handleOpenModal = useCallback(() => {
    setModalPosition(position);
    setIsModalOpen(true);
  }, [position]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setPosition(modalPosition);
  }, [modalPosition]);

  useEffect(() => {
    if (!isModalOpen || typeof document === 'undefined') {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseModal();
      }
    };

    const targetWindow = typeof window !== 'undefined' ? window : null;
    targetWindow?.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      targetWindow?.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCloseModal, isModalOpen]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointerIdRef.current = event.pointerId;
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updatePosition(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId && !event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
    if (!isDragging) return;
    event.preventDefault();
    updatePosition(event.clientX);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current === event.pointerId) {
      setIsDragging(false);
      activePointerIdRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPosition(Number(event.target.value));
  };

  const handleModalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsModalDragging(true);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId) === false) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    updateModalPosition(event.clientX);
  };

  const handleModalPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isModalDragging && !event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
    updateModalPosition(event.clientX);
  };

  const handleModalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsModalDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleModalRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setModalPosition(Number(event.target.value));
    setIsModalDragging(false);
  };

  return (
    <>
      <div className={`relative overflow-hidden rounded-3xl bg-slate-950/90 ${className ?? ''}`}>
        <div
          ref={containerRef}
          className="relative h-full w-full cursor-ew-resize select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: 'pan-y' }}
        >
          <img
            src={afterSrc}
            alt={altAfter}
            className="absolute inset-0 h-full w-full object-cover brightness-[0.95]"
            loading="lazy"
          />

          <div
            className="absolute inset-0 h-full w-full overflow-hidden transition-[clip-path] duration-150 ease-out"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
            <img
              src={beforeSrc}
              alt={altBefore}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              loading="lazy"
            />
          </div>

          <span className="absolute left-4 top-4 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-lg backdrop-blur-md">
            {beforeLabel}
          </span>
          <span className="absolute right-4 top-4 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-lg backdrop-blur-md">
            {afterLabel}
          </span>

          <button
            type="button"
            onClick={handleOpenModal}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            className="absolute bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/80 text-white shadow-lg backdrop-blur transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900/30"
            aria-label="Open full-screen preview"
          >
            <Maximize2 className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white/80 shadow-[0_0_20px_rgba(15,23,42,0.35)] transition-opacity duration-150"
              style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
            >
              <div className="pointer-events-auto absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_8px_30px_rgba(15,23,42,0.4)] ring-2 ring-blue-500/40">
                <span aria-hidden className="text-xs font-semibold text-slate-700">
                  ⇆
                </span>
              </div>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={position}
            onChange={handleRangeChange}
            aria-label="Drag to see the transformation"
            className="before-after-slider absolute bottom-4 left-1/2 z-10 w-2/3 -translate-x-1/2 cursor-ew-resize appearance-none bg-transparent focus:outline-none focus-visible:outline-none"
          />

          <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-md sm:flex">
            Drag to see the transformation
          </div>
        </div>
      </div>
      {isModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 px-4 py-8 backdrop-blur"
            onClick={handleCloseModal}
          >
            <div
              className="relative w-full max-w-5xl rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleCloseModal}
                className="absolute right-6 top-6 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white shadow-lg backdrop-blur transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900/60"
                aria-label="Close full-screen preview"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="mb-6 pr-16">
                <h3 className="text-lg font-semibold text-white">
                  Full-screen transformation preview
                </h3>
                <p className="text-sm text-slate-200/80">
                  Drag the slider or use arrow keys to compare the original and enhanced results.
                </p>
              </div>

              <div
                ref={modalContainerRef}
                className="relative h-[60vh] min-h-[360px] w-full cursor-ew-resize select-none overflow-hidden rounded-3xl bg-slate-900/40"
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleModalPointerDown(event);
                }}
                onPointerMove={(event) => {
                  event.preventDefault();
                  handleModalPointerMove(event);
                }}
                onPointerUp={(event) => {
                  event.preventDefault();
                  handleModalPointerUp(event);
                }}
                onPointerCancel={handleModalPointerUp}
                onPointerLeave={handleModalPointerUp}
              >

                <img
                  src={afterSrc}
                  alt={altAfter}
                  className="h-full w-full object-contain"
                />
                <div
                  className="absolute inset-0 h-full w-full overflow-hidden transition-[clip-path] duration-150 ease-out"
                  style={{ clipPath: `inset(0 ${100 - modalPosition}% 0 0)` }}
                >
                  <img
                    src={beforeSrc}
                    alt={altBefore}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </div>

                <span className="absolute left-6 top-6 rounded-full bg-slate-900/80 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-white shadow-lg backdrop-blur">
                  {beforeLabel}
                </span>
                <span className="absolute right-6 top-6 rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-white shadow-lg backdrop-blur">
                  {afterLabel}
                </span>

                <div className="pointer-events-none absolute inset-0">
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-white/80 shadow-[0_0_30px_rgba(15,23,42,0.45)]"
                    style={{ left: `${modalPosition}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="absolute top-1/2 left-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_35px_rgba(15,23,42,0.45)]">
                      ⇆
                    </div>
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  value={modalPosition}
                  onChange={handleModalRangeChange}
                  aria-label="Drag to compare the transformation"
                  className="before-after-slider absolute bottom-6 left-1/2 z-20 w-1/2 -translate-x-1/2 cursor-ew-resize appearance-none bg-transparent focus:outline-none focus-visible:outline-none"
                />

                <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur">
                  Drag to compare • {Math.round(modalPosition)}% AI enhanced
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

const serviceShowcases: ServiceShowcase[] = [
  {
    id: 'interior-design',
    name: 'Interior Design',
    tagline: 'Stage every room virtually',
    description:
      'Fill empty spaces with on-trend furniture, lighting, and textures generated from curated design systems that convert browsers into showings.',
    beforeSrc: 'https://pub-b2fab8efcfed441092b0dc6d69b534a9.r2.dev/uploads/1762543751614_u45vjj_1761275559906_q0fxg6_IMG_4065.webp',
    afterSrc: 'https://pub-b2fab8efcfed441092b0dc6d69b534a9.r2.dev/processed/interior_design_undefined_processed_1762543763594_8ljmmu',
    altBefore: 'Empty dining room before staging',
    altAfter: 'Furnished dining room with modern decor',
    bullets: [
      'Design styles curated by top stagers',
      'Floor-aware furniture placement with correct shadows',
      'Generate multiple looks for each buyer persona'
    ],
    metric: { value: '+85%', label: 'more showing requests' },
    icon: Palette,
    gradient: 'from-purple-500 to-violet-600',
    accent: 'Interior Design',
    beforeLabel: 'Before',
    afterLabel: 'After'
  },
  {
    id: 'replace-elements',
    name: 'Replace Elements',
    tagline: 'Erase distractions, keep realism',
    description:
      'Remove clutter, swap finishes, and fix construction artifacts while preserving architectural accuracy and lighting continuity.',
    beforeSrc: 'https://pub-b2fab8efcfed441092b0dc6d69b534a9.r2.dev/uploads/1762879685600_wjch86_1761277140390_nleq3q_image-1761260228284.jpg',
    afterSrc: 'https://pub-b2fab8efcfed441092b0dc6d69b534a9.r2.dev/processed/1761277140390_nleq3q_image-1761260228284_replaced_processed_1762879695149_plkbm7.jpg',
    altBefore: 'Kitchen before unwanted elements are removed',
    altAfter: 'Kitchen after element replacement with clean surfaces',
    bullets: [
      'Mask-free removal with context-aware fill',
      'Swap cabinets, counters, and fixtures instantly',
      'True-to-life reflections and grain preservation'
    ],
    metric: { value: '98%', label: 'perceived realism score' },
    icon: Wand2,
    gradient: 'from-emerald-500 to-teal-500',
    accent: 'Replace Elements',
    beforeLabel: 'Before',
    afterLabel: 'After'
  },
  {
    id: 'add-furnitures',
    name: 'Add Furnitures',
    tagline: 'Turn empty units into aspirational homes',
    description:
      'Place designer-grade furniture, art, and accessories that highlight scale, flow, and lifestyle for every room size and layout.',
    beforeSrc: 'https://pub-b2fab8efcfed441092b0dc6d69b534a9.r2.dev/uploads/1762880195635_o416w1_image-1759341837469.jpg',
    afterSrc: 'https://pub-b2fab8efcfed441092b0dc6d69b534a9.r2.dev/processed/image-1759341837469_furnished_processed_1762880214867_fazzdm.jpg',
    altBefore: 'Unfurnished living room before virtual staging',
    altAfter: 'Living room staged with stylish furniture',
    bullets: [
      'Choose modern, transitional, or luxury collections',
      'Automatically matches flooring tones and wall colors',
      'Export print-quality images and 4K web assets'
    ],
    metric: { value: '4.9★', label: 'average buyer rating' },
    icon: Sofa,
    gradient: 'from-amber-500 to-orange-500',
    accent: 'Add Furnitures',
    beforeLabel: 'Before',
    afterLabel: 'After'
  },
  {
    id: 'exterior-design',
    name: 'Exterior Design',
    tagline: 'Refresh curb appeal from the sidewalk view',
    description:
      'Visualize landscaping, siding, and twilight conversions that help buyers picture life in the home before they ever visit.',
    beforeSrc: 'https://pub-b2fab8efcfed441092b0dc6d69b534a9.r2.dev/uploads/1761263932418_tpscv6_address-of-the-property-1-26-2048x1365.jpeg.webp',
    afterSrc: 'http://localhost:8000/outputs/exterior_1761263944911_6iirpwzgd.jpg',
    altBefore: 'Exterior home before AI enhancements',
    altAfter: 'Exterior home after landscaping and lighting enhancements',
    bullets: [
      'AI landscaping presets for every climate zone',
      'Golden-hour twilight renders with accurate shadows',
      'Siding and roof recolors that stay architectural'
    ],
    metric: { value: '+62%', label: 'more listing clicks' },
    icon: Building2,
    gradient: 'from-cyan-500 to-sky-500',
    accent: 'Exterior Design',
    beforeLabel: 'Before',
    afterLabel: 'After'
  },
  {
    id: 'enhance-images',
    name: 'Enhance Images',
    tagline: 'Correct lighting & color in seconds',
    description:
      'Transform raw shots into magazine-ready imagery using domain-trained AI built for real estate and interior design teams.',
    beforeSrc: 'https://pub-b2fab8efcfed441092b0dc6d69b534a9.r2.dev/uploads/1762879328372_pktlqe_IMG_5685.PNG',
    afterSrc: 'https://pub-b2fab8efcfed441092b0dc6d69b534a9.r2.dev/processed/IMG_5685_enhanced_processed_1762879343417_w0dmzz.png',
    altBefore: 'Dimly lit living room before enhancement',
    altAfter: '',
    bullets: [
      'AI tone mapping protects natural window views',
      'Batch process entire shoots with one click',
      'Portfolio-ready exports with horizon correction for property tours'
    ],
    metric: { value: '5× faster', label: 'than manual retouching' },
    icon: Camera,
    gradient: 'from-blue-500 to-indigo-500',
    accent: 'Enhance Images',
    beforeLabel: 'Before',
    afterLabel: 'After'
  },
];

const trustSignals: TrustSignal[] = [
  {
    icon: Shield,
    label: 'Enterprise-grade security',
    description: 'SOC2-ready infrastructure and private workspaces keep client photography locked down.'
  },
  {
    icon: Clock,
    label: 'Quick results in 12 seconds',
    description: 'Parallel render pipeline delivers staged and enhanced photos before your coffee cools.'
  },
  {
    icon: TrendingUp,
    label: '+72% more qualified leads',
    description: 'Listings featuring RealVision AI visuals outperform traditional photos across leading real estate marketplaces.'
  }
];

const featureHighlights: Highlight[] = [
  {
    icon: Camera,
    title: 'AI-optimized outputs',
    description: 'Automatic straightening, noise reduction, and AI model selection tuned for real estate deliver web + print assets instantly.'
  },
  {
    icon: Wand2,
    title: 'Intelligent scene editing',
    description: 'Granular controls for walls, floors, and fixtures with live previews and undo-safe edits.'
  },
  {
    icon: Globe2,
    title: 'Team-first workspace',
    description: 'Invite photographers, stagers, and coordinators with approval flows, version history, and comments.'
  }
];

const workflowSteps: WorkflowStep[] = [
  {
    icon: Upload,
    title: 'Upload your shoot',
    description: 'Drag & drop RAW, HDR, or smartphone photos. We auto-detect rooms and recommend best styles.'
  },
  {
    icon: Palette,
    title: 'Pick your transformation',
    description: 'Choose enhancement, staging, replacement, furnishing, or exterior presets tailored to your goals.'
  },
  {
    icon: CheckCircle,
    title: 'Approve in seconds',
    description: 'Fine-tune before/after sliders, lock favorites, and request instant variations if needed.'
  },
  {
    icon: TrendingUp,
    title: 'Publish & track',
    description: 'Export market-ready files, share galleries, and monitor engagement with built-in analytics powered by our real estate AI.'
  }
];

const testimonials: Testimonial[] = [
  {
    name: 'Caroline Vega',
    title: 'Top 1% Listing Agent',
    company: 'Compass Dallas',
    quote:
      'Our listings now launch with marketing assets in under an hour. RealVision AI staging consistently delivers the “wow” moment buyers expect.',
    result: 'Booked 3× more showings the first month',
    rating: 5
  },
  {
    name: 'Ashley Patel',
    title: 'Marketing Director',
    company: 'UrbanNest Developments',
    quote:
      'Exterior design previews helped us lock pre-sales faster. Buyers see the future community before the first brick is laid.',
    result: 'Secured 40% more pre-sales reservations',
    rating: 5
  },
  {
    name: 'Devon Hart',
    title: 'Director of Marketing Ops',
    company: 'Harbor & Key Realty',
    quote:
      'RealVision AI’s success team built our templates, trained every agent, and checks in weekly. Support is the reason we transitioned our entire photo program in two weeks.',
    result: 'Onboarded 12 agents and 4 photographers in the first week',
    rating: 4
  }
];

const faqs: FAQItem[] = [
  {
    question: 'How fast can I get enhanced and staged photos back?',
    answer:
      'Most projects finish in under three minutes thanks to our GPU render cluster. You will receive an email notification and can continue editing or requesting instant variations without waiting in a queue.'
  },
  {
    question: 'Do I need design or editing experience?',
    answer:
      'Not at all. RealVision AI was built alongside top photographers and stagers. You choose a goal, preview the before/after slider, and we handle the complex editing under the hood.'
  },
  {
    question: 'Can my team collaborate on the same project?',
    answer:
      'Yes. Invite unlimited teammates, set approvals, leave timestamped comments, and lock versions. Every action is tracked so you stay audit-ready for enterprise clients.'
  },
  {
    question: 'What makes RealVision AI models stand out?',
    answer:
      'Our AI stack blends diffusion, upscaling, and structure-aware models that are trained on real estate and interior design datasets, so your assets stay architecturally accurate while delivering polished, client-ready visuals every time.'
  }
];

const socialProofLogos = ['Compass', 'Keller Williams', 'Coldwell Banker', 'eXp Realty', 'Sotheby’s', 'RE/MAX'];

const heroCheckmarks = [
  'No credit card required to start',
  'Batch process entire photo sets with one click for quick client delivery',
  '5x faster than manual editing, giving you more time for creative work'
];

const whyChooseBullets: WhyChooseItem[] = [
  {
    icon: Sparkles,
    title: 'Specialized real estate AI',
    description: 'Domain-trained models respect architecture, layout, and decor styles across residential and commercial spaces.'
  },
  {
    icon: Shield,
    title: 'Guided onboarding & support',
    description: 'Dedicated success architects configure styles, workflows, and QA reviews so your team ships confidently on day one.'
  },
  {
    icon: Clock,
    title: '12-second production speed',
    description: 'Parallel rendering keeps photographers and marketers ahead of deadlines without sacrificing polish.'
  },
  {
    icon: Users,
    title: 'Built for cross-team collaboration',
    description: 'Invite agents, designers, and developers with approval flows, version history, and comments in a single workspace.'
  }
];

const successMetrics = [
  {
    label: 'Listings sell faster',
    value: '37%',
    description: 'average reduction in days-on-market',
    icon: TrendingUp
  },
  {
    label: 'Buyer engagement',
    value: '+124%',
    description: 'increase in gallery interactions',
    icon: Users
  },
  {
    label: 'Time saved per shoot',
    value: '3.4h',
    description: 'manual editing eliminated',
    icon: Clock
  }
];

const ctaHighlights = [
  'Kick off with 100 free credits across every AI transformation',
  'Unlimited before/after previews to showcase client-ready proofs',
  'Dedicated success architect onboarding your team in 48 hours'
];

const roleOutcomes: RoleOutcome[] = [
  {
    icon: TrendingUp,
    role: 'Realtors',
    stat: '3× more signed listings',
    description: 'Win seller trust with instant AI staging proofs and marketing decks tailored to each property.'
  },
  {
    icon: Users,
    role: 'Designers',
    stat: '60% quicker concept approvals',
    description: 'Prototype multiple interior looks in minutes and lock sourcing-ready mood boards with clients.'
  },
  {
    icon: Award,
    role: 'Agents',
    stat: '+45% premium package upsell',
    description: 'Bundle AI visuals with concierge services to increase commission opportunities and repeat referrals.'
  },
  {
    icon: Camera,
    role: 'Photographers',
    stat: '4h saved per shoot',
    description: 'Automate retouching, twilight conversions, and clutter removal so you can book more sessions weekly.'
  },
  {
    icon: Rocket,
    role: 'Developers',
    stat: '2× faster pre-sales velocity',
    description: 'Render future amenities and exterior transformations that accelerate investor buy-in and buyer reservations.'
  }
];

const subscriptionOutcomes: SubscriptionOutcome[] = [
  {
    icon: TrendingUp,
    value: '+28%',
    label: 'higher premium package attach rate',
    description: 'Convert more sellers to top-tier marketing plans with AI visuals that justify pricing.'
  },
  {
    icon: Users,
    value: '2.5×',
    label: 'increase in qualified prospect demos',
    description: 'Send interactive before/after links that turn curious leads into booked consultations.'
  },
  {
    icon: Shield,
    value: '-35%',
    label: 'reduction in churn across teams',
    description: 'Deliver consistent AI results with onboarding, governance, and success reviews baked into every plan.'
  }
];

const LandingPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [showAuth, setShowAuth] = useState(false);

  const { sendCode, signIn } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const pageTitle = 'RealVision AI | AI Real Estate Photo Enhancement & Virtual Staging';
    const description =
      'RealVision AI enhances property photos, stages interiors, replaces elements, adds furnitures, and refreshes exteriors with production-ready AI.';

    document.title = pageTitle;
    const existingMeta = document.querySelector('meta[name="description"]');

    if (existingMeta) {
      existingMeta.setAttribute('content', description);
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      meta.setAttribute('content', description);
      document.head.appendChild(meta);
    }
  }, []);

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      setMessage('Please enter a valid email address');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await sendCode(email);
      if (result.success) {
        setMessage(result.message);
        setMessageType('success');
        setStep('code');
      } else {
        setMessage(result.message);
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Failed to send code. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      setMessage('Please enter the 6-digit code');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await signIn(email, code);
      if (result.success) {
        setMessage(result.message);
        setMessageType('success');
        navigate('/dashboard');
      } else {
        setMessage(result.message);
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Authentication failed. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setCode('');
    setMessage('');
  };

  const scrollToAuth = () => {
    setShowAuth(true);
    requestAnimationFrame(() => {
      document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleAnchorNavigation = (anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const heroService = {
    id: 'enhance-images',
    name: 'Main highlight',
    tagline: 'Correct lighting & color in seconds',
    description:
      'Transform raw shots into magazine-ready imagery using domain-trained AI built for real estate and interior design teams.',
    beforeSrc: 'https://pub-b2fab8efcfed441092b0dc6d69b534a9.r2.dev/uploads/1761279323790_yh1571_1761275559906_q0fxg6_IMG_4065.webp',
    afterSrc: 'https://pub-b2fab8efcfed441092b0dc6d69b534a9.r2.dev/uploads/1761277455358_inxnid_image-1761260228284.jpg',
    altBefore: 'Dimly lit living room before enhancement',
    altAfter: '',
    bullets: [
      'AI tone mapping protects natural window views',
      'Batch process entire shoots with one click',
      'Portfolio-ready exports with horizon correction for property tours'
    ],
    metric: { value: '5× faster', label: 'than manual retouching' },
    icon: Camera,
    gradient: 'from-blue-500 to-indigo-500',
    accent: 'Main highlight'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 transition-colors duration-300 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-lg transition-colors duration-300 dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <img
              src={theme === 'dark' ? '/logo_white.png' : '/logo_black.png'}
              alt="RealVision AI"
              className="h-12 w-auto sm:h-14"
            />
          </div>
          <div className="hidden items-center space-x-6 text-sm font-medium text-slate-600 dark:text-slate-300 lg:flex">
            <button onClick={() => handleAnchorNavigation('features-section')} className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
              Features
            </button>
            <button onClick={() => handleAnchorNavigation('services-section')} className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
              Services
            </button>
            <button onClick={() => handleAnchorNavigation('showcase-section')} className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
              Before &amp; After
            </button>
            <button onClick={() => handleAnchorNavigation('testimonials-section')} className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
              Proof
            </button>
            <button onClick={() => handleAnchorNavigation('faq-section')} className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
              FAQ
            </button>
            <button onClick={() => navigate('/pricing')} className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
              Pricing
            </button>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="hidden items-center rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-600 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 sm:flex">
              Limited pricing
            </div>
            <button
              onClick={toggleTheme}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-all hover:border-blue-400 hover:text-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={scrollToAuth}
              className="flex items-center space-x-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/40 sm:px-6 sm:text-base"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      <main>
        <section className="px-4 pt-24 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:items-center">
              <div>
                <div className="inline-flex items-center space-x-2 rounded-full border border-blue-200/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 shadow-sm backdrop-blur dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200 sm:text-sm">
                  <Sparkles className="h-4 w-4" />
                  <span>AI-Powered Imagery for Real Estate & Design</span>
                </div>
                <h1 className="mt-6 text-3xl font-bold leading-tight text-slate-900 dark:text-white sm:text-5xl sm:leading-[1.05] lg:text-6xl">
                  Sell Homes 72% Faster with
                  <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {' '}AI-Enhanced Listings That Captivate Buyers
                  </span>
                </h1>
                <p className="mt-6 max-w-3xl text-base text-slate-600 dark:text-slate-300 sm:text-lg md:text-xl">
                  Tired of raw photos that don't impress clients or close deals? <b>RealVision AI</b> AI enhances images, stages interiors, replaces elements, adds furnitures, and refreshes exteriors. — all while preserving the original structure for authentic results. Transform your shots into professional visuals in 12 seconds, driving 85% more viewings and 62% more engagement.

                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {heroCheckmarks.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-200"
                    >
                      <BadgeCheck className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-8 rounded-3xl border border-blue-200/70 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-blue-500/30 dark:bg-slate-900/70">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Why teams choose RealVision AI
                  </h3>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {whyChooseBullets.map(({ icon: Icon, title, description }) => (
                      <li key={title} className="flex items-start gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-300">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
                  <button
                    onClick={scrollToAuth}
                    className="flex w-full items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/35 transition-all hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 sm:w-auto"
                  >
                    <span>Start Free Trial</span>
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/10 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                      <Star className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">FHD quality and ultra realistic results</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Validated real estate & design pros</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Only 12 seconds for full transformation</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">98% AI realism accuracy</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-tr from-blue-500/30 via-indigo-500/20 to-purple-500/30 blur-3xl"></div>
                <div className="rounded-3xl border border-white/40 bg-white/80 p-4 shadow-2xl backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70">
                  <BeforeAfterSlider
                    beforeSrc={heroService.beforeSrc}
                    afterSrc={heroService.afterSrc}
                    altBefore={heroService.altBefore}
                    altAfter={heroService.altAfter}
                    beforeLabel="Before"
                    afterLabel="After"
                    className="h-64 sm:h-72 md:h-80"
                  />
                  <div className="mt-5 grid  rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-slate-700 shadow dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wide text-blue-500 dark:text-blue-300">Stunning results in 12 seconds</span>
                      <span className="text-xl font-semibold text-slate-900 dark:text-white">Balanced lighting, preserved room and calibrated colors without manual masking.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features-section"
          aria-labelledby="features-title"
          className="px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                id="features-title"
                className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl"
              >
                Built to close more listings with less effort
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
                Every workflow is co-designed with photographers, stagers, and brokerage teams so you ship premium visuals without bottlenecks.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {featureHighlights.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30 transition group-hover:scale-105">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{description}</p>
                  <button
                    onClick={() => handleAnchorNavigation('showcase-section')}
                    className="mt-6 inline-flex items-center text-sm font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Explore transformations
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {trustSignals.map(({ icon: Icon, label, description }) => (
                <div
                  key={label}
                  className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h4 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{label}</h4>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="services-section"
          aria-labelledby="services-title"
          className="px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl space-y-16">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                id="services-title"
                className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl"
              >
                Five services, one seamless AI studio
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
                Give clients precise before &amp; after proof for every transformation. Mix and match services across an entire listing in minutes.
              </p>
            </div>

            <div id="showcase-section" className="space-y-16">
              {serviceShowcases.map(
                ({
                  id,
                  name,
                  tagline,
                  description,
                  beforeSrc,
                  afterSrc,
                  altBefore,
                  altAfter,
                  bullets,
                  metric,
                  icon: Icon,
                  gradient,
                  accent,
                  beforeLabel,
                  afterLabel
                }) => (
                  <article
                    key={id}
                    className="grid gap-10 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]"
                  >
                    <div className="flex flex-col justify-center space-y-5">
                      <div className="inline-flex items-center space-x-3">
                        <span
                          className={`inline-flex items-center space-x-2 rounded-full bg-gradient-to-r ${gradient} px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{accent}</span>
                        </span>
                      </div>
                      <h3 className="text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">{name}</h3>
                      <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                        {tagline}
                      </p>
                      <p className="text-base text-slate-600 dark:text-slate-300">{description}</p>
                      <ul className="grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                        {bullets.map((bullet) => (
                          <li key={bullet} className="flex items-center space-x-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-300">
                              <CheckCircle className="h-4 w-4" />
                            </div>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50 dark:text-slate-200">
                        <TrendingUp className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{metric.value}</span>
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {metric.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col space-y-4">
                      <BeforeAfterSlider
                        beforeSrc={beforeSrc}
                        afterSrc={afterSrc}
                        altBefore={altBefore}
                        altAfter={altAfter}
                        beforeLabel={beforeLabel}
                        afterLabel={afterLabel}
                        className="h-72 sm:h-80 md:h-[420px]"
                      />
                      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 sm:grid-cols-2">
                        <div className="flex items-center space-x-2">
                          <ImageIcon className="h-4 w-4 text-blue-500 dark:text-blue-300" />
                          <span>Interactive slider ready for listing presentations &amp; client pitches</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Shield className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                          <span>Reality anchored, and validated by human QA specialists</span>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <span className="inline-flex items-center space-x-2 rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Award className="h-4 w-4" />
                <span>Signature case study</span>
              </span>
              <h3 className="mt-6 text-3xl font-semibold text-slate-900 dark:text-white">
                Compass Dallas launched a seven-figure listing in 47 minutes
              </h3>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
                Caroline’s team replaced three vendors and now launches listings the same afternoon. RealVision AI gives sellers tangible before/after proof during the first appointment.
              </p>
              <ul className="mt-6 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-start space-x-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-300">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <span>Secured a seven-figure listing by presenting AI staging proofs live.</span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-300">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <span>Reduced post-production costs by 64% while increasing listing volume per photographer.</span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-300">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <span>Delivered before/after QR codes for buyer journeys and agent follow-ups.</span>
                </li>
              </ul>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {successMetrics.map(({ label, value, description, icon: Icon }) => (
                <div
                  key={label}
                  className="flex flex-col rounded-3xl border border-slate-200 bg-white/80 p-6 text-center shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">{value}</span>
                  <span className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {label}
                  </span>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
                Role-based results you can forecast
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
                Whether you sell, shoot, design, or build, RealVision AI subscriptions tie directly to KPIs that matter for each discipline.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {roleOutcomes.map(({ icon: Icon, role, stat, description }) => (
                <div
                  key={role}
                  className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{role}</h3>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                    {stat}
                  </p>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl rounded-3xl border border-emerald-200/70 bg-white/90 p-10 shadow-xl dark:border-emerald-500/30 dark:bg-slate-900/80">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
              <div>
                <span className="inline-flex items-center space-x-2 rounded-full bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <TrendingUp className="h-4 w-4" />
                  <span>AI tool outcomes</span>
                </span>
                <h2 className="mt-5 text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
                  Tool that grow revenue, not just image quality
                </h2>
                <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
                  Better images, faster production, and higher close rates. Wait for close rates, faster upsells, and steadier renewals once RealVision AI automates visual production across every listing and project.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {subscriptionOutcomes.map(({ icon: Icon, value, label, description }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/80"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {label}
                    </div>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl text-white">
            <div className="max-w-2xl">
              <span className="inline-flex items-center space-x-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-blue-200">
                <Sparkles className="h-4 w-4" />
                <span>Launch-ready workflow</span>
              </span>
              <h2 className="mt-6 text-3xl font-semibold sm:text-4xl">Four steps from raw photos to offers</h2>
              <p className="mt-4 text-base text-slate-300">
                Replace manual edits with a conversion-optimized pipeline. Every step was designed alongside brokerage marketing teams.
              </p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-4">
              {workflowSteps.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-6 transition-all hover:-translate-y-1 hover:border-white/20 hover:bg-white/10"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-blue-200">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-3 text-sm text-slate-200/80">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="testimonials-section"
          aria-labelledby="testimonials-title"
          className="px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2
                id="testimonials-title"
                className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl"
              >
                Social proof that wins skeptical clients
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
                Teams across brokerage, development, and marketing switched to RealVision AI to deliver jaw-dropping visuals at scale.
              </p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {testimonials.map(({ name, title, company, quote, result, rating }) => (
                <figure
                  key={name}
                  className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/80"
                >
                  <Quote className="h-8 w-8 text-blue-500" />
                  <blockquote className="mt-5 flex-1 text-sm text-slate-600 dark:text-slate-300">{quote}</blockquote>
                  <figcaption className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <div className="font-semibold text-slate-900 dark:text-white">{name}</div>
                    <div>
                      {title} · {company}
                    </div>
                    <div className="mt-2 flex items-center space-x-1 text-amber-400">
                      {Array.from({ length: rating }).map((_, index) => (
                        <Star key={index} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-400">
                      {result}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section
          id="faq-section"
          aria-labelledby="faq-title"
          className="px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2
                id="faq-title"
                className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl"
              >
                Answers for your launch team
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
                Still evaluating? Here are the questions real estate marketers, photographers, and developers ask before switching.
              </p>
            </div>
            <div className="mt-12 space-y-4">
              {faqs.map(({ question, answer }) => (
                <details
                  key={question}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                >
                  <summary className="flex cursor-pointer items-center justify-between text-left text-lg font-semibold text-slate-900 dark:text-white">
                    {question}
                    <ChevronRight className="h-5 w-5 text-blue-500 transition-transform duration-200 group-open:rotate-90" />
                  </summary>
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <section
        id="auth-section"
        className={`px-4 py-20 sm:px-6 lg:px-8 ${showAuth ? 'scroll-mt-32' : ''}`}
      >
        <div className="mx-auto max-w-md">
          <div className="mb-6 text-center sm:mb-8">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 sm:h-16 sm:w-16">
              <Mail className="h-6 w-6 text-white sm:h-8 sm:w-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              {step === 'email' ? 'Get Started Today' : 'Enter Code'}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {step === 'email'
                ? 'Enter your email to receive a secure login code.'
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          <div className={`space-y-6 rounded-2xl bg-white p-6 shadow-xl ring-offset-2 ring-offset-white transition dark:bg-slate-800 dark:shadow-2xl dark:ring-offset-slate-950 ${showAuth ? 'ring-2 ring-blue-500/60' : ''}`}>
            {step === 'email' ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700 dark:text-white"
                      placeholder="you@agency.com"
                      disabled={loading}
                    />
                  </div>
                </div>
                <button
                  onClick={handleSendCode}
                  disabled={loading || !email}
                  className="flex w-full items-center justify-center space-x-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-medium text-white transition-all hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                  ) : (
                    <>
                      <span>Send Code</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="code" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Verification Code
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      id="code"
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-center text-lg font-mono tracking-widest text-gray-900 transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700 dark:text-white"
                      placeholder="000000"
                      maxLength={6}
                      disabled={loading}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Enter the 6-digit code sent to your email.</p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleBackToEmail}
                    disabled={loading}
                    className="flex-1 rounded-lg border border-gray-300 py-3 text-gray-700 transition hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerifyCode}
                    disabled={loading || code.length !== 6}
                    className="flex flex-1 items-center justify-center space-x-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-3 font-medium text-white transition-all hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                    ) : (
                      <>
                        <span>Verify</span>
                        <CheckCircle className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {message && (
              <div className={`flex items-center space-x-3 rounded-lg p-4 ${messageType === 'success'
                ? 'border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200'
                : 'border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'
                }`}>
                {messageType === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-300" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-300" />
                )}
                <span className="text-sm font-medium">{message}</span>
              </div>
            )}
          </div>

          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>
              {step === 'email'
                ? "Don't have an account? Enter your email and we'll create one instantly."
                : "Didn't receive the code? Check spam or go back to resend."}
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-3xl border border-blue-200/70 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-10 text-white shadow-2xl dark:border-blue-500/40">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center space-x-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                <Rocket className="h-4 w-4" />
                <span>Founder launch offer</span>
              </span>
              <h2 className="mt-5 text-3xl font-bold sm:text-4xl">
                Ready to launch market-winning visuals?
              </h2>
              <p className="mt-3 text-base text-blue-100">
                Lock in lifetime pricing, onboard your team in under 48 hours, and start shipping AI-powered before/after assets that win every seller meeting.
              </p>
              <ul className="mt-6 grid gap-3 text-sm text-blue-100">
                {ctaHighlights.map((item) => (
                  <li key={item} className="flex items-center space-x-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={scrollToAuth}
                className="inline-flex items-center space-x-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-blue-600 shadow-lg shadow-blue-900/40 transition-all hover:-translate-y-0.5 hover:bg-blue-50"
              >
                Start now
                <ArrowRight className="h-5 w-5" />
              </button>
              <span className="text-xs uppercase tracking-wide text-blue-100/80">
                Sign up now and get 100 credits free
              </span>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 py-8 text-white dark:bg-slate-900 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 sm:gap-8">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="mb-4 flex items-center space-x-3">
                <img src="/logo_white.png" alt="RealVision AI" className="h-6 w-auto sm:h-8" />
                <span className="text-lg font-bold sm:text-xl">RealVision AI</span>
              </div>
              <p className="text-sm text-gray-400 sm:text-base">
                Transform your property photos with cutting-edge AI technology designed for modern real estate teams.
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-base font-semibold sm:text-lg">Product</h3>
              <ul className="space-y-2 text-sm text-gray-400 sm:text-base">
                <li><a href="#features-section" className="transition-colors hover:text-white">Features</a></li>
                <li><a href="#services-section" className="transition-colors hover:text-white">Solutions</a></li>
                <li><a href="#showcase-section" className="transition-colors hover:text-white">Before &amp; After</a></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-base font-semibold sm:text-lg">Company</h3>
              <ul className="space-y-2 text-sm text-gray-400 sm:text-base">
                <li><a href="mailto:contact@realvisionaire.com" className="transition-colors hover:text-white">Contact</a></li>
                <li><a href="#testimonials-section" className="transition-colors hover:text-white">Customers</a></li>
                <li><a href="#faq-section" className="transition-colors hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-base font-semibold sm:text-lg">Resources</h3>
              <ul className="space-y-2 text-sm text-gray-400 sm:text-base">
                <li><a href="#auth-section" className="transition-colors hover:text-white">Sign In</a></li>
                <li><a href="/privacy" className="transition-colors hover:text-white">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-6 border-t border-gray-800 pt-6 text-center text-sm text-gray-400 sm:mt-8 sm:pt-8 sm:text-base">
            <p>&copy; 2025 RealVision AI. All rights reserved.</p>
            <small className="mt-1 block text-xs text-gray-500">RealVision AI {packageJson.version}</small>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;


