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
    text: "The NOC Finder is frighteningly accurate. My consultant originally suggested a code that was completely wrong. This tool caught the mismatch and saved me an entire year of waiting.",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop",
    name: "Alisha Patel",
    role: "Granted PR (CEC)",
  },
  {
    text: "I was rejected for PR in 2024 because my employment letter lacked specific duty terms. I used the Auditor on my second try, and it instantly flagged 3 missing IRCC requirements. Approved in 6 months.",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200&auto=format&fit=crop",
    name: "Omar Raza",
    role: "FSW Applicant",
  },
  {
    text: "The Duty-by-Duty alignment sheet that the Auditor generates is amazing. I literally just included it with my Letter of Explanation and the IRCC officer approved it without any ADRs.",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=200&auto=format&fit=crop",
    name: "Saman Malik",
    role: "Software Engineer",
  },
  {
    text: "I was confused between three different IT NOC codes. The AI looked at my duties and found the exact match with a 92% confidence score. Everything it explained made perfect sense.",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=200&auto=format&fit=crop",
    name: "Jordan Lee",
    role: "Systems Analyst",
  },
  {
    text: "Don't submit your ITA without running your letters through this first. It caught that my HR lacked 'hours per week' on company letterhead—a mistake that would have cost me Everything.",
    image: "https://images.unsplash.com/photo-1619895862022-09114b41f16f?q=80&w=200&auto=format&fit=crop",
    name: "Zainab Hussain",
    role: "Healthcare Worker",
  },
  {
    text: "Better than relying on Facebook groups for NOC advice. It cross-references the official government database duty-by-duty. No hallucinations, just hard facts.",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop",
    name: "Emily Carter",
    role: "Marketing Manager",
  },
  {
    text: "Used the NOC Finder before I accepted my job offer to ensure the generic title wouldn't lock me out of TEER 2. This platform is a must-have for temporary foreign workers.",
    image: "https://images.unsplash.com/photo-1552058544-f2b08422138a?q=80&w=200&auto=format&fit=crop",
    name: "Farhan Siddiqui",
    role: "Graphic Designer",
  },
  {
    text: "For $4.90, this is the cheapest insurance policy for your Express Entry application. The peace of mind knowing my documents are IRCC compliant is priceless.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop",
    name: "Sarah Jenkins",
    role: "Retail Supervisor",
  },
  {
    text: "An absolute gamechanger. The AI flagged a risk with my 'dates of employment' format that my own immigration lawyer had completely overlooked.",
    image: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?q=80&w=200&auto=format&fit=crop",
    name: "Hassan Ali",
    role: "Granted PR (PNP)",
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);

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
          <div className="flex justify-center mb-4">
            <div className="border border-indigo-100 bg-indigo-50 text-indigo-700 py-1.5 px-5 rounded-full text-sm font-semibold tracking-wide uppercase">Real Success Stories</div>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 mt-2 leading-tight">
            Don't just take our word for it
          </h2>
          <p className="mt-5 text-gray-600 text-lg md:text-xl leading-relaxed">
            See how Mentor Visa has helped thousands of applicants secure their Canadian PR by avoiding critical NOC and document mistakes.
          </p>
        </motion.div>

        {/* 
          Note: We added Tailwind style inline polyfills for the grid mask and flex layouts 
          to ensure this looks stunning even if Tailwind utility classes aren't fully configured yet.
        */}
        <div 
          className="flex justify-center gap-6 mt-16 max-w-6xl mx-auto overflow-hidden"
          style={{
            maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
            maxHeight: "700px"
          }}
        >
          <TestimonialsColumn testimonials={firstColumn} duration={35} className="flex-1" />
          <TestimonialsColumn testimonials={secondColumn} duration={45} className="hidden md:block flex-1" />
          <TestimonialsColumn testimonials={thirdColumn} duration={40} className="hidden lg:block flex-1" />
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
