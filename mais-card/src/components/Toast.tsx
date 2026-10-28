import { AnimatePresence, motion } from 'framer-motion'

export function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute left-1/2 -translate-x-1/2 bottom-28 z-40 bg-ink text-white dark:bg-white dark:text-ink text-[13px] font-semibold px-4 py-2.5 rounded-full shadow-lg"
          role="status"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
