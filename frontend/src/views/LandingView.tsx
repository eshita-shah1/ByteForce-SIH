import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Translation strings ─────────────────────────────────────────────── */
const T = {
  en: {
    badge: 'TerraScope · Mining Intelligence',
    heading1: 'Find the ground that',
    headingItalic: 'deserves',
    heading2: 'a closer look.',
    subtitle:
      'Transform layered geological context, historical drilling telemetry, and spatial evidence into high-confidence prospectivity signatures and actionable site operational insights.',
    card1Title: 'Manganese Prospectivity',
    card1Desc:
      'Identify and classify resource prospectivity at a selected target location using deep stratigraphic matching, spatial evidence overlays, and legacy survey data fusion.',
    card1Cta: 'Explore Prospectivity',
    card2Title: 'Mining Shortfall',
    card2Desc:
      'Estimate and mitigate production shortfall risks by synthesizing complex current pit conditions, haulage bottlenecks, and real-time local environment sensors.',
    card2Cta: 'Predict Shortfall',
    footer1: '© 2026 TerraScope Intelligence Platform. Specialized for geological mining operations.',
    footer2: 'FastAPI Model Service: v1.14',
    footer3: 'Balaghat Survey Dataset (MOIL/GSI)',
  },
  hi: {
    badge: 'टेरास्कोप · खनन बुद्धिमत्ता',
    heading1: 'वह भूमि खोजें जो',
    headingItalic: 'ध्यान',
    heading2: 'की पात्र है।',
    subtitle:
      'स्तरित भूवैज्ञानिक संदर्भ, ऐतिहासिक ड्रिलिंग टेलीमेट्री और स्थानिक साक्ष्य को उच्च-विश्वसनीयता वाले संभावना हस्ताक्षरों और कार्रवाई योग्य साइट परिचालन अंतर्दृष्टि में परिवर्तित करें।',
    card1Title: 'मैंगनीज संभावना',
    card1Desc:
      'गहरी स्तरशैली मिलान, स्थानिक साक्ष्य ओवरले और विरासत सर्वेक्षण डेटा संयोजन का उपयोग करके चयनित लक्ष्य स्थान पर संसाधन संभावना की पहचान और वर्गीकरण करें।',
    card1Cta: 'संभावना देखें',
    card2Title: 'उत्खनन कमी',
    card2Desc:
      'वर्तमान गड्ढे की स्थिति, परिवहन अड़चनों और रियल-टाइम पर्यावरण सेंसर को संश्लेषित करके उत्पादन कमी जोखिमों का अनुमान लगाएं और उन्हें कम करें।',
    card2Cta: 'कमी का अनुमान',
    footer1: '© 2026 टेरास्कोप इंटेलिजेंस प्लेटफ़ॉर्म। भूवैज्ञानिक खनन कार्यों के लिए विशेष।',
    footer2: 'FastAPI मॉडल सेवा: v1.14',
    footer3: 'बालाघाट सर्वेक्षण डेटासेट (MOIL/GSI)',
  },
} as const;

const HERO_SLIDES = [
  {
    image: '/images/hero-mine-aerial.jpg',
    caption: 'Aerial perspective of layered manganese open pit concession with haul road arteries and drainage sump.',
  },
  {
    image: '/images/hero-mine-truck.jpg',
    caption: 'Heavy haulage transport unit operating on gradient ramp within active extraction zone.',
  },
  {
    image: '/images/hero-mine-worker.jpg',
    caption: 'Field stratigrapher inspecting core samples and ore grade boundaries at the bench outcrop.',
  },
  {
    image: '/images/hero-mine-machinery.jpg',
    caption: 'Mechanical winch and deep core drill assembly deployed for structural telemetry logging.',
  },
];

export const LandingView: React.FC = () => {
  const { isLoggedIn, openLoginModal, setCurrentView, language } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const t = T[language];

  // Auto-play every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  // Critical routing gate logic
  const handleCardClick = (destination: 'prospectivity' | 'shortfall') => {
    if (isLoggedIn) {
      setCurrentView(destination);
    } else {
      openLoginModal(destination);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 1. Full-width Hero Carousel Section */}
      <div className="relative w-full h-[380px] sm:h-[440px] md:h-[480px] bg-slate-900 overflow-hidden select-none group">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <img
              src={HERO_SLIDES[currentSlide].image}
              alt={HERO_SLIDES[currentSlide].caption}
              className="w-full h-full object-cover object-center"
            />
            {/* Subtle contrast overlay to maintain clean industrial feel */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
          </motion.div>
        </AnimatePresence>

        {/* Carousel Navigation Chevron Arrows */}
        <button
          onClick={handlePrev}
          aria-label="Previous slide"
          className="absolute left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-brand-forest/80 hover:bg-brand-forest text-white border border-brand-mint-light/40 flex items-center justify-center shadow-lg backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
        >
          <ChevronLeft className="w-6 h-6 text-brand-mint-light" />
        </button>

        <button
          onClick={handleNext}
          aria-label="Next slide"
          className="absolute right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-brand-forest/80 hover:bg-brand-forest text-white border border-brand-mint-light/40 flex items-center justify-center shadow-lg backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
        >
          <ChevronRight className="w-6 h-6 text-brand-mint-light" />
        </button>

        {/* Slide Indicators / Dots */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-xs">
          {HERO_SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentSlide === idx ? 'w-6 bg-brand-mint-light' : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* 2. Content & Action Cards Section */}
      <main className="max-w-5xl mx-auto px-6 py-14 flex-1 flex flex-col items-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF7F0] border border-[#C5E9D5] text-[11px] font-semibold text-brand-forest tracking-wider uppercase mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>{t.badge}</span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 max-w-2xl leading-[1.18]">
          {t.heading1}{' '}
          <span className="font-serif italic font-normal text-brand-forest-light">{t.headingItalic}</span>{' '}
          {t.heading2}
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-sm sm:text-base text-slate-500 max-w-2xl leading-relaxed">
          {t.subtitle}
        </p>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-12 text-left">
          {/* Card 1: Manganese Prospectivity */}
          <div
            onClick={() => handleCardClick('prospectivity')}
            className="group relative bg-white rounded-xl border border-slate-200 p-8 shadow-subtle hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between cursor-pointer active:scale-[0.995]"
          >
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight group-hover:text-brand-forest transition-colors">
                {t.card1Title}
              </h3>
              <p className="mt-3 text-xs sm:text-sm text-slate-500 leading-relaxed">
                {t.card1Desc}
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-brand-forest group-hover:text-brand-forest-light">
              <span>{t.card1Cta}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Card 2: Mining Shortfall */}
          <div
            onClick={() => handleCardClick('shortfall')}
            className="group relative bg-white rounded-xl border border-slate-200 p-8 shadow-subtle hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between cursor-pointer active:scale-[0.995]"
          >
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight group-hover:text-brand-forest transition-colors">
                {t.card2Title}
              </h3>
              <p className="mt-3 text-xs sm:text-sm text-slate-500 leading-relaxed">
                {t.card2Desc}
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-brand-forest group-hover:text-brand-forest-light">
              <span>{t.card2Cta}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 px-6 bg-slate-50/50">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <div>{t.footer1}</div>
          <div className="flex items-center gap-4">
            <span className="text-slate-500">{t.footer2}</span>
            <span>·</span>
            <span className="text-slate-500">{t.footer3}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
