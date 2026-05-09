import React from "react";
import { motion } from "motion/react";
import { Star } from "lucide-react";

export const TestimonialsColumn = (props: {
  className?: string;
  testimonials: typeof testimonials;
  duration?: number;
}) => {
  return (
    <div className={props.className}>
      <motion.div
        animate={{
          translateY: "-50%",
        }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6 bg-background"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map(({ text, image, name, role }, i) => (
                <div className="p-10 rounded-3xl border shadow-lg shadow-primary/10 max-w-xs w-full bg-white relative" key={i}>
                  <div className="flex gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={16} fill="#FCD34D" color="#FCD34D" />
                    ))}
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed italic">"{text}"</div>
                  <div className="flex items-center gap-3 mt-6">
                    <img
                      width={44}
                      height={44}
                      src={image}
                      alt={name}
                      style={{ objectFit: 'cover' }}
                      className="h-11 w-11 rounded-full border-2 border-gray-100"
                    />
                    <div className="flex flex-col">
                      <div className="font-semibold text-gray-900 tracking-tight leading-5">{name}</div>
                      <div className="text-xs text-gray-500 font-medium mt-1 leading-4">{role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.div>
    </div>
  );
};

const testimonials = [
  {
    text: "Went from 441 to 481 CRS after the point simulator showed me that improving my IELTS writing by one band would gain me 40 points. Got my ITA two draws later.",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop",
    name: "Priya Sharma",
    role: "Granted PR via CEC — 6 months",
  },
  {
    text: "The letter auditor caught that my employment letter was missing 'hours per week' on company letterhead. My first application was refused for exactly this. Wish I had this tool a year ago.",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200&auto=format&fit=crop",
    name: "Omar Raza",
    role: "FSWP Applicant — Approved on 2nd try",
  },
  {
    text: "My consultant quoted $3,500 CAD. I used Mentor Visa for $49, submitted my own application, and got my ITA 3 months later. The document tracker alone was worth the price.",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=200&auto=format&fit=crop",
    name: "Sarah Chen",
    role: "CEC — Self-filed, no consultant",
  },
  {
    text: "I was claiming the wrong NOC code for 2 years on my Express Entry profile. The AI found the correct one in 30 seconds with a 94% confidence match. That code got me 50 extra CRS points under TEER 1.",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=200&auto=format&fit=crop",
    name: "Jordan Lee",
    role: "Systems Analyst — NOC 21211",
  },
  {
    text: "For $49, this is the cheapest insurance policy for your Express Entry application. The peace of mind knowing every document is IRCC-ready before you hit submit is worth ten times that.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop",
    name: "Fatima Al-Hassan",
    role: "Healthcare Worker — PR Granted",
  },
  {
    text: "I almost missed my WES deadline because I didn't know my degree evaluation would take 3 months. The document tracker flagged it with 90 days to spare. That one alert saved my entire application.",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=200&auto=format&fit=crop",
    name: "Raj Patel",
    role: "Software Engineer — FSWP Approved",
  },
];

const firstColumn = testimonials.slice(0, 2);
const secondColumn = testimonials.slice(2, 4);
const thirdColumn = testimonials.slice(4, 6);

export const Testimonials = () => {
  return (
    <section className="bg-background my-20 relative px-6 md:px-0">
      <div className="container z-10 mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-center max-w-[640px] mx-auto text-center"
        >
          {/* Metrics Bar */}
          <div className="flex gap-8 mb-8 flex-wrap justify-center">
            <div className="text-center">
              <div className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--primary-color)' }}>2,847+</div>
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Users</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-color)' }} />
            <div className="text-center">
              <div className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--primary-color)' }}>94%</div>
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Avg NOC Match</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-color)' }} />
            <div className="text-center">
              <div className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--primary-color)' }}>12</div>
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Mistakes Covered</div>
            </div>
          </div>

          <div className="flex justify-center mb-4">
            <div className="border border-indigo-100 bg-indigo-50 text-indigo-700 py-1.5 px-5 rounded-full text-sm font-semibold tracking-wide uppercase">Real Results</div>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 mt-2 leading-tight">
            Don't just take our word for it
          </h2>
          <p className="mt-5 text-gray-600 text-lg md:text-xl leading-relaxed">
            See how applicants are using Mentor Visa to avoid costly mistakes and get their PR faster.
          </p>
        </motion.div>

        <div 
          className="flex justify-center gap-6 mt-16 max-w-6xl mx-auto overflow-hidden"
          style={{
            maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
            maxHeight: "700px"
          }}
        >
          <TestimonialsColumn testimonials={firstColumn} duration={30} className="flex-1" />
          <TestimonialsColumn testimonials={secondColumn} duration={38} className="hidden md:block flex-1" />
          <TestimonialsColumn testimonials={thirdColumn} duration={25} className="hidden lg:block flex-1" />
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
