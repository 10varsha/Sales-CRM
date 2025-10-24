import { motion, Transition } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { SalesPipeline } from '@/components/dashboard/SalesPipeline';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { TopAgents } from '@/components/dashboard/TopAgents';
import { LeadsTrendChart } from '@/components/dashboard/LeadsTrendChart';
import { VisaStatusReport } from '@/components/dashboard/VisaStatusReport';
import { RevenueAttribution } from '@/components/dashboard/RevenueAttribution';

const Index = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const springTransition: Transition = {
    type: "spring",
    stiffness: 100
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: springTransition
    }
  };

  return (
    <DashboardLayout>
      <motion.div 
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header with Gradient */}
        <motion.div 
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8 text-white"
        >
          <div className="relative z-10">
            <h1 className="text-4xl font-bold tracking-tight">Dashboard Overview</h1>
            <p className="mt-2 text-blue-100">
              Welcome back! Here's what's happening with your sales today.
            </p>
          </div>
          {/* Animated background blobs */}
          <motion.div
            className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          <motion.div
            className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              rotate: [0, -90, 0],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </motion.div>

        {/* Bento Grid Layout */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min"
          variants={containerVariants}
        >
          {/* Top Stats - Full Width */}
          <motion.div variants={itemVariants} className="md:col-span-12">
            <DashboardStats />
          </motion.div>

          {/* Visa Status Report - Large Left Card */}
          <motion.div variants={itemVariants} className="md:col-span-8 md:row-span-2">
            <VisaStatusReport />
          </motion.div>

          {/* Top Agents - Right Column */}
          <motion.div variants={itemVariants} className="md:col-span-4">
            <TopAgents />
          </motion.div>

          {/* Activity Feed - Right Column */}
          <motion.div variants={itemVariants} className="md:col-span-4">
            <ActivityFeed />
          </motion.div>

          {/* Revenue Attribution - Wide Card */}
          <motion.div variants={itemVariants} className="md:col-span-8">
            <RevenueAttribution />
          </motion.div>

          {/* Sales Pipeline - Medium Card */}
          <motion.div variants={itemVariants} className="md:col-span-4">
            <SalesPipeline />
          </motion.div>

          {/* Leads Trend - Wide Bottom */}
          <motion.div variants={itemVariants} className="md:col-span-12">
            <LeadsTrendChart />
          </motion.div>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
};

export default Index;
