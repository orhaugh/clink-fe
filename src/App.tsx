import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/layout/AppShell'
import { Overview } from '@/pages/Overview'
import { TaskManagers } from '@/pages/TaskManagers'
import { TaskManagerDetail } from '@/pages/TaskManagerDetail'
import { Jobs } from '@/pages/Jobs'
import { JobDetail } from '@/pages/JobDetail'
import { SubmitJob } from '@/pages/SubmitJob'
import { Logs } from '@/pages/Logs'
import { Metrics } from '@/pages/Metrics'
import { MetricsDashboards } from '@/pages/MetricsDashboards'
import { SqlWorkbench } from '@/pages/SqlWorkbench'
import { Connectors } from '@/pages/Connectors'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1500,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Overview />} />
              <Route path="/task-managers" element={<TaskManagers />} />
              <Route path="/task-managers/:id" element={<TaskManagerDetail />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/sql" element={<SqlWorkbench />} />
              <Route path="/connectors" element={<Connectors />} />
              <Route path="/submit" element={<SubmitJob />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/dashboards" element={<MetricsDashboards />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
