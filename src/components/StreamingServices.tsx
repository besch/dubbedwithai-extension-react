import React from "react";
import Marquee from "react-fast-marquee";
import { motion } from "framer-motion";
import { streamingServices } from "@/data/streamingServices";

const StreamingServices: React.FC = () => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  const ServiceCard = ({ name, url }: { name: string; url: string }) => (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      variants={item}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-1 px-2 py-0.5 m-0.5 rounded-lg bg-accent hover:bg-accent/80 transition-colors"
    >
      <span className="text-xs">{name}</span>
    </motion.a>
  );

  return (
    <motion.div initial="hidden" animate="show" variants={container}>
      <motion.p
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-base font-semibold mb-1"
      >
        Free video streaming services
      </motion.p>
      <Marquee gradient gradientColor="#111827" speed={40} pauseOnHover>
        <div className="flex">
          {[...streamingServices.moviesAndTV, ...streamingServices.anime].map(
            (service) => (
              <ServiceCard key={service.name} {...service} />
            )
          )}
        </div>
      </Marquee>
    </motion.div>
  );
};

export default StreamingServices;
